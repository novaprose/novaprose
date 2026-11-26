// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { createRenderer, registerHtmlRules, renderHTML } from '../src';
import { htmlRules } from '../src/html-rules';

/**
 * Отрисовка сохранённого документа на сервере (Node, письма, SSR страниц): импорт ядра и вывод
 * HTML не трогают window/document. Совпадение с getHTML() редактора — render.test.ts.
 */

const doc = (...content: unknown[]) => ({ type: 'doc', content });
const p = (...content: unknown[]) => ({ type: 'paragraph', content });
const text = (value: string, marks?: unknown[]) => ({ type: 'text', text: value, marks });

describe('на сервере, без DOM', () => {
  it('окружение действительно без DOM', () => {
    expect(typeof window).toBe('undefined');
    expect(typeof document).toBe('undefined');
  });

  it('встроенные узлы, марки и проверка ссылок', () => {
    const html = renderHTML(
      doc(
        { type: 'heading', attrs: { level: 2 }, content: [text('Title')] },
        p(
          text('Hi ', [{ type: 'bold' }]),
          text('site', [{ type: 'link', attrs: { href: 'https://example.com' } }]),
          text(' & '),
          text('bad', [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }]),
        ),
      ),
    );
    expect(html).toBe(
      '<h2>Title</h2><p><strong>Hi </strong><a href="https://example.com">site</a> &amp; <a href="#">bad</a></p>',
    );
  });

  it('плагины с узлами — по имени, с их настройками', () => {
    const renderer = createRenderer({
      plugins: ['mentions', 'mergetags', 'math', 'accordion'],
      pluginOptions: { accordion: { serializedState: 'expanded' } },
    });
    const html = renderer.html(
      doc(
        p(
          { type: 'mention', attrs: { id: 'u1', name: 'Anna' } },
          text(' '),
          { type: 'mergetag', attrs: { key: 'client', label: 'Client' } },
          text(' '),
          { type: 'math_inline', attrs: { latex: 'x^2' } },
        ),
        {
          type: 'details',
          content: [{ type: 'details_summary', content: [text('More')] }, p(text('Body'))],
        },
      ),
    );
    expect(html).toContain('data-mention="u1"');
    expect(html).toContain('data-mergetag="client"');
    expect(html).toContain('<span data-type="inline-math" data-latex="x^2">\\(x^2\\)</span>');
    expect(html).toContain('<details open=""><summary>More</summary><p>Body</p></details>');
    expect(renderer.text(doc(p(text('a')), p(text('b'))))).toBe('a\n\nb');
  });

  it('правила разметки и направление письма', () => {
    registerHtmlRules(htmlRules);
    const indented = doc({ type: 'paragraph', attrs: { indent: 1 }, content: [text('x')] });
    expect(renderHTML(indented, { language: 'ar' })).toContain('margin-right');
    expect(renderHTML(indented)).toContain('margin-left');
    const html = renderHTML(doc(p(text('a', [{ type: 'italic' }]), text('b'))), {
      invalidElements: 'em',
    });
    expect(html).toBe('<p>ab</p>');
  });
});
