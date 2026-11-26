import { sanitizeThread, type CommentStore, type CommentThread } from '@novaprose/core';
import * as Y from 'yjs';

/**
 * A comment store in the shared Y.Doc: discussions sync between participants like the text and are
 * saved by the sync server together with the document. Replies live in a Y.Array, so two people
 * replying at once don't lose each other's replies.
 */
export function yCommentStore(ydoc: Y.Doc, name = 'comments'): CommentStore {
  const root = ydoc.getMap<Y.Map<unknown>>(name);
  let snapshot: readonly CommentThread[] = [];
  const listeners = new Set<() => void>();

  const read = () => {
    const threads: CommentThread[] = [];
    root.forEach((thread) => {
      if (!(thread instanceof Y.Map)) return;
      const comments = thread.get('comments');
      const clean = sanitizeThread({
        id: thread.get('id'),
        createdAt: thread.get('createdAt'),
        resolved: thread.get('resolved'),
        comments: comments instanceof Y.Array ? comments.toArray() : [],
      });
      if (clean) threads.push(clean);
    });
    snapshot = threads;
  };
  read();
  root.observeDeep(() => {
    read();
    listeners.forEach((listener) => listener());
  });

  const commentsOf = (threadId: string) => {
    const value = root.get(threadId)?.get('comments');
    return value instanceof Y.Array ? (value as Y.Array<Record<string, unknown>>) : null;
  };
  const indexOf = (list: Y.Array<Record<string, unknown>>, commentId: string) =>
    list.toArray().findIndex((comment) => comment.id === commentId);

  return {
    threads: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    createThread(thread) {
      const clean = sanitizeThread(thread);
      if (!clean || root.has(clean.id)) return;
      ydoc.transact(() => {
        const map = new Y.Map<unknown>();
        map.set('id', clean.id);
        map.set('createdAt', clean.createdAt);
        map.set('resolved', clean.resolved ?? null);
        const comments = new Y.Array<unknown>();
        comments.push(clean.comments);
        map.set('comments', comments);
        root.set(clean.id, map);
      });
    },
    reply(threadId, comment) {
      const clean = sanitizeThread({ id: threadId, comments: [comment] })?.comments[0];
      if (clean) commentsOf(threadId)?.push([{ ...clean }]);
    },
    editComment(threadId, commentId, text) {
      const list = commentsOf(threadId);
      const index = list ? indexOf(list, commentId) : -1;
      if (!list || index < 0) return;
      const current = list.get(index);
      ydoc.transact(() => {
        list.delete(index, 1);
        list.insert(index, [{ ...current, text: text.slice(0, 5000), editedAt: Date.now() }]);
      });
    },
    deleteComment(threadId, commentId) {
      const list = commentsOf(threadId);
      const index = list ? indexOf(list, commentId) : -1;
      if (list && index >= 0) list.delete(index, 1);
    },
    setResolved(threadId, resolved) {
      root.get(threadId)?.set('resolved', resolved ?? null);
    },
    deleteThread(threadId) {
      root.delete(threadId);
    },
  };
}
