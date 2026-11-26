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
 * The comments plugin: discussions about parts of the text (like comments in Google Docs or Word).
 * `plugins: ['comments']`, options in `pluginOptions.comments` ({@link CommentsOptions}).
 * Buttons (TinyMCE names): `addcomment`, `showcomments`. Ctrl+Alt+M comments on the selection.
 *
 * A mark in the schema, so the plugin is set up right away; the discussion panel loads lazily when opened.
 */

export interface CommentsOptions {
  /** Who is commenting. Default: "Guest". */
  author?: CommentAuthor;
  /** Where threads are stored. Default: in memory, with `threads` and `onChange`. */
  store?: CommentStore;
  /** Previously saved threads (for the default store). */
  threads?: readonly CommentThread[];
  /** The threads changed — save them (for the default store). */
  onChange?: (threads: readonly CommentThread[]) => void;
  /** Whether a comment can be edited and deleted. Default: only by its author. */
  canEdit?: (comment: Comment, author: CommentAuthor) => boolean;
  /**
   * Finding people for "@" in comments. Default: `pluginOptions.mentions.fetch` (the mentions plugin).
   */
  mentions?: MentionsOptions['fetch'];
  /** Someone was mentioned in a new comment — send them a notification. */
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
  /** The selection a new comment is being written for (not saved yet, so no mark in the text). */
  pending: { from: number; to: number } | null;
  active: string | null;
}

type Meta = Partial<PluginState> & { refresh?: true };

export const commentsKey = new PluginKey<PluginState>('nova-comments');

/** Controls the editor's comments: one object shared by the plugin and the lazy panel. */
export interface CommentsController {
  readonly editor: Editor;
  readonly store: CommentStore;
  readonly author: CommentAuthor;
  readonly labels: CommentsLabels;
  readonly shortcut: string;
  pending(): PluginState['pending'];
  active(): string | null;
  setActive(id: string | null, scroll?: boolean): void;
  /** Start a comment on the selection: highlight it and open the panel with an input. */
  startComment(): boolean;
  cancelPending(): void;
  /** Save a new comment on the pending selection. Returns the thread ID. */
  submitPending(text: string, mentions?: CommentAuthor[]): string | null;
  reply(threadId: string, text: string, mentions?: CommentAuthor[]): void;
  /** Finding people for "@" (null when no source is set up and mentions in comments are off). */
  findUsers: ((query: string) => Promise<MentionUser[]>) | null;
  /** Text fragments of a thread (empty when the text was deleted). */
  ranges(id: string): { from: number; to: number }[];
  quote(id: string): string;
  /** Threads in the order of their place in the document. */
  positionOf(id: string): number;
  deleteThread(id: string): void;
  setResolved(id: string, resolved: boolean): void;
  canEdit(comment: Comment): boolean;
  isPanelOpen(): boolean;
  openPanel(): Promise<void>;
  closePanel(): void;
}

const controllers = new WeakMap<Editor, CommentsController>();

/** The editor's comments controller (when the comments plugin is active). */
export function getComments(editor: Editor): CommentsController | undefined {
  return controllers.get(editor);
}

/** Every commented fragment: id → ranges. */
function collectRanges(doc: PMNode): Map<string, { from: number; to: number }[]> {
  const result = new Map<string, { from: number; to: number }[]>();
  doc.descendants((node, pos) => {
    if (!node.isInline) return;
    for (const mark of node.marks) {
      if (mark.type.name !== 'comment') continue;
      const id = mark.attrs.id as string;
      const list = result.get(id) ?? [];
      const last = list[list.length - 1];
      // Adjacent text nodes (different formatting) form one continuous fragment.
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
      // Typing at the edge of a fragment doesn't extend it; different threads may overlap.
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
    // The highlight cache: recomputed only when the document, the threads or the active thread change.
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
            // The cursor entered commented text: show its thread.
            // Only on cursor moves (a click, arrows): the panel isn't pushed while typing.
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
    /** Mentioned people whose "@Name" is still in the text (picked from the list, then erased: no notification). */
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

    // The panel is the editor's shared sidebar (editor.ui.sidebar): one open at a time, next to the
    // text, under it on a narrow screen. The panel draws its own header with the title and the close button.
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
        // hidden on the panel itself is for compatibility with styles and tests; the sidebar controls visibility.
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
          // The panel may already be open: redraw it so the new comment field appears.
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
            // A comment isn't a text edit: Ctrl+Z must not remove it.
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

    // Thread changes (your own, from the backend, from other participants) redraw the highlight and the panel.
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
      // editor.ui.sidebar destroys the panel (the cleanup from render).
      controllers.delete(editor);
    };
  },
});
