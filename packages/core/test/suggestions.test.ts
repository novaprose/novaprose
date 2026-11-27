import { TextSelection } from 'prosemirror-state';
import { afterEach, describe, expect, it } from 'vitest';
import {
  createEditor,
  isSuggesting,
  listSuggestions,
  resolveSuggestions,
  setSuggesting,
  suggestionsResult,
  type Editor,
} from '../src';

/** Suggesting mode: typing turns into suggestions, which get accepted and rejected. */

const editors: Editor[] = [];
afterEach(() => {
  editors.splice(0).forEach((e) => e.destroy());
  document.body.innerHTML = '';
});

function mount(content: string, options: Record<string, unknown> = { enabled: true }) {
  const element = document.createElement('div');
  document.body.appendChild(element);
  const editor = createEditor({
    element,
    content,
    plugins: ['suggestions'],
    pluginOptions: { suggestions: { author: { id: 'u1', name: 'Anna' }, ...options } },
  });
  editors.push(editor);
  return editor;
}

/** HTML without random ids and times. */
const html = (editor: Editor) =>
  editor
    .getHTML()
    .replace(/ data-suggestion="[^"]+"/g, '')
    .replace(/ data-time="\d+"/g, '')
    .replace(/ data-author="u1" data-name="Anna"/g, '');

const cursor = (editor: Editor, pos: number) =>
  editor.view.dispatch(
    editor.view.state.tr.setSelection(TextSelection.create(editor.view.state.doc, pos)),
  );
const type = (editor: Editor, text: string) => {
  for (const ch of text) editor.view.dispatch(editor.view.state.tr.insertText(ch));
};
/** Like Backspace: delete the character before the cursor. */
const backspace = (editor: Editor) => {
  const { from } = editor.view.state.selection;
  editor.view.dispatch(editor.view.state.tr.delete(from - 1, from));
};
/** Like Delete: delete the character after the cursor. */
const del = (editor: Editor) => {
  const { from } = editor.view.state.selection;
  editor.view.dispatch(editor.view.state.tr.delete(from, from + 1));
};

describe('suggesting mode', () => {
  it('setContent loads a document even in suggesting mode: no suggestion of everything', () => {
    const editor = mount('<p>old</p>');
    expect(isSuggesting(editor.view.state)).toBe(true);
    editor.setContent('<p>new</p>');
    expect(editor.getHTML()).toBe('<p>new</p>');
    // Typing after it is still a suggestion.
    cursor(editor, 4);
    type(editor, '!');
    expect(html(editor)).toBe('<p>new<ins>!</ins></p>');
  });

  it('off by default: typing changes the text directly', () => {
    const editor = mount('<p>Hi</p>', {});
    expect(isSuggesting(editor.view.state)).toBe(false);
    cursor(editor, 3);
    type(editor, '!');
    expect(editor.getHTML()).toBe('<p>Hi!</p>');
  });

  it('typed text is one insertion with an author', () => {
    const editor = mount('<p>Hello world</p>');
    cursor(editor, 7);
    type(editor, 'big ');
    expect(html(editor)).toBe('<p>Hello <ins>big </ins>world</p>');
    const [s] = listSuggestions(editor.view.state.doc);
    expect(s).toMatchObject({ kind: 'insert', text: 'big ', author: { id: 'u1', name: 'Anna' } });
    expect(listSuggestions(editor.view.state.doc)).toHaveLength(1);
  });

  it('Backspace marks a deletion, the text stays, the cursor moves left; one suggestion', () => {
    const editor = mount('<p>Hello world</p>');
    cursor(editor, 12);
    backspace(editor);
    backspace(editor);
    expect(html(editor)).toBe('<p>Hello wor<del>ld</del></p>');
    expect(editor.view.state.selection.from).toBe(10);
    expect(listSuggestions(editor.view.state.doc)).toHaveLength(1);
  });

  it('a word erased, then typing: the replacement reads "deleted, then inserted"', () => {
    const editor = mount('<p>Ship in May</p>');
    cursor(editor, 12);
    for (let i = 0; i < 3; i += 1) backspace(editor);
    type(editor, 'June');
    expect(html(editor)).toBe('<p>Ship in <del>May</del><ins>June</ins></p>');
    expect(editor.view.state.selection.from).toBe(16);
  });

  it('Delete marks the character on the right and jumps over it', () => {
    const editor = mount('<p>abc</p>');
    cursor(editor, 1);
    del(editor);
    del(editor);
    expect(html(editor)).toBe('<p><del>ab</del>c</p>');
    expect(editor.view.state.selection.from).toBe(3);
  });

  it("Backspace over your own insertion that isn't accepted yet deletes it for real", () => {
    const editor = mount('<p>Hi</p>');
    cursor(editor, 3);
    type(editor, ' there');
    backspace(editor);
    backspace(editor);
    expect(html(editor)).toBe('<p>Hi<ins> the</ins></p>');
  });

  it('typing over a selection: the old text is a deletion, the new one an insertion after it', () => {
    const editor = mount('<p>The quick fox</p>');
    editor.view.dispatch(
      editor.view.state.tr.setSelection(TextSelection.create(editor.view.state.doc, 5, 10)),
    );
    type(editor, 'slow');
    expect(html(editor)).toBe('<p>The <del>quick</del><ins>slow</ins> fox</p>');
    expect(editor.view.state.selection.from).toBe(14);
  });

  it('accept all / reject all / one suggestion', () => {
    const editor = mount('<p>The quick fox</p>');
    editor.view.dispatch(
      editor.view.state.tr.setSelection(TextSelection.create(editor.view.state.doc, 5, 10)),
    );
    type(editor, 'slow');
    expect(suggestionsResult(editor, 'accept').textContent).toBe('The slow fox');
    expect(suggestionsResult(editor, 'reject').textContent).toBe('The quick fox');

    const [deletion] = listSuggestions(editor.view.state.doc);
    editor.view.dispatch(resolveSuggestions(editor.view.state, 'reject', [deletion!.id]));
    expect(html(editor)).toBe('<p>The quick<ins>slow</ins> fox</p>');
    editor.view.dispatch(resolveSuggestions(editor.view.state, 'accept'));
    expect(editor.getHTML()).toBe('<p>The quickslow fox</p>');
  });

  it('Ctrl+Z undoes a whole suggestion instead of turning the undo into a new suggestion', () => {
    const editor = mount('<p>Text</p>');
    cursor(editor, 5);
    type(editor, '!');
    expect(editor.exec('undo')).toBe(true);
    expect(editor.getHTML()).toBe('<p>Text</p>');
  });

  it('HTML round trip without changes; a regular <del> stays a strike-through', () => {
    const saved =
      '<p>A <ins data-suggestion="s1" data-author="u2" data-name="Boris" data-time="1700000000000">new</ins> <del data-suggestion="s2" data-author="u2" data-name="Boris" data-time="1700000000000">old</del> <s>gone</s></p>';
    const editor = mount(saved);
    expect(editor.getHTML()).toBe(saved);
    expect(mount('<p><del>struck</del></p>').getHTML()).toBe('<p><s>struck</s></p>');
  });

  it('data from HTML is checked: a bad id is not a suggestion, the name is only text', () => {
    const editor = mount(
      '<p><ins data-suggestion="bad id" data-name="x">a</ins><ins data-suggestion="ok" data-author="&quot;><img>" data-name="&lt;img src=x onerror=alert(1)&gt;">b</ins></p>',
    );
    const out = editor.getHTML();
    expect(out).not.toContain('<img');
    expect(out).toContain('data-name="&lt;img src=x onerror=alert(1)&gt;"');
    expect(out).not.toContain('data-author');
    expect(listSuggestions(editor.view.state.doc).map((s) => s.id)).toEqual(['ok']);
  });

  it("programmatic changes without history (addToHistory: false) aren't tracked", () => {
    const editor = mount('<p>x</p>');
    editor.setContent('<p>Loaded</p>', { addToHistory: false });
    expect(editor.getHTML()).toBe('<p>Loaded</p>');
  });

  it('force: the mode is always on and the button unavailable; without force it toggles', async () => {
    const forced = mount('<p>x</p>', { force: true });
    // The plugin's buttons are registered by its lazy part, after editor.ready.
    await forced.ready;
    setSuggesting(forced, false);
    expect(isSuggesting(forced.view.state)).toBe(true);
    expect(
      forced.root.querySelector<HTMLButtonElement>('[data-control="suggestions"]')!.disabled,
    ).toBe(true);

    const free = mount('<p>x</p>', {});
    await free.ready;
    setSuggesting(free, true);
    expect(isSuggesting(free.view.state)).toBe(true);
    expect(free.view.dom.classList.contains('nova-suggesting')).toBe(true);
  });

  it("the tooltip with the author and the author's color are in the editor only, not in the HTML", () => {
    const editor = mount('<p>Hi</p>');
    cursor(editor, 3);
    type(editor, '!');
    expect(editor.view.dom.querySelector('[title]')?.getAttribute('title')).toMatch(
      /^Inserted by Anna/,
    );
    expect(editor.getHTML()).not.toContain('title');
  });

  it('the text of a new paragraph rejected: no empty line is left (the break and the text are suggestions)', () => {
    const editor = mount('<p>One</p><p>Two</p>');
    cursor(editor, 4);
    editor.view.dispatch(editor.view.state.tr.split(4));
    type(editor, 'New');
    expect(html(editor)).toBe('<p>One</p><p data-change="split"><ins>New</ins></p><p>Two</p>');
    editor.view.dispatch(resolveSuggestions(editor.view.state, 'reject'));
    expect(editor.getHTML()).toBe('<p>One</p><p>Two</p>');
  });

  it("the deletion of all of a block's text accepted: the block goes; where it is required it stays empty", () => {
    const editor = mount('<p>One</p><p>Two</p>');
    editor.view.dispatch(editor.view.state.tr.delete(6, 9));
    expect(html(editor)).toBe('<p>One</p><p><del>Two</del></p>');
    editor.view.dispatch(resolveSuggestions(editor.view.state, 'accept'));
    expect(editor.getHTML()).toBe('<p>One</p>');

    // A list item without text goes entirely.
    const list = mount('<ul><li><p>A</p></li><li><p>B</p></li></ul>');
    list.view.dispatch(list.view.state.tr.delete(8, 9));
    list.view.dispatch(resolveSuggestions(list.view.state, 'accept'));
    expect(list.getHTML()).toBe('<ul><li><p>A</p></li></ul>');

    // The only paragraph of the document and the item's paragraph before a nested list are required.
    const only = mount('<p>Only</p>');
    only.view.dispatch(only.view.state.tr.delete(1, 5));
    only.view.dispatch(resolveSuggestions(only.view.state, 'accept'));
    expect(only.getHTML()).toBe('<p></p>');
    const nested = mount('<ul><li><p>A</p><ul><li><p>B</p></li></ul></li></ul>');
    nested.view.dispatch(nested.view.state.tr.delete(3, 4));
    nested.view.dispatch(resolveSuggestions(nested.view.state, 'accept'));
    expect(() => nested.view.state.doc.check()).not.toThrow();
    expect(nested.getHTML()).toBe('<ul><li><p></p><ul><li><p>B</p></li></ul></li></ul>');
  });
});

/** Select from..to. */
const select = (editor: Editor, from: number, to: number) =>
  editor.view.dispatch(
    editor.view.state.tr.setSelection(TextSelection.create(editor.view.state.doc, from, to)),
  );

/** HTML without ids, times and the author: the format suggestion's span keeps data-format. */
const plain = (editor: Editor) => html(editor).replace(/ data-suggestion="[^"]+"/g, '');

describe('suggested formats', () => {
  it('bold in suggesting mode: bold at once, remembering it was not; reject takes it back', () => {
    const editor = mount('<p>plain text</p>');
    select(editor, 1, 6);
    editor.exec('bold');
    expect(html(editor)).toBe('<p><strong><span data-format="[]">plain</span></strong> text</p>');
    const [s] = listSuggestions(editor.view.state.doc);
    expect(s).toMatchObject({ kind: 'format', text: 'plain', added: ['bold'], removed: [] });
    editor.view.dispatch(resolveSuggestions(editor.view.state, 'reject'));
    expect(editor.getHTML()).toBe('<p>plain text</p>');
  });

  it('accept keeps the new format; the suggestion goes', () => {
    const editor = mount('<p>plain text</p>');
    select(editor, 1, 6);
    editor.exec('italic');
    editor.view.dispatch(resolveSuggestions(editor.view.state, 'accept'));
    expect(editor.getHTML()).toBe('<p><em>plain</em> text</p>');
    expect(listSuggestions(editor.view.state.doc)).toEqual([]);
  });

  it('taking italic away is a suggestion too; reject brings italic back', () => {
    const editor = mount('<p><em>slanted</em> text</p>');
    select(editor, 1, 8);
    editor.exec('italic');
    expect(plain(editor)).toBe(
      '<p><span data-format="[{&quot;type&quot;:&quot;italic&quot;}]">slanted</span> text</p>',
    );
    expect(listSuggestions(editor.view.state.doc)[0]).toMatchObject({
      added: [],
      removed: ['italic'],
    });
    editor.view.dispatch(resolveSuggestions(editor.view.state, 'reject'));
    expect(editor.getHTML()).toBe('<p><em>slanted</em> text</p>');
  });

  it('two changes are one suggestion that remembers the start; back to the start, it goes', () => {
    const editor = mount('<p>word</p>');
    select(editor, 1, 5);
    editor.exec('bold');
    editor.exec('italic');
    expect(listSuggestions(editor.view.state.doc)).toHaveLength(1);
    expect(listSuggestions(editor.view.state.doc)[0]!.added).toEqual(['bold', 'italic']);
    editor.exec('italic');
    editor.exec('bold');
    expect(editor.getHTML()).toBe('<p>word</p>');
  });

  it('formatting your own suggested insertion just formats it', () => {
    const editor = mount('<p>Hi</p>');
    cursor(editor, 3);
    type(editor, ' there');
    select(editor, 4, 9);
    editor.exec('bold');
    expect(html(editor)).toBe('<p>Hi<ins> </ins><strong><ins>there</ins></strong></p>');
    expect(listSuggestions(editor.view.state.doc).map((s) => s.kind)).toEqual(['insert']);
  });

  it("another person's insertion formatted: rejecting both leaves the text as it was", () => {
    const editor = mount(
      '<p>a <ins data-suggestion="b1" data-author="u2" data-name="Bob">new</ins> b</p>',
    );
    select(editor, 3, 6);
    editor.exec('bold');
    expect(listSuggestions(editor.view.state.doc).map((s) => s.kind)).toEqual(['insert', 'format']);
    editor.view.dispatch(resolveSuggestions(editor.view.state, 'reject'));
    expect(editor.getHTML()).toBe('<p>a &nbsp;b</p>');
  });

  it('the format suggestion comes back from HTML; a damaged data-format is safe', () => {
    const editor = mount(
      '<p><strong><span data-suggestion="f1" data-format="[{&quot;type&quot;:&quot;italic&quot;}]" data-author="u2" data-name="Bob" data-time="1700000000000">x</span></strong>' +
        '<span data-suggestion="f2" data-format="not json">y</span>' +
        '<span data-suggestion="f3" data-format="[{&quot;type&quot;:&quot;nosuchmark&quot;},{&quot;type&quot;:&quot;link&quot;,&quot;attrs&quot;:{&quot;href&quot;:&quot;javascript:alert(1)&quot;}}]">z</span></p>',
      { enabled: false },
    );
    expect(editor.getHTML()).toBe(
      '<p><strong><span data-suggestion="f1" data-format="[{&quot;type&quot;:&quot;italic&quot;}]" data-author="u2" data-name="Bob" data-time="1700000000000">x</span></strong>' +
        '<span data-suggestion="f2" data-format="[]">y</span>' +
        '<span data-suggestion="f3" data-format="[{&quot;type&quot;:&quot;nosuchmark&quot;},{&quot;type&quot;:&quot;link&quot;,&quot;attrs&quot;:{&quot;href&quot;:&quot;javascript:alert(1)&quot;}}]">z</span></p>',
    );
    editor.view.dispatch(resolveSuggestions(editor.view.state, 'reject'));
    // x goes back to italic; z gets the link back, but its unsafe address is never written.
    expect(editor.getHTML()).toBe('<p><em>x</em>y<a href="#">z</a></p>');
  });

  it('JSON with any attributes on the format mark: listing, accepting and rejecting don’t throw', () => {
    const element = document.createElement('div');
    document.body.appendChild(element);
    const editor = createEditor({
      element,
      plugins: ['suggestions'],
      content: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'odd',
                marks: [
                  { type: 'suggestion_format', attrs: { id: 7, before: { a: 1 }, author: null } },
                ],
              },
            ],
          },
        ],
      },
    });
    editors.push(editor);
    expect(listSuggestions(editor.view.state.doc)[0]).toMatchObject({ kind: 'format' });
    expect(() =>
      editor.view.dispatch(resolveSuggestions(editor.view.state, 'reject')),
    ).not.toThrow();
    expect(editor.getHTML()).toBe('<p>odd</p>');
  });
});
