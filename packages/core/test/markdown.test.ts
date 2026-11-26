import fc from 'fast-check';
import { afterAll, describe, expect, it } from 'vitest';
import { createEditor } from '../src';
import { markdownToHTML, toMarkdown } from '../src/markdown';

/** Markdown in and out: @novaprose/core/markdown. */

const element = document.createElement('div');
document.body.appendChild(element);
const editor = createEditor({ element, plugins: ['mergetags', 'mentions', 'pagebreak'] });
afterAll(() => editor.destroy());

/** Markdown → editor document → Markdown. */
const roundTrip = (md: string) => {
  editor.setContent(markdownToHTML(md), { addToHistory: false });
  return toMarkdown(editor);
};

describe('Markdown → editor → Markdown', () => {
  it.each([
    ['headings', '# H1\n\n## H2\n\n###### H6'],
    ['formatting', 'Text **bold** *italic* ~~strike~~ `code`'],
    ['a link with a title', '[NovaProse](https://novaprose.com "Editor")'],
    ['an image', '![Logo](https://example.com/a.png)'],
    ['a bulleted list', '* one\n* two\n  * nested'],
    ['a numbered list with a start', '3. three\n4. four'],
    ['a quote', '> quoted text\n>\n> second paragraph'],
    ['a code block with a language', '```ts\nconst a = 1;\n```'],
    ['a rule', 'before\n\n---\n\nafter'],
    ['a GFM table', '| A | B |\n| --- | --- |\n| 1 | 2 |'],
  ])('%s', (_name, md) => {
    expect(roundTrip(md)).toBe(md);
  });

  // Found by a property-based test: an address without a link became a link after the second save.
  it('an address without a link stays text, a link stays a link', () => {
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

  // Found by a property-based test: markdown-it's service line break gave an empty line
  // at the bottom of a code block, and inside a quote it multiplied with every save.
  it('a code block without an extra empty line, inside a quote too', () => {
    editor.setContent(markdownToHTML('```\nx\n```'));
    expect(editor.getHTML()).toBe('<pre><code>x</code></pre>');
    expect(roundTrip('> ```\n> x \n> ```')).toBe('> ```\n> x \n> ```');
  });

  it('a heading whose text ends with "#" keeps it', () => {
    // "#" without a space before it doesn't close the heading, so it needs no escaping.
    expect(roundTrip('# C#')).toBe('# C#');
    editor.setContent('<h2>Tag #</h2>');
    editor.setContent(markdownToHTML(toMarkdown(editor)));
    expect(editor.getHTML()).toBe('<h2>Tag #</h2>');
  });

  it("an empty code block doesn't grow", () => {
    expect(roundTrip('> ```\n> ```')).toBe('> ```\n> ```');
  });

  it('"|" is escaped in a table cell', () => {
    editor.setContent(
      '<table><tbody><tr><th><p>a|b</p></th></tr><tr><td><p>c</p></td></tr></tbody></table>',
    );
    expect(toMarkdown(editor)).toBe('| a\\|b |\n| --- |\n| c |');
  });

  it('formatting with no Markdown equivalent is removed, the text stays', () => {
    editor.setContent('<p><u>under</u> <span style="color: #ff0000">red</span> H<sub>2</sub>O</p>');
    expect(toMarkdown(editor)).toBe('under red H2O');
  });

  it('template variables become {{key}}, mentions become @Name', () => {
    editor.setContent(
      '<p>Hi <span data-mergetag="client" contenteditable="false">Client</span> and <span data-mention="u1">@Anna</span></p>',
    );
    expect(toMarkdown(editor)).toBe('Hi {{client}} and @Anna');
  });
});

describe('Markdown input security', () => {
  it("javascript: links and images don't become links (they stay text)", () => {
    editor.setContent(markdownToHTML('[x](javascript:alert(1)) ![y](javascript:alert(1))'));
    const html = editor.getHTML();
    expect(html).not.toContain('<a');
    expect(html).not.toContain('<img');
    expect(html).not.toMatch(/(href|src)="javascript/i);
  });

  it('data:text/html and vbscript: too', () => {
    editor.setContent(
      markdownToHTML('[a](data:text/html,<script>alert(1)</script>) [b](vbscript:x)'),
    );
    expect(editor.getHTML()).not.toMatch(/href="(data|vbscript)/i);
  });

  it("raw HTML doesn't run: it stays text", () => {
    editor.setContent(markdownToHTML('<img src=x onerror=alert(1)> <script>alert(1)</script>'));
    const html = editor.getHTML();
    expect(html).not.toContain('<img');
    expect(html).not.toContain('<script');
    expect(html).toContain('&lt;script&gt;');
  });
});

describe('stability (property-based)', () => {
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
      'Λέξη',
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

  /** A document without marks: the text and the block structure. */
  const structure = () =>
    JSON.stringify(editor.getJSON(), (key, value) => (key === 'marks' ? undefined : value));

  it("the text and block structure don't change after one round (any input)", () => {
    fc.assert(
      fc.property(markdown, (md) => {
        editor.setContent(markdownToHTML(roundTrip(md)), { addToHistory: false });
        const before = structure();
        roundTrip(toMarkdown(editor));
        expect(structure(), `input: ${JSON.stringify(md)}`).toBe(before);
      }),
      { numRuns: RUNS },
    );
  });

  /**
   * Full stability, formatting included, for inputs without "*" and "_". A known limitation:
   * bold/italic right next to punctuation ("**{text**"), by CommonMark's "flanking" rules,
   * is sometimes not recognized on reading: the formatting is lost, but not the text (checked above).
   */
  it("after one round the Markdown doesn't change (escaping is correct)", () => {
    const noEmphasis = markdown.filter((md) => !/[*_]/.test(md));
    fc.assert(
      fc.property(noEmphasis, (md) => {
        const once = roundTrip(md);
        expect(roundTrip(once), `input: ${JSON.stringify(md)}`).toBe(once);
      }),
      { numRuns: RUNS },
    );
  });

  it('a line break followed by "#" doesn\'t turn into a heading', () => {
    editor.setContent('<p>$<br># tag</p>');
    editor.setContent(markdownToHTML(toMarkdown(editor)));
    expect(editor.getHTML()).toBe('<p>$<br># tag</p>');
  });
});
