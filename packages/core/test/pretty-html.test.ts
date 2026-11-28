import fc from 'fast-check';
import { afterAll, describe, expect, it } from 'vitest';
import { createEditor, prettyHTML } from '../src';

/** HTML laid out for reading (the code editor, getContent({ prettify })): read back, the same document. */

const RUNS = Number(process.env.FC_RUNS) || 300;
const element = document.createElement('div');
document.body.appendChild(element);
const editor = createEditor({
  element,
  plugins: [
    'accordion',
    'footnotes',
    'math',
    'pagebreak',
    'media',
    'pageembed',
    'mediaembed',
    'advtable',
    'anchor',
  ],
});
afterAll(() => editor.destroy());

/** The editor's HTML, laid out and read back. */
const roundTrip = (html: string) => {
  editor.setContent(html);
  const before = editor.getHTML();
  editor.setContent(prettyHTML(before));
  return { before, after: editor.getHTML() };
};

describe('prettyHTML', () => {
  it('a block per line, nested blocks indented, inline content and <pre> as they are', () => {
    expect(
      prettyHTML(
        '<h2>Title</h2><p>Text <strong>bold</strong> and <a href="#x">a link</a>.</p>' +
          '<ul><li><p>a</p><ul><li><p>b</p></li></ul></li></ul>' +
          '<pre><code>line 1\n  line 2</code></pre><hr><p>a<br>b</p>',
      ),
    ).toBe(
      [
        '<h2>Title</h2>',
        '<p>Text <strong>bold</strong> and <a href="#x">a link</a>.</p>',
        '<ul>',
        '  <li>',
        '    <p>a</p>',
        '    <ul>',
        '      <li>',
        '        <p>b</p>',
        '      </li>',
        '    </ul>',
        '  </li>',
        '</ul>',
        '<pre><code>line 1',
        '  line 2</code></pre>',
        '<hr>',
        '<p>a<br>b</p>',
      ].join('\n'),
    );
  });

  it('a wrapper with inline content (a frame) stays on its line', () => {
    expect(
      prettyHTML('<div class="nova-pageembed"><iframe src="https://example.com/"></iframe></div>'),
    ).toBe('<div class="nova-pageembed"><iframe src="https://example.com/"></iframe></div>');
  });

  it.each([
    '<p>  two  spaces  </p><p>&nbsp;lead</p><p>tail&nbsp;</p>',
    '<table><tbody><tr><th><p>H</p></th></tr><tr><td><p>x <em>y</em></p></td></tr></tbody></table>',
    '<blockquote><p>q</p><ul><li><p>in a quote</p></li></ul></blockquote>',
    '<details open=""><summary>T</summary><p>Body</p></details>',
    '<pre><code class="language-js">if (a &lt; b) {\n\treturn;\n}\n</code></pre><p>after</p>',
    '<p>a</p><div class="nova-pagebreak" style="break-after: page;"></div><p>b</p>',
    '<table><tbody><tr><td data-series="numeric"><p>1</p></td><td><p>a</p></td></tr></tbody></table>',
    '<ol start="3"><li><p>c</p></li></ol><p><span data-type="inline-math" data-latex="x^2"></span></p>',
    '<p>a</p><a class="nova-card" href="https://example.com/post"><span class="nova-card-title">Post</span>' +
      '<span class="nova-card-description">About</span></a><p>b</p>',
  ])('reads back as the same document: %s', (html) => {
    const { before, after } = roundTrip(html);
    expect(after).toBe(before);
  });

  it('any document the editor writes reads back the same (property)', () => {
    const text = fc.constantFrom('a', 'b c', ' lead', 'tail ', '  ', '&nbsp;', 'x&lt;y', '');
    const inline = fc.oneof(
      text,
      text.map((t) => `<strong>${t}</strong>`),
      text.map((t) => `<em>${t}</em>`),
      fc.constant('<br>'),
      text.map((t) => `<a href="https://example.com">${t}</a>`),
    );
    const block: fc.Arbitrary<string> = fc.letrec<{ block: string }>((tie) => ({
      block: fc.oneof(
        { depthSize: 'small' },
        fc.array(inline, { maxLength: 3 }).map((parts) => `<p>${parts.join('')}</p>`),
        fc.array(inline, { maxLength: 2 }).map((parts) => `<h3>${parts.join('')}</h3>`),
        fc.array(text, { maxLength: 2 }).map((t) => `<pre><code>${t.join('\n')}</code></pre>`),
        fc
          .array(tie('block'), { minLength: 1, maxLength: 2 })
          .map((items) => `<ul>${items.map((b) => `<li>${b}</li>`).join('')}</ul>`),
        fc
          .array(tie('block'), { minLength: 1, maxLength: 2 })
          .map((b) => `<blockquote>${b.join('')}</blockquote>`),
        fc
          .array(tie('block'), { minLength: 1, maxLength: 2 })
          .map(
            (cells) =>
              `<table><tbody><tr>${cells.map((c) => `<td>${c}</td>`).join('')}</tr></tbody></table>`,
          ),
        fc.constant('<hr>'),
      ),
    })).block;
    fc.assert(
      fc.property(fc.array(block, { minLength: 1, maxLength: 4 }), (blocks) => {
        const { before, after } = roundTrip(blocks.join(''));
        expect(after).toBe(before);
      }),
      { numRuns: RUNS },
    );
  });
});
