import { describe, expect, it } from 'vitest';
import { schema } from '../src';
import { HTMLSerializer, escapeAttr, escapeText } from '../src/serializer';

const s = new HTMLSerializer();
const { nodes, marks } = schema;
const doc = (...content: Parameters<typeof nodes.doc.create>[1][]) =>
  nodes.doc.create(null, content.flat() as never);
const p = (...content: ReturnType<typeof schema.text>[]) => nodes.paragraph.create(null, content);

describe('HTMLSerializer', () => {
  it('escapes text and attributes', () => {
    expect(escapeText('<a> & "b" ')).toBe('&lt;a&gt; &amp; "b"&nbsp;');
    expect(escapeAttr('x" onmouseover="alert(1)')).toBe('x&quot; onmouseover=&quot;alert(1)');
    const link = marks.link.create({ href: 'https://a.io/?q="><script>' });
    expect(s.serializeFragment(doc(p(schema.text('<b>', [link]))).content)).toBe(
      '<p><a href="https://a.io/?q=&quot;&gt;&lt;script&gt;">&lt;b&gt;</a></p>',
    );
  });

  it("doesn't fragment marks shared by neighboring nodes", () => {
    const bold = marks.bold.create();
    const italic = marks.italic.create();
    const html = s.serializeFragment(
      doc(p(schema.text('a', [bold]), schema.text('b', [bold, italic]), schema.text('c', [bold])))
        .content,
    );
    expect(html).toBe('<p><strong>a<em>b</em>c</strong></p>');
  });

  it('a nested hole in the spec (pre > code)', () => {
    const block = nodes.code_block.create({ language: 'js' }, schema.text('a < b'));
    expect(s.serializeNode(block)).toBe('<pre><code class="language-js">a &lt; b</code></pre>');
  });

  it('empty and void elements', () => {
    expect(s.serializeFragment(doc(nodes.horizontal_rule.create(), p()).content)).toBe(
      '<hr><p></p>',
    );
    const img = nodes.image.create({ src: 'https://a.io/x.png', alt: 'cat "Tom"' });
    expect(
      s.serializeFragment(
        doc(nodes.paragraph.create(null, [img, nodes.hard_break.create()])).content,
      ),
    ).toBe('<p><img src="https://a.io/x.png" alt="cat &quot;Tom&quot;"><br></p>');
  });
});

describe('spaces survive saving and loading', () => {
  // Found by a property-based test: the HTML parser collapses spaces, but the editor shows them.
  // Each case: document → getHTML → setContent → the same text.
  const br = () => nodes.hard_break.create();
  const cases: [string, ReturnType<typeof schema.text | typeof br>[], string][] = [
    ['a double space', [schema.text('a  b')], '<p>a &nbsp;b</p>'],
    ['three spaces', [schema.text('a   b')], '<p>a &nbsp; b</p>'],
    ['an indent at the start', [schema.text('  a')], '<p>&nbsp; a</p>'],
    ['a space at the end of a paragraph', [schema.text('a ')], '<p>a&nbsp;</p>'],
    [
      'a space after a line break',
      [schema.text('a'), br(), schema.text(' b')],
      '<p>a<br>&nbsp;b</p>',
    ],
    ['a space before a line break', [schema.text('a '), br(), schema.text('b')], '<p>a <br>b</p>'],
    ["regular text doesn't change", [schema.text('a b c')], '<p>a b c</p>'],
  ];
  it.each(cases)('%s', async (_name, content, html) => {
    const { createEditor } = await import('../src');
    const out = s.serializeFragment(doc(nodes.paragraph.create(null, content)).content);
    expect(out).toBe(html);
    const element = document.createElement('div');
    const editor = createEditor({ element, content: out });
    const text = (n: { textContent: string }) => n.textContent.replace(/\u00a0/g, ' ');
    expect(text(editor.view.state.doc)).toBe(text(nodes.paragraph.create(null, content)));
    editor.destroy();
  });

  it("code (pre) isn't touched", () => {
    const block = nodes.code_block.create(null, schema.text('  x  '));
    expect(s.serializeNode(block)).toBe('<pre><code>  x  </code></pre>');
  });
});
