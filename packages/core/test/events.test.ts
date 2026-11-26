import { TextSelection } from 'prosemirror-state';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEditor, type Editor, type EditorEvent } from '../src';

/**
 * Editor events: what fires and when, which details come as the second argument.
 * The main difference: change means the document changed in any way, input means the user changed it.
 */

const editors: Editor[] = [];
afterEach(() => {
  editors.splice(0).forEach((e) => e.destroy());
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

function mount(
  content = '<p>Hello</p>',
  options: Partial<Parameters<typeof createEditor>[0]> = {},
) {
  const element = document.createElement('div');
  document.body.appendChild(element);
  const editor = createEditor({ element, content, ...options });
  editors.push(editor);
  return editor;
}

/** Typing by the user, as ProseMirror sees it (an input transaction). */
function type(editor: Editor, text: string) {
  const { state } = editor.view;
  editor.view.dispatch(state.tr.setSelection(TextSelection.atEnd(state.doc)).insertText(text));
}

function record(editor: Editor, events: EditorEvent[]) {
  const log: string[] = [];
  for (const name of events) editor.on(name, () => log.push(name));
  return log;
}

describe('events', () => {
  it('init fires once, when the editor is ready', async () => {
    const editor = mount();
    const onInit = vi.fn();
    editor.on('init', onInit);
    expect(onInit).not.toHaveBeenCalled();
    await editor.ready;
    expect(onInit).toHaveBeenCalledTimes(1);
    expect(onInit).toHaveBeenCalledWith(editor, undefined);
  });

  it('input fires on user input, together with change; the details are the transaction', () => {
    const editor = mount();
    const onInput = vi.fn();
    editor.on('input', onInput);
    const log = record(editor, ['change', 'selectionChange']);
    type(editor, '!');
    expect(onInput).toHaveBeenCalledTimes(1);
    expect(onInput.mock.calls[0]![1].transaction.docChanged).toBe(true);
    expect(log).toEqual(['change', 'selectionChange']);
  });

  it('a command from the toolbar or a keyboard shortcut is input too', () => {
    const editor = mount('<p>Hello</p>');
    const log = record(editor, ['input']);
    editor.view.dispatch(
      editor.view.state.tr.setSelection(TextSelection.create(editor.view.state.doc, 1, 6)),
    );
    editor.exec('bold');
    expect(log).toEqual(['input']);
  });

  it('setContent and insertContent fire change without input', () => {
    const editor = mount();
    const log = record(editor, ['change', 'input']);
    editor.setContent('<p>Other</p>');
    editor.insertContent('<p>More</p>');
    expect(log).toEqual(['change', 'change']);
  });

  it('beforeSetContent can replace the content, setContent reports the result', () => {
    const editor = mount();
    editor.on('beforeSetContent', (_e, detail) => {
      detail.content = String(detail.content).replace('draft', 'final');
    });
    const onSet = vi.fn();
    editor.on('setContent', onSet);
    editor.setContent('<p>draft</p>');
    expect(editor.getHTML()).toBe('<p>final</p>');
    expect(onSet).toHaveBeenCalledWith(editor, { content: '<p>final</p>' });
  });

  it("keydown: the details are the event; preventDefault cancels the editor's handling", () => {
    const editor = mount('<p>Hello</p>');
    const seen: string[] = [];
    editor.on('keydown', (_e, { event }) => {
      seen.push(event.key);
      // Ctrl+Enter means "send", not a line break.
      if (event.key === 'Enter' && event.ctrlKey) event.preventDefault();
    });
    const before = editor.getHTML();
    editor.view.dom.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Enter',
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      }),
    );
    expect(seen).toEqual(['Enter']);
    expect(editor.getHTML()).toBe(before);
  });

  it('focus and blur get the DOM event', () => {
    const editor = mount();
    const onFocus = vi.fn();
    editor.on('focus', onFocus);
    editor.view.dom.dispatchEvent(new FocusEvent('focus'));
    expect(onFocus.mock.calls[0]![1].event).toBeInstanceOf(FocusEvent);
  });

  it("an error in one handler doesn't break the editor or the other subscribers", () => {
    const editor = mount();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const second = vi.fn();
    editor.on('change', () => {
      throw new Error('bug in client code');
    });
    editor.on('change', second);
    expect(() => type(editor, '!')).not.toThrow();
    expect(second).toHaveBeenCalled();
    expect(editor.getHTML()).toBe('<p>Hello!</p>');
  });

  it('off and the unsubscribe function', () => {
    const editor = mount();
    const a = vi.fn();
    const b = vi.fn();
    const unsubscribe = editor.on('change', a);
    editor.on('change', b);
    unsubscribe();
    editor.off('change', b);
    type(editor, '!');
    expect(a).not.toHaveBeenCalled();
    expect(b).not.toHaveBeenCalled();
  });
});

describe('getCommandState', () => {
  it('active and enabled, for a custom toolbar', () => {
    const editor = mount('<p><strong>Bold</strong> plain</p>');
    editor.view.dispatch(
      editor.view.state.tr.setSelection(TextSelection.create(editor.view.state.doc, 2)),
    );
    expect(editor.getCommandState('bold')).toEqual({ active: true, enabled: true });
    expect(editor.getCommandState('italic')).toEqual({ active: false, enabled: true });
    // unlink is available only on a link.
    expect(editor.getCommandState('unlink').enabled).toBe(false);
  });

  it('in read-only mode nothing is available', () => {
    const editor = mount('<p>Text</p>', { editable: false });
    expect(editor.getCommandState('bold').enabled).toBe(false);
  });
});
