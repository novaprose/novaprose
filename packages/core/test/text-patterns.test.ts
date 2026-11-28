import { TextSelection } from 'prosemirror-state';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEditor, type Editor, type EditorOptions } from '../src';

/** Your own typing shortcuts: at the start of a block, between markers, replacements. */

const editors: Editor[] = [];
afterEach(() => {
  editors.splice(0).forEach((e) => e.destroy());
  document.body.innerHTML = '';
});

function mount(options: Partial<EditorOptions>, content = '<p></p>') {
  const element = document.createElement('div');
  document.body.appendChild(element);
  const editor = createEditor({ element, content, ...options });
  editors.push(editor);
  editor.view.dispatch(
    editor.view.state.tr.setSelection(TextSelection.atEnd(editor.view.state.doc)),
  );
  return editor;
}

/** Types text the way a keyboard does: each character through handleTextInput. */
function type(e: Editor, text: string) {
  for (const ch of text) {
    const { from, to } = e.view.state.selection;
    const handled = e.view.someProp('handleTextInput', (f) =>
      f(e.view, from, to, ch, () => e.view.state.tr.insertText(ch, from, to)),
    );
    if (!handled) e.view.dispatch(e.view.state.tr.insertText(ch, from, to));
  }
}

function enter(e: Editor) {
  const event = new KeyboardEvent('keydown', { key: 'Enter' });
  if (!e.view.someProp('handleKeyDown', (f) => f(e.view, event))) {
    e.view.dispatch(e.view.state.tr.split(e.view.state.selection.from));
  }
}

const PATTERNS = [
  { start: '*', end: '*', format: 'italic' },
  { start: '**', end: '**', format: 'bold' },
  { start: '#', format: 'h1' },
  { start: '##', format: 'h2' },
  { start: '1.', command: 'orderedList' as const },
  { start: '- ', command: 'bulletList' as const, trigger: 'enter' as const },
  { start: '(c)', replacement: '©' },
];

describe('textPatterns: your own list', () => {
  it('at the start of a block: "# " and "## " make headings, "1. " a numbered list', () => {
    const e = mount({ textPatterns: PATTERNS });
    type(e, '## Title');
    expect(e.getHTML()).toBe('<h2>Title</h2>');
    e.setContent('<p></p>');
    e.view.dispatch(e.view.state.tr.setSelection(TextSelection.atEnd(e.view.state.doc)));
    type(e, '1. one');
    expect(e.getHTML()).toBe('<ol><li><p>one</p></li></ol>');
  });

  it('between markers: italic and bold when a space follows; a space inside stays text', () => {
    const e = mount({ textPatterns: PATTERNS });
    type(e, 'a *word* and **strong** then 2 * 3 * 4 ');
    expect(e.getHTML()).toBe(
      '<p>a <em>word</em> and <strong>strong</strong> then 2 * 3 * 4&nbsp;</p>',
    );
  });

  it('a replacement, and Enter as the trigger of a block pattern', () => {
    const e = mount({ textPatterns: PATTERNS });
    type(e, '(c) 2026');
    expect(e.getHTML()).toBe('<p>© 2026</p>');
    e.setContent('<p></p>');
    e.view.dispatch(e.view.state.tr.setSelection(TextSelection.atEnd(e.view.state.doc)));
    type(e, '- milk');
    enter(e);
    expect(e.getHTML()).toMatch(/^<ul><li><p>milk<\/p><\/li>/);
  });

  it('your list replaces the built-in shortcuts; nothing fires in code', () => {
    const e = mount({ textPatterns: [{ start: '(c)', replacement: '©' }] });
    type(e, '# not a heading -- (c) ');
    expect(e.getHTML()).toBe('<p># not a heading -- ©&nbsp;</p>');
    const code = mount({ textPatterns: PATTERNS }, '<pre><code></code></pre>');
    type(code, '# *x* ');
    expect(code.getHTML()).toBe('<pre><code># *x* </code></pre>');
  });

  it('a function command gets the editor and the value; a format of your own works too', () => {
    const run = vi.fn();
    const e = mount({
      formats: { note: { inline: 'span', classes: 'note' } },
      textPatterns: [
        { start: '!', end: '!', format: 'note' },
        { start: '>>', command: run, value: 42 },
      ],
    });
    type(e, '!hey! ');
    expect(e.getHTML()).toBe('<p><span class="note">hey</span>&nbsp;</p>');
    e.setContent('<p></p>');
    e.view.dispatch(e.view.state.tr.setSelection(TextSelection.atEnd(e.view.state.doc)));
    type(e, '>> ');
    expect(run).toHaveBeenCalledWith(e, 42);
  });

  it('textPatternsLookup adds patterns from the text before the cursor', () => {
    const lookup = vi.fn(({ text }: { text: string }) =>
      text.endsWith('@me') ? [{ start: '@me', replacement: 'Ann' }] : [],
    );
    const e = mount({ textPatternsLookup: lookup });
    type(e, 'hi @me ');
    expect(e.getHTML()).toBe('<p>hi Ann&nbsp;</p>');
    expect(lookup).toHaveBeenCalledWith(expect.objectContaining({ text: 'hi @me' }));
  });

  it('patterns from options can be anything: malformed ones are left out', () => {
    const e = mount({
      textPatterns: [
        null,
        { start: 5 },
        {},
        { start: '' },
        { start: 'x' },
        { start: '(r)', replacement: '®' },
      ] as never,
    });
    type(e, '(r) x ');
    expect(e.getHTML()).toBe('<p>® x&nbsp;</p>');
  });
});
