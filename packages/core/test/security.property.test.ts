/**
 * Property-based тесты: вместо ручных примеров fast-check генерирует тысячи случайных
 * HTML-фрагментов и JSON-документов с заведомо опасными конструкциями и проверяет свойства,
 * которые должны выполняться для ЛЮБОГО входа:
 *  1. на выходе getHTML() нет способа выполнить скрипт (обработчики on*, опасные теги, URL);
 *  2. HTML стабилен: getHTML → setContent → getHTML даёт то же самое (идемпотентность);
 *  3. редактор не падает ни на каком входе.
 * Оракул безопасности независим от кода редактора: он не вызывает isSafeLinkUrl,
 * а сам разбирает выход как браузер.
 *
 * При падении fast-check печатает минимальный воспроизводимый пример и seed:
 * его стоит превратить в обычный тест-регрессию.
 */
import fc from 'fast-check';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createEditor, registerHtmlRules, type Editor } from '../src';
import { htmlRules } from '../src/html-rules';

registerHtmlRules(htmlRules);

const RUNS = Number(process.env.FC_RUNS) || 300;

// Все плагины со своими узлами схемы — максимальная поверхность разбора.
const SCHEMA_PLUGINS = [
  'accordion',
  'anchor',
  'pagebreak',
  'media',
  'comments',
  'mentions',
  'mergetags',
  'suggestions',
];

let editor: Editor;
/** Редактор с максимально разрешающими правилами элементов и атрибутов. */
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
});
afterAll(() => {
  editor.destroy();
  ruled.destroy();
});

/* ------------------------------ генераторы ------------------------------ */

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

/* ------------------------- независимый оракул XSS ------------------------- */

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

/** Протокол так, как его увидит браузер: без управляющих символов и пробелов. */
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

/** Возвращает список нарушений в HTML (пустой — безопасно). */
function xssViolations(html: string): string[] {
  const out: string[] = [];
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  for (const el of doc.body.querySelectorAll('*')) {
    const tag = el.tagName.toLowerCase();
    if (FORBIDDEN_TAGS.has(tag)) out.push(`тег <${tag}>`);
    for (const attr of el.attributes) {
      const name = attr.name.toLowerCase();
      if (name.startsWith('on')) out.push(`обработчик ${name} на <${tag}>`);
      if (URL_ATTRS.includes(name)) {
        const urls =
          name === 'srcset'
            ? attr.value.split(',').map((x) => x.trim().split(/\s+/)[0] ?? '')
            : [attr.value];
        for (const u of urls) if (unsafeUrl(u)) out.push(`${name}="${attr.value}" на <${tag}>`);
      }
      if (
        name === 'style' &&
        /expression\s*\(|javascript:|behavior\s*:|-moz-binding|url\s*\(/i.test(attr.value)
      ) {
        out.push(`опасный style="${attr.value}" на <${tag}>`);
      }
    }
    if (tag === 'iframe') {
      const src = el.getAttribute('src') ?? '';
      if (!/^https:\/\//i.test(src)) out.push(`iframe с src="${src}"`);
    }
  }
  return out;
}

/* --------------------------------- свойства -------------------------------- */

describe('безопасность и стабильность HTML (property-based)', () => {
  it('оракул ловит то, что должен (самопроверка)', () => {
    expect(xssViolations('<p onclick="x">a</p>')).not.toEqual([]);
    expect(xssViolations('<a href="java\tscript:alert(1)">a</a>')).not.toEqual([]);
    expect(xssViolations('<p style="background:url(javascript:x)">a</p>')).not.toEqual([]);
    expect(xssViolations('<p><a href="https://a.io">a</a></p>')).toEqual([]);
  });

  it('getHTML() безопасен для любого входного HTML', () => {
    fc.assert(
      fc.property(htmlDocument, (input) => {
        editor.setContent(input, { addToHistory: false });
        const violations = xssViolations(editor.getHTML());
        expect(violations, `вход: ${input}`).toEqual([]);
      }),
      { numRuns: RUNS },
    );
  });

  it('HTML стабилен: повторный разбор собственного вывода ничего не меняет', () => {
    fc.assert(
      fc.property(htmlDocument, (input) => {
        editor.setContent(input, { addToHistory: false });
        const first = editor.getHTML();
        editor.setContent(first, { addToHistory: false });
        expect(editor.getHTML(), `вход: ${input}`).toBe(first);
      }),
      { numRuns: RUNS },
    );
  });

  it('JSON-документ с опасными атрибутами не даёт XSS на выходе', () => {
    // Все атрибуты всех узлов и марок схемы (лишние ProseMirror игнорирует). Значения — в т.ч.
    // не того типа: JSON приходит снаружи (БД, API), его никто не обязан проверять до нас.
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
      rowspan: anyValue,
      colwidth: fc.oneof(anyValue, fc.array(fc.integer({ min: -5, max: 900 }), { maxLength: 2 })),
    });
    const mark = fc.record({
      type: fc.constantFrom(
        'link',
        'span_class',
        'bold',
        'color',
        'background',
        'font_family',
        'font_size',
        'comment',
        'suggestion_insert',
        'suggestion_delete',
      ),
      attrs,
    });
    const text = fc.record({
      type: fc.constant('text'),
      text: fc.string({ minLength: 1, maxLength: 5 }),
      marks: fc.uniqueArray(mark, { maxLength: 2, selector: (m) => m.type }),
    });
    const atom = fc.record({
      type: fc.constantFrom('image', 'hard_break', 'mergetag', 'mention', 'anchor'),
      attrs,
      marks: fc.uniqueArray(mark, { maxLength: 1, selector: (m) => m.type }),
    });
    const textblock = fc.record({
      type: fc.constantFrom('paragraph', 'heading', 'code_block'),
      attrs,
      content: fc.array(fc.oneof(text, atom), { maxLength: 4 }),
    });
    const blockAtom = fc.record({
      type: fc.constantFrom('media', 'pagebreak', 'horizontal_rule'),
      attrs,
    });
    const cell = fc.record({
      type: fc.constantFrom('table_cell', 'table_header'),
      attrs,
      content: fc.array(textblock, { minLength: 1, maxLength: 1 }),
    });
    // Списки, в т.ч. чек-листы: checked/checklist из JSON — чем угодно.
    const list = fc.record({
      type: fc.constantFrom('bullet_list', 'ordered_list'),
      attrs,
      content: fc.array(
        fc.record({
          type: fc.constant('list_item'),
          attrs,
          // Пункт списка начинается с абзаца (иначе JSON отвергается целиком — тест проверял бы меньше).
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
    // Раскрывающийся блок: open из JSON — чем угодно, заголовок со строчными узлами.
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
    let accepted = 0;
    fc.assert(
      fc.property(
        fc.array(fc.oneof(textblock, textblock, blockAtom, table, list, details), {
          minLength: 1,
          maxLength: 3,
        }),
        (content) => {
          const json = { type: 'doc', content };
          try {
            editor.setContent(json as never, { addToHistory: false });
          } catch {
            return; // отказ принять неверный JSON — допустимое поведение
          }
          accepted++;
          const violations = xssViolations(editor.getHTML());
          expect(violations, `вход: ${JSON.stringify(json)}`).toEqual([]);
        },
      ),
      { numRuns: RUNS },
    );
    // Защита от «пустого» теста: генератор должен давать в основном валидные документы.
    expect(accepted / RUNS).toBeGreaterThan(0.9);
  });
});

describe('правила элементов и атрибутов не открывают дыр (property-based)', () => {
  it('getHTML() безопасен при правилах «разрешить всё»', () => {
    fc.assert(
      fc.property(htmlDocument, (input) => {
        ruled.setContent(input, { addToHistory: false });
        expect(xssViolations(ruled.getHTML()), `вход: ${input}`).toEqual([]);
      }),
      { numRuns: RUNS },
    );
  });

  it('HTML стабилен при правилах «разрешить всё»', () => {
    fc.assert(
      fc.property(htmlDocument, (input) => {
        ruled.setContent(input, { addToHistory: false });
        const first = ruled.getHTML();
        ruled.setContent(first, { addToHistory: false });
        expect(ruled.getHTML(), `вход: ${input}`).toBe(first);
      }),
      { numRuns: RUNS },
    );
  });

  it('JSON с чужими тегами и атрибутами в узлах правил не даёт XSS', () => {
    const anyValue = fc.oneof(attrValue, fc.integer(), fc.constant(null), fc.constant({}));
    const htmlAttrs = fc.oneof(
      fc.dictionary(fc.constantFrom(...ATTRS, 'srcdoc', 'is', 'ONCLICK', 'a b', ''), anyValue, {
        maxKeys: 4,
      }),
      anyValue,
    );
    const tag = fc.constantFrom('div', 'section', 'script', 'iframe', 'img', 'abbr', 7, null);
    // href — обязательный атрибут ссылки: без него JSON отвергается целиком, тест проверял бы меньше.
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
          expect(xssViolations(ruled.getHTML()), `вход: ${JSON.stringify(json)}`).toEqual([]);
        },
      ),
      { numRuns: RUNS },
    );
    expect(accepted / RUNS).toBeGreaterThan(0.8);
  });
});
