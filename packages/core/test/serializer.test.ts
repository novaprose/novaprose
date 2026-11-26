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

describe('пробелы переживают сохранение и загрузку', () => {
  // Найдено property-based тестом: HTML-парсер схлопывает пробелы, а в редакторе их видно.
  // Каждый случай: документ → getHTML → setContent → тот же текст.
  const br = () => nodes.hard_break.create();
  const cases: [string, ReturnType<typeof schema.text | typeof br>[], string][] = [
    ['двойной пробел', [schema.text('a  b')], '<p>a &nbsp;b</p>'],
    ['три пробела', [schema.text('a   b')], '<p>a &nbsp; b</p>'],
    ['отступ в начале', [schema.text('  a')], '<p>&nbsp; a</p>'],
    ['пробел в конце абзаца', [schema.text('a ')], '<p>a&nbsp;</p>'],
    [
      'пробел после переноса строки',
      [schema.text('a'), br(), schema.text(' b')],
      '<p>a<br>&nbsp;b</p>',
    ],
    ['пробел перед переносом', [schema.text('a '), br(), schema.text('b')], '<p>a <br>b</p>'],
    ['обычный текст не меняется', [schema.text('a b c')], '<p>a b c</p>'],
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

  it('код (pre) не трогаем', () => {
    const block = nodes.code_block.create(null, schema.text('  x  '));
    expect(s.serializeNode(block)).toBe('<pre><code>  x  </code></pre>');
  });
});
