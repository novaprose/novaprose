import { afterEach, describe, expect, it } from 'vitest';
import { createEditor, type Editor, type EditorOptions } from '../src';

/** The editor's writing direction: the direction option, the language, the page's dir; indent and arrows. */

let editor: Editor | null = null;
afterEach(() => {
  editor?.destroy();
  editor = null;
  document.body.innerHTML = '';
});

function mount(options: Partial<EditorOptions> = {}, content = '<p>x</p>', parent?: HTMLElement) {
  const element = document.createElement('div');
  (parent ?? document.body).append(element);
  editor = createEditor({ element, content, ...options });
  return editor;
}

describe('writing direction', () => {
  it('direction: rtl puts dir on the editor; Arabic and Hebrew turn it on by themselves', () => {
    expect(mount({ direction: 'rtl' }).root.dir).toBe('rtl');
    editor!.destroy();
    expect(mount({ language: 'ar-EG' }).direction).toBe('rtl');
    editor!.destroy();
    expect(mount({ language: 'he', direction: 'ltr' }).direction).toBe('ltr');
    editor!.destroy();
    expect(mount({ language: 'en' }).direction).toBe('ltr');
  });

  it('without the option, as the page', () => {
    const page = document.createElement('div');
    page.dir = 'rtl';
    document.body.append(page);
    const e = mount({}, '<p>x</p>', page);
    expect(e.direction).toBe('rtl');
    expect(e.root.hasAttribute('dir')).toBe(false);
  });

  it('a right-to-left paragraph indent is margin-right, and it is read back', () => {
    const e = mount({ direction: 'rtl' }, '<p style="margin-right: 80px">x</p>');
    expect(e.getHTML()).toBe('<p style="margin-right: 80px;">x</p>');
    e.setContent('<p>y</p>');
    e.exec('indent');
    expect(e.getHTML()).toBe('<p style="margin-right: 40px;">y</p>');
  });

  it('a block with its own dir="ltr" in a right-to-left editor is indented on the left', () => {
    const html = '<p dir="ltr" style="margin-left: 40px;">x</p>';
    expect(mount({ direction: 'rtl' }, html).getHTML()).toBe(html);
  });

  it('left to right, the indent is margin-left as before', () => {
    const e = mount({}, '<p>y</p>');
    e.exec('indent');
    expect(e.getHTML()).toBe('<p style="margin-left: 40px;">y</p>');
  });

  it('toolbar: ← is the next button, → the previous one', () => {
    const e = mount({ direction: 'rtl', toolbar: 'bold italic underline' });
    const [bold, italic] = [...e.root.querySelectorAll<HTMLButtonElement>('.nova-toolbar button')];
    bold!.focus();
    const key = (k: string) =>
      document.activeElement!.dispatchEvent(
        new KeyboardEvent('keydown', { key: k, bubbles: true }),
      );
    key('ArrowLeft');
    expect(document.activeElement).toBe(italic);
    key('ArrowRight');
    expect(document.activeElement).toBe(bold);
  });
});
