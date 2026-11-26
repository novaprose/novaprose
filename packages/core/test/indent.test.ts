import { TextSelection } from 'prosemirror-state';
import { afterEach, describe, expect, it } from 'vitest';
import { createEditor, type Editor } from '../src';

/**
 * Indenting paragraphs and headings (margin-left in steps of 40px, margin-right for RTL) and lists.
 * Tab indents only in lists: in a paragraph it still moves the focus (no keyboard trap, WCAG 2.1.2).
 */

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
  // The cursor at the start of the first text block.
  editor.view.dispatch(
    editor.view.state.tr.setSelection(TextSelection.atStart(editor.view.state.doc)),
  );
  return editor;
}

function key(editor: Editor, keyName: string, mods: KeyboardEventInit = {}) {
  const event = new KeyboardEvent('keydown', {
    key: keyName,
    bubbles: true,
    cancelable: true,
    ...mods,
  });
  editor.view.dom.dispatchEvent(event);
  return event;
}

describe('indent HTML', () => {
  it.each([
    '<p style="margin-left: 40px;">a</p>',
    '<p style="margin-left: 120px;">a</p>',
    '<h2 style="margin-left: 40px;">h</h2>',
    '<p style="text-align: center; margin-left: 80px;">c</p>',
    '<p dir="rtl" style="margin-right: 40px;">ر</p>',
  ])('round trip without changes: %s', (html) => {
    expect(mount(html).getHTML()).toBe(html);
  });

  it('foreign units and padding are brought to the 40px step', () => {
    expect(mount('<p style="padding-left: 36pt;">a</p>').getHTML()).toBe(
      '<p style="margin-left: 40px;">a</p>',
    );
    expect(mount('<p style="margin-left: 5em;">a</p>').getHTML()).toBe(
      '<p style="margin-left: 80px;">a</p>',
    );
  });

  it('an indent inside a list item is not a paragraph indent', () => {
    const html = '<ul><li><p style="margin-left: 40px;">a</p></li></ul>';
    expect(mount(html).getHTML()).toBe('<ul><li><p>a</p></li></ul>');
  });

  it('the level is capped (10), garbage from JSON gives 0', () => {
    expect(mount('<p style="margin-left: 4000px;">a</p>').getHTML()).toBe(
      '<p style="margin-left: 400px;">a</p>',
    );
    const e = mount('<p>a</p>');
    e.setContent({
      type: 'doc',
      content: [
        { type: 'paragraph', attrs: { indent: 'x' }, content: [{ type: 'text', text: 'a' }] },
      ],
    });
    expect(e.getHTML()).toBe('<p>a</p>');
  });
});

describe('indent commands', () => {
  it('indent / outdent in a paragraph; outdent is unavailable at zero', () => {
    const e = mount('<p>a</p>');
    expect(e.can('outdent')).toBe(false);
    e.exec('indent');
    e.exec('indent');
    expect(e.getHTML()).toBe('<p style="margin-left: 80px;">a</p>');
    e.exec('outdent');
    expect(e.getHTML()).toBe('<p style="margin-left: 40px;">a</p>');
  });

  it('several paragraphs in the selection: all at once', () => {
    const e = mount('<p>a</p><p>b</p>');
    const { doc } = e.view.state;
    e.view.dispatch(
      e.view.state.tr.setSelection(TextSelection.create(doc, 1, doc.content.size - 1)),
    );
    e.exec('indent');
    expect(e.getHTML()).toBe(
      '<p style="margin-left: 40px;">a</p><p style="margin-left: 40px;">b</p>',
    );
  });

  it('in a list indent nests the item, as before', () => {
    const e = mount('<ul><li><p>a</p></li><li><p>b</p></li></ul>');
    const pos = e.view.state.doc.content.size - 3;
    e.view.dispatch(e.view.state.tr.setSelection(TextSelection.create(e.view.state.doc, pos)));
    e.exec('indent');
    expect(e.getHTML()).toBe('<ul><li><p>a</p><ul><li><p>b</p></li></ul></li></ul>');
  });

  it('paragraph → heading keeps the indent', () => {
    const e = mount('<p style="margin-left: 40px;">a</p>');
    e.exec('h2');
    expect(e.getHTML()).toBe('<h2 style="margin-left: 40px;">a</h2>');
  });

  it('an RTL paragraph is indented on the right', () => {
    const e = mount('<p dir="rtl">ر</p>');
    e.exec('indent');
    expect(e.getHTML()).toBe('<p dir="rtl" style="margin-right: 40px;">ر</p>');
  });
});

describe('keyboard', () => {
  it("Tab in a paragraph isn't intercepted: the focus moves on (no trap)", () => {
    const e = mount('<p>a</p>');
    const event = key(e, 'Tab');
    expect(event.defaultPrevented).toBe(false);
    expect(e.getHTML()).toBe('<p>a</p>');
  });

  it('Mod-] / Mod-[ indent the paragraph', () => {
    const e = mount('<p>a</p>');
    key(e, ']', { ctrlKey: true });
    expect(e.getHTML()).toBe('<p style="margin-left: 40px;">a</p>');
    key(e, '[', { ctrlKey: true });
    expect(e.getHTML()).toBe('<p>a</p>');
  });
});
