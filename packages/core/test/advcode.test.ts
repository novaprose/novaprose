import { EditorSelection } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEditor, prettyHTML, type Editor } from '../src';

/** The enhanced code editor (advcode): the Source code dialog with CodeMirror. */

const editors: Editor[] = [];
afterEach(() => {
  editors.splice(0).forEach((e) => e.destroy());
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

async function openCode(content: string, options: Record<string, unknown> = {}) {
  const element = document.createElement('div');
  document.body.appendChild(element);
  const editor = createEditor({
    element,
    content,
    toolbar: 'code',
    plugins: ['advcode'],
    pluginOptions: { advcode: options },
  });
  editors.push(editor);
  await editor.ready;
  editor.root.querySelector<HTMLElement>('[data-control="code"]')!.click();
  await vi.waitFor(() => expect(editor.root.querySelector('.cm-editor')).not.toBeNull(), {
    timeout: 5000,
  });
  const view = EditorView.findFromDOM(editor.root.querySelector<HTMLElement>('.cm-editor')!)!;
  const dialog = editor.root.querySelector<HTMLFormElement>('.nova-dialog')!;
  return { editor, view, dialog };
}

const CONTENT = '<h2>Title</h2><ul><li><p>one</p></li><li><p>two</p></li></ul><p>End</p>';

describe('advcode', () => {
  it('opens the HTML laid out, in a code editor with a label; saving changes the document', async () => {
    const { editor, view, dialog } = await openCode(CONTENT);
    expect(view.state.doc.toString()).toBe(prettyHTML(CONTENT));
    expect(view.contentDOM.getAttribute('aria-label')).toBe('Source code');
    expect(dialog.querySelector('[role="toolbar"]')).not.toBeNull();
    const end = view.state.doc.length;
    view.dispatch({ changes: { from: end, insert: '\n<p>Added</p>' } });
    dialog.requestSubmit();
    await vi.waitFor(() => expect(editor.root.querySelector('.nova-dialog')).toBeNull());
    expect(editor.getHTML()).toBe(CONTENT + '<p>Added</p>');
    // The code editor is gone with the dialog.
    expect(editor.root.querySelector('.cm-editor')).toBeNull();
  });

  it('closing without changes leaves the document as it was', async () => {
    const { editor, dialog } = await openCode(CONTENT);
    const setContent = vi.spyOn(editor, 'setContent');
    dialog
      .querySelector<HTMLButtonElement>(
        '.nova-dialog-footer .nova-button:not(.nova-button-primary)',
      )!
      .click();
    expect(editor.root.querySelector('.nova-dialog')).toBeNull();
    expect(setContent).not.toHaveBeenCalled();
    expect(editor.getHTML()).toBe(CONTENT);
  });

  it('text size, line wrapping and full screen; prettify: false keeps the plain layout', async () => {
    const { view, dialog } = await openCode(CONTENT, { fontSize: 16, wrap: false });
    const code = dialog.querySelector<HTMLElement>('.nova-advcode-code')!;
    expect(code.style.getPropertyValue('--nova-advcode-size')).toBe('16px');
    const buttons = [...dialog.querySelectorAll<HTMLButtonElement>('.nova-advcode-toolbar button')];
    const byLabel = (label: string) => buttons.find((b) => b.getAttribute('aria-label') === label)!;
    byLabel('Larger text').click();
    expect(code.style.getPropertyValue('--nova-advcode-size')).toBe('18px');
    const wrap = byLabel('Wrap long lines');
    expect(wrap.getAttribute('aria-pressed')).toBe('false');
    expect(view.contentDOM.classList.contains('cm-lineWrapping')).toBe(false);
    wrap.click();
    expect(wrap.getAttribute('aria-pressed')).toBe('true');
    expect(view.contentDOM.classList.contains('cm-lineWrapping')).toBe(true);
    byLabel('Full screen').click();
    expect(dialog.classList.contains('nova-advcode-full')).toBe(true);

    dialog.requestSubmit();
    const second = await openCode(CONTENT, { prettify: false });
    expect(second.view.state.doc.toString()).not.toContain('  <li>');
  });

  it('Escape that the code editor uses itself keeps the dialog open; the next one closes it', async () => {
    const { editor, view } = await openCode(CONTENT);
    const escape = () =>
      view.contentDOM.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
      );
    // Two cursors: the first Escape leaves one, and the dialog stays.
    view.dispatch({
      selection: EditorSelection.create([EditorSelection.cursor(0), EditorSelection.cursor(5)]),
    });
    escape();
    expect(view.state.selection.ranges).toHaveLength(1);
    expect(editor.root.querySelector('.nova-dialog')).not.toBeNull();
    escape();
    expect(editor.root.querySelector('.nova-dialog')).toBeNull();
  });
});
