import { undo } from 'prosemirror-history';
import { TextSelection } from 'prosemirror-state';
import { afterEach, describe, expect, it } from 'vitest';
import { createEditor, createRenderer, REMOTE_CHANGE_META, type Editor } from '../src';
import { insertFootnote } from '../src/plugins/footnotes-ui';

const editors: Editor[] = [];
afterEach(() => {
  for (const editor of editors.splice(0)) editor.destroy();
});

async function ready(content: string): Promise<Editor> {
  const element = document.createElement('div');
  document.body.append(element);
  const editor = createEditor({ element, content, plugins: ['footnotes'] });
  editors.push(editor);
  await editor.ready;
  return editor;
}

const ref = (id: string, n: number) =>
  `<sup class="mce-footnote"><a href="#footnote-${id}" id="footnote-ref-${id}" role="doc-noteref">${n}</a></sup>`;
const note = (id: string, text: string) =>
  `<li id="footnote-${id}"><a class="mce-footnotes-backlink" href="#footnote-ref-${id}" role="doc-backlink">^</a>` +
  `<span class="mce-footnote-text">${text}</span></li>`;
const section = (...notes: string[]) =>
  `<div class="mce-footnotes" role="doc-endnotes"><hr><ol>${notes.join('')}</ol></div>`;

/** The footnotes of the document as [number, note text] pairs, in order. */
function footnotes(editor: Editor): [number, string][] {
  const refs: [string, number][] = [];
  const notes = new Map<string, string>();
  editor.view.state.doc.descendants((node) => {
    if (node.type.name === 'footnote_ref') refs.push([node.attrs.id, node.attrs.number]);
    if (node.type.name === 'footnote') notes.set(node.attrs.id, node.textContent);
    return true;
  });
  return refs.map(([id, number]) => [number, notes.get(id) ?? '?']);
}

function select(editor: Editor, pos: number): void {
  const { state } = editor.view;
  editor.view.dispatch(state.tr.setSelection(TextSelection.create(state.doc, pos)));
}

describe('footnotes in HTML', () => {
  it('our HTML comes back unchanged', async () => {
    const html = `<p>Text${ref('a1', 1)} more${ref('b2', 2)}</p>${section(note('a1', 'First'), note('b2', 'Second'))}`;
    const editor = await ready(html);
    expect(editor.getHTML()).toBe(html);
  });

  it('TinyMCE-style notes load: the back link is not text, the note text is', async () => {
    const editor = await ready(
      `<p>Text${ref('x', 1)}</p><div class="mce-footnotes"><hr><ol><li id="footnote-x">` +
        '<a class="mce-footnotes-backlink" href="#footnote-ref-x">^</a> The note</li></ol></div>',
    );
    expect(footnotes(editor)).toEqual([[1, 'The note']]);
  });

  it('the server renderer writes the same HTML', () => {
    const json = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'A' },
            { type: 'footnote_ref', attrs: { id: 'q', number: 1 } },
          ],
        },
        {
          type: 'footnotes',
          content: [
            { type: 'footnote', attrs: { id: 'q' }, content: [{ type: 'text', text: 'Note' }] },
          ],
        },
      ],
    };
    expect(createRenderer({ plugins: ['footnotes'] }).html(json)).toBe(
      `<p>A${ref('q', 1)}</p>${section(note('q', 'Note'))}`,
    );
  });
});

describe('keeping footnotes in step', () => {
  it('Insert footnote: a reference at the cursor, its note at the end, the cursor in the note', async () => {
    const editor = await ready('<p>Hello world</p>');
    select(editor, 6);
    editor.exec(insertFootnote);
    editor.view.dispatch(editor.view.state.tr.insertText('A note'));
    expect(footnotes(editor)).toEqual([[1, 'A note']]);
    const html = editor.getHTML();
    expect(html).toMatch(
      /^<p>Hello<sup class="mce-footnote">.*<\/sup> world<\/p><div class="mce-footnotes"/,
    );
  });

  it('numbers follow the order in the text; the notes too', async () => {
    const editor = await ready('<p>one two</p>');
    select(editor, 8);
    editor.exec(insertFootnote);
    editor.view.dispatch(editor.view.state.tr.insertText('about two'));
    select(editor, 4);
    editor.exec(insertFootnote);
    editor.view.dispatch(editor.view.state.tr.insertText('about one'));
    expect(footnotes(editor)).toEqual([
      [1, 'about one'],
      [2, 'about two'],
    ]);
    expect(editor.getText()).toContain('about one');
  });

  it('a deleted reference takes its note; the last one takes the section', async () => {
    const editor = await ready(
      `<p>a${ref('a', 1)} b${ref('b', 2)}</p>${section(note('a', 'A'), note('b', 'B'))}`,
    );
    editor.view.dispatch(editor.view.state.tr.delete(2, 3));
    expect(footnotes(editor)).toEqual([[1, 'B']]);
    editor.view.dispatch(editor.view.state.tr.delete(4, 5));
    expect(editor.getHTML()).toBe('<p>a b</p>');
  });

  it('a copied reference gets a note of its own, with the same text', async () => {
    const editor = await ready(`<p>a${ref('a', 1)}</p>${section(note('a', 'Shared'))}`);
    const refNode = editor.view.state.doc.firstChild!.child(1);
    editor.view.dispatch(editor.view.state.tr.insert(1, refNode));
    expect(footnotes(editor)).toEqual([
      [1, 'Shared'],
      [2, 'Shared'],
    ]);
    const ids = new Set<string>();
    editor.view.state.doc.descendants(
      (n) => (n.type.name === 'footnote_ref' && ids.add(n.attrs.id), true),
    );
    expect(ids.size).toBe(2);
  });

  it('stale numbers and a section in the middle are put right on load, without an undo step', async () => {
    const editor = await ready(`<p>a${ref('a', 7)}</p>${section(note('a', 'A'))}<p>after</p>`);
    expect(editor.getHTML()).toBe(`<p>a${ref('a', 1)}</p><p>after</p>${section(note('a', 'A'))}`);
    expect(undo(editor.view.state, editor.view.dispatch)).toBe(false);
  });

  it('typing in a note keeps the cursor there', async () => {
    const editor = await ready(`<p>a${ref('a', 1)}</p>${section(note('a', 'Note'))}`);
    const end = editor.view.state.doc.content.size - 2;
    select(editor, end);
    editor.view.dispatch(editor.view.state.tr.insertText('s'));
    editor.view.dispatch(editor.view.state.tr.insertText('!'));
    expect(footnotes(editor)).toEqual([[1, 'Notes!']]);
  });

  it('undo takes the reference and its note back in one step', async () => {
    const editor = await ready('<p>text</p>');
    select(editor, 5);
    editor.exec(insertFootnote);
    undo(editor.view.state, editor.view.dispatch);
    expect(editor.getHTML()).toBe('<p>text</p>');
  });

  it('no footnote inside a note', async () => {
    const editor = await ready(`<p>a${ref('a', 1)}</p>${section(note('a', 'Note'))}`);
    select(editor, editor.view.state.doc.content.size - 4);
    expect(editor.can(insertFootnote)).toBe(false);
  });

  it('a click on the back link selects the reference', async () => {
    const editor = await ready(`<p>a${ref('a', 1)}</p>${section(note('a', 'Note'))}`);
    const back = editor.view.dom.querySelector('a.mce-footnotes-backlink')!;
    back.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    const { selection } = editor.view.state;
    expect(selection.from).toBe(2);
    expect(selection.to).toBe(3);
  });

  it('a click on a number puts the cursor into its note (the page does not follow the link)', async () => {
    const editor = await ready(`<p>a${ref('a', 1)}</p>${section(note('a', 'Note'))}`);
    const link = editor.view.dom.querySelector('sup.mce-footnote a')!;
    const click = new MouseEvent('click', { bubbles: true, cancelable: true });
    link.dispatchEvent(click);
    expect(click.defaultPrevented).toBe(true);
    const { $from } = editor.view.state.selection;
    expect($from.parent.type.name).toBe('footnote');
    expect($from.parentOffset).toBe(0);
  });

  it('a reference from JSON with a bad id gets a usable id and an empty note', async () => {
    const element = document.createElement('div');
    document.body.append(element);
    const editor = createEditor({
      element,
      plugins: ['footnotes'],
      content: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: 'x' },
              {
                type: 'footnote_ref',
                attrs: { id: '"><img src=x onerror=alert(1)>', number: 'NaN' },
              },
            ],
          },
        ],
      },
    });
    editors.push(editor);
    await editor.ready;
    const html = editor.getHTML();
    expect(html).not.toContain('<img');
    expect(html).toMatch(
      /^<p>x<sup class="mce-footnote"><a href="#footnote-([\w-]+)" id="footnote-ref-\1" role="doc-noteref">1<\/a><\/sup><\/p><div class="mce-footnotes" role="doc-endnotes"><hr><ol><li id="footnote-\1">/,
    );
  });

  it('read only: no inserting, the button is off', async () => {
    const editor = await ready('<p>text</p>');
    editor.setEditable(false);
    expect(editor.ui.registry.getMenuItem('footnotes')?.isEnabled?.(editor)).toBe(false);
  });

  it('a selection keeps its text: the number goes after it', async () => {
    const editor = await ready('<p>one two</p>');
    const { state } = editor.view;
    editor.view.dispatch(state.tr.setSelection(TextSelection.create(state.doc, 1, 4)));
    editor.exec(insertFootnote);
    expect(editor.getHTML()).toMatch(/^<p>one<sup class="mce-footnote">.*<\/sup> two<\/p>/);
  });
});

/** A key pressed in the editor, as the browser sends it (through keydown, before the keymap). */
function key(editor: Editor, name: string): void {
  editor.view.dom.dispatchEvent(
    new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true }),
  );
}

/** Where a text starts in the document. */
function at(editor: Editor, text: string): number {
  let found = -1;
  editor.view.state.doc.descendants((node, pos) => {
    if (found < 0 && node.isText && node.text!.includes(text))
      found = pos + node.text!.indexOf(text);
    return found < 0;
  });
  if (found < 0) throw new Error(`no "${text}"`);
  return found;
}

/** The note node with an id. */
function noteNode(editor: Editor, id: string) {
  let found: unknown = null;
  editor.view.state.doc.descendants((node) => {
    if (node.type.name === 'footnote' && node.attrs.id === id) found = node;
    return true;
  });
  return found;
}

describe('editing inside notes', () => {
  it('Enter in a note is a line break: the note stays one and keeps its text', async () => {
    const editor = await ready(`<p>a${ref('a', 1)}</p>${section(note('a', 'Note text'))}`);
    select(editor, at(editor, ' text'));
    key(editor, 'Enter');
    expect(editor.getHTML()).toContain('<span class="mce-footnote-text">Note<br>&nbsp;text</span>');
    expect(footnotes(editor)).toHaveLength(1);
  });

  it('Backspace at the start of a note and Delete at its end keep the notes apart', async () => {
    const editor = await ready(
      `<p>a${ref('a', 1)} b${ref('b', 2)}</p>${section(note('a', 'First'), note('b', 'Second'))}`,
    );
    select(editor, at(editor, 'Second'));
    key(editor, 'Backspace');
    select(editor, at(editor, 'First') + 5);
    key(editor, 'Delete');
    expect(footnotes(editor)).toEqual([
      [1, 'First'],
      [2, 'Second'],
    ]);
  });

  it('a note split by a paste is joined back: the pasted lines stay in it', async () => {
    const editor = await ready(`<p>a${ref('a', 1)}</p>${section(note('a', 'Start end'))}`);
    select(editor, at(editor, ' end'));
    editor.view.pasteHTML('<p>one</p><p>two</p>');
    expect(footnotes(editor)).toHaveLength(1);
    expect(editor.getHTML()).toContain(
      '<span class="mce-footnote-text">Startone<br>two end</span>',
    );
    // The cursor is where the paste ended, in the same note.
    editor.view.dispatch(editor.view.state.tr.insertText('!'));
    expect(editor.getHTML()).toContain('two! end');
  });

  it('a note split some other way (a split step) is joined back too', async () => {
    const editor = await ready(`<p>a${ref('a', 1)}</p>${section(note('a', 'Left right'))}`);
    editor.view.dispatch(editor.view.state.tr.split(at(editor, ' right')));
    expect(footnotes(editor)).toEqual([[1, 'Left right']]);
    expect(editor.getHTML()).toContain('Left<br>&nbsp;right');
  });
});

describe('small changes, for co-authors', () => {
  it('inserting a footnote leaves the other notes as they are', async () => {
    const editor = await ready(
      `<p>a${ref('a', 1)} b${ref('b', 2)}</p>${section(note('a', 'A'), note('b', 'B'))}`,
    );
    const a = noteNode(editor, 'a');
    const b = noteNode(editor, 'b');
    select(editor, at(editor, ' b'));
    editor.exec(insertFootnote);
    expect(noteNode(editor, 'a')).toBe(a);
    expect(noteNode(editor, 'b')).toBe(b);
    expect(footnotes(editor).map(([n, text]) => `${n}:${text}`)).toEqual(['1:A', '2:', '3:B']);
  });

  it('moving a reference moves only its note', async () => {
    const editor = await ready(
      `<p>x${ref('a', 1)}${ref('b', 2)}${ref('c', 3)}</p>` +
        section(note('a', 'A'), note('b', 'B'), note('c', 'C')),
    );
    const a = noteNode(editor, 'a');
    const b = noteNode(editor, 'b');
    const { state } = editor.view;
    const c = state.doc.firstChild!.child(3);
    // The last reference goes to the start of the paragraph.
    editor.view.dispatch(state.tr.delete(4, 5).insert(1, c));
    expect(footnotes(editor)).toEqual([
      [1, 'C'],
      [2, 'A'],
      [3, 'B'],
    ]);
    expect(noteNode(editor, 'a')).toBe(a);
    expect(noteNode(editor, 'b')).toBe(b);
  });

  it("a co-author's change is not redone here; the next change made here puts it in step", async () => {
    const editor = await ready(`<p>a${ref('a', 1)} end</p>${section(note('a', 'A'))}`);
    const { state } = editor.view;
    const remote = state.tr
      .insert(1, state.schema.nodes.footnote_ref!.create({ id: 'z', number: 1 }))
      .setMeta(REMOTE_CHANGE_META, true);
    editor.view.dispatch(remote);
    // As it came: two number 1, no note for z yet.
    expect(footnotes(editor)).toEqual([
      [1, '?'],
      [1, 'A'],
    ]);
    // Any change here (typing elsewhere) brings the footnotes in step.
    editor.view.dispatch(editor.view.state.tr.insertText('!', at(editor, ' end') + 4));
    expect(footnotes(editor)).toEqual([
      [1, ''],
      [2, 'A'],
    ]);
  });

  it('text typed after the notes goes before them', async () => {
    const editor = await ready(`<p>a${ref('a', 1)}</p>${section(note('a', 'A'))}`);
    const { state } = editor.view;
    const paragraph = state.schema.nodes.paragraph!.create(null, state.schema.text('after'));
    editor.view.dispatch(state.tr.insert(state.doc.content.size, paragraph));
    expect(editor.getHTML()).toBe(`<p>a${ref('a', 1)}</p><p>after</p>${section(note('a', 'A'))}`);
  });

  it('notes without any reference go away; the document keeps a paragraph', async () => {
    const editor = await ready(section(note('x', 'Lost note')));
    expect(editor.getHTML()).toBe('<p></p>');
  });
});
