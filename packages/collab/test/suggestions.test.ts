import { TextSelection } from 'prosemirror-state';
import { afterEach, describe, expect, it } from 'vitest';
import { createEditor, listSuggestions, resolveSuggestions, type Editor } from '@novaprose/core';
import { collab, Y } from '../src';

/** Suggesting mode in real-time collaboration. */

const editors: Editor[] = [];
afterEach(() => {
  editors.splice(0).forEach((e) => e.destroy());
  document.body.innerHTML = '';
});
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

function linkedDocs() {
  const a = new Y.Doc();
  const b = new Y.Doc();
  a.on('update', (u: Uint8Array, o: unknown) => o !== 'remote' && Y.applyUpdate(b, u, 'remote'));
  b.on('update', (u: Uint8Array, o: unknown) => o !== 'remote' && Y.applyUpdate(a, u, 'remote'));
  return [a, b] as const;
}

function mount(ydoc: Y.Doc, id: string, name: string) {
  const element = document.createElement('div');
  document.body.appendChild(element);
  const editor = createEditor({
    element,
    plugins: [collab({ ydoc, user: { name } }), 'suggestions'],
    // Both in suggesting mode: other people's changes must not turn into "my" suggestions.
    pluginOptions: { suggestions: { author: { id, name }, enabled: true } },
  });
  editors.push(editor);
  return editor;
}

describe('suggestions in real-time collaboration', () => {
  it("Anna's suggestion shows to Boris with the author; Boris accepts it and it is accepted for Anna too", async () => {
    const [docA, docB] = linkedDocs();
    const anna = mount(docA, 'anna', 'Anna');
    const boris = mount(docB, 'boris', 'Boris');
    // The original text without tracking (like loading a document).
    anna.setContent('<p>Ship in May</p>', { addToHistory: false });
    await tick();

    const { state } = anna.view;
    anna.view.dispatch(state.tr.setSelection(TextSelection.create(state.doc, 9, 12)));
    for (const ch of 'June') anna.view.dispatch(anna.view.state.tr.insertText(ch));
    await tick();

    const seen = listSuggestions(boris.view.state.doc);
    expect(seen.map((s) => [s.kind, s.text, s.author.name])).toEqual([
      ['delete', 'May', 'Anna'],
      ['insert', 'June', 'Anna'],
    ]);

    boris.view.dispatch(resolveSuggestions(boris.view.state, 'accept'));
    await tick();
    expect(anna.getHTML()).toBe('<p>Ship in June</p>');
    expect(listSuggestions(anna.view.state.doc)).toEqual([]);
  });
});
