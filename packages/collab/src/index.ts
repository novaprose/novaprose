import { HocuspocusProvider } from '@hocuspocus/provider';
import {
  definePlugin,
  REMOTE_CHANGE_META,
  type CommentStore,
  type Editor,
  type NovaPlugin,
} from '@novaprose/core';
import {
  redoCommand,
  undoCommand,
  yCursorPlugin,
  ySyncPlugin,
  ySyncPluginKey,
  yUndoPlugin,
} from 'y-prosemirror';
import { Awareness } from 'y-protocols/awareness';
import * as Y from 'yjs';
import { yCommentStore } from './comments';
import { serverVersions, type ServerRequest, type VersionSource } from './versions';

/**
 * Real-time collaborative editing for NovaProse (Yjs, CRDT):
 * - the document syncs through a server (Hocuspocus-compatible, see apps/sync-server);
 * - other people's cursors and selections, with names;
 * - undo undoes only your own changes (Ctrl+Z never rolls back someone else's).
 *
 * ```ts
 * createEditor({
 *   element,
 *   plugins: [collab({ url: 'wss://sync.example.com', document: 'post-42', token, user: { name: 'Anna' } })],
 * });
 * ```
 */

export type CollabStatus = 'connecting' | 'connected' | 'disconnected';

export interface CollabUser {
  name: string;
  /** Cursor color (any CSS color). By default one from the palette, picked by name. */
  color?: string;
}

/** A participant of the document (from presence, "awareness"). */
export interface CollabParticipant {
  /** The Yjs client ID: one person in two tabs is two participants. */
  clientId: number;
  name: string;
  color: string;
  /** This is the current editor. */
  self: boolean;
}

export interface CollabOptions {
  /** Address of the sync server (wss://…). */
  url?: string;
  /** The document's ID on the server. */
  document?: string;
  /** A JWT from your backend (or a function that gets one): the server checks access to the document. */
  token?: string | (() => string) | (() => Promise<string>);
  /** Who is editing: the name and cursor color others see. */
  user?: CollabUser;
  /**
   * Your own Y.Doc and Awareness instead of the built-in connection (your own transport: WebRTC,
   * y-websocket, tests). url/document/token are then unused, and your code manages the connection.
   */
  ydoc?: Y.Doc;
  awareness?: Awareness;
  /** Name of the shared fragment in the Y.Doc ('prosemirror' by default). */
  field?: string;
  onStatus?: (status: CollabStatus) => void;
  /** The document has loaded from the server (first sync). */
  onSynced?: () => void;
  onAuthenticationFailed?: (reason: string) => void;
  /** The participants changed (someone joined, left or changed their name). Your own client comes first. */
  onUsers?: (users: CollabParticipant[]) => void;
}

const PALETTE = [
  '#2563eb',
  '#db2777',
  '#16a34a',
  '#ea580c',
  '#7c3aed',
  '#0891b2',
  '#ca8a04',
  '#dc2626',
];

/** A stable color for a name: one person gets the same color in every tab. */
export function colorFor(name: string): string {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return PALETTE[Math.abs(hash) % PALETTE.length]!;
}

/** Курсор участника: полоса и подпись с именем. Без innerHTML — имя приходит от других клиентов. */
function cursorBuilder(user: { name?: string; color?: string }): HTMLElement {
  const color =
    typeof user.color === 'string' && /^#[0-9a-f]{3,8}$/i.test(user.color) ? user.color : '#64748b';
  const caret = document.createElement('span');
  caret.className = 'nova-collab-caret';
  caret.style.borderColor = color;
  const label = document.createElement('span');
  label.className = 'nova-collab-label';
  label.style.backgroundColor = color;
  label.textContent = String(user.name ?? '').slice(0, 40) || '…';
  caret.append(label);
  return caret;
}

function selectionBuilder(user: { color?: string }) {
  const color =
    typeof user.color === 'string' && /^#[0-9a-f]{6}$/i.test(user.color) ? user.color : '#64748b';
  // Прозрачность через 8-значный hex: выделение видно, текст под ним читается.
  return { class: 'nova-collab-selection', style: `background-color: ${color}33;` };
}

const SAFE_COLOR = /^#[0-9a-f]{3,8}$/i;

function participants(awareness: Awareness): CollabParticipant[] {
  const list: CollabParticipant[] = [];
  awareness.getStates().forEach((state, clientId) => {
    const user = (state as { user?: { name?: unknown; color?: unknown } }).user;
    if (!user) return;
    const name = String(user.name ?? '').slice(0, 40) || '…';
    const color =
      typeof user.color === 'string' && SAFE_COLOR.test(user.color) ? user.color : '#64748b';
    list.push({ clientId, name, color, self: clientId === awareness.clientID });
  });
  return list.sort((a, b) => Number(b.self) - Number(a.self) || a.name.localeCompare(b.name));
}

interface Connection {
  ydoc: Y.Doc;
  awareness: Awareness;
  destroy(): void;
  /** Запросы к серверу (только при подключении к серверу синхронизации). */
  request?: ServerRequest;
}

/** Ответа на запрос к серверу ждём не дольше. */
const REQUEST_TIMEOUT = 15_000;

function connect(options: CollabOptions): Connection {
  if (options.ydoc) {
    const awareness = options.awareness ?? new Awareness(options.ydoc);
    return { ydoc: options.ydoc, awareness, destroy: () => {} };
  }
  if (!options.url || !options.document) {
    throw new Error('[nova] collab: pass url and document, or your own ydoc');
  }
  const ydoc = new Y.Doc();
  // Ответы сервера на запросы (история версий): по номеру запроса rid.
  const waiting = new Map<
    number,
    { resolve: (reply: Record<string, unknown>) => void; timer: ReturnType<typeof setTimeout> }
  >();
  let requestId = 0;
  const provider = new HocuspocusProvider({
    url: options.url,
    name: options.document,
    document: ydoc,
    ...(options.token !== undefined ? { token: options.token } : {}),
    onStatus: ({ status }) => options.onStatus?.(status as CollabStatus),
    onSynced: () => options.onSynced?.(),
    onAuthenticationFailed: ({ reason }) => options.onAuthenticationFailed?.(reason),
    onStateless: ({ payload }) => {
      let reply: Record<string, unknown>;
      try {
        reply = JSON.parse(payload) as Record<string, unknown>;
      } catch {
        return;
      }
      const entry = waiting.get(reply.rid as number);
      if (!entry) return;
      clearTimeout(entry.timer);
      waiting.delete(reply.rid as number);
      entry.resolve(reply);
    },
  });
  return {
    ydoc,
    awareness: provider.awareness!,
    request: (message) =>
      new Promise((resolve, reject) => {
        const id = ++requestId;
        const timer = setTimeout(() => {
          waiting.delete(id);
          reject(new Error('[nova] sync server did not answer'));
        }, REQUEST_TIMEOUT);
        waiting.set(id, { resolve, timer });
        provider.sendStateless(JSON.stringify({ ...message, rid: id }));
      }),
    destroy: () => {
      waiting.forEach(({ timer }) => clearTimeout(timer));
      waiting.clear();
      provider.destroy();
      ydoc.destroy();
    },
  };
}

/** The collaboration plugin; `setUser` changes your name and color for others without reconnecting. */
export type CollabPlugin = NovaPlugin & {
  setUser(user: CollabUser): void;
  /** Comments in the shared document, for `pluginOptions.comments.store` (the comments plugin). */
  commentStore(): CommentStore;
  /**
   * Version history from the sync server, for `pluginOptions.revisionhistory` (the revisionhistory
   * plugin). Only when connected by url (there are no versions with your own ydoc).
   */
  versions(): VersionSource;
};

/** The collaboration plugin. Passed as an object in `plugins` (not by name and not lazily). */
export function collab(options: CollabOptions): CollabPlugin {
  let connection: Connection | null = null;
  const get = () => (connection ??= connect(options));

  const publishUser = (user: CollabUser) =>
    get().awareness.setLocalStateField('user', {
      name: user.name,
      color: user.color ?? colorFor(user.name),
    });

  const plugin = definePlugin({
    name: 'collab',
    // Своя история: Ctrl+Z отменяет только свои правки, не чужие.
    replaceHistory: true,
    commands: { undo: undoCommand, redo: redoCommand },
    // Правки соавторов — не ввод этого пользователя: событие input для них не срабатывает.
    transformTransaction: (tr) =>
      (tr.getMeta(ySyncPluginKey) as { isChangeOrigin?: boolean } | undefined)?.isChangeOrigin
        ? tr.setMeta(REMOTE_CHANGE_META, true)
        : tr,
    prosemirrorPlugins: () => {
      const { ydoc, awareness } = get();
      const fragment = ydoc.getXmlFragment(options.field ?? 'prosemirror');
      return [
        // Представления y-prosemirror не готовы к пересозданию; ядро сохраняет их при догрузке
        // ленивых частей (см. plugin-views.ts в @novaprose/core).
        ySyncPlugin(fragment),
        yCursorPlugin(awareness, { cursorBuilder, selectionBuilder }),
        yUndoPlugin(),
      ];
    },
    setup(editor: Editor) {
      const { awareness } = get();
      if (options.user) publishUser(options.user);
      editor.root.classList.add('nova-collab');
      const reportUsers = () => options.onUsers?.(participants(awareness));
      awareness.on('change', reportUsers);
      reportUsers();
      return () => {
        awareness.off('change', reportUsers);
        editor.root.classList.remove('nova-collab');
        awareness.setLocalState(null);
        connection?.destroy();
        connection = null;
      };
    },
  });
  let comments: CommentStore | null = null;
  return Object.assign(plugin, {
    setUser: publishUser,
    commentStore: () => (comments ??= yCommentStore(get().ydoc)),
    versions: () => {
      // Текущее соединение (после destroy редактора его нет — новое не открываем).
      const request: ServerRequest = (message) => {
        const current = connection?.request;
        if (!current) {
          return Promise.reject(new Error('[nova] versions need a sync server (url + document)'));
        }
        return current(message);
      };
      return serverVersions(request, options.field ?? 'prosemirror');
    },
  });
}

export { Y, Awareness, yCommentStore, serverVersions };
export type { VersionSource, ServerRequest };
