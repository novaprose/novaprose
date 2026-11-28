import { NodeSelection } from 'prosemirror-state';
import { afterEach, describe, expect, it } from 'vitest';
import { createEditor, type Editor, type SelectionBookmark } from '../src';

/** editor.selection: what is selected, as HTML or text; moving it; bookmarks across changes. */

const editors: Editor[] = [];
afterEach(() => {
  editors.splice(0).forEach((e) => e.destroy());
  document.body.innerHTML = '';
});

function mount(content: string) {
  const element = document.createElement('div');
  document.body.appendChild(element);
  const editor = createEditor({ element, content });
  editors.push(editor);
  return editor;
}

/** The document position of the first occurrence of `text` (its start). */
function posOf(e: Editor, text: string): number {
  let found = -1;
  e.view.state.doc.descendants((node, pos) => {
    if (found >= 0 || !node.isText) return found < 0;
    const at = node.text!.indexOf(text);
    if (at >= 0) found = pos + at;
    return false;
  });
  if (found < 0) throw new Error(`no "${text}"`);
  return found;
}

describe('editor.selection', () => {
  it('a range: set, read, collapse, select all', () => {
    const e = mount('<p>Hello world</p><p>Second line</p>');
    const start = posOf(e, 'world');
    e.selection.setRange(start, start + 5);
    expect(e.selection.getRange()).toEqual({ from: start, to: start + 5 });
    expect(e.selection.isCollapsed()).toBe(false);
    expect(e.selection.getText()).toBe('world');
    e.selection.collapse(true);
    expect(e.selection.getRange()).toEqual({ from: start, to: start });
    expect(e.selection.isCollapsed()).toBe(true);
    expect(e.selection.getHTML()).toBe('');
    e.selection.selectAll();
    expect(e.selection.getText()).toBe('Hello world\nSecond line');
  });

  it('HTML and text of a selection across blocks; replacing it', () => {
    const e = mount('<p>One <strong>bold</strong> two</p><ul><li><p>Item</p></li></ul>');
    e.selection.setRange(posOf(e, 'bold') + 2, posOf(e, 'Item') + 2);
    expect(e.selection.getHTML()).toBe('<p><strong>ld</strong> two</p><ul><li><p>It</p></li></ul>');
    expect(e.selection.getText()).toBe('ld two\nIt');
    e.selection.setRange(posOf(e, 'two'), posOf(e, 'two') + 3);
    expect(e.selection.setHTML('<em>three</em>')).toBe(true);
    expect(e.getHTML()).toContain('<p>One <strong>bold</strong> <em>three</em></p>');
  });

  it('the element where the selection is; selecting an element, a paragraph, an image', () => {
    const e = mount(
      '<p>Plain <strong>bold</strong> text</p><p>Next</p><p><img src="https://example.com/a.png" alt="A"></p>',
    );
    e.selection.setRange(posOf(e, 'bold') + 1);
    expect(e.selection.getNode()?.tagName).toBe('STRONG');
    const strong = e.view.dom.querySelector('strong')!;
    e.selection.select(strong);
    expect(e.selection.getText()).toBe('bold');
    // All of the bold word: that element; across elements: their common parent.
    expect(e.selection.getNode()).toBe(strong);
    e.selection.setRange(posOf(e, 'Plain'), posOf(e, 'text') + 2);
    expect(e.selection.getNode()?.tagName).toBe('P');
    const next = e.view.dom.querySelectorAll('p')[1]!;
    e.selection.select(next);
    expect(e.view.state.selection).toBeInstanceOf(NodeSelection);
    expect(e.selection.getHTML()).toBe('<p>Next</p>');
    e.selection.select(next, true);
    expect(e.view.state.selection).not.toBeInstanceOf(NodeSelection);
    expect(e.selection.getText()).toBe('Next');
    // (Not ProseMirror's own img.ProseMirror-separator: the picture, inside its frame.)
    const img = e.view.dom.querySelector('img[src]')!;
    e.selection.select(img);
    expect(e.view.state.selection).toBeInstanceOf(NodeSelection);
    expect((e.view.state.selection as NodeSelection).node.type.name).toBe('image');
    expect(e.selection.getNode()?.contains(img) || e.selection.getNode() === img).toBe(true);
  });

  it('a cursor in a text node, at an offset', () => {
    const e = mount('<p>Hello world</p>');
    const text = e.view.dom.querySelector('p')!.firstChild!;
    e.selection.setCursorLocation(text, 6);
    expect(e.selection.getRange()).toEqual({ from: 7, to: 7 });
    // An offset past the end stays in the text.
    e.selection.setCursorLocation(text, 999);
    expect(e.selection.getRange()).toEqual({ from: 12, to: 12 });
  });

  it('a DOM range of the selection, for measuring; the rectangle never throws', () => {
    const e = mount('<p>Hello <em>wide</em> world</p>');
    e.selection.setRange(posOf(e, 'wide'), posOf(e, 'world') + 2);
    expect(e.selection.getDOMRange()?.toString()).toBe('wide wo');
    expect(() => e.selection.getRect()).not.toThrow();
  });

  it('a bookmark follows the changes; its text deleted, it is gone', () => {
    const e = mount('<p>Alpha beta gamma</p>');
    e.selection.setRange(posOf(e, 'beta'), posOf(e, 'beta') + 4);
    const bookmark = e.selection.getBookmark();
    // Text typed before it moves it; the selection is elsewhere meanwhile.
    e.selection.setRange(1);
    e.view.dispatch(e.view.state.tr.insertText('New '));
    expect(e.selection.moveToBookmark(bookmark)).toBe(true);
    expect(e.selection.getText()).toBe('beta');
    // Undo undoes the typing, not the bookmark.
    e.exec('undo');
    expect(e.getHTML()).toBe('<p>Alpha beta gamma</p>');
    expect(e.selection.moveToBookmark(bookmark)).toBe(true);
    expect(e.selection.getText()).toBe('beta');
    // The text deleted: nowhere to go back to.
    e.view.dispatch(e.view.state.tr.deleteSelection());
    expect(e.selection.moveToBookmark(bookmark)).toBe(false);
  });

  it('at most 200 bookmarks are kept; the oldest go first', () => {
    const e = mount('<p>Text</p>');
    const first = e.selection.getBookmark();
    for (let i = 0; i < 200; i++) e.selection.getBookmark();
    expect(e.selection.moveToBookmark(first)).toBe(false);
    const last = e.selection.getBookmark();
    expect(e.selection.moveToBookmark(last)).toBe(true);
  });

  it('wrong arguments do nothing and never throw', () => {
    const e = mount('<p>Text</p>');
    const outside = document.createElement('p');
    document.body.appendChild(outside);
    expect(() => {
      e.selection.setRange(Number.NaN, 1e9);
      e.selection.setRange(-5);
      e.selection.select(outside);
      e.selection.select(e.view.dom);
      e.selection.setCursorLocation(outside, 3);
      e.selection.select(null as unknown as Node);
    }).not.toThrow();
    expect(e.selection.moveToBookmark({ id: 12345 })).toBe(false);
    expect(e.selection.moveToBookmark(null as unknown as SelectionBookmark)).toBe(false);
    expect(e.selection.moveToBookmark('x' as unknown as SelectionBookmark)).toBe(false);
  });
});
