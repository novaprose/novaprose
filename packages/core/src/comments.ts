/**
 * Комментарии к тексту: модель данных и хранилище.
 *
 * Текст документа хранит только якорь — марку `<span data-comment="id">` вокруг обсуждаемого фрагмента.
 * Сами обсуждения (ветки) лежат в хранилище: по умолчанию в памяти (сохраняйте их через `onChange`
 * рядом с HTML), при совместном редактировании — в общем Y.Doc (`collabSession.commentStore()`),
 * или в вашем собственном хранилище с тем же интерфейсом.
 */

export interface CommentAuthor {
  id: string;
  name: string;
}

export interface Comment {
  id: string;
  author: CommentAuthor;
  text: string;
  /** Время создания, мс с 1970 (Date.now()). */
  createdAt: number;
  editedAt?: number;
  /** Упомянутые через «@» (в тексте — «@Имя»): кого уведомить. */
  mentions?: CommentAuthor[];
}

export interface CommentThread {
  /** Совпадает с data-comment у фрагмента текста. */
  id: string;
  createdAt: number;
  /** Первый комментарий — суть обсуждения, остальные — ответы. */
  comments: Comment[];
  /** Ветка решена: подсветка в тексте скрывается, обсуждение остаётся в истории. */
  resolved?: { by: CommentAuthor; at: number } | null;
}

/** Хранилище веток. Методы синхронные: интерфейс обновляется сразу, сохранение — на вашей стороне. */
export interface CommentStore {
  /** Снимок всех веток (новый массив после каждого изменения). */
  threads(): readonly CommentThread[];
  /** Подписка на любые изменения (в том числе пришедшие от других участников). Возвращает отписку. */
  subscribe(listener: () => void): () => void;
  createThread(thread: CommentThread): void;
  reply(threadId: string, comment: Comment): void;
  editComment(threadId: string, commentId: string, text: string): void;
  deleteComment(threadId: string, commentId: string): void;
  setResolved(threadId: string, resolved: CommentThread['resolved']): void;
  deleteThread(threadId: string): void;
}

/** Идентификатор ветки: безопасен в атрибуте и селекторе. */
export const COMMENT_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
/** Ограничения против случайных (или злонамеренных) гигантских данных. */
export const COMMENT_MAX_LENGTH = 5000;
export const COMMENT_NAME_MAX_LENGTH = 80;

export function newCommentId(prefix = 'c'): string {
  const bytes = new Uint8Array(9);
  globalThis.crypto.getRandomValues(bytes);
  return prefix + Array.from(bytes, (b) => (b % 36).toString(36)).join('');
}

/** Привести данные из внешнего источника (JSON, сеть) к безопасному виду; негодное — отбросить. */
export function sanitizeThread(value: unknown): CommentThread | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.id !== 'string' || !COMMENT_ID_RE.test(raw.id)) return null;
  const comments = Array.isArray(raw.comments)
    ? raw.comments.map(sanitizeComment).filter((c): c is Comment => c !== null)
    : [];
  const resolved = raw.resolved as Record<string, unknown> | null | undefined;
  return {
    id: raw.id,
    createdAt: Number(raw.createdAt) || 0,
    comments,
    resolved:
      resolved && typeof resolved === 'object'
        ? { by: sanitizeAuthor(resolved.by), at: Number(resolved.at) || 0 }
        : null,
  };
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
 * Хранилище в памяти. `initial` — ветки, сохранённые раньше (из вашего бэкенда), `onChange` — сохранить.
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
