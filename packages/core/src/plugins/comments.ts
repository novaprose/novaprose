import { icons } from '../ui/icons';
import type { Mark, Node as PMNode } from 'prosemirror-model';
import { Plugin, PluginKey, type EditorState } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';
import { keymap } from 'prosemirror-keymap';
import {
  COMMENT_ID_RE,
  COMMENT_MAX_LENGTH,
  COMMENT_NAME_MAX_LENGTH,
  createCommentStore,
  newCommentId,
  type Comment,
  type CommentAuthor,
  type CommentStore,
  type CommentThread,
} from '../comments';
import type { Editor } from '../editor';
import { definePlugin } from '../plugins';
import { findMentionUsers, type MentionUser, type MentionsOptions } from './mentions';
import { pickLabels } from './shared';

/**
 * Плагин comments: обсуждения фрагментов текста (как комментарии в Google Docs / Word).
 * `plugins: ['comments']`, настройки — `pluginOptions.comments` ({@link CommentsOptions}).
 * Кнопки (имена TinyMCE): `addcomment`, `showcomments`. Ctrl+Alt+M — комментировать выделение.
 *
 * Марка в схеме — поэтому плагин подключается сразу; панель обсуждений грузится лениво при открытии.
 */

export interface CommentsOptions {
  /** Кто комментирует. По умолчанию — «Гость». */
  author?: CommentAuthor;
  /** Хранилище веток. По умолчанию — в памяти, с `threads` и `onChange`. */
  store?: CommentStore;
  /** Сохранённые ранее ветки (для хранилища по умолчанию). */
  threads?: readonly CommentThread[];
  /** Ветки изменились — сохраните их (для хранилища по умолчанию). */
  onChange?: (threads: readonly CommentThread[]) => void;
  /** Можно ли менять и удалять комментарий. По умолчанию — только автору. */
  canEdit?: (comment: Comment, author: CommentAuthor) => boolean;
  /**
   * Поиск людей для «@» в комментариях. По умолчанию — `pluginOptions.mentions.fetch` (плагин mentions).
   */
  mentions?: MentionsOptions['fetch'];
  /** В новом комментарии кого-то упомянули — отправьте уведомление. */
  onMention?: (event: { threadId: string; comment: Comment; users: CommentAuthor[] }) => void;
}

export const LABELS = {
  en: {
    add: 'Add comment',
    show: 'Comments',
    panel: 'Comments',
    guest: 'Guest',
    newComment: 'New comment',
    placeholder: 'Add a comment…',
    replyPlaceholder: 'Reply…',
    comment: 'Comment',
    reply: 'Reply',
    cancel: 'Cancel',
    save: 'Save',
    edit: 'Edit',
    remove: 'Delete',
    resolve: 'Resolve',
    reopen: 'Reopen',
    deleteThread: 'Delete thread',
    close: 'Close comments',
    showResolved: 'Show resolved',
    resolvedBy: 'Resolved by {name}',
    orphan: 'The commented text was deleted',
    empty: 'No comments yet. Select text and press “Add comment” ({shortcut}).',
    people: 'People',
    noPeople: 'No matches',
    edited: 'edited',
    you: 'you',
    count: '{count} comments',
  },
};

export type CommentsLabels = typeof LABELS.en;

const ICON_ADD = icons.commentAdd;
const ICON_SHOW = icons.comments;

const SHORTCUT = 'Mod-Alt-m';

interface PluginState {
  /** Выделение, к которому пишется новый комментарий (ещё не сохранён — без марки в тексте). */
  pending: { from: number; to: number } | null;
  active: string | null;
}

type Meta = Partial<PluginState> & { refresh?: true };

export const commentsKey = new PluginKey<PluginState>('nova-comments');

/** Управление комментариями редактора — общий объект для плагина и ленивой панели. */
export interface CommentsController {
  readonly editor: Editor;
  readonly store: CommentStore;
  readonly author: CommentAuthor;
  readonly labels: CommentsLabels;
  readonly shortcut: string;
  pending(): PluginState['pending'];
  active(): string | null;
  setActive(id: string | null, scroll?: boolean): void;
  /** Начать комментарий к выделению: подсветить его и открыть панель с полем ввода. */
  startComment(): boolean;
  cancelPending(): void;
  /** Сохранить новый комментарий к отложенному выделению. Возвращает id ветки. */
  submitPending(text: string, mentions?: CommentAuthor[]): string | null;
  reply(threadId: string, text: string, mentions?: CommentAuthor[]): void;
  /** Поиск людей для «@» (null — источник не настроен, упоминания в комментариях выключены). */
  findUsers: ((query: string) => Promise<MentionUser[]>) | null;
  /** Фрагменты текста ветки (пусто — текст удалён). */
  ranges(id: string): { from: number; to: number }[];
  quote(id: string): string;
  /** Порядок веток по месту в документе. */
  positionOf(id: string): number;
  deleteThread(id: string): void;
  setResolved(id: string, resolved: boolean): void;
  canEdit(comment: Comment): boolean;
  isPanelOpen(): boolean;
  openPanel(): Promise<void>;
  closePanel(): void;
}

const controllers = new WeakMap<Editor, CommentsController>();

/** Контроллер комментариев редактора (если подключён плагин comments). */
export function getComments(editor: Editor): CommentsController | undefined {
  return controllers.get(editor);
}

/** Все фрагменты с комментариями: id → диапазоны. */
function collectRanges(doc: PMNode): Map<string, { from: number; to: number }[]> {
  const result = new Map<string, { from: number; to: number }[]>();
  doc.descendants((node, pos) => {
    if (!node.isInline) return;
    for (const mark of node.marks) {
      if (mark.type.name !== 'comment') continue;
      const id = mark.attrs.id as string;
      const list = result.get(id) ?? [];
      const last = list[list.length - 1];
      // Соседние текстовые узлы (другое форматирование) — один непрерывный фрагмент.
      if (last && last.to === pos) last.to = pos + node.nodeSize;
      else list.push({ from: pos, to: pos + node.nodeSize });
      result.set(id, list);
    }
  });
  return result;
}

function commentIdsAt(state: EditorState): string[] {
  const { $from, empty } = state.selection;
  const marks: readonly Mark[] = empty
    ? [...($from.nodeBefore?.marks ?? []), ...($from.nodeAfter?.marks ?? [])]
    : ($from.nodeAfter?.marks ?? []);
  return marks.filter((m) => m.type.name === 'comment').map((m) => m.attrs.id as string);
}

export default definePlugin({
  name: 'comments',
  toolbar: 'addcomment showcomments',
  marks: {
    comment: {
      attrs: { id: {} },
      // Ввод на границе фрагмента не расширяет его; разные обсуждения могут перекрываться.
      inclusive: false,
      excludes: '',
      parseDOM: [
        {
          tag: 'span[data-comment]',
          getAttrs: (dom) => {
            const id = (dom as HTMLElement).getAttribute('data-comment') ?? '';
            return COMMENT_ID_RE.test(id) ? { id } : false;
          },
        },
      ],
      toDOM: (mark) => [
        'span',
        { 'data-comment': COMMENT_ID_RE.test(mark.attrs.id as string) ? mark.attrs.id : null },
        0,
      ],
    },
  },

  prosemirrorPlugins: (editor) => {
    // Кэш подсветки: пересчитываем, только когда изменились документ, ветки или активная ветка.
    let cache: { doc: PMNode; threads: unknown; state: PluginState; set: DecorationSet } | null =
      null;
    return [
      keymap({
        [SHORTCUT]: () => getComments(editor)?.startComment() ?? false,
      }),
      new Plugin<PluginState>({
        key: commentsKey,
        state: {
          init: () => ({ pending: null, active: null }),
          apply(tr, value) {
            const meta = tr.getMeta(commentsKey) as Meta | undefined;
            let next = value;
            if (tr.docChanged && next.pending) {
              const from = tr.mapping.map(next.pending.from, 1);
              const to = tr.mapping.map(next.pending.to, -1);
              next = { ...next, pending: from < to ? { from, to } : null };
            }
            if (meta && ('pending' in meta || 'active' in meta)) next = { ...next, ...meta };
            return next;
          },
        },
        props: {
          decorations(state) {
            const controller = getComments(editor);
            const pluginState = commentsKey.getState(state)!;
            const threads = controller?.store.threads();
            if (
              cache &&
              cache.doc === state.doc &&
              cache.threads === threads &&
              cache.state === pluginState
            ) {
              return cache.set;
            }
            const open = new Set((threads ?? []).filter((t) => !t.resolved).map((t) => t.id));
            const decorations: Decoration[] = [];
            for (const [id, ranges] of collectRanges(state.doc)) {
              if (!open.has(id)) continue;
              const className =
                id === pluginState.active ? 'nova-comment is-active' : 'nova-comment';
              for (const { from, to } of ranges) {
                decorations.push(Decoration.inline(from, to, { class: className }));
              }
            }
            if (pluginState.pending) {
              const { from, to } = pluginState.pending;
              decorations.push(
                Decoration.inline(from, to, { class: 'nova-comment is-active is-pending' }),
              );
            }
            const set = DecorationSet.create(state.doc, decorations);
            cache = { doc: state.doc, threads, state: pluginState, set };
            return set;
          },
        },
        view: () => ({
          update(view, prev) {
            // Курсор зашёл в прокомментированный текст — показываем его обсуждение.
            // Только перемещение курсора (клик, стрелки): при наборе текста панель не навязываем.
            if (prev.selection.eq(view.state.selection) || prev.doc !== view.state.doc) return;
            const controller = getComments(editor);
            if (!controller || commentsKey.getState(view.state)!.pending) return;
            const open = new Set(
              controller.store
                .threads()
                .filter((t) => !t.resolved)
                .map((t) => t.id),
            );
            const id = commentIdsAt(view.state).find((candidate) => open.has(candidate));
            if (id && (id !== controller.active() || !controller.isPanelOpen())) {
              queueMicrotask(() => {
                controller.setActive(id);
                void controller.openPanel();
              });
            }
          },
        }),
      }),
    ];
  },

  setup(editor) {
    const labels = pickLabels(editor, 'comments', LABELS);
    const options = (editor.options.pluginOptions?.comments ?? {}) as CommentsOptions;
    const store = options.store ?? createCommentStore(options.threads ?? [], options.onChange);
    const author: CommentAuthor = {
      id: String(options.author?.id ?? 'guest').slice(0, 128),
      name: String(options.author?.name || labels.guest).slice(0, COMMENT_NAME_MAX_LENGTH),
    };
    const markType = () => editor.schema.marks.comment!;
    const userSource =
      options.mentions ??
      (editor.options.pluginOptions?.mentions as MentionsOptions | undefined)?.fetch;
    /** Упомянутые, чьё «@Имя» осталось в тексте (выбрал из списка, потом стёр — не уведомляем). */
    const keepMentions = (text: string, mentions: CommentAuthor[] = []) => {
      const unique = new Map(mentions.map((m) => [m.id, m]));
      return [...unique.values()].filter((m) => text.includes(`@${m.name}`));
    };
    const makeComment = (text: string, mentions?: CommentAuthor[]): Comment => {
      const kept = keepMentions(text, mentions);
      return {
        id: newCommentId(),
        author,
        text,
        createdAt: Date.now(),
        ...(kept.length ? { mentions: kept } : {}),
      };
    };
    const notify = (threadId: string, comment: Comment) => {
      if (comment.mentions?.length) {
        options.onMention?.({ threadId, comment, users: comment.mentions });
      }
    };
    const pluginState = () => commentsKey.getState(editor.view.state)!;
    const dispatchMeta = (meta: Meta) =>
      editor.view.dispatch(editor.view.state.tr.setMeta(commentsKey, meta));

    let panel: { el: HTMLElement; render(): void; focusComposer(): void; destroy(): void } | null =
      null;
    let panelOpen = false;

    // Панель — общая боковая панель редактора (editor.ui.sidebar): одна открытая за раз, рядом с
    // текстом, на узком экране — под ним. Шапку с заголовком и закрытием рисует сама панель.
    editor.ui.registry.addSidebar('comments', {
      title: labels.panel,
      button: false,
      header: false,
      render: async (container) => {
        const { createCommentsPanel } = await import('./comments-panel');
        panel = createCommentsPanel(controller);
        container.append(panel.el);
        return () => panel?.destroy();
      },
      onShow: () => {
        panelOpen = true;
        // hidden у самой панели — для совместимости со стилями и тестами, видимостью управляет sidebar.
        if (panel) panel.el.hidden = false;
        editor.root.classList.add('nova-comments-open');
        panel?.render();
      },
      onHide: () => {
        panelOpen = false;
        if (panel) panel.el.hidden = true;
        editor.root.classList.remove('nova-comments-open');
        if (pluginState().pending) dispatchMeta({ pending: null });
      },
    });

    const controller: CommentsController = {
      editor,
      store,
      author,
      labels,
      shortcut: SHORTCUT,
      pending: () => pluginState().pending,
      active: () => pluginState().active,
      setActive(id, scroll = false) {
        if (pluginState().active !== id) dispatchMeta({ active: id });
        panel?.render();
        const range = id ? controller.ranges(id)[0] : undefined;
        if (scroll && range) {
          const { node } = editor.view.domAtPos(range.from);
          const el = node instanceof Element ? node : node.parentElement;
          el?.scrollIntoView({ block: 'nearest' });
        }
      },
      startComment() {
        const { selection } = editor.view.state;
        if (selection.empty || !editor.isEditable()) return false;
        dispatchMeta({ pending: { from: selection.from, to: selection.to }, active: null });
        void controller.openPanel().then(() => {
          // Панель могла быть уже открыта — перерисовать, чтобы появилось поле нового комментария.
          panel?.render();
          panel?.focusComposer();
        });
        return true;
      },
      cancelPending() {
        dispatchMeta({ pending: null });
        panel?.render();
        editor.focus();
      },
      findUsers: userSource ? (query) => findMentionUsers(userSource, query) : null,
      submitPending(text, mentions) {
        const pending = pluginState().pending;
        const value = text.trim().slice(0, COMMENT_MAX_LENGTH);
        if (!pending || !value) return null;
        const id = newCommentId('t');
        const comment = makeComment(value, mentions);
        store.createThread({
          id,
          createdAt: comment.createdAt,
          comments: [comment],
          resolved: null,
        });
        const { state } = editor.view;
        editor.view.dispatch(
          state.tr
            .addMark(pending.from, pending.to, markType().create({ id }))
            .setMeta(commentsKey, { pending: null, active: id } satisfies Meta)
            // Комментарий — не правка текста: Ctrl+Z не должен его снимать.
            .setMeta('addToHistory', false),
        );
        panel?.render();
        notify(id, comment);
        return id;
      },
      reply(threadId, text, mentions) {
        const value = text.trim().slice(0, COMMENT_MAX_LENGTH);
        if (!value) return;
        const comment = makeComment(value, mentions);
        store.reply(threadId, comment);
        notify(threadId, comment);
      },
      ranges: (id) => collectRanges(editor.view.state.doc).get(id) ?? [],
      quote(id) {
        const { doc } = editor.view.state;
        return controller
          .ranges(id)
          .map(({ from, to }) => doc.textBetween(from, to, ' '))
          .join(' … ');
      },
      positionOf: (id) => controller.ranges(id)[0]?.from ?? Number.MAX_SAFE_INTEGER,
      deleteThread(id) {
        const { state } = editor.view;
        const tr = state.tr;
        for (const { from, to } of controller.ranges(id)) {
          tr.removeMark(from, to, markType().create({ id }));
        }
        if (pluginState().active === id) tr.setMeta(commentsKey, { active: null } satisfies Meta);
        if (tr.docChanged || tr.getMeta(commentsKey)) {
          editor.view.dispatch(tr.setMeta('addToHistory', false));
        }
        store.deleteThread(id);
      },
      setResolved(id, resolved) {
        store.setResolved(id, resolved ? { by: author, at: Date.now() } : null);
        if (resolved && pluginState().active === id) dispatchMeta({ active: null });
      },
      canEdit: (comment) =>
        options.canEdit ? options.canEdit(comment, author) : comment.author.id === author.id,
      isPanelOpen: () => panelOpen,
      openPanel: () => editor.ui.sidebar.show('comments'),
      closePanel() {
        if (!panelOpen) return;
        editor.ui.sidebar.hide({ restoreFocus: false });
        editor.focus();
      },
    };
    controllers.set(editor, controller);

    // Изменения веток (свои, из бэкенда, от других участников) — перерисовать подсветку и панель.
    const unsubscribe = store.subscribe(() => {
      if (editor.view.isDestroyed) return;
      dispatchMeta({ refresh: true });
      panel?.render();
    });

    const add = () => controller.startComment();
    const toggle = () =>
      controller.isPanelOpen() ? controller.closePanel() : void controller.openPanel();
    const canAdd = (e: Editor) => e.isEditable() && !e.view.state.selection.empty;

    editor.ui.registry.addButton('addcomment', {
      icon: ICON_ADD,
      tooltip: labels.add,
      shortcut: SHORTCUT,
      isEnabled: canAdd,
      onAction: add,
    });
    editor.ui.registry.addToggleButton('showcomments', {
      icon: ICON_SHOW,
      tooltip: labels.show,
      isActive: () => panelOpen,
      onAction: toggle,
    });
    editor.ui.registry.addMenuItem('addcomment', {
      text: labels.add,
      icon: ICON_ADD,
      shortcut: SHORTCUT,
      isEnabled: canAdd,
      onAction: add,
    });
    editor.ui.registry.addMenuItem('showcomments', {
      text: labels.show,
      icon: ICON_SHOW,
      isActive: () => panelOpen,
      onAction: toggle,
    });

    return () => {
      unsubscribe();
      // Панель уничтожает editor.ui.sidebar (очистка из render).
      controllers.delete(editor);
    };
  },
});
