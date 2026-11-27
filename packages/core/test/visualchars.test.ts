import { afterEach, describe, expect, it } from 'vitest';
import { createEditor, type Editor, type EditorOptions } from '../src';
import { invisibleCharacters } from '../src/plugins/visualchars';

const editors: Editor[] = [];
afterEach(() => {
  for (const editor of editors.splice(0)) editor.destroy();
});

async function ready(content: string, options: Partial<EditorOptions> = {}): Promise<Editor> {
  const element = document.createElement('div');
  document.body.append(element);
  const editor = createEditor({ element, content, plugins: ['visualchars'], ...options });
  editors.push(editor);
  await editor.ready;
  return editor;
}

const NBSP = String.fromCharCode(0xa0);
const SHY = String.fromCharCode(0xad);
const ZWSP = String.fromCharCode(0x200b);

/** What the view marks: the kind of each marked character. */
const marked = (editor: Editor) =>
  [...editor.view.dom.querySelectorAll('.nova-visualchar')].map((el) =>
    el.getAttribute('data-char'),
  );

const toggle = (editor: Editor) => editor.ui.registry.getMenuItem('visualchars')!.onAction(editor);

describe('invisible characters', () => {
  it('finds no-break spaces, soft hyphens and zero-width spaces', async () => {
    const editor = await ready(`<p>a${NBSP}b${SHY}c${ZWSP}d e</p>`);
    const found = invisibleCharacters(editor.view.state.doc).map((d) => [
      d.from,
      (d as unknown as { type: { attrs: Record<string, string> } }).type.attrs['data-char'],
    ]);
    expect(found).toEqual([
      [2, 'nbsp'],
      [4, 'shy'],
      [6, 'zwsp'],
    ]);
  });

  it('off by default; the toggle shows and hides them; the HTML never changes', async () => {
    const editor = await ready(`<p>a${NBSP}b</p>`);
    const html = editor.getHTML();
    expect(marked(editor)).toEqual([]);
    toggle(editor);
    expect(marked(editor)).toEqual(['nbsp']);
    expect(editor.ui.registry.getMenuItem('visualchars')!.isActive!(editor)).toBe(true);
    expect(editor.getHTML()).toBe(html);
    toggle(editor);
    expect(marked(editor)).toEqual([]);
  });

  it('follows typing and deleting while on', async () => {
    const editor = await ready('<p>one two</p>', {
      pluginOptions: { visualchars: { default: true } },
    });
    expect(marked(editor)).toEqual([]);
    editor.view.dispatch(editor.view.state.tr.insertText(NBSP, 4, 5));
    expect(marked(editor)).toEqual(['nbsp']);
    editor.view.dispatch(editor.view.state.tr.insertText(`x${SHY}y`, 1));
    expect(marked(editor)).toEqual(['shy', 'nbsp']);
    editor.view.dispatch(editor.view.state.tr.delete(1, 4));
    expect(marked(editor)).toEqual(['nbsp']);
  });
});
