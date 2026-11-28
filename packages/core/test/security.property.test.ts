/**
 * Property-based tests: instead of hand-written examples, fast-check generates thousands of random
 * HTML fragments and JSON documents with deliberately dangerous constructs and checks properties
 * that must hold for ANY input:
 *  1. the output of getHTML() has no way to run a script (on* handlers, dangerous tags, URLs);
 *  2. the HTML is stable: getHTML → setContent → getHTML gives the same thing (idempotence);
 *  3. the editor doesn't crash on any input;
 *  4. the HTML on the server (createRenderer from JSON) matches the editor's getHTML().
 * The security oracle is independent of the editor's code: it doesn't call isSafeLinkUrl
 * but parses the output itself, as a browser would.
 *
 * On a failure fast-check prints the minimal reproducible example and the seed:
 * turn it into a regular regression test.
 */
import fc from 'fast-check';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createEditor, createRenderer, registerHtmlRules, type Editor } from '../src';
import { htmlRules } from '../src/html-rules';

registerHtmlRules(htmlRules);

const RUNS = Number(process.env.FC_RUNS) || 300;

// Every plugin with its own schema nodes: the largest parsing surface.
const SCHEMA_PLUGINS = [
  'accordion',
  'footnotes',
  'math',
  'tableofcontents',
  'anchor',
  'pagebreak',
  'media',
  'pageembed',
  'advtable',
  'mediaembed',
  'comments',
  'mentions',
  'mergetags',
  'suggestions',
];

let editor: Editor;
/** An editor with the most permissive element and attribute rules. */
let ruled: Editor;
const PERMISSIVE = {
  extendedValidElements:
    '@[*],div[*],section[*],details[*],summary[*],abbr[*],kbd[*],ins[*],i[*],b[*],span[*],mark[*],' +
    'a[*],img[*],td[*],script[*],iframe[*],form[*]',
  customElements: 'my-widget,~my-chip',
};
beforeAll(() => {
  const element = document.createElement('div');
  document.body.appendChild(element);
  editor = createEditor({ element, plugins: SCHEMA_PLUGINS, table: true } as never);
  const second = document.createElement('div');
  document.body.appendChild(second);
  const warn = console.warn;
  console.warn = () => {};
  ruled = createEditor({ element: second, plugins: SCHEMA_PLUGINS, ...PERMISSIVE } as never);
  console.warn = warn;
  // Lazy parts of plugins (the table of contents updates the HTML) load before the first check, not in the middle of it:
  // otherwise the same document would be output differently before and after they load.
  return Promise.all([editor.ready, ruled.ready]);
});
afterAll(() => {
  editor.destroy();
  ruled.destroy();
});

/* ------------------------------ generators ------------------------------ */

const DANGEROUS_URLS = [
  'javascript:alert(1)',
  'JaVaScRiPt:alert(1)',
  ' javascript:alert(1)',
  'java\tscript:alert(1)',
  'java\nscript:alert(1)',
  '\u0001javascript:alert(1)',
  'javascript&colon;alert(1)',
  '&#106;avascript:alert(1)',
  '&#x6A;avascript:alert(1)',
  'vbscript:msgbox(1)',
  'data:text/html,<script>alert(1)</script>',
  'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==',
  'data:image/svg+xml,<svg onload=alert(1)>',
  'data:image/png;base64,iVBORw0KGgo=',
  'file:///etc/passwd',
  'https://example.com/a.png',
  '/relative/path',
  '#anchor',
  'mailto:a@b.c',
  '//evil.example.com',
];

const TAGS = [
  'p',
  'div',
  'span',
  'a',
  'img',
  'strong',
  'em',
  'b',
  'i',
  'u',
  's',
  'sub',
  'sup',
  'code',
  'pre',
  'h1',
  'h2',
  'h3',
  'blockquote',
  'ul',
  'ol',
  'li',
  'table',
  'tbody',
  'tr',
  'td',
  'th',
  'br',
  'hr',
  'mark',
  'font',
  'iframe',
  'video',
  'audio',
  'source',
  'object',
  'embed',
  'script',
  'style',
  'svg',
  'math',
  'form',
  'input',
  'button',
  'base',
  'meta',
  'link',
  'template',
  'noscript',
  'textarea',
  'select',
  'details',
  'ins',
  'del',
  'figure',
  'figcaption',
  'colgroup',
  'col',
  'section',
  'summary',
  'abbr',
  'kbd',
  'my-widget',
  'my-chip',
];

const ATTRS = [
  'href',
  'src',
  'style',
  'class',
  'id',
  'title',
  'alt',
  'width',
  'height',
  'onclick',
  'onerror',
  'onload',
  'onmouseover',
  'srcset',
  'formaction',
  'action',
  'xlink:href',
  'background',
  'poster',
  'data',
  'data-var',
  'data-mention',
  'data-comment',
  'data-suggestion',
  'data-before',
  'data-change',
  'data-depth',
  'data-time',
  'contenteditable',
  'name',
  'target',
  'rel',
  'colspan',
  'rowspan',
  'align',
  'color',
  'face',
  'size',
  'start',
  'type',
  'lang',
  'dir',
  'data-name',
  'data-author',
  'data-id',
  'data-checked',
  'data-type',
  'data-series',
];

const STYLE_VALUES = [
  'color: red',
  'background: url(javascript:alert(1))',
  'background-image: url("javascript:alert(1)")',
  'width: expression(alert(1))',
  'behavior: url(x.htc)',
  '-moz-binding: url(x.xml#xss)',
  'text-align: center',
  'font-size: 14px; color: #ff0000',
  'color: red; } body { background: url(https://evil.example.com) ',
  'font-family: "a"; background: url(//evil.example.com/x)',
];

const attrValue = fc.oneof(
  fc.constantFrom(...DANGEROUS_URLS),
  fc.constantFrom(...STYLE_VALUES),
  fc.constantFrom(
    '"><script>alert(1)</script>',
    "' onmouseover='alert(1)",
    '<img src=x onerror=alert(1)>',
  ),
  fc.string({ maxLength: 12 }),
);

const attribute = fc.tuple(fc.constantFrom(...ATTRS), attrValue);

const escapeAttr = (v: string) => v.replace(/&(?![#a-z0-9]+;)/gi, '&amp;').replace(/"/g, '&quot;');

const textNode = fc.oneof(
  fc.string({ maxLength: 10 }).map((t) => t.replace(/</g, '&lt;')),
  fc.constantFrom('<!-- c -->', '&nbsp;', '{{x}}', '<![CDATA[x]]>', '</p>', '<'),
);

const htmlTree: fc.Arbitrary<string> = fc.letrec<{ node: string }>((tie) => ({
  node: fc.oneof(
    { depthSize: 'small', withCrossShrink: true },
    textNode,
    fc
      .tuple(
        fc.constantFrom(...TAGS),
        fc.array(attribute, { maxLength: 3 }),
        fc.array(tie('node'), { maxLength: 3 }),
      )
      .map(([tag, attrs, children]) => {
        const a = attrs.map(([n, v]) => ` ${n}="${escapeAttr(v)}"`).join('');
        return `<${tag}${a}>${children.join('')}</${tag}>`;
      }),
  ),
})).node;

const htmlDocument = fc
  .array(htmlTree, { minLength: 1, maxLength: 4 })
  .map((parts) => parts.join(''));

/* ------------------------- independent XSS oracle ------------------------- */

const FORBIDDEN_TAGS = new Set([
  'script',
  'style',
  'object',
  'embed',
  'base',
  'meta',
  'link',
  'form',
  'input',
  'button',
  'textarea',
  'select',
  'template',
  'noscript',
  'frame',
  'frameset',
  'applet',
  'svg',
  'math',
]);
const URL_ATTRS = [
  'href',
  'src',
  'xlink:href',
  'formaction',
  'action',
  'background',
  'poster',
  'data',
  'srcset',
];
const SAFE_DATA_IMAGE = /^data:image\/(png|jpe?g|gif|webp|avif|bmp);base64,/i;

/** The protocol as a browser sees it: without control characters and spaces. */
function scheme(url: string): string | null {
  // eslint-disable-next-line no-control-regex
  const m = url.replace(/[\u0000- \u007f-\u009f]/g, '').match(/^([a-z][a-z0-9+.-]*):/i);
  return m ? m[1]!.toLowerCase() : null;
}

function unsafeUrl(url: string): boolean {
  if (SAFE_DATA_IMAGE.test(url.trim())) return false;
  const s = scheme(url);
  return s !== null && !['http', 'https', 'mailto', 'tel', 'blob'].includes(s);
}

/** Returns the list of violations in the HTML (empty means safe). */
function xssViolations(html: string): string[] {
  const out: string[] = [];
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  for (const el of doc.body.querySelectorAll('*')) {
    const tag = el.tagName.toLowerCase();
    if (FORBIDDEN_TAGS.has(tag)) out.push(`tag <${tag}>`);
    for (const attr of el.attributes) {
      const name = attr.name.toLowerCase();
      if (name.startsWith('on')) out.push(`handler ${name} on <${tag}>`);
      if (URL_ATTRS.includes(name)) {
        const urls =
          name === 'srcset'
            ? attr.value.split(',').map((x) => x.trim().split(/\s+/)[0] ?? '')
            : [attr.value];
        for (const u of urls) if (unsafeUrl(u)) out.push(`${name}="${attr.value}" on <${tag}>`);
      }
      if (
        name === 'style' &&
        /expression\s*\(|javascript:|behavior\s*:|-moz-binding|url\s*\(/i.test(attr.value)
      ) {
        out.push(`dangerous style="${attr.value}" on <${tag}>`);
      }
    }
    if (tag === 'iframe') {
      const src = el.getAttribute('src') ?? '';
      if (!/^https:\/\//i.test(src)) out.push(`iframe with src="${src}"`);
    }
  }
  return out;
}

/* --------------------------------- properties -------------------------------- */

describe('HTML security and stability (property-based)', () => {
  it('the oracle catches what it should (self-check)', () => {
    expect(xssViolations('<p onclick="x">a</p>')).not.toEqual([]);
    expect(xssViolations('<a href="java\tscript:alert(1)">a</a>')).not.toEqual([]);
    expect(xssViolations('<p style="background:url(javascript:x)">a</p>')).not.toEqual([]);
    expect(xssViolations('<p><a href="https://a.io">a</a></p>')).toEqual([]);
  });

  it('getHTML() is safe for any input HTML', () => {
    fc.assert(
      fc.property(htmlDocument, (input) => {
        editor.setContent(input, { addToHistory: false });
        const violations = xssViolations(editor.getHTML());
        expect(violations, `input: ${input}`).toEqual([]);
      }),
      { numRuns: RUNS },
    );
  });

  it('the HTML is stable: parsing its own output again changes nothing', () => {
    fc.assert(
      fc.property(htmlDocument, (input) => {
        editor.setContent(input, { addToHistory: false });
        const first = editor.getHTML();
        editor.setContent(first, { addToHistory: false });
        expect(editor.getHTML(), `input: ${input}`).toBe(first);
      }),
      { numRuns: RUNS },
    );
  });

  it("the server's HTML from JSON matches the editor's getHTML()", () => {
    const renderer = createRenderer({ plugins: SCHEMA_PLUGINS });
    fc.assert(
      fc.property(htmlDocument, (input) => {
        editor.setContent(input, { addToHistory: false });
        expect(renderer.html(editor.getJSON()), `input: ${input}`).toBe(editor.getHTML());
      }),
      { numRuns: RUNS },
    );
  });

  it('a JSON document with dangerous attributes gives no XSS on output', () => {
    // Every attribute of every node and mark of the schema (ProseMirror ignores extra ones). Values include
    // the wrong types: JSON comes from outside (a database, an API), and nobody has to check it before us.
    const anyValue = fc.oneof(attrValue, fc.integer({ min: -2, max: 9 }), fc.constant(null));
    const attrs = fc.record({
      src: anyValue,
      href: anyValue,
      alt: anyValue,
      title: anyValue,
      target: anyValue,
      width: anyValue,
      height: anyValue,
      align: anyValue,
      class: attrValue,
      lineHeight: anyValue,
      dir: anyValue,
      language: anyValue,
      // A passage's language goes into lang: anything from JSON, or a tag that tries to break out.
      lang: fc.oneof(anyValue, fc.constantFrom('fr', 'pt-BR', 'en" onclick="alert(1)')),
      level: anyValue,
      value: attrValue,
      id: attrValue,
      name: anyValue,
      key: attrValue,
      label: anyValue,
      kind: anyValue,
      background: anyValue,
      valign: anyValue,
      author: anyValue,
      time: anyValue,
      listStyle: anyValue,
      start: anyValue,
      colspan: anyValue,
      checked: anyValue,
      checklist: anyValue,
      open: anyValue,
      // A footnote reference: its id goes into href and id, its number is shown.
      number: anyValue,
      // A suggested format: the formatting before it, as JSON (goes into data-format).
      before: fc.oneof(anyValue, attrValue),
      // The formula source goes into data-latex and the text: anything from JSON.
      latex: fc.oneof(anyValue, attrValue),
      // Table of contents items: level, id and text can be anything too (the id goes into href).
      entries: fc.oneof(
        anyValue,
        fc.array(fc.record({ level: anyValue, id: attrValue, text: attrValue }), { maxLength: 3 }),
      ),
      rowspan: anyValue,
      // A page's card: its texts and its picture's address.
      description: anyValue,
      image: anyValue,
      site: anyValue,
      // The numbers column of advanced tables: the series' name goes into data-series.
      series: fc.oneof(anyValue, attrValue, fc.constantFrom('numeric', 'alpha')),
      colwidth: fc.oneof(anyValue, fc.array(fc.integer({ min: -5, max: 900 }), { maxLength: 2 })),
    });
    const mark = fc.record({
      type: fc.constantFrom(
        'link',
        'span_class',
        'language',
        'bold',
        'color',
        'background',
        'font_family',
        'font_size',
        'comment',
        'suggestion_insert',
        'suggestion_delete',
        'suggestion_format',
      ),
      attrs,
    });
    const text = fc.record({
      type: fc.constant('text'),
      text: fc.string({ minLength: 1, maxLength: 5 }),
      marks: fc.uniqueArray(mark, { maxLength: 2, selector: (m) => m.type }),
    });
    const atom = fc.record({
      type: fc.constantFrom(
        'image',
        'hard_break',
        'mergetag',
        'mention',
        'anchor',
        'math_inline',
        'footnote_ref',
      ),
      attrs,
      marks: fc.uniqueArray(mark, { maxLength: 1, selector: (m) => m.type }),
    });
    const textblock = fc.record({
      type: fc.constantFrom('paragraph', 'heading', 'code_block'),
      attrs,
      content: fc.array(fc.oneof(text, atom), { maxLength: 4 }),
    });
    const blockAtom = fc.record({
      type: fc.constantFrom(
        'media',
        'pageembed',
        'link_card',
        'pagebreak',
        'horizontal_rule',
        'toc',
        'math_block',
      ),
      attrs,
    });
    const cell = fc.record({
      type: fc.constantFrom('table_cell', 'table_header'),
      attrs,
      content: fc.array(textblock, { minLength: 1, maxLength: 1 }),
    });
    // Lists, checklists included: checked/checklist from JSON can be anything.
    const list = fc.record({
      type: fc.constantFrom('bullet_list', 'ordered_list'),
      attrs,
      content: fc.array(
        fc.record({
          type: fc.constant('list_item'),
          attrs,
          // A list item starts with a paragraph (otherwise the whole JSON is rejected and the test would check less).
          content: fc.array(
            fc.record({
              type: fc.constant('paragraph'),
              attrs,
              content: fc.array(fc.oneof(text, atom), { maxLength: 3 }),
            }),
            { minLength: 1, maxLength: 1 },
          ),
        }),
        { minLength: 1, maxLength: 2 },
      ),
    });
    const table = fc.record({
      type: fc.constant('table'),
      attrs,
      content: fc.array(
        fc.record({
          type: fc.constant('table_row'),
          content: fc.array(cell, { minLength: 1, maxLength: 2 }),
        }),
        {
          minLength: 1,
          maxLength: 1,
        },
      ),
    });
    // A collapsible block: open from JSON can be anything, the title has inline nodes.
    const details = fc.record({
      type: fc.constant('details'),
      attrs,
      content: fc.tuple(
        fc.record({
          type: fc.constant('details_summary'),
          content: fc.array(fc.oneof(text, atom), { maxLength: 3 }),
        }),
        textblock,
      ),
    });
    // The footnotes section: note ids go into id and href.
    const footnotes = fc.record({
      type: fc.constant('footnotes'),
      attrs,
      content: fc.array(
        fc.record({
          type: fc.constant('footnote'),
          attrs,
          content: fc.array(fc.oneof(text, atom), { maxLength: 3 }),
        }),
        { minLength: 1, maxLength: 2 },
      ),
    });
    let accepted = 0;
    fc.assert(
      fc.property(
        fc.array(fc.oneof(textblock, textblock, blockAtom, table, list, details, footnotes), {
          minLength: 1,
          maxLength: 3,
        }),
        (content) => {
          const json = { type: 'doc', content };
          try {
            editor.setContent(json as never, { addToHistory: false });
          } catch {
            return; // refusing invalid JSON is acceptable behavior
          }
          accepted++;
          const violations = xssViolations(editor.getHTML());
          expect(violations, `input: ${JSON.stringify(json)}`).toEqual([]);
        },
      ),
      { numRuns: RUNS },
    );
    // Guard against an "empty" test: the generator must produce mostly valid documents.
    expect(accepted / RUNS).toBeGreaterThan(0.9);
  });
});

describe("element and attribute rules don't open holes (property-based)", () => {
  it('getHTML() is safe with "allow everything" rules', () => {
    fc.assert(
      fc.property(htmlDocument, (input) => {
        ruled.setContent(input, { addToHistory: false });
        expect(xssViolations(ruled.getHTML()), `input: ${input}`).toEqual([]);
      }),
      { numRuns: RUNS },
    );
  });

  it('the HTML is stable with "allow everything" rules', () => {
    fc.assert(
      fc.property(htmlDocument, (input) => {
        ruled.setContent(input, { addToHistory: false });
        const first = ruled.getHTML();
        ruled.setContent(first, { addToHistory: false });
        expect(ruled.getHTML(), `input: ${input}`).toBe(first);
      }),
      { numRuns: RUNS },
    );
  });

  it('the server HTML matches getHTML() with "allow everything" rules too', () => {
    const warn = console.warn;
    console.warn = () => {};
    const renderer = createRenderer({ plugins: SCHEMA_PLUGINS, ...PERMISSIVE });
    console.warn = warn;
    fc.assert(
      fc.property(htmlDocument, (input) => {
        ruled.setContent(input, { addToHistory: false });
        expect(renderer.html(ruled.getJSON()), `input: ${input}`).toBe(ruled.getHTML());
      }),
      { numRuns: RUNS },
    );
  });

  it('JSON with foreign tags and attributes in rule nodes gives no XSS', () => {
    const anyValue = fc.oneof(attrValue, fc.integer(), fc.constant(null), fc.constant({}));
    const htmlAttrs = fc.oneof(
      fc.dictionary(fc.constantFrom(...ATTRS, 'srcdoc', 'is', 'ONCLICK', 'a b', ''), anyValue, {
        maxKeys: 4,
      }),
      anyValue,
    );
    const tag = fc.constantFrom('div', 'section', 'script', 'iframe', 'img', 'abbr', 7, null);
    // href is a required attribute of a link: without it the whole JSON is rejected and the test would check less.
    const attrs = fc.record({ tag, htmlAttrs, href: attrValue });
    const text = fc.record({
      type: fc.constant('text'),
      text: fc.string({ minLength: 1, maxLength: 4 }),
      marks: fc.array(fc.record({ type: fc.constantFrom('html_inline', 'link'), attrs }), {
        maxLength: 2,
      }),
    });
    const atom = fc.record({ type: fc.constant('html_inline_atom'), attrs });
    const textblock = fc.record({
      type: fc.constantFrom('html_textblock', 'paragraph', 'heading'),
      attrs,
      content: fc.array(fc.oneof(text, atom), { maxLength: 3 }),
    });
    const container = fc.record({
      type: fc.constant('html_block'),
      attrs,
      content: fc.array(textblock, { minLength: 1, maxLength: 2 }),
    });
    let accepted = 0;
    fc.assert(
      fc.property(
        fc.array(fc.oneof(textblock, container), { minLength: 1, maxLength: 3 }),
        (content) => {
          const json = { type: 'doc', content };
          try {
            ruled.setContent(json as never, { addToHistory: false });
          } catch {
            return;
          }
          accepted++;
          expect(xssViolations(ruled.getHTML()), `input: ${JSON.stringify(json)}`).toEqual([]);
        },
      ),
      { numRuns: RUNS },
    );
    expect(accepted / RUNS).toBeGreaterThan(0.8);
  });
});
