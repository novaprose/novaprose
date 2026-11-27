/**
 * Comments on the text: the data model and the store.
 *
 * The document's text keeps only the anchor — a `<span data-comment="id">` mark around the discussed
 * fragment. The discussions (threads) themselves live in a store: in memory by default (save them
 * next to the HTML with `onChange`), in the shared Y.Doc when collaborating
 * (`collabSession.commentStore()`), or in your own store with the same interface.
 */

export interface CommentAuthor {
  id: string;
  name: string;
}

export interface Comment {
  id: string;
  author: CommentAuthor;
  text: string;
  /** When it was created, ms since 1970 (Date.now()). */
  createdAt: number;
  editedAt?: number;
  /** People mentioned with "@" ("@Name" in the text): whom to notify. */
  mentions?: CommentAuthor[];
}

export interface CommentThread {
  /** Matches data-comment of the text fragment. */
  id: string;
  createdAt: number;
  /** The first comment starts the discussion, the rest are replies. */
  comments: Comment[];
  /** The thread is resolved: its highlight in the text is hidden, the discussion stays in the history. */
  resolved?: { by: CommentAuthor; at: number } | null;
  /**
   * A discussion of a suggested edit (the suggestion's id) rather than of a piece of text: it shows
   * on the suggestion's card and is resolved when the suggestion is accepted or rejected.
   */
  suggestion?: string;
}

/** A store of threads. Its methods are synchronous: the UI updates at once, saving is up to you. */
export interface CommentStore {
  /** A snapshot of all threads (a new array after every change). */
  threads(): readonly CommentThread[];
  /** Subscribe to any change (including ones from other participants). Returns an unsubscribe function. */
  subscribe(listener: () => void): () => void;
  createThread(thread: CommentThread): void;
  reply(threadId: string, comment: Comment): void;
  editComment(threadId: string, commentId: string, text: string): void;
  deleteComment(threadId: string, commentId: string): void;
  setResolved(threadId: string, resolved: CommentThread['resolved']): void;
  deleteThread(threadId: string): void;
}

/** A thread identifier: safe in an attribute and a selector. */
export const COMMENT_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
/** Limits against accidental (or malicious) giant data. */
export const COMMENT_MAX_LENGTH = 5000;
export const COMMENT_NAME_MAX_LENGTH = 80;

export function newCommentId(prefix = 'c'): string {
  const bytes = new Uint8Array(9);
  globalThis.crypto.getRandomValues(bytes);
  return prefix + Array.from(bytes, (b) => (b % 36).toString(36)).join('');
}

/** Make data from an outside source (JSON, network) safe; drop whatever doesn't fit. */
export function sanitizeThread(value: unknown): CommentThread | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.id !== 'string' || !COMMENT_ID_RE.test(raw.id)) return null;
  const comments = Array.isArray(raw.comments)
    ? raw.comments.map(sanitizeComment).filter((c): c is Comment => c !== null)
    : [];
  const resolved = raw.resolved as Record<string, unknown> | null | undefined;
  const thread: CommentThread = {
    id: raw.id,
    createdAt: Number(raw.createdAt) || 0,
    comments,
    resolved:
      resolved && typeof resolved === 'object'
        ? { by: sanitizeAuthor(resolved.by), at: Number(resolved.at) || 0 }
        : null,
  };
  if (typeof raw.suggestion === 'string' && COMMENT_ID_RE.test(raw.suggestion))
    thread.suggestion = raw.suggestion;
  return thread;
}

function sanitizeAuthor(value: unknown): CommentAuthor {
  const raw = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
  return {
    id: String(raw.id ?? '').slice(0, 128),
    name: String(raw.name ?? '').slice(0, COMMENT_NAME_MAX_LENGTH),
  };
}

function sanitizeComment(value: unknown): Comment | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.id !== 'string' || !COMMENT_ID_RE.test(raw.id)) return null;
  const comment: Comment = {
    id: raw.id,
    author: sanitizeAuthor(raw.author),
    text: String(raw.text ?? '').slice(0, COMMENT_MAX_LENGTH),
    createdAt: Number(raw.createdAt) || 0,
  };
  if (raw.editedAt) comment.editedAt = Number(raw.editedAt) || 0;
  if (Array.isArray(raw.mentions)) {
    const mentions = raw.mentions
      .slice(0, 20)
      .map(sanitizeAuthor)
      .filter((m) => /^[\w.@:+-]{1,128}$/.test(m.id) && m.name);
    if (mentions.length) comment.mentions = mentions;
  }
  return comment;
}

/**
 * An in-memory store. `initial` — threads saved earlier (from your backend), `onChange` — save them.
 *
 * ```ts
 * const store = createCommentStore(saved.threads, (threads) => api.saveComments(postId, threads));
 * ```
 */
export function createCommentStore(
  initial: readonly unknown[] = [],
  onChange?: (threads: readonly CommentThread[]) => void,
): CommentStore {
  let threads: readonly CommentThread[] = initial
    .map(sanitizeThread)
    .filter((t): t is CommentThread => t !== null);
  const listeners = new Set<() => void>();

  const update = (next: readonly CommentThread[]) => {
    threads = next;
    onChange?.(threads);
    listeners.forEach((listener) => listener());
  };
  const mapThread = (id: string, fn: (thread: CommentThread) => CommentThread) =>
    update(threads.map((thread) => (thread.id === id ? fn(thread) : thread)));

  return {
    threads: () => threads,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    createThread(thread) {
      const clean = sanitizeThread(thread);
      if (!clean || threads.some((t) => t.id === clean.id)) return;
      update([...threads, clean]);
    },
    reply(threadId, comment) {
      const clean = sanitizeComment(comment);
      if (clean) mapThread(threadId, (t) => ({ ...t, comments: [...t.comments, clean] }));
    },
    editComment(threadId, commentId, text) {
      mapThread(threadId, (t) => ({
        ...t,
        comments: t.comments.map((c) =>
          c.id === commentId
            ? { ...c, text: text.slice(0, COMMENT_MAX_LENGTH), editedAt: Date.now() }
            : c,
        ),
      }));
    },
    deleteComment(threadId, commentId) {
      mapThread(threadId, (t) => ({
        ...t,
        comments: t.comments.filter((c) => c.id !== commentId),
      }));
    },
    setResolved(threadId, resolved) {
      mapThread(threadId, (t) => ({ ...t, resolved: resolved ?? null }));
    },
    deleteThread(threadId) {
      update(threads.filter((t) => t.id !== threadId));
    },
  };
}
