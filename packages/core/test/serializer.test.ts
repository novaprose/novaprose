import { describe, expect, it } from 'vitest';
import { schema } from '../src';
import { HTMLSerializer, escapeAttr, escapeText } from '../src/serializer';

const s = new HTMLSerializer();
const { nodes, marks } = schema;
const doc = (...content: Parameters<typeof nodes.doc.create>[1][]) =>
  nodes.doc.create(null, content.flat() as never);
const p = (...content: ReturnType<typeof schema.text>[]) => nodes.paragraph.create(null, content);

describe('HTMLSerializer', () => {
  it('экранирует текст и атрибуты', () => {
    expect(escapeText('<a> & "b" ')).toBe('&lt;a&gt; &amp; "b"&nbsp;');
    expect(escapeAttr('x" onmouseover="alert(1)')).toBe('x&quot; onmouseover=&quot;alert(1)');
    const link = marks.link.create({ href: 'https://a.io/?q="><script>' });
    expect(s.serializeFragment(doc(p(schema.text('<b>', [link]))).content)).toBe(
      '<p><a href="https://a.io/?q=&quot;&gt;&lt;script&gt;">&lt;b&gt;</a></p>',
    );
  });

  it('не дробит общие марки соседних узлов', () => {
    const bold = marks.bold.create();
    const italic = marks.italic.create();
    const html = s.serializeFragment(
      doc(p(schema.text('a', [bold]), schema.text('b', [bold, italic]), schema.text('c', [bold])))
        .content,
    );
    expect(html).toBe('<p><strong>a<em>b</em>c</strong></p>');
  });

  it('вложенная дыра в спеке (pre > code)', () => {
    const block = nodes.code_block.create({ language: 'js' }, schema.text('a < b'));
    expect(s.serializeNode(block)).toBe('<pre><code class="language-js">a &lt; b</code></pre>');
  });

  it('пустые и void-элементы', () => {
    expect(s.serializeFragment(doc(nodes.horizontal_rule.create(), p()).content)).toBe(
      '<hr><p></p>',
    );
    const img = nodes.image.create({ src: 'https://a.io/x.png', alt: 'кот "Барсик"' });
    expect(
      s.serializeFragment(
        doc(nodes.paragraph.create(null, [img, nodes.hard_break.create()])).content,
      ),
    ).toBe('<p><img src="https://a.io/x.png" alt="кот &quot;Барсик&quot;"><br></p>');
  });
});
