import { NodeSelection, TextSelection } from 'prosemirror-state';
import { CellSelection } from 'prosemirror-tables';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEditor, listSuggestions, resolveSuggestions, type Editor } from '../src';
import { insertTable, tableCommands } from '../src/table';

/**
 * Structure as suggestions: whole nodes inserted and deleted (tables, rows, columns, images, lines),
 * the markup of any node (list kind, table and cell properties, an image's size), and lists and
 * quotes (wrap, unwrap, Tab, Shift+Tab). Rejecting gives back the document as it was; accepting gives
 * the one the author meant.
 */

const editors: Editor[] = [];
afterEach(() => {
  editors.splice(0).forEach((e) => e.destroy());
  document.body.innerHTML = '';
});

async function mount(content: string, options: Record<string, unknown> = {}) {
  const element = document.createElement('div');
  document.body.appendChild(element);
  const editor = createEditor({
    element,
    content,
    plugins: ['suggestions'],
    pluginOptions: {
      suggestions: { author: { id: 'ann', name: 'Ann' }, enabled: true, ...options },
    },
  });
  editors.push(editor);
  await editor.ready;
  return editor;
}

/** The cursor inside the n-th text block (0-based), at its end or at an offset. */
function cursorIn(e: Editor, index: number, offset?: number) {
  let found = -1;
  let i = 0;
  e.view.state.doc.descendants((node, pos) => {
    if (found >= 0) return false;
    if (node.isTextblock) {
      if (i === index) found = pos + 1 + (offset ?? node.content.size);
      i++;
      return false;
    }
    return true;
  });
  e.view.dispatch(e.view.state.tr.setSelection(TextSelection.create(e.view.state.doc, found)));
}

/** The position of the n-th node of a type. */
function nodePos(e: Editor, type: string, index = 0): number {
  let found = -1;
  let i = 0;
  e.view.state.doc.descendants((node, pos) => {
    if (found >= 0) return false;
    if (node.type.name === type) {
      if (i === index) found = pos;
      i++;
    }
    return true;
  });
  return found;
}

const kinds = (e: Editor) =>
  listSuggestions(e.view.state.doc).map((s) => `${s.kind}:${s.node ?? 'text'}`);

const decide = (e: Editor, action: 'accept' | 'reject') =>
  e.view.dispatch(resolveSuggestions(e.view.state, action));

const T2x2 =
  '<table><tbody><tr><td><p>a</p></td><td><p>b</p></td></tr><tr><td><p>c</p></td><td><p>d</p></td></tr></tbody></table>';

describe('whole nodes', () => {
  it('a table inserted in suggesting mode carries the suggestion; reject removes it, accept keeps it', async () => {
    const original = '<p>Before</p><p>After</p>';
    for (const action of ['reject', 'accept'] as const) {
      const e = await mount(original);
      cursorIn(e, 0);
      e.exec(insertTable(2, 2, false));
      expect(kinds(e)).toEqual(['insert:table']);
      expect(e.getHTML()).toContain('<table data-suggestion=');
      expect(e.getHTML()).toContain('data-change="insert"');
      // The cursor is in the new table's first cell.
      expect(e.view.state.selection.$from.node(-1).type.name).toBe('table_cell');
      expect(e.view.dom.querySelector('table')!.closest('.nova-sugg-node')).not.toBeNull();
      decide(e, action);
      expect(listSuggestions(e.view.state.doc)).toEqual([]);
      if (action === 'reject') expect(e.getHTML()).toBe(original);
      else expect(e.getHTML()).toMatch(/^<p>Before<\/p><table><tbody>/);
    }
  });

  it('a horizontal line inserted and a selected one deleted', async () => {
    const e = await mount('<p>One</p>');
    cursorIn(e, 0);
    e.exec('horizontalRule');
    expect(kinds(e)).toEqual(['insert:horizontal_rule']);
    decide(e, 'reject');
    expect(e.getHTML()).toBe('<p>One</p>');

    const d = await mount('<p>One</p><hr><p>Two</p>');
    const hr = nodePos(d, 'horizontal_rule');
    d.view.dispatch(d.view.state.tr.setSelection(NodeSelection.create(d.view.state.doc, hr)));
    d.view.dispatch(d.view.state.tr.deleteSelection());
    // The line stays until the deletion is accepted.
    expect(d.getHTML()).toContain('<hr data-suggestion=');
    expect(kinds(d)).toEqual(['delete:horizontal_rule']);
    // The cursor went past the line.
    expect(d.view.state.selection.from).toBeGreaterThan(hr);
    decide(d, 'accept');
    expect(d.getHTML()).toBe('<p>One</p><p>Two</p>');
  });

  it('rows: a new one is a suggestion, a deleted one stays until accepted', async () => {
    const e = await mount(T2x2);
    cursorIn(e, 0);
    e.exec(tableCommands.addRowAfter);
    expect(kinds(e)).toEqual(['insert:table_row']);
    decide(e, 'reject');
    expect(e.getHTML()).toBe(T2x2);

    cursorIn(e, 2);
    e.exec(tableCommands.deleteRow);
    expect(e.getHTML().match(/<tr/g)).toHaveLength(2);
    expect(kinds(e)).toEqual(['delete:table_row']);
    decide(e, 'reject');
    expect(e.getHTML()).toBe(T2x2);
    cursorIn(e, 2);
    e.exec(tableCommands.deleteRow);
    decide(e, 'accept');
    expect(e.getHTML()).toBe(
      '<table><tbody><tr><td><p>a</p></td><td><p>b</p></td></tr></tbody></table>',
    );
  });

  it('a column is one suggestion: a new cell in every row', async () => {
    const e = await mount(T2x2);
    cursorIn(e, 0);
    e.exec(tableCommands.addColumnAfter);
    const all = listSuggestions(e.view.state.doc);
    expect(all.map((s) => `${s.kind}:${s.node}`)).toEqual([
      'insert:table_cell',
      'insert:table_cell',
    ]);
    expect(new Set(all.map((s) => s.id)).size).toBe(1);
    decide(e, 'reject');
    expect(e.getHTML()).toBe(T2x2);

    cursorIn(e, 1);
    e.exec(tableCommands.deleteColumn);
    expect(kinds(e)).toEqual(['delete:table_cell', 'delete:table_cell']);
    decide(e, 'accept');
    expect(e.getHTML()).toBe(
      '<table><tbody><tr><td><p>a</p></td></tr><tr><td><p>c</p></td></tr></tbody></table>',
    );
  });

  it('a table deleted stays until accepted; accepting leaves a paragraph if it was all there was', async () => {
    const e = await mount(T2x2);
    cursorIn(e, 0);
    e.exec(tableCommands.deleteTable);
    expect(kinds(e)).toEqual(['delete:table']);
    decide(e, 'reject');
    expect(e.getHTML()).toBe(T2x2);
    e.exec(tableCommands.deleteTable);
    decide(e, 'accept');
    expect(e.getHTML()).toBe('<p></p>');
  });

  it('header rows and cell properties are suggestions on the cells; reject gives them back', async () => {
    const e = await mount(T2x2);
    cursorIn(e, 0);
    e.exec(tableCommands.toggleHeaderRow);
    expect(e.getHTML()).toContain('<th');
    expect(kinds(e)).toEqual(['block:table_header', 'block:table_header']);
    decide(e, 'reject');
    expect(e.getHTML()).toBe(T2x2);
  });

  it('merging cells can’t be a suggestion: it isn’t made, and a notice says why', async () => {
    const e = await mount(T2x2);
    const notify = vi.spyOn(e.ui, 'notify');
    const doc = e.view.state.doc;
    e.view.dispatch(
      e.view.state.tr.setSelection(
        CellSelection.create(doc, nodePos(e, 'table_cell', 0), nodePos(e, 'table_cell', 1)),
      ),
    );
    e.exec(tableCommands.mergeCells);
    expect(e.getHTML()).toBe(T2x2);
    expect(notify).toHaveBeenCalledWith(expect.stringContaining('can’t be a suggestion'));
  });

  it('your own new table: what you do in it is just done, and deleting it deletes it', async () => {
    const e = await mount('<p>Before</p>');
    cursorIn(e, 0);
    e.exec(insertTable(2, 2, false));
    e.view.dispatch(e.view.state.tr.insertText('x'));
    // Text typed into your own new table is part of it.
    expect(kinds(e)).toEqual(['insert:table']);
    e.exec(tableCommands.addRowAfter);
    expect(kinds(e)).toEqual(['insert:table']);
    e.exec(tableCommands.deleteTable);
    expect(e.getHTML()).toBe('<p>Before</p>');
    expect(listSuggestions(e.view.state.doc)).toEqual([]);
  });
});

/** Types text the way a keyboard does: each character through handleTextInput (input rules). */
function type(e: Editor, text: string) {
  for (const ch of text) {
    const { from, to } = e.view.state.selection;
    const handled = e.view.someProp('handleTextInput', (f) =>
      f(e.view, from, to, ch, () => e.view.state.tr.insertText(ch, from, to)),
    );
    if (!handled) e.view.dispatch(e.view.state.tr.insertText(ch, from, to));
  }
}

const press = (e: Editor, key: string) =>
  e.view.someProp('handleKeyDown', (f) => f(e.view, new KeyboardEvent('keydown', { key })));

describe('images', () => {
  it('an image with a caption inserted is one suggestion; reject removes it', async () => {
    const original = '<p>Text</p>';
    const e = await mount(original);
    cursorIn(e, 0);
    const { schema } = e.view.state;
    const figure = schema.nodes.figure!.create(null, [
      schema.nodes.figure_image!.create({ src: 'https://example.com/a.png', alt: 'A' }),
      schema.nodes.figcaption!.create(),
    ]);
    e.view.dispatch(e.view.state.tr.replaceSelectionWith(figure));
    expect(kinds(e)).toEqual(['insert:figure']);
    decide(e, 'reject');
    expect(e.getHTML()).toBe(original);
  });

  it('an image resized remembers its size; reject gives it back', async () => {
    const original = '<p>A <img src="https://example.com/a.png" alt="A"> B</p>';
    const e = await mount(original);
    const pos = nodePos(e, 'image');
    const image = e.view.state.doc.nodeAt(pos)!;
    // As the resize handle does: new attributes, the image selected again.
    const tr = e.view.state.tr.setNodeMarkup(pos, undefined, { ...image.attrs, width: 120 });
    e.view.dispatch(tr.setSelection(NodeSelection.create(tr.doc, pos)));
    expect(kinds(e)).toEqual(['block:image']);
    expect(e.getHTML()).toContain('width="120"');
    // The image stays selected (its toolbar stays).
    expect(e.view.state.selection).toBeInstanceOf(NodeSelection);
    decide(e, 'reject');
    expect(e.getHTML()).toBe(original);
  });
});

describe('lists and quotes', () => {
  it('a paragraph made a bulleted list: the item carries "wrap"; reject gives the paragraph back', async () => {
    const original = '<p>One</p><p>Two</p>';
    for (const action of ['reject', 'accept'] as const) {
      const e = await mount(original);
      cursorIn(e, 0);
      e.exec('bulletList');
      expect(kinds(e)).toEqual(['wrap:list_item']);
      expect(e.getHTML()).toContain('<li data-suggestion=');
      decide(e, action);
      expect(listSuggestions(e.view.state.doc)).toEqual([]);
      expect(e.getHTML()).toBe(
        action === 'reject' ? original : '<ul><li><p>One</p></li></ul><p>Two</p>',
      );
    }
  });

  it('several paragraphs into a list, and a typed "- " too', async () => {
    const e = await mount('<p>One</p><p>Two</p>');
    e.view.dispatch(e.view.state.tr.setSelection(TextSelection.create(e.view.state.doc, 2, 8)));
    e.exec('orderedList');
    expect(kinds(e)).toEqual(['wrap:list_item', 'wrap:list_item']);
    decide(e, 'reject');
    expect(e.getHTML()).toBe('<p>One</p><p>Two</p>');

    const t = await mount('<p></p>');
    cursorIn(t, 0);
    type(t, '- ');
    expect(t.getHTML()).toMatch(/^<ul><li data-suggestion=/);
    expect(kinds(t)).toEqual(['wrap:list_item']);
    type(t, 'Milk');
    decide(t, 'reject');
    expect(t.getHTML()).toBe('<p></p>');
  });

  it('a list item taken out of its list stays until accepted ("unwrap")', async () => {
    const original = '<ul><li><p>One</p></li><li><p>Two</p></li></ul>';
    const e = await mount(original);
    cursorIn(e, 1);
    e.exec('bulletList');
    // Still in the list, marked to be taken out.
    expect(e.getHTML()).toMatch(/^<ul><li><p>One<\/p><\/li><li data-suggestion=/);
    expect(kinds(e)).toEqual(['unwrap:list_item']);
    decide(e, 'reject');
    expect(e.getHTML()).toBe(original);
    e.exec('bulletList');
    decide(e, 'accept');
    expect(e.getHTML()).toBe('<ul><li><p>One</p></li></ul><p>Two</p>');
  });

  it('Tab and Shift+Tab in a list are suggestions; Tab then Shift+Tab is no change at all', async () => {
    const original = '<ul><li><p>One</p></li><li><p>Two</p></li></ul>';
    const e = await mount(original);
    cursorIn(e, 1);
    e.exec('indent');
    expect(e.getHTML()).toContain('<ul><li data-suggestion=');
    expect(kinds(e)).toEqual(['wrap:list_item']);
    e.exec('outdent');
    expect(e.getHTML()).toBe(original);
    expect(listSuggestions(e.view.state.doc)).toEqual([]);

    e.exec('indent');
    decide(e, 'reject');
    expect(e.getHTML()).toBe(original);

    const nested = '<ul><li><p>One</p><ul><li><p>Two</p></li></ul></li></ul>';
    const n = await mount(nested);
    cursorIn(n, 1);
    n.exec('outdent');
    expect(kinds(n)).toEqual(['unwrap:list_item']);
    decide(n, 'accept');
    expect(n.getHTML()).toBe(original);
  });

  it('Enter on your own new empty item leaves the list as usual; rejecting takes it all back', async () => {
    const original = '<ul><li><p>One</p></li></ul>';
    const e = await mount(original);
    cursorIn(e, 0);
    press(e, 'Enter');
    expect(e.getHTML().match(/<li/g)).toHaveLength(2);
    press(e, 'Enter');
    // Out of the list: an empty paragraph after it, a suggestion of your own.
    expect(e.getHTML()).toMatch(/^<ul><li><p>One<\/p><\/li><\/ul><p data-suggestion=/);
    type(e, 'Next');
    decide(e, 'reject');
    expect(e.getHTML()).toBe(original);
  });

  it('a bulleted list made numbered remembers it was bulleted', async () => {
    const original = '<ul><li><p>One</p></li></ul>';
    const e = await mount(original);
    cursorIn(e, 0);
    e.exec('orderedList');
    expect(e.getHTML()).toMatch(/^<ol data-suggestion=/);
    expect(kinds(e)).toEqual(['block:ordered_list']);
    decide(e, 'reject');
    expect(e.getHTML()).toBe(original);
  });

  it('a quote: "wrap" on the quote; reject takes the text out of it again', async () => {
    const original = '<p>Quote me</p>';
    const e = await mount(original);
    cursorIn(e, 0);
    e.exec('blockquote');
    expect(kinds(e)).toEqual(['wrap:blockquote']);
    decide(e, 'reject');
    expect(e.getHTML()).toBe(original);
    e.exec('blockquote');
    decide(e, 'accept');
    expect(e.getHTML()).toBe('<blockquote><p>Quote me</p></blockquote>');
  });
});

describe('nothing changes the document directly, and nobody’s name is borrowed', () => {
  it('pasted content carries no suggestions: only the person pasting suggests', async () => {
    const e = await mount('<p>x</p>', { enabled: false });
    cursorIn(e, 0);
    const html =
      '<p><ins data-suggestion="s1" data-author="bob" data-name="Bob">fake</ins></p><table data-suggestion="s2" data-change="insert" data-author="bob" data-name="Bob"><tbody><tr><td><p>t</p></td></tr></tbody></table>';
    e.view.pasteHTML(html);
    expect(listSuggestions(e.view.state.doc)).toEqual([]);
    expect(e.getHTML()).not.toContain('data-suggestion');
  });

  it('in suggestions-only mode an edit that can’t be a suggestion isn’t made', async () => {
    const e = await mount(T2x2, { force: true });
    const notify = vi.spyOn(e.ui, 'notify');
    e.view.dispatch(e.view.state.tr.setDocAttribute('nope', 1));
    expect(e.view.state.doc.attrs.nope).toBeUndefined();
    expect(notify).toHaveBeenCalledWith('This change can’t be a suggestion');
  });

  it('a collaborator’s structure change and undo apply as they are', async () => {
    const e = await mount('<p>One</p>');
    cursorIn(e, 0);
    e.exec('bulletList');
    e.exec('undo');
    expect(e.getHTML()).toBe('<p>One</p>');
    const c = await mount('<p>One</p>');
    const { schema } = c.view.state;
    const range = c.view.state.doc.resolve(1).blockRange()!;
    c.view.dispatch(
      c.view.state.tr
        .wrap(range, [{ type: schema.nodes.blockquote! }])
        .setMeta('y-sync$', { isChangeOrigin: true }),
    );
    expect(c.getHTML()).toBe('<blockquote><p>One</p></blockquote>');
    expect(listSuggestions(c.view.state.doc)).toEqual([]);
  });

  it('node suggestions come back the same from HTML', async () => {
    const saved =
      '<table data-suggestion="s1" data-change="insert" data-author="bob" data-name="Bob" data-time="1700000000000"><tbody><tr data-suggestion="s2" data-change="delete" data-author="bob" data-name="Bob"><td><p>a</p></td></tr></tbody></table><ul><li data-suggestion="s3" data-change="wrap" data-depth="2" data-author="bob" data-name="Bob"><p>b</p></li></ul><hr data-suggestion="s4" data-change="delete" data-author="bob" data-name="Bob">';
    const e = await mount(saved, { enabled: false });
    expect(e.getHTML()).toBe(saved);
    expect(kinds(e)).toEqual([
      'insert:table',
      'delete:table_row',
      'wrap:list_item',
      'delete:horizontal_rule',
    ]);
  });
});

describe('regressions', () => {
  it('a whole formatted word replaced is text, not a node change (text is a leaf too)', async () => {
    const e = await mount('<p>Hello <strong>bold</strong> world</p>');
    const { schema } = e.view.state;
    // "bold" is a text node of its own: 7…11.
    e.view.dispatch(
      e.view.state.tr.replaceWith(7, 11, schema.text('big', [schema.marks.bold!.create()])),
    );
    expect(kinds(e)).toEqual(['delete:text', 'insert:text']);
    decide(e, 'accept');
    expect(e.getHTML()).toBe('<p>Hello <strong>big</strong> world</p>');
  });

  it('what a node "was" comes from HTML: a type that doesn’t fit there is never put back', async () => {
    const e = await mount(
      '<ul><li data-suggestion="s1" data-before="{&quot;type&quot;:&quot;table_cell&quot;,&quot;attrs&quot;:{&quot;colspan&quot;:&quot;x&quot;}}" data-author="bob" data-name="Bob"><p>x</p></li></ul>',
      { enabled: false },
    );
    expect(kinds(e)).toEqual(['block:list_item']);
    decide(e, 'reject');
    expect(e.getHTML()).toBe('<ul><li><p>x</p></li></ul>');
  });
});

describe('a node or paragraphs put in the middle of a paragraph', () => {
  it('a line in the middle: reject removes it and joins the paragraph again', async () => {
    const original = '<p>Hello world</p>';
    const e = await mount(original);
    cursorIn(e, 0, 5);
    e.exec('horizontalRule');
    expect(e.getHTML()).toMatch(/^<p>Hello<\/p><hr data-suggestion=/);
    decide(e, 'reject');
    expect(e.getHTML()).toBe(original);
  });

  it('paragraphs pasted in the middle: reject gives back the one paragraph', async () => {
    const original = '<p>Hello world</p>';
    const e = await mount(original);
    cursorIn(e, 0, 5);
    e.view.pasteHTML('<p>A</p><p>B</p>');
    expect(e.getHTML().match(/<p/g)!.length).toBe(2);
    decide(e, 'reject');
    expect(e.getHTML()).toBe(original);
    cursorIn(e, 0, 5);
    e.view.pasteHTML('<p>A</p><p>B</p>');
    decide(e, 'accept');
    expect(e.getHTML()).toBe('<p>HelloA</p><p>B world</p>');
  });
});

describe('undone in the right order (found by the property-based test)', () => {
  it('Enter at the start of an item, Tab on the empty one, a table: rejecting never throws and gives the list back', async () => {
    const original = '<ul><li><p>a</p></li><li><p>a</p></li><li><p>a</p></li></ul>';
    const e = await mount(original);
    cursorIn(e, 1, 0);
    press(e, 'Enter');
    cursorIn(e, 1, 0);
    e.exec('indent');
    cursorIn(e, 0, 0);
    e.exec(insertTable(2, 2, false));
    expect(() => decide(e, 'reject')).not.toThrow();
    expect(e.getHTML()).toBe(original);
  });

  it('a list, Enter at the start of its item, Tab on the new item: rejecting gives the paragraph back', async () => {
    const e = await mount('<p>a</p>');
    cursorIn(e, 0, 0);
    e.exec('bulletList');
    cursorIn(e, 0, 0);
    press(e, 'Enter');
    cursorIn(e, 1, 0);
    e.exec('indent');
    decide(e, 'reject');
    expect(e.getHTML()).toBe('<p>a</p>');
  });

  it('an item with a nested list: Enter at the end of its text is a break (the nested list comes back)', async () => {
    const original = '<ol><li><p>a</p><ul><li><p>a</p></li></ul></li></ol>';
    const e = await mount(original);
    cursorIn(e, 0, 0);
    press(e, 'Enter');
    cursorIn(e, 1, 0);
    e.exec('indent');
    cursorIn(e, 0, 0);
    press(e, 'Enter');
    decide(e, 'reject');
    expect(e.getHTML()).toBe(original);
  });
});
