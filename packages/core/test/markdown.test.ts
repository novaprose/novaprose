import fc from 'fast-check';
import { afterAll, describe, expect, it } from 'vitest';
import { createEditor } from '../src';
import { markdownToHTML, toMarkdown } from '../src/markdown';

/** Markdown на входе и выходе: @novaprose/core/markdown. */

const element = document.createElement('div');
document.body.appendChild(element);
const editor = createEditor({ element, plugins: ['mergetags', 'mentions', 'pagebreak'] });
afterAll(() => editor.destroy());

/** Markdown → документ редактора → Markdown. */
const roundTrip = (md: string) => {
  editor.setContent(markdownToHTML(md), { addToHistory: false });
  return toMarkdown(editor);
};

describe('Markdown → редактор → Markdown', () => {
  it.each([
    ['заголовки', '# H1\n\n## H2\n\n###### H6'],
    ['оформление', 'Text **bold** *italic* ~~strike~~ `code`'],
    ['ссылка с заголовком', '[NovaProse](https://novaprose.com "Editor")'],
    ['картинка', '![Logo](https://example.com/a.png)'],
    ['маркированный список', '* one\n* two\n  * nested'],
    ['нумерованный список с началом', '3. three\n4. four'],
    ['цитата', '> quoted text\n>\n> second paragraph'],
    ['блок кода с языком', '```ts\nconst a = 1;\n```'],
    ['линия', 'before\n\n---\n\nafter'],
    ['таблица GFM', '| A | B |\n| --- | --- |\n| 1 | 2 |'],
  ])('%s', (_name, md) => {
    expect(roundTrip(md)).toBe(md);
  });

  // Найдено property-based тестом: адрес без ссылки становился ссылкой после второго сохранения.
  it('адрес без ссылки остаётся текстом, ссылка — ссылкой', () => {
    editor.setContent(
      '<p>site example.com and https://example.com_ and <a href="https://a.io">https://a.io</a></p>',
    );
    const once = toMarkdown(editor);
    editor.setContent(markdownToHTML(once));
    expect(editor.getHTML()).toBe(
      '<p>site example.com and https://example.com_ and <a href="https://a.io">https://a.io</a></p>',
    );
    expect(roundTrip(once)).toBe(once);
  });

  // Найдено property-based тестом: служебный перевод строки markdown-it давал пустую строку
  // внизу блока кода, а в цитате размножался с каждым сохранением.
  it('блок кода без лишней пустой строки, в том числе в цитате', () => {
    editor.setContent(markdownToHTML('```\nx\n```'));
    expect(editor.getHTML()).toBe('<pre><code>x</code></pre>');
    expect(roundTrip('> ```\n> x \n> ```')).toBe('> ```\n> x \n> ```');
  });

  it('заголовок, текст которого кончается на «#», не теряет его', () => {
    // «#» без пробела перед ним — не закрытие заголовка, экранировать не нужно.
    expect(roundTrip('# C#')).toBe('# C#');
    editor.setContent('<h2>Tag #</h2>');
    editor.setContent(markdownToHTML(toMarkdown(editor)));
    expect(editor.getHTML()).toBe('<h2>Tag #</h2>');
  });

  it('пустой блок кода не растёт', () => {
    expect(roundTrip('> ```\n> ```')).toBe('> ```\n> ```');
  });

  it('в ячейке таблицы «|» экранируется', () => {
    editor.setContent(
      '<table><tbody><tr><th><p>a|b</p></th></tr><tr><td><p>c</p></td></tr></tbody></table>',
    );
    expect(toMarkdown(editor)).toBe('| a\\|b |\n| --- |\n| c |');
  });

  it('оформление без аналога в Markdown снимается, текст остаётся', () => {
    editor.setContent('<p><u>under</u> <span style="color: #ff0000">red</span> H<sub>2</sub>O</p>');
    expect(toMarkdown(editor)).toBe('under red H2O');
  });

  it('переменные шаблона — {{key}}, упоминания — @Имя', () => {
    editor.setContent(
      '<p>Hi <span data-mergetag="client" contenteditable="false">Client</span> and <span data-mention="u1">@Anna</span></p>',
    );
    expect(toMarkdown(editor)).toBe('Hi {{client}} and @Anna');
  });
});

describe('безопасность Markdown на входе', () => {
  it('javascript:-ссылки и картинки не становятся ссылками (остаются текстом)', () => {
    editor.setContent(markdownToHTML('[x](javascript:alert(1)) ![y](javascript:alert(1))'));
    const html = editor.getHTML();
    expect(html).not.toContain('<a');
    expect(html).not.toContain('<img');
    expect(html).not.toMatch(/(href|src)="javascript/i);
  });

  it('data:text/html и vbscript: — тоже', () => {
    editor.setContent(
      markdownToHTML('[a](data:text/html,<script>alert(1)</script>) [b](vbscript:x)'),
    );
    expect(editor.getHTML()).not.toMatch(/href="(data|vbscript)/i);
  });

  it('сырой HTML не исполняется — остаётся текстом', () => {
    editor.setContent(markdownToHTML('<img src=x onerror=alert(1)> <script>alert(1)</script>'));
    const html = editor.getHTML();
    expect(html).not.toContain('<img');
    expect(html).not.toContain('<script');
    expect(html).toContain('&lt;script&gt;');
  });
});

describe('стабильность (property-based)', () => {
  const RUNS = Number(process.env.FC_RUNS) || 200;
  const piece = fc.oneof(
    fc.constantFrom(
      '# ',
      '## ',
      '* ',
      '1. ',
      '> ',
      '**',
      '*',
      '_',
      '~~',
      '`',
      '```\n',
      '[',
      '](',
      ')',
      '![',
      '| a | b |\n| --- | --- |\n',
      '---',
      '\\',
      '<',
      '>',
      '&',
      '{{x}}',
      '@',
      '#',
      ' ',
      '  ',
      '\n',
      '\n\n',
      'https://example.com',
      'text',
      'Слово',
      '1) ',
      '+ ',
      '- ',
      '***',
      '\t',
      '#',
      '<https://a.io>',
      '`a`',
      '| x |',
      'a_b_c',
      '~~~\n',
      '    ',
      '!',
      '=',
      'example.com',
    ),
    fc.string({ maxLength: 4 }),
  );
  const markdown = fc.array(piece, { maxLength: 25 }).map((parts) => parts.join(''));

  /** Документ без марок: текст и структура блоков. */
  const structure = () =>
    JSON.stringify(editor.getJSON(), (key, value) => (key === 'marks' ? undefined : value));

  it('текст и структура блоков не меняются после одного круга (любой вход)', () => {
    fc.assert(
      fc.property(markdown, (md) => {
        editor.setContent(markdownToHTML(roundTrip(md)), { addToHistory: false });
        const before = structure();
        roundTrip(toMarkdown(editor));
        expect(structure(), `вход: ${JSON.stringify(md)}`).toBe(before);
      }),
      { numRuns: RUNS },
    );
  });

  /**
   * Полная стабильность, включая оформление, — для входов без «*» и «_». Известное ограничение:
   * жирный/курсив вплотную к пунктуации («**{текст**») по правилам CommonMark о «фланкировании»
   * иногда не распознаётся при чтении — теряется оформление, но не текст (проверка выше).
   */
  it('после одного круга Markdown не меняется (экранирование корректно)', () => {
    const noEmphasis = markdown.filter((md) => !/[*_]/.test(md));
    fc.assert(
      fc.property(noEmphasis, (md) => {
        const once = roundTrip(md);
        expect(roundTrip(once), `вход: ${JSON.stringify(md)}`).toBe(once);
      }),
      { numRuns: RUNS },
    );
  });

  it('перенос строки, за которым «#», не превращается в заголовок', () => {
    editor.setContent('<p>$<br># tag</p>');
    editor.setContent(markdownToHTML(toMarkdown(editor)));
    expect(editor.getHTML()).toBe('<p>$<br># tag</p>');
  });
});
