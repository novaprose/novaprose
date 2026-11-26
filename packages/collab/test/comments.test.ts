import { TextSelection } from 'prosemirror-state';
import { afterEach, describe, expect, it } from 'vitest';
import { createEditor, getComments, type Editor } from '@novaprose/core';
import { collab, Y, yCommentStore } from '../src';

/** Comments on top of a shared Y.Doc: threads and anchors show to every participant at once. */

const editors: Editor[] = [];
afterEach(() => {
  editors.splice(0).forEach((e) => e.destroy());
  document.body.innerHTML = '';
});

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

function linkedDocs() {
  const a = new Y.Doc();
  const b = new Y.Doc();
  a.on(
    'update',
    (u: Uint8Array, origin: unknown) => origin !== 'remote' && Y.applyUpdate(b, u, 'remote'),
  );
  b.on(
    'update',
    (u: Uint8Array, origin: unknown) => origin !== 'remote' && Y.applyUpdate(a, u, 'remote'),
  );
  return [a, b] as const;
}

function mount(ydoc: Y.Doc, name: string) {
  const element = document.createElement('div');
  document.body.appendChild(element);
  const sync = collab({ ydoc, user: { name } });
  const editor = createEditor({
    element,
    plugins: [sync, 'comments'],
    pluginOptions: { comments: { author: { id: name, name }, store: sync.commentStore() } },
  });
  editors.push(editor);
  return editor;
}

describe('comments in real-time collaboration', () => {
  it("one participant's comment and reply show to the other together with the highlight", async () => {
    const [docA, docB] = linkedDocs();
    const anna = mount(docA, 'Anna');
    const boris = mount(docB, 'Boris');
    anna.setContent('<p>Shared plan</p>');
    await tick();

    const comments = getComments(anna)!;
    anna.view.dispatch(
      anna.view.state.tr.setSelection(TextSelection.create(anna.view.state.doc, 8, 12)),
    );
    comments.startComment();
    await comments.openPanel();
    const id = comments.submitPending('Which plan?')!;
    await tick();

    expect(boris.getHTML()).toBe(`<p>Shared <span data-comment="${id}">plan</span></p>`);
    const borisComments = getComments(boris)!;
    expect(borisComments.store.threads()[0]!.comments[0]!.text).toBe('Which plan?');
    expect(boris.view.dom.querySelector('.nova-comment')?.textContent).toBe('plan');

    borisComments.reply(id, 'The Q4 one');
    comments.reply(id, 'Thanks');
    await tick();
    expect(comments.store.threads()[0]!.comments.map((c) => c.text)).toEqual([
      'Which plan?',
      'The Q4 one',
      'Thanks',
    ]);

    borisComments.setResolved(id, true);
    await tick();
    expect(comments.store.threads()[0]!.resolved?.by.name).toBe('Boris');
    expect(anna.view.dom.querySelector('.nova-comment')).toBeNull();
  });

  it("simultaneous replies to one thread aren't lost", () => {
    const [docA, docB] = linkedDocs();
    const storeA = yCommentStore(docA);
    const storeB = yCommentStore(docB);
    const author = { id: 'u', name: 'U' };
    storeA.createThread({
      id: 't1',
      createdAt: 1,
      comments: [{ id: 'c0', author, text: 'Q', createdAt: 1 }],
    });
    // Cut the link, both reply, then they exchange state.
    const offlineA = new Y.Doc();
    const offlineB = new Y.Doc();
    Y.applyUpdate(offlineA, Y.encodeStateAsUpdate(docA));
    Y.applyUpdate(offlineB, Y.encodeStateAsUpdate(docB));
    yCommentStore(offlineA).reply('t1', { id: 'c1', author, text: 'A', createdAt: 2 });
    yCommentStore(offlineB).reply('t1', { id: 'c2', author, text: 'B', createdAt: 2 });
    Y.applyUpdate(offlineA, Y.encodeStateAsUpdate(offlineB));
    const texts = yCommentStore(offlineA)
      .threads()[0]!
      .comments.map((c) => c.text)
      .sort();
    expect(texts).toEqual(['A', 'B', 'Q']);
    expect(storeB.threads()[0]!.comments).toHaveLength(1);
  });
});
