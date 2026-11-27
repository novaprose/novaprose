import { TextSelection } from 'prosemirror-state';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEditor, type Editor, type EditorOptions } from '../src';
import { applyFormat, copyFormat } from '../src/plugins/formatpainter';

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

function select(editor: Editor, from: number, to = from): void {
  const { state } = editor.view;
  editor.view.dispatch(state.tr.setSelection(TextSelection.create(state.doc, from, to)));
}

/** Position of the n-th occurrence of `text` in the document (counted from 1). */
function at(editor: Editor, text: string, n = 1): number {
  let found = -1;
  let seen = 0;
  editor.view.state.doc.descendants((node, pos) => {
    if (found >= 0 || !node.isText) return found < 0;
    let index = node.text!.indexOf(text);
    while (index >= 0 && found < 0) {
      if (++seen === n) found = pos + index;
      index = node.text!.indexOf(text, index + 1);
    }
    return false;
  });
  if (found < 0) throw new Error(`"${text}" not found`);
  return found;
}

/** Copy at the cursor in `source`, then apply to the range of `target` (or a cursor in it). */
function paint(editor: Editor, source: string, target: string, cursor = false): string {
  select(editor, at(editor, source) + 1);
  const format = copyFormat(editor.view.state);
  const start = at(editor, target);
  if (cursor) select(editor, start + 1);
  else select(editor, start, start + target.length);
  const tr = applyFormat(editor.view.state, format);
  if (tr) editor.view.dispatch(tr);
  return editor.getHTML();
}

describe('copying and applying a format', () => {
  it('replaces the formatting of the selected text, keeping links', () => {
    const editor = mount(
      '<p><strong><span style="color: #c0392b;">source</span></strong> text</p>' +
        '<p><em>plain</em> and <a href="https://example.com">linked target</a></p>',
    );
    expect(paint(editor, 'source', 'plain')).toContain(
      '<strong><span style="color: #c0392b;">plain</span></strong>',
    );
    expect(paint(editor, 'source', 'linked')).toContain(
      '<a href="https://example.com"><strong><span style="color: #c0392b;">linked</span></strong> target</a>',
    );
  });

  it('a selection inside one block takes only the text formatting', () => {
    const editor = mount('<h2 style="text-align: center;">Title</h2><p>first word here</p>');
    expect(paint(editor, 'Title', 'word')).toBe(
      '<h2 style="text-align: center;">Title</h2><p>first word here</p>',
    );
  });

  it('a cursor in a word paints the word and its block takes the kind and layout', () => {
    const editor = mount(
      '<h2 style="text-align: center;"><em>Title</em></h2><p>first word here</p>',
    );
    expect(paint(editor, 'Title', 'word', true)).toBe(
      '<h2 style="text-align: center;"><em>Title</em></h2>' +
        '<h2 style="text-align: center;">first <em>word</em> here</h2>',
    );
  });

  it('a whole block or several blocks take the block format', () => {
    const editor = mount('<p style="text-align: right;">source</p><h3>one</h3><h3>two</h3>');
    select(editor, at(editor, 'source') + 1);
    const format = copyFormat(editor.view.state);
    select(editor, at(editor, 'one'), at(editor, 'two') + 3);
    editor.view.dispatch(applyFormat(editor.view.state, format)!);
    expect(editor.getHTML()).toBe(
      '<p style="text-align: right;">source</p>' +
        '<p style="text-align: right;">one</p><p style="text-align: right;">two</p>',
    );
  });

  it('a code block keeps its kind', () => {
    const editor = mount('<h2>Title</h2><pre><code>code</code></pre>');
    expect(paint(editor, 'Title', 'code', true)).toBe('<h2>Title</h2><pre><code>code</code></pre>');
  });

  it('an empty line keeps the format for what is typed next', () => {
    const editor = mount('<p><strong>bold</strong></p><p></p>');
    select(editor, at(editor, 'bold') + 1);
    const format = copyFormat(editor.view.state);
    select(editor, editor.view.state.doc.content.size - 1);
    editor.view.dispatch(applyFormat(editor.view.state, format)!);
    editor.view.dispatch(editor.view.state.tr.insertText('typed'));
    expect(editor.getHTML()).toBe('<p><strong>bold</strong></p><p><strong>typed</strong></p>');
  });
});

describe('the formatpainter plugin', () => {
  async function ready(content: string): Promise<Editor> {
    const editor = mount(content, { plugins: ['formatpainter'] });
    await editor.ready;
    return editor;
  }

  const button = (editor: Editor) => {
    const control = editor.ui.registry.get('formatpainter');
    if (control?.type !== 'button') throw new Error('no formatpainter button');
    return control;
  };

  /** A mouse selection: the selection, then mouseup on the text (painting runs after a tick). */
  function mouseSelect(editor: Editor, from: number, to: number): void {
    select(editor, from, to);
    editor.view.dom.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    vi.advanceTimersByTime(1);
  }

  it('the button copies; the next mouse selection is painted; then it is off', async () => {
    vi.useFakeTimers();
    const editor = await ready('<p><strong>bold</strong> one two</p>');
    select(editor, at(editor, 'bold') + 1);
    button(editor).onAction(editor);
    expect(button(editor).isActive!(editor)).toBe(true);
    vi.advanceTimersByTime(600);
    mouseSelect(editor, at(editor, 'one'), at(editor, 'one') + 3);
    expect(editor.getHTML()).toBe('<p><strong>bold</strong> <strong>one</strong> two</p>');
    expect(button(editor).isActive!(editor)).toBe(false);
    mouseSelect(editor, at(editor, 'two'), at(editor, 'two') + 3);
    expect(editor.getHTML()).toBe('<p><strong>bold</strong> <strong>one</strong> two</p>');
  });

  it('a double click keeps painting until Escape', async () => {
    vi.useFakeTimers();
    const editor = await ready('<p><em>it</em> one two three</p>');
    select(editor, at(editor, 'it') + 1);
    button(editor).onAction(editor);
    button(editor).onAction(editor);
    vi.advanceTimersByTime(600);
    mouseSelect(editor, at(editor, 'one'), at(editor, 'one') + 3);
    mouseSelect(editor, at(editor, 'two'), at(editor, 'two') + 3);
    expect(editor.getHTML()).toBe('<p><em>it</em> <em>one</em> <em>two</em> three</p>');
    editor.view.someProp('handleKeyDown', (f) =>
      f(editor.view, new KeyboardEvent('keydown', { key: 'Escape' })),
    );
    expect(button(editor).isActive!(editor)).toBe(false);
    mouseSelect(editor, at(editor, 'three'), at(editor, 'three') + 5);
    expect(editor.getHTML()).toBe('<p><em>it</em> <em>one</em> <em>two</em> three</p>');
  });

  it('Ctrl+Alt+C copies and Ctrl+Alt+V applies, as often as needed', async () => {
    const editor = await ready('<p><u>under</u> one two</p>');
    const press = (key: string) =>
      editor.view.someProp('handleKeyDown', (f) =>
        f(editor.view, new KeyboardEvent('keydown', { key, ctrlKey: true, altKey: true })),
      );
    select(editor, at(editor, 'under') + 1);
    expect(press('c')).toBe(true);
    select(editor, at(editor, 'one'), at(editor, 'one') + 3);
    expect(press('v')).toBe(true);
    select(editor, at(editor, 'two'), at(editor, 'two') + 3);
    press('v');
    expect(editor.getHTML()).toBe('<p><u>under</u> <u>one</u> <u>two</u></p>');
  });

  it('says what happens to screen readers', async () => {
    vi.useFakeTimers();
    const editor = await ready('<p><strong>bold</strong> one</p>');
    select(editor, at(editor, 'bold') + 1);
    button(editor).onAction(editor);
    vi.advanceTimersByTime(60);
    expect(editor.root.querySelector('.nova-announcer')?.textContent).toBe(
      'Format copied. Select the text to apply it to.',
    );
  });
});
