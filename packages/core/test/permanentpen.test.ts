import { splitBlock } from 'prosemirror-commands';
import { TextSelection } from 'prosemirror-state';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEditor, type Editor, type EditorOptions } from '../src';
import { penMarks } from '../src/plugins/permanentpen';

const editors: Editor[] = [];
afterEach(() => {
  for (const editor of editors.splice(0)) editor.destroy();
  vi.restoreAllMocks();
});

async function ready(content: string, options: Partial<EditorOptions> = {}): Promise<Editor> {
  const element = document.createElement('div');
  document.body.append(element);
  const editor = createEditor({ element, content, plugins: ['permanentpen'], ...options });
  editors.push(editor);
  await editor.ready;
  return editor;
}

function select(editor: Editor, pos: number): void {
  const { state } = editor.view;
  editor.view.dispatch(state.tr.setSelection(TextSelection.create(state.doc, pos)));
}

const type = (editor: Editor, text: string) =>
  editor.view.dispatch(editor.view.state.tr.insertText(text));

const pen = (editor: Editor) => {
  const control = editor.ui.registry.get('permanentpen');
  if (control?.type !== 'button') throw new Error('no permanentpen button');
  return control;
};

const end = (editor: Editor) => editor.view.state.doc.content.size - 1;

describe('the permanent pen', () => {
  it('turns properties into marks; nothing for empty values', () => {
    const editor = createEditor({ element: document.createElement('div'), content: '<p></p>' });
    editors.push(editor);
    const names = (props: Parameters<typeof penMarks>[1]) =>
      penMarks(editor.schema, props).map((mark) => mark.type.name);
    expect(names({ bold: true, forecolor: '#ff0000', hilitecolor: '' })).toEqual(['bold', 'color']);
    expect(names({ italic: true, fontname: 'Georgia, serif', fontsize: '14pt' })).toEqual([
      'italic',
      'font_family',
      'font_size',
    ]);
  });

  it('while on, typed text gets the pen, after Enter and after moving the cursor too', async () => {
    const editor = await ready('<p>text</p>');
    select(editor, end(editor));
    pen(editor).onAction(editor);
    expect(pen(editor).isActive!(editor)).toBe(true);
    type(editor, ' note');
    expect(editor.getHTML()).toBe(
      '<p>text<strong><span style="color: #c0392b;"> note</span></strong></p>',
    );
    splitBlock(editor.view.state, editor.view.dispatch);
    type(editor, 'next');
    expect(editor.getHTML()).toContain(
      '<p><strong><span style="color: #c0392b;">next</span></strong></p>',
    );
    select(editor, 1);
    type(editor, 'A');
    expect(editor.getHTML()).toMatch(
      /^<p><strong><span style="color: #c0392b;">A<\/span><\/strong>text/,
    );
  });

  it('turned off, typing goes on without the pen right after pen text', async () => {
    const editor = await ready('<p>text</p>');
    select(editor, end(editor));
    pen(editor).onAction(editor);
    type(editor, 'pen');
    pen(editor).onAction(editor);
    type(editor, 'plain');
    expect(editor.getHTML()).toBe(
      '<p>text<strong><span style="color: #c0392b;">pen</span></strong>plain</p>',
    );
  });

  it('keeps a link at the cursor', async () => {
    const editor = await ready('<p><a href="https://example.com">link</a></p>');
    select(editor, 3);
    pen(editor).onAction(editor);
    type(editor, 'X');
    expect(editor.getHTML()).toBe(
      '<p><a href="https://example.com">li<strong><span style="color: #c0392b;">X</span></strong>nk</a></p>',
    );
  });

  it('pluginOptions.permanentpen.properties sets the pen', async () => {
    const editor = await ready('<p>text</p>', {
      pluginOptions: { permanentpen: { properties: { italic: true, hilitecolor: '#ffff00' } } },
    });
    select(editor, end(editor));
    pen(editor).onAction(editor);
    type(editor, '!');
    expect(editor.getHTML()).toBe(
      '<p>text<em><span style="background-color: #ffff00;">!</span></em></p>',
    );
  });

  it('the properties dialog changes the pen', async () => {
    const editor = await ready('<p>text</p>');
    const dialog = vi.spyOn(editor.ui, 'dialog').mockResolvedValue({
      fontname: '',
      fontsize: '',
      bold: false,
      italic: false,
      underline: true,
      strikethrough: false,
      forecolor: '#1a5276',
      highlight: false,
      hilitecolor: '#ffff00',
    });
    editor.ui.registry.getMenuItem('configurepermanentpen')!.onAction(editor);
    await vi.waitFor(() => expect(dialog).toHaveBeenCalled());
    await Promise.resolve();
    select(editor, end(editor));
    pen(editor).onAction(editor);
    type(editor, 'u');
    expect(editor.getHTML()).toBe('<p>text<u><span style="color: #1a5276;">u</span></u></p>');
  });
});
