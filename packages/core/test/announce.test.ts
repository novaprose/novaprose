import { TextSelection } from 'prosemirror-state';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEditor, registerLanguage, type Editor, type EditorOptions } from '../src';
import dePack from '../src/i18n/packs/de';

/**
 * What a screen reader hears after a formatting shortcut or a typed Markdown shortcut: the editor's
 * hidden polite live region. NVDA reported nothing useful there ("Ctrl+B": the next word; "- ": only
 * "minus, space").
 */

registerLanguage('de', dePack);

const editors: Editor[] = [];
afterEach(() => {
  for (const editor of editors.splice(0)) editor.destroy();
  vi.useRealTimers();
});

function mount(content: string, options: Partial<EditorOptions> = {}): Editor {
  const element = document.createElement('div');
  document.body.append(element);
  const editor = createEditor({ element, content, ...options });
  editors.push(editor);
  return editor;
}

/** The text in the live region once it has been filled (it fills 50 ms after a change). */
function spoken(editor: Editor): string {
  vi.advanceTimersByTime(60);
  return editor.root.querySelector('.nova-announcer')?.textContent ?? '';
}

function press(editor: Editor, key: string, { ctrl = false, alt = false, shift = false } = {}) {
  editor.view.someProp('handleKeyDown', (f) =>
    f(
      editor.view,
      new KeyboardEvent('keydown', { key, ctrlKey: ctrl, altKey: alt, shiftKey: shift }),
    ),
  );
}

/** Typing as the browser does it: every character goes through handleTextInput (the input rules). */
function type(editor: Editor, text: string) {
  for (const ch of text) {
    const { from, to } = editor.view.state.selection;
    const handled = editor.view.someProp('handleTextInput', (f) =>
      f(editor.view, from, to, ch, () => editor.view.state.tr.insertText(ch, from, to)),
    );
    if (!handled) editor.view.dispatch(editor.view.state.tr.insertText(ch, from, to));
  }
}

function select(editor: Editor, from: number, to = from) {
  const { state } = editor.view;
  editor.view.dispatch(state.tr.setSelection(TextSelection.create(state.doc, from, to)));
}

describe('announcements for screen readers', () => {
  it('the live region is there from the start: a polite status inside the editor, empty', () => {
    const editor = mount('<p>a</p>');
    const region = editor.root.querySelector('.nova-announcer')!;
    expect(region.getAttribute('role')).toBe('status');
    expect(region.getAttribute('aria-live')).toBe('polite');
    expect(region.classList.contains('nova-visually-hidden')).toBe(true);
    expect(region.textContent).toBe('');
  });

  it('Ctrl+B on a selected word says "Bold on", and again "Bold off"', () => {
    vi.useFakeTimers();
    const editor = mount('<p>one source two</p>');
    select(editor, 5, 11);
    press(editor, 'b', { ctrl: true });
    expect(editor.getHTML()).toBe('<p>one <strong>source</strong> two</p>');
    expect(spoken(editor)).toBe('Bold on');
    press(editor, 'b', { ctrl: true });
    expect(spoken(editor)).toBe('Bold off');
  });

  it('other formats and lists say their name and state', () => {
    vi.useFakeTimers();
    const editor = mount('<p>text</p>');
    select(editor, 1, 5);
    press(editor, 'i', { ctrl: true });
    expect(spoken(editor)).toBe('Italic on');
    press(editor, '8', { ctrl: true, shift: true });
    expect(spoken(editor)).toBe('Bulleted list on');
    press(editor, '8', { ctrl: true, shift: true });
    expect(spoken(editor)).toBe('Bulleted list off');
  });

  it('block shortcuts say the block they made; alignment says the alignment', () => {
    vi.useFakeTimers();
    const editor = mount('<p>title</p>');
    select(editor, 2);
    press(editor, '2', { ctrl: true, alt: true });
    expect(spoken(editor)).toBe('Heading 2');
    press(editor, '0', { ctrl: true, alt: true });
    expect(spoken(editor)).toBe('Paragraph');
    press(editor, 'e', { ctrl: true, shift: true });
    expect(spoken(editor)).toBe('Align center');
  });

  it('typing "- " on an empty line says "Bulleted list"; "1. ", "## " and "> " say theirs', () => {
    vi.useFakeTimers();
    const cases: [string, string, string][] = [
      ['- ', 'Bulleted list', '<ul><li><p></p></li></ul>'],
      ['1. ', 'Numbered list', '<ol><li><p></p></li></ol>'],
      ['## ', 'Heading 2', '<h2></h2>'],
      ['> ', 'Quote', '<blockquote><p></p></blockquote>'],
    ];
    for (const [typed, said, html] of cases) {
      const editor = mount('<p></p>');
      select(editor, 1);
      type(editor, typed);
      expect(editor.getHTML()).toBe(html);
      expect(spoken(editor)).toBe(said);
    }
  });

  it('a shortcut that keeps the structure ("..." → "…") and plain typing say nothing', () => {
    vi.useFakeTimers();
    const editor = mount('<p></p>');
    select(editor, 1);
    type(editor, 'wait...');
    expect(editor.getHTML()).toBe('<p>wait…</p>');
    expect(spoken(editor)).toBe('');
  });

  it('the toolbar button does not add a second announcement: its pressed state is read already', () => {
    vi.useFakeTimers();
    const editor = mount('<p>one source two</p>');
    select(editor, 5, 11);
    editor.exec('bold');
    expect(spoken(editor)).toBe('');
  });

  it('a translated editor speaks its language', () => {
    vi.useFakeTimers();
    const editor = mount('<p>one source two</p>', { language: 'de' });
    select(editor, 5, 11);
    press(editor, 'b', { ctrl: true });
    expect(spoken(editor)).toBe(`${dePack.bold} an`);
  });
});
