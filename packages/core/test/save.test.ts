import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEditor, type Editor, type EditorOptions } from '../src';

const editors: Editor[] = [];
afterEach(() => {
  for (const editor of editors.splice(0)) editor.destroy();
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

async function ready(
  content: string,
  options: Partial<EditorOptions> = {},
  parent: HTMLElement = document.body,
): Promise<Editor> {
  const element = document.createElement('div');
  parent.append(element);
  const editor = createEditor({ element, content, plugins: ['save'], ...options });
  editors.push(editor);
  await editor.ready;
  return editor;
}

const control = (editor: Editor, name: 'save' | 'cancel') => {
  const spec = editor.ui.registry.get(name);
  if (spec?.type !== 'button') throw new Error(`no ${name} button`);
  return spec;
};

const type = (editor: Editor, text: string) =>
  editor.view.dispatch(editor.view.state.tr.insertText(text, 1));

const pressCtrlS = (editor: Editor) =>
  editor.view.someProp('handleKeyDown', (f) =>
    f(editor.view, new KeyboardEvent('keydown', { key: 's', ctrlKey: true })),
  );

describe('the save plugin', () => {
  it('Save is enabled by changes; onSave gets the editor; then it is disabled again', async () => {
    const onSave = vi.fn();
    const editor = await ready('<p>text</p>', { pluginOptions: { save: { onSave } } });
    expect(control(editor, 'save').isEnabled!(editor)).toBe(false);
    type(editor, 'new ');
    expect(control(editor, 'save').isEnabled!(editor)).toBe(true);
    control(editor, 'save').onAction(editor);
    await vi.waitFor(() => expect(onSave).toHaveBeenCalledWith(editor));
    await vi.waitFor(() => expect(control(editor, 'save').isEnabled!(editor)).toBe(false));
  });

  it('enableWhenDirty: false keeps Save enabled', async () => {
    const editor = await ready('<p>text</p>', {
      pluginOptions: { save: { onSave: () => {}, enableWhenDirty: false } },
    });
    expect(control(editor, 'save').isEnabled!(editor)).toBe(true);
  });

  it('Ctrl/Cmd+S saves', async () => {
    const onSave = vi.fn();
    const editor = await ready('<p>text</p>', { pluginOptions: { save: { onSave } } });
    expect(pressCtrlS(editor)).toBe(true);
    await vi.waitFor(() => expect(onSave).toHaveBeenCalled());
  });

  it('without onSave, the form around the editor is submitted', async () => {
    const form = document.createElement('form');
    document.body.append(form);
    const submit = vi.fn((event: Event) => event.preventDefault());
    form.addEventListener('submit', submit);
    const editor = await ready('<p>text</p>', {}, form);
    type(editor, 'x');
    control(editor, 'save').onAction(editor);
    await vi.waitFor(() => expect(submit).toHaveBeenCalled());
  });

  it('Cancel brings back the text of the last save', async () => {
    const onCancel = vi.fn();
    const editor = await ready('<p>first</p>', {
      pluginOptions: { save: { onSave: () => {}, onCancel } },
    });
    type(editor, 'A ');
    control(editor, 'save').onAction(editor);
    await vi.waitFor(() => expect(control(editor, 'cancel').isEnabled!(editor)).toBe(false));
    type(editor, 'B ');
    expect(control(editor, 'cancel').isEnabled!(editor)).toBe(true);
    control(editor, 'cancel').onAction(editor);
    expect(editor.getHTML()).toBe('<p>A first</p>');
    expect(onCancel).toHaveBeenCalledWith(editor);
    expect(control(editor, 'cancel').isEnabled!(editor)).toBe(false);
  });

  it('setContent from code is a new starting point', async () => {
    const editor = await ready('<p>first</p>', { pluginOptions: { save: { onSave: () => {} } } });
    editor.setContent('<p>loaded</p>');
    expect(control(editor, 'save').isEnabled!(editor)).toBe(false);
    type(editor, 'x');
    control(editor, 'cancel').onAction(editor);
    expect(editor.getHTML()).toBe('<p>loaded</p>');
  });

  it('a failed save keeps the changes unsaved and shows an error', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const editor = await ready('<p>text</p>', {
      pluginOptions: { save: { onSave: () => Promise.reject(new Error('offline')) } },
    });
    type(editor, 'x');
    control(editor, 'save').onAction(editor);
    await vi.waitFor(() => expect(document.body.textContent).toContain('Could not save'));
    expect(control(editor, 'save').isEnabled!(editor)).toBe(true);
  });
});
