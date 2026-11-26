import { TextSelection } from 'prosemirror-state';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEditor, type Editor, type EditorOptions } from '../src';
import { markdownToHTML, toMarkdown } from '../src/markdown';
import { toSegments } from '../src/plugins/code-highlight';
import { codeHighlightIdle, setCodeLanguage } from '../src/plugins/codesample';

/**
 * Code blocks: the language in HTML (ours, TinyMCE, Prism, Prettify), highlighting by the codesample plugin
 * (decorations only: the output HTML doesn't change), language choice, the dialog, the "```js" fence,
 * paste from VS Code.
 */

let editor: Editor | null = null;
afterEach(() => {
  editor?.destroy();
  editor = null;
  document.body.innerHTML = '';
  vi.useRealTimers();
});

async function mount(content: string, options: Partial<EditorOptions> = {}): Promise<Editor> {
  const element = document.createElement('div');
  document.body.append(element);
  editor = createEditor({ element, content, plugins: ['codesample'], ...options });
  editor.focus();
  await editor.ready;
  await highlighted(editor);
  return editor;
}

/** The grammars have loaded and the highlighting is drawn. */
async function highlighted(e: Editor): Promise<void> {
  await codeHighlightIdle(e.view.state);
}

/** Classes of the highlighted pieces of text in the first code block: "const" → hljs-keyword. */
function tokens(e: Editor, index = 0): Record<string, string> {
  const pre = e.root.querySelectorAll('.nova-prosemirror pre')[index]!;
  const out: Record<string, string> = {};
  for (const span of pre.querySelectorAll('span[class*="hljs-"]')) {
    out[span.textContent!] = span.className;
  }
  return out;
}

function cursorAfter(e: Editor, text: string): void {
  let pos = -1;
  e.view.state.doc.descendants((node, at) => {
    if (pos < 0 && node.isText && node.text!.includes(text)) {
      pos = at + node.text!.indexOf(text) + text.length;
    }
  });
  e.view.dispatch(e.view.state.tr.setSelection(TextSelection.create(e.view.state.doc, pos)));
}

/** Typing letter by letter through handleTextInput: that is how input rules fire. */
function type(e: Editor, text: string): void {
  for (const ch of text) {
    const { from, to } = e.view.state.selection;
    const handled = e.view.someProp('handleTextInput', (f) =>
      f(e.view, from, to, ch, () => e.view.state.tr.insertText(ch, from, to)),
    );
    if (!handled) e.view.dispatch(e.view.state.tr.insertText(ch, from, to));
  }
}

function pressEnter(e: Editor): void {
  e.view.dom.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
}

const JS = '<pre><code class="language-javascript">const answer = 42; // ok</code></pre>';

describe('code block language in HTML (core, without the plugin)', () => {
  const plain = (content: string) => {
    const element = document.createElement('div');
    document.body.append(element);
    editor = createEditor({ element, content });
    return editor.getHTML();
  };

  it('round trip without changes', () => {
    expect(plain(JS)).toBe(JS);
  });

  it('TinyMCE and Prism (class on <pre>), Prettify (lang-x), data-language', () => {
    expect(plain('<pre class="language-markup"><code>&lt;b&gt;</code></pre>')).toBe(
      '<pre><code class="language-markup">&lt;b&gt;</code></pre>',
    );
    editor!.destroy();
    expect(plain('<pre class="prettyprint lang-py">x</pre>')).toBe(
      '<pre><code class="language-py">x</code></pre>',
    );
    editor!.destroy();
    expect(plain('<pre data-language="ruby"><code>x</code></pre>')).toBe(
      '<pre><code class="language-ruby">x</code></pre>',
    );
    editor!.destroy();
    expect(plain('<pre><code class="hljs language-c++ line-numbers">x</code></pre>')).toBe(
      '<pre><code class="language-c++">x</code></pre>',
    );
  });

  it("garbage in the language from HTML and JSON doesn't reach the class or the Markdown fence", () => {
    expect(plain('<pre><code class="language-a&quot;onclick">x</code></pre>')).toBe(
      '<pre><code>x</code></pre>',
    );
    for (const language of ['"><img src=x onerror=alert(1)>', 'a b', 42, {}, 'x'.repeat(40)]) {
      editor!.setContent({
        type: 'doc',
        content: [
          { type: 'code_block', attrs: { language }, content: [{ type: 'text', text: 'x' }] },
        ],
      });
      expect(editor!.getHTML()).toBe('<pre><code>x</code></pre>');
      expect(toMarkdown(editor!)).toBe('```\nx\n```');
    }
  });
});

describe('highlighting (plugins: codesample)', () => {
  it("draws highlight.js tokens and doesn't change the output HTML", async () => {
    const e = await mount(JS);
    const t = tokens(e);
    expect(t.const).toBe('hljs-keyword');
    expect(t['42']).toBe('hljs-number');
    expect(t['// ok']).toBe('hljs-comment');
    expect(e.getHTML()).toBe(JS);
    const pre = e.root.querySelector('.nova-prosemirror pre')!;
    expect(pre.getAttribute('data-language')).toBe('JavaScript');
    expect(pre.getAttribute('spellcheck')).toBe('false');
  });

  it('aliases: js, html (with <script> inside), markup from TinyMCE', async () => {
    const e = await mount(
      '<pre><code class="language-js">let a</code></pre>' +
        '<pre><code class="language-html">&lt;script&gt;let b&lt;/script&gt;</code></pre>' +
        '<pre class="language-markup"><code>&lt;i&gt;</code></pre>',
    );
    expect(tokens(e, 0).let).toBe('hljs-keyword');
    // Inside <script>, JavaScript highlighting (the HTML grammar pulls it in).
    expect(tokens(e, 1).let).toBe('hljs-keyword');
    expect(tokens(e, 1).script).toBe('hljs-tag hljs-name');
    expect(tokens(e, 2).i).toBe('hljs-tag hljs-name');
    const labels = [...e.root.querySelectorAll('.nova-prosemirror pre')].map((p) =>
      p.getAttribute('data-language'),
    );
    expect(labels).toEqual(['JavaScript', 'HTML', 'HTML/XML']);
  });

  it('an unknown language and plain text: no highlighting; the label as is', async () => {
    const e = await mount(
      '<pre><code class="language-brainfuck">+++</code></pre><pre><code>let x</code></pre>',
    );
    expect(tokens(e, 0)).toEqual({});
    expect(tokens(e, 1)).toEqual({});
    const [unknown, plain] = e.root.querySelectorAll('.nova-prosemirror pre');
    expect(unknown!.getAttribute('data-language')).toBe('brainfuck');
    expect(plain!.hasAttribute('data-language')).toBe(false);
  });

  it('typing recolors only its own block; the neighboring block keeps its highlighting', async () => {
    const e = await mount(JS + '<pre><code class="language-python">def f(): pass</code></pre>');
    cursorAfter(e, 'const answer = 42;');
    e.view.dispatch(e.view.state.tr.insertText(' return'));
    expect(tokens(e, 0).return).toBe('hljs-keyword');
    expect(tokens(e, 1).def).toBe('hljs-keyword');
    // Blocks right next to each other: editing the second doesn't touch the first one's decorations.
    cursorAfter(e, 'pass');
    e.view.dispatch(e.view.state.tr.insertText(' # done'));
    expect(tokens(e, 1)['# done']).toBe('hljs-comment');
    expect(tokens(e, 0).const).toBe('hljs-keyword');
  });

  it('changing the language: the command, the label, highlighting, the class in HTML', async () => {
    const e = await mount('<pre><code>SELECT 1</code></pre>');
    cursorAfter(e, 'SELECT');
    expect(e.exec(setCodeLanguage('sql'))).toBe(true);
    await highlighted(e);
    expect(tokens(e).SELECT).toBe('hljs-keyword');
    expect(e.getHTML()).toBe('<pre><code class="language-sql">SELECT 1</code></pre>');
    e.exec(setCodeLanguage(null));
    expect(tokens(e)).toEqual({});
    expect(e.getHTML()).toBe('<pre><code>SELECT 1</code></pre>');
    // Outside a code block the command isn't available.
    e.setContent('<p>text</p>');
    expect(e.can(setCodeLanguage('sql'))).toBe(false);
  });

  it('language menu: the current one is checked, a choice changes the language; a language not in the list goes first', async () => {
    const e = await mount('<pre><code class="language-ts">let a</code></pre>');
    cursorAfter(e, 'let');
    const control = e.ui.registry.get('codelanguage')!;
    if (control.type !== 'menu') throw new Error('codelanguage is not a menu');
    expect(control.label!(e)).toBe('TypeScript');
    const items = control.items(e).filter((i) => i.type !== 'separator' && i.type !== 'heading');
    expect(items.slice(0, 2).map((i) => 'label' in i && i.label)).toEqual([
      'Plain text',
      'TypeScript',
    ]);
    expect(items.find((i) => 'active' in i && i.active)).toMatchObject({ id: 'ts' });
    const python = items.find((i) => 'id' in i && i.id === 'python')!;
    if ('onSelect' in python) python.onSelect();
    expect(e.getHTML()).toBe('<pre><code class="language-python">let a</code></pre>');
    expect(control.label!(e)).toBe('Python');
  });

  it('context toolbar: in a code block, above its right corner, in a right-to-left document too', async () => {
    const spec = async (direction: 'ltr' | 'rtl') => {
      const e = await mount('<pre><code>x</code></pre><p>text</p>', { direction });
      const [name, found] = e.ui.registry.getContextToolbars()[0]!;
      expect(name).toBe('codesample');
      cursorAfter(e, 'x');
      expect(found.predicate(e)).toBe(true);
      cursorAfter(e, 'text');
      expect(found.predicate(e)).toBe(false);
      const placement =
        typeof found.placement === 'function' ? found.placement(e) : found.placement;
      e.destroy();
      return placement;
    };
    // Code is always left to right: the right corner is the line "end" left to right and the "start" right to left.
    expect(await spec('ltr')).toBe('top-end');
    expect(await spec('rtl')).toBe('top-start');
  });

  it('a large block is recolored after a pause in typing, not on every letter', async () => {
    const big = 'let x = 1;\n'.repeat(1900); // > 20,000 characters
    const e = await mount(`<pre><code class="language-javascript">${big}</code></pre>`);
    expect(e.root.querySelectorAll('.nova-prosemirror pre .hljs-keyword')).toHaveLength(1900);
    vi.useFakeTimers();
    e.view.dispatch(e.view.state.tr.insertText('const ', 1));
    // Right away: the old decorations (shifted), the new word isn't colored yet.
    expect(tokens(e)['const']).toBeUndefined();
    vi.advanceTimersByTime(400);
    expect(tokens(e)['const']).toBe('hljs-keyword');
  });

  it('ranges: nested scopes are merged, unexpected markup gets no highlighting', () => {
    expect(
      toSegments('<span class="hljs-string">`a <span class="hljs-subst">${b}</span>`</span>', 8),
    ).toEqual([
      { from: 0, to: 3, className: 'hljs-string' },
      { from: 3, to: 7, className: 'hljs-string hljs-subst' },
      { from: 7, to: 8, className: 'hljs-string' },
    ]);
    expect(toSegments('a &lt; b', 5)).toEqual([]);
    expect(toSegments('<b>x</b>', 1)).toBeNull();
  });
});

describe('the "```" fence', () => {
  it('"```js" and a space make a code block with a language; "```" without a space is still text', async () => {
    const e = await mount('<p></p>');
    type(e, '```');
    expect(e.getHTML()).toBe('<p>```</p>');
    type(e, 'js ');
    expect(e.getHTML()).toBe('<pre><code class="language-js"></code></pre>');
    type(e, 'let');
    await highlighted(e);
    expect(tokens(e).let).toBe('hljs-keyword');
  });

  it('Enter after "```" or "```python" makes a code block; in the middle of a paragraph it does not', async () => {
    const e = await mount('<p>```python</p>');
    cursorAfter(e, '```python');
    pressEnter(e);
    expect(e.getHTML()).toBe('<pre><code class="language-python"></code></pre>');
    e.setContent('<p>```</p>');
    cursorAfter(e, '```');
    pressEnter(e);
    expect(e.getHTML()).toBe('<pre><code></code></pre>');
    e.setContent('<p>``` not a fence</p>');
    cursorAfter(e, '``` not a fence');
    pressEnter(e);
    expect(e.getHTML()).toBe('<p>``` not a fence</p><p></p>');
  });

  it('code blocks forbidden (content rules): the fence stays text', async () => {
    const e = await mount('<p>```js</p>', { invalidElements: 'pre' });
    cursorAfter(e, '```js');
    pressEnter(e);
    expect(e.getHTML()).not.toContain('<pre');
  });
});

describe('paste from VS Code', () => {
  function paste(e: Editor, data: Record<string, string>): void {
    const clipboardData = {
      getData: (t: string) => data[t] ?? '',
      types: Object.keys(data),
      files: [] as File[],
      items: [],
    };
    e.view.dom.dispatchEvent(
      new ClipboardEvent('paste', {
        clipboardData: clipboardData as unknown as DataTransfer,
        bubbles: true,
        cancelable: true,
      }),
    );
  }
  const THEMED =
    '<div style="color: #d4d4d4;background-color: #1e1e1e;font-family: Consolas"><div><span style="color: #569cd6;">const</span> a</div></div>';

  it("several lines become a code block with the file's language, without the theme colors", async () => {
    const e = await mount('<p>Before</p><p></p>');
    e.view.dispatch(e.view.state.tr.setSelection(TextSelection.atEnd(e.view.state.doc)));
    paste(e, {
      'text/plain': 'const a = 1;\r\n  return a;\r\n',
      'text/html': THEMED,
      'vscode-editor-data': JSON.stringify({ version: 1, mode: 'typescriptreact' }),
    });
    expect(e.getHTML()).toBe(
      '<p>Before</p><pre><code class="language-tsx">const a = 1;\n  return a;</code></pre>',
    );
    await highlighted(e);
    expect(tokens(e).const).toBe('hljs-keyword');
  });

  it('one line and Markdown become regular text; shellscript becomes bash', async () => {
    const e = await mount('<p></p>');
    paste(e, {
      'text/plain': 'npm install',
      'text/html': THEMED,
      'vscode-editor-data': '{"mode":"shellscript"}',
    });
    expect(e.getHTML()).toBe('<p>npm install</p>');
    e.setContent('<p></p>');
    paste(e, {
      'text/plain': '# Title\ntext',
      'text/html': THEMED,
      'vscode-editor-data': '{"mode":"markdown"}',
    });
    expect(e.getHTML()).toBe('<p># Title</p><p>text</p>');
    e.setContent('<p></p>');
    paste(e, {
      'text/plain': 'line one\nline two',
      'text/html': THEMED,
      'vscode-editor-data': '{"mode":"plaintext"}',
    });
    expect(e.getHTML()).toBe('<p>line one</p><p>line two</p>');
    e.setContent('<p></p>');
    paste(e, {
      'text/plain': 'echo 1\necho 2',
      'vscode-editor-data': '{"mode":"shellscript"}',
    });
    expect(e.getHTML()).toBe('<pre><code class="language-bash">echo 1\necho 2</code></pre>');
  });
});

describe('the "Code sample" dialog (the codesample button)', () => {
  const dialogEl = (e: Editor) => e.root.querySelector<HTMLFormElement>('.nova-dialog');
  const field = <T extends HTMLElement>(e: Editor, name: string) =>
    dialogEl(e)!.querySelector<T>(`[name="${name}"]`)!;
  const open = async (e: Editor) => {
    const button = e.ui.registry.get('codesample')!;
    if (button.type !== 'button') throw new Error('codesample is not a button');
    button.onAction(e);
    await vi.waitFor(() => expect(dialogEl(e)).not.toBeNull());
  };
  const submit = async (e: Editor) => {
    dialogEl(e)!.requestSubmit();
    await vi.waitFor(() => expect(dialogEl(e)).toBeNull());
  };

  it('insert: language and code; an empty paragraph is replaced, the cursor goes to the end of the code', async () => {
    const e = await mount('<p>Intro</p><p></p>');
    e.view.dispatch(e.view.state.tr.setSelection(TextSelection.atEnd(e.view.state.doc)));
    await open(e);
    const code = field<HTMLTextAreaElement>(e, 'code');
    expect(code.classList.contains('nova-input-code')).toBe(true);
    expect(code.spellcheck).toBe(false);
    field<HTMLSelectElement>(e, 'language').value = 'python';
    code.value = 'print(1)\r\nprint(2)';
    await submit(e);
    expect(e.getHTML()).toBe(
      '<p>Intro</p><pre><code class="language-python">print(1)\nprint(2)</code></pre>',
    );
    expect(e.view.state.selection.$from.parent.type.name).toBe('code_block');
  });

  it('edit: with the cursor in a block the dialog has its code and language, saving replaces the block', async () => {
    const e = await mount(JS);
    cursorAfter(e, 'answer');
    await open(e);
    expect(field<HTMLSelectElement>(e, 'language').value).toBe('javascript');
    expect(field<HTMLTextAreaElement>(e, 'code').value).toBe('const answer = 42; // ok');
    field<HTMLSelectElement>(e, 'language').value = 'typescript';
    field<HTMLTextAreaElement>(e, 'code').value = 'const answer: number = 42;';
    await submit(e);
    expect(e.getHTML()).toBe(
      '<pre><code class="language-typescript">const answer: number = 42;</code></pre>',
    );
  });
});

describe('Markdown', () => {
  it('a fence with a language round trip', async () => {
    const e = await mount(JS);
    const md = toMarkdown(e);
    expect(md).toBe('```javascript\nconst answer = 42; // ok\n```');
    e.setContent(markdownToHTML(md));
    expect(e.getHTML()).toBe(JS);
  });
});
