import type { Slice } from 'prosemirror-model';
import { TextSelection } from 'prosemirror-state';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEditor, type Editor, type EditorOptions } from '../src';
import { looksLikeMarkdown } from '../src/plugins/markdown';

const editors: Editor[] = [];
afterEach(() => {
  for (const editor of editors.splice(0)) editor.destroy();
  document.body.innerHTML = '';
  vi.useRealTimers();
});

async function ready(content: string, options: Partial<EditorOptions> = {}): Promise<Editor> {
  const element = document.createElement('div');
  document.body.append(element);
  const editor = createEditor({ element, content, plugins: ['markdown'], ...options });
  editors.push(editor);
  await editor.ready;
  return editor;
}

/** A plain-text paste the way ProseMirror runs it: the text parsers, then the selection replaced. */
function pasteText(editor: Editor, text: string, plain = false): void {
  const { view } = editor;
  const $context = view.state.selection.$from;
  const slice = view.someProp('clipboardTextParser', (f) => f(text, $context, plain, view)) as
    Slice | undefined;
  if (slice) view.dispatch(view.state.tr.replaceSelection(slice));
  else view.dispatch(view.state.tr.insertText(text));
}

const cursorAtEnd = (editor: Editor) => {
  const { state } = editor.view;
  editor.view.dispatch(
    state.tr.setSelection(TextSelection.create(state.doc, state.doc.content.size - 1)),
  );
};

describe('what looks like Markdown', () => {
  it.each([
    '# Title',
    '- one\n- two',
    '1. one\n2. two',
    '- [ ] to do',
    '> a quote',
    '```js\ncode\n```',
    '| a | b |\n| --- | --- |\n| 1 | 2 |',
    'some **bold** words',
    'see [the docs](https://novaprose.com)',
    'run `pnpm check` first',
    '~~gone~~',
  ])('Markdown: %j', (text) => expect(looksLikeMarkdown(text)).toBe(true));

  it.each([
    'Hello, world.',
    'Prices: 5*3*2 = 30',
    'a - b - c',
    '- just one dash line',
    'Dear Ann,\n\nthe meeting is at 10.\nBest,\nBob',
    'word_with_underscores and snake_case',
    '[not a link] (because of the space)',
  ])('plain text: %j', (text) => expect(looksLikeMarkdown(text)).toBe(false));
});

describe('pasting Markdown', () => {
  it('becomes formatting, with a notification offering plain text', async () => {
    vi.useFakeTimers();
    const editor = await ready('<p></p>');
    pasteText(editor, '## Plan\n\n- **first** step\n- [docs](https://novaprose.com)');
    expect(editor.getHTML()).toBe(
      '<h2>Plan</h2><ul><li><p><strong>first</strong> step</p></li>' +
        '<li><p><a href="https://novaprose.com">docs</a></p></li></ul>',
    );
    vi.advanceTimersByTime(1);
    expect(document.body.textContent).toContain('Markdown pasted as formatting');
  });

  it('"Paste as text" in the notification brings the plain text instead', async () => {
    vi.useFakeTimers();
    const editor = await ready('<p></p>');
    pasteText(editor, '# Title');
    vi.advanceTimersByTime(1);
    const button = [...document.querySelectorAll('button')].find(
      (b) => b.textContent === 'Paste as text',
    );
    button!.click();
    expect(editor.getHTML()).toBe('<p># Title</p>');
  });

  it('ordinary text, Shift (plain) and code blocks stay plain', async () => {
    const editor = await ready('<p></p>');
    pasteText(editor, 'Hello, world.');
    expect(editor.getHTML()).toBe('<p>Hello, world.</p>');
    editor.setContent('<p></p>');
    pasteText(editor, '# Title', true);
    expect(editor.getHTML()).toBe('<p># Title</p>');
    editor.setContent('<pre><code>x</code></pre>');
    cursorAtEnd(editor);
    pasteText(editor, '# Title');
    expect(editor.getHTML()).toBe('<pre><code>x# Title</code></pre>');
  });

  it('pluginOptions.markdown.paste: false turns it off', async () => {
    const editor = await ready('<p></p>', { pluginOptions: { markdown: { paste: false } } });
    pasteText(editor, '# Title');
    expect(editor.getHTML()).toBe('<p># Title</p>');
  });

  it('Markdown copied in VS Code becomes formatting too', async () => {
    const editor = await ready('<p></p>');
    const data: Record<string, string> = {
      'text/plain': '# From VS Code\n\n- item',
      'text/html': '<div style="color: #d4d4d4"><span># From VS Code</span></div>',
      'vscode-editor-data': JSON.stringify({ mode: 'markdown' }),
    };
    const event = { clipboardData: { getData: (type: string) => data[type] ?? '' } };
    const handled = editor.view.someProp('handlePaste', (f) =>
      f(editor.view, event as unknown as ClipboardEvent, null as unknown as Slice),
    );
    expect(handled).toBe(true);
    expect(editor.getHTML()).toBe('<h1>From VS Code</h1><ul><li><p>item</p></li></ul>');
  });
});
