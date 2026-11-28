import { afterEach, describe, expect, it } from 'vitest';
import { createEditor, type Editor } from '../src';

/**
 * Reading <pre>: its text, exactly, whatever it holds. Found by a property-based test
 * (security.property.test.ts): a <pre> holding blocks let its "keep the spaces as they are" mode
 * leak into the paragraphs after it (a tab stayed a tab, then became a space on the next save),
 * and its own text left the code block.
 */

let editor: Editor | null = null;
afterEach(() => {
  editor?.destroy();
  editor = null;
  document.body.innerHTML = '';
});

function html(input: string): string {
  const element = document.createElement('div');
  document.body.appendChild(element);
  editor ??= createEditor({ element });
  editor.setContent(input);
  return editor.getHTML();
}

describe('reading a <pre>', () => {
  it('blocks inside it: their text stays in the code block, one per line', () => {
    expect(html('<pre><p>x</p>y</pre>')).toBe('<pre><code>x\ny</code></pre>');
    expect(html('<pre><div>one</div><div>  two</div></pre>')).toBe(
      '<pre><code>one\n  two</code></pre>',
    );
  });

  it('a line break inside it is a new line, not lost', () => {
    expect(html('<pre>a<br>b</pre>')).toBe('<pre><code>a\nb</code></pre>');
  });

  it('after it, spaces are normal again', () => {
    expect(html('<pre><p></p></pre><p>a\tb</p>')).toBe('<pre><code></code></pre><p>a b</p>');
  });

  it('the HTML is stable: saving it again changes nothing', () => {
    const first = html(
      '<p><p><pre></p></pre></p></p><p><iframe><p href="java\tscript:alert(1)"></p></iframe></p>',
    );
    expect(html(first)).toBe(first);
  });

  it('plain code keeps every space, tab and line', () => {
    const code = '<pre><code class="language-js">if (a) {\n\treturn  b;\n}\n</code></pre>';
    expect(html(code)).toBe(code);
  });
});
