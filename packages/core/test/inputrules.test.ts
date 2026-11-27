import { TextSelection } from 'prosemirror-state';
import { afterEach, describe, expect, it } from 'vitest';
import { createEditor, type Editor } from '../src';

/** Typographic input rules: "--" becomes an em dash, "..." an ellipsis, but never inside code. */

const editors: Editor[] = [];
afterEach(() => {
  editors.splice(0).forEach((e) => e.destroy());
  document.body.innerHTML = '';
});

function mount(content: string, options: Record<string, unknown> = {}) {
  const element = document.createElement('div');
  document.body.appendChild(element);
  const editor = createEditor({ element, content, ...options });
  editors.push(editor);
  const end = TextSelection.atEnd(editor.view.state.doc);
  editor.view.dispatch(editor.view.state.tr.setSelection(end));
  return editor;
}

function type(e: Editor, text: string) {
  for (const ch of text) {
    const { from, to } = e.view.state.selection;
    const handled = e.view.someProp('handleTextInput', (f) =>
      f(e.view, from, to, ch, () => e.view.state.tr.insertText(ch, from, to)),
    );
    if (!handled) e.view.dispatch(e.view.state.tr.insertText(ch, from, to));
  }
}

describe('typographic input rules', () => {
  it('in text: -- is an em dash, ... an ellipsis', () => {
    const e = mount('<p>Wait</p>');
    type(e, '-- so...');
    expect(e.view.state.doc.textContent).toBe('Wait— so…');
  });

  it('inside inline code and code blocks they stay as typed (npm --help, a...b)', () => {
    const inline = mount('<p><code>npm x</code></p>');
    // The cursor inside the code, before "x".
    inline.view.dispatch(
      inline.view.state.tr.setSelection(TextSelection.create(inline.view.state.doc, 5)),
    );
    type(inline, '--help a...b ');
    expect(inline.getHTML()).toBe('<p><code>npm --help a...b x</code></p>');
    const block = mount('<pre><code>x</code></pre>');
    type(block, ' --help ...');
    expect(block.view.state.doc.textContent).toBe('x --help ...');
  });

  it('textPatterns: false turns them all off: Markdown and typography stay as typed (WCAG 2.1.4)', () => {
    const e = mount('<p></p>', { textPatterns: false });
    type(e, '# Title -- so... - x');
    expect(e.getHTML()).toBe('<p># Title -- so... - x</p>');
    const md = mount('<p></p>');
    type(md, '# Title');
    expect(md.getHTML()).toBe('<h1>Title</h1>');
  });
});
