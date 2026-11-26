import { Schema, type DOMOutputSpec, type MarkSpec, type NodeSpec } from 'prosemirror-model';
import { tableNodes } from 'prosemirror-tables';
import { isSafeImageUrl, isSafeLinkUrl } from './url';

/**
 * Базовая схема документа NovaProse (P0 из PRD §4.1–4.2).
 * Каждый узел и марка описывают и парсинг HTML (parseDOM), и сериализацию (toDOM),
 * поэтому HTML на входе и выходе предсказуем.
 */

export const ALIGNMENTS = ['left', 'center', 'right', 'justify'] as const;
export type TextAlign = (typeof ALIGNMENTS)[number];

// ---------- валидация CSS-значений ----------
// Значения стилей попадают в атрибут style, поэтому пропускаем только ожидаемые форматы:
// это не даёт протащить через контент position:fixed, url(...) и прочие инъекции.

const COLOR_RE =
  /^(#[0-9a-f]{3,8}|rgba?\(\s*[\d.]+%?\s*,\s*[\d.]+%?\s*,\s*[\d.]+%?\s*(,\s*[\d.]+%?\s*)?\)|[a-z]{3,20})$/i;
const LENGTH_RE = /^\d{1,4}(\.\d{1,3})?(px|pt|em|rem|%)$/;
const LINE_HEIGHT_RE = /^\d{1,2}(\.\d{1,3})?(px|em|%)?$/;
const FONT_FAMILY_RE = /^[\w\s,'"-]{1,200}$/;

/** Канонический вид цвета: #rrggbb в нижнем регистре; rgba с прозрачностью и имена — как есть. */
function normalizeColor(value: string): string {
  const v = value.trim().toLowerCase();
  const rgb = v.match(
    /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*(1|1\.0+)\s*)?\)$/,
  );
  if (rgb) {
    return (
      '#' +
      rgb
        .slice(1, 4)
        .map((n) => Math.min(255, Number(n)).toString(16).padStart(2, '0'))
        .join('')
    );
  }
  const short = v.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/);
  if (short) return `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`;
  return v;
}

export const cssValue = {
  color: (v: unknown): string | null =>
    typeof v === 'string' &&
    COLOR_RE.test(v.trim()) &&
    // Не цвета, а «по умолчанию»: transparent (Google Docs), windowtext и auto (Word).
    !/^(inherit|initial|unset|currentcolor|transparent|windowtext|window|auto|none)$/i.test(
      v.trim(),
    )
      ? normalizeColor(v)
      : null,
  length: (v: unknown): string | null =>
    typeof v === 'string' && LENGTH_RE.test(v.trim()) ? v.trim() : null,
  lineHeight: (v: unknown): string | null =>
    typeof v === 'string' && LINE_HEIGHT_RE.test(v.trim()) && v.trim() !== 'normal'
      ? v.trim()
      : null,
  fontFamily: (v: unknown): string | null =>
    typeof v === 'string' && FONT_FAMILY_RE.test(v.trim()) ? v.trim() : null,
};

// ---------- стили блоков: выравнивание, межстрочный интервал, направление текста ----------

export type TextDirection = 'ltr' | 'rtl';

interface BlockStyle {
  align: TextAlign | null;
  lineHeight: string | null;
  dir: TextDirection | null;
  indent: number;
}

/** Шаг отступа абзаца, px (как в привычных редакторах), и предел уровней. */
export const INDENT_STEP = 40;
export const MAX_INDENT = 10;

/** Уровень отступа 0…MAX_INDENT из любого значения (JSON может прийти чем угодно). */
export function indentLevel(value: unknown): number {
  const level = Math.trunc(Number(value));
  return Number.isFinite(level) ? Math.min(MAX_INDENT, Math.max(0, level)) : 0;
}

const CSS_LENGTH = /^(\d+(?:\.\d+)?)(px|pt|em|rem)$/;
const PX_PER: Record<string, number> = { px: 1, pt: 4 / 3, em: 16, rem: 16 };

/** Отступ блока из margin/padding со стороны начала строки (для RTL — справа). */
function readIndent(dom: HTMLElement, dir: TextDirection | null): number {
  // Отступ абзаца внутри пункта списка — это уровень списка, а не отступ абзаца.
  if (dom.parentElement?.tagName === 'LI') return 0;
  const style = dom.style;
  const raw =
    dir === 'rtl' ? style.marginRight || style.paddingRight : style.marginLeft || style.paddingLeft;
  const m = CSS_LENGTH.exec(raw?.trim() ?? '');
  return m ? indentLevel(Math.round((Number(m[1]) * PX_PER[m[2]!]!) / INDENT_STEP)) : 0;
}

function readDir(dom: HTMLElement): TextDirection | null {
  const dir = dom.getAttribute('dir')?.toLowerCase();
  return dir === 'rtl' || dir === 'ltr' ? dir : null;
}

function readBlockStyle(dom: HTMLElement): BlockStyle {
  const align = dom.style.textAlign;
  const dir = readDir(dom);
  return {
    align: (ALIGNMENTS as readonly string[]).includes(align) ? (align as TextAlign) : null,
    lineHeight: cssValue.lineHeight(dom.style.lineHeight),
    dir,
    indent: readIndent(dom, dir),
  };
}

function blockStyleAttrs(attrs: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  // Направление — атрибутом dir (так его понимают и браузер, и экранные дикторы).
  if (attrs.dir === 'rtl' || attrs.dir === 'ltr') out.dir = attrs.dir;
  const parts: string[] = [];
  const align = attrs.align as string | null;
  if (align && (ALIGNMENTS as readonly string[]).includes(align))
    parts.push(`text-align: ${align};`);
  const lineHeight = cssValue.lineHeight(attrs.lineHeight);
  if (lineHeight) parts.push(`line-height: ${lineHeight};`);
  const indent = indentLevel(attrs.indent);
  // Отступ — со стороны начала строки: для текста справа налево это правый край.
  if (indent) {
    parts.push(`margin-${attrs.dir === 'rtl' ? 'right' : 'left'}: ${indent * INDENT_STEP}px;`);
  }
  if (parts.length) out.style = parts.join(' ');
  return out;
}

const blockStyleSpec = {
  align: { default: null },
  lineHeight: { default: null },
  dir: { default: null },
  indent: { default: 0 },
};

// ---------- стиль маркеров и нумерации списков (advlist) ----------

export const BULLET_STYLES = ['disc', 'circle', 'square'] as const;
export const ORDERED_STYLES = [
  'decimal',
  'lower-alpha',
  'upper-alpha',
  'lower-roman',
  'upper-roman',
  'lower-greek',
] as const;
const OL_TYPE: Record<string, string> = {
  '1': 'decimal',
  a: 'lower-alpha',
  A: 'upper-alpha',
  i: 'lower-roman',
  I: 'upper-roman',
};

/** Стиль списка из style или атрибута type; значение по умолчанию (disc / decimal) — null. */
function readListStyle(
  dom: HTMLElement,
  allowed: readonly string[],
  fallback: string,
): string | null {
  const fromStyle = dom.style.listStyleType.toLowerCase();
  const fromType = OL_TYPE[dom.getAttribute('type') ?? ''] ?? '';
  const value = allowed.includes(fromStyle)
    ? fromStyle
    : allowed.includes(fromType)
      ? fromType
      : null;
  return value === fallback ? null : value;
}

function listStyleAttrs(value: unknown, allowed: readonly string[]): Record<string, string> {
  return typeof value === 'string' && allowed.includes(value)
    ? { style: `list-style-type: ${value};` }
    : {};
}

// ---------- картинки: размер и выравнивание ----------

export type ImageAlign = 'left' | 'center' | 'right';

/** Выравнивание картинки — привычными стилями (float / центр блоком), как в TinyMCE-контенте. */
export const IMAGE_ALIGN_STYLES: Record<ImageAlign, string> = {
  left: 'float: left; margin: 0 1em 1em 0;',
  right: 'float: right; margin: 0 0 1em 1em;',
  center: 'display: block; margin-left: auto; margin-right: auto;',
};

function readImageAlign(el: HTMLElement): ImageAlign | null {
  const float = el.style.float || el.getAttribute('align');
  if (float === 'left' || float === 'right') return float;
  if (
    el.style.display === 'block' &&
    el.style.marginLeft === 'auto' &&
    el.style.marginRight === 'auto'
  ) {
    return 'center';
  }
  return null;
}

/** Размер картинки в px: целое 1…10000, иначе null ('300', '300px', 300). */
export function imageSize(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const match = String(value)
    .trim()
    .match(/^(\d{1,5})(px)?$/);
  if (!match) return null;
  const n = Number(match[1]);
  return n >= 1 && n <= 10000 ? n : null;
}

// ---------- таблицы (prosemirror-tables) ----------

export const CELL_VALIGN = ['top', 'middle', 'bottom'] as const;
export type CellVAlign = (typeof CELL_VALIGN)[number];
export type TableAlign = 'center' | 'right';

/** style таблицы по атрибутам: ширина и выравнивание через margin (так его понимают все браузеры и почта). */
export function tableStyle(attrs: Record<string, unknown>): string {
  const parts: string[] = [];
  const width = cssValue.length(attrs.width);
  if (width) parts.push(`width: ${width};`);
  if (attrs.align === 'center') parts.push('margin-left: auto; margin-right: auto;');
  else if (attrs.align === 'right') parts.push('margin-left: auto;');
  return parts.join(' ');
}

const MAX_SPAN = 100;

/** Узлы таблицы с защитой от вредных значений из вставки и шириной колонок в style. */
function buildTableNodes(allow: ClassFilter) {
  const specs = tableNodes({
    tableGroup: 'block',
    cellContent: 'block+',
    cellAttributes: {
      // Стиль ячейки из списка (tableCellClassList) — рамки, отступы задаёт CSS сайта.
      class: {
        default: null,
        getFromDOM: (dom) => readClass(dom as HTMLElement, allow),
        setDOMAttr: (value, attrs) => {
          const cls = classAttr(value).class;
          if (cls) attrs.class = cls;
        },
      },
      background: {
        default: null,
        // Фон заранее перенесён в data-атрибут (parser.ts → preprocessDOM); style — запасной путь.
        getFromDOM: (dom) =>
          cssValue.color(
            (dom as HTMLElement).getAttribute('data-nova-cell-bg') ??
              (dom as HTMLElement).style?.backgroundColor,
          ),
        setDOMAttr: (value, attrs) => {
          const color = cssValue.color(value);
          if (color)
            attrs.style = `${(attrs.style as string | undefined) ?? ''}background-color: ${color};`;
        },
      },
      valign: {
        default: null,
        getFromDOM: (dom) => {
          const el = dom as HTMLElement;
          const value = (el.style.verticalAlign || el.getAttribute('valign') || '').toLowerCase();
          return (CELL_VALIGN as readonly string[]).includes(value) ? value : null;
        },
        setDOMAttr: (value, attrs) => {
          if ((CELL_VALIGN as readonly string[]).includes(value as string))
            attrs.style = `${(attrs.style as string | undefined) ?? ''}vertical-align: ${value};`;
        },
      },
    },
  });

  // Таблица: ширина (px или %) и выравнивание на странице (по центру / справа).
  specs.table.attrs = {
    width: { default: null },
    align: { default: null },
    // Стиль таблицы из списка (tableClassList): «с рамками», «раскладка без рамок»…
    class: { default: null },
  };
  specs.table.parseDOM = [
    {
      tag: 'table',
      getAttrs: (dom) => {
        const el = dom as HTMLElement;
        const width =
          cssValue.length(el.style.width) ?? cssValue.length(`${el.getAttribute('width') ?? ''}px`);
        const auto = (v: string) => v === 'auto';
        const align =
          el.getAttribute('align') === 'center' ||
          (auto(el.style.marginLeft) && auto(el.style.marginRight))
            ? 'center'
            : el.getAttribute('align') === 'right' || auto(el.style.marginLeft)
              ? 'right'
              : null;
        return { width, align, class: readClass(el, allow) };
      },
    },
  ];
  specs.table.toDOM = (node) => {
    const style = tableStyle(node.attrs);
    return ['table', { ...classAttr(node.attrs.class), ...(style ? { style } : {}) }, ['tbody', 0]];
  };
  for (const name of ['table_cell', 'table_header'] as const) {
    const spec = specs[name];
    const rule = spec.parseDOM![0]!;
    const getAttrs = rule.getAttrs!;
    rule.getAttrs = (dom) => {
      const attrs = getAttrs(dom as HTMLElement) as Record<string, unknown> | false | null;
      if (!attrs) return attrs;
      // colspan="99999" из вставки раздул бы карту таблицы — ограничиваем.
      const clamp = (n: unknown) =>
        Math.min(MAX_SPAN, Math.max(1, Number.isFinite(n) ? Math.floor(n as number) : 1));
      return { ...attrs, colspan: clamp(attrs.colspan), rowspan: clamp(attrs.rowspan) };
    };
    const toDOM = spec.toDOM!;
    spec.toDOM = (node) => {
      const out = toDOM(node) as [string, Record<string, string>, 0];
      const widths = node.attrs.colwidth as number[] | null;
      // Ширина в style — чтобы таблица выглядела так же вне редактора (data-colwidth знает только он).
      if (widths?.every((w) => w > 0)) {
        const total = widths.reduce((a, b) => a + b, 0);
        const rest = out[1].style ? ` ${out[1].style}` : '';
        out[1] = { ...out[1], style: `width: ${total}px;${rest}` };
      }
      return out;
    };
  }
  return specs;
}

// ---------- классы (style_formats, validClasses) ----------

/** Какие классы из HTML сохранять. По умолчанию — никакие: вывод без классов, как раньше. */
export type ClassFilter = (className: string) => boolean;
const NO_CLASSES: ClassFilter = () => false;
const CLASS_TOKEN = /^-?[_a-zA-Z][\w-]*$/;

/** Уровень заголовка 1–6 (значение могло прийти из JSON строкой, числом вне диапазона, null). */
function headingLevel(value: unknown): number {
  const level = Math.trunc(Number(value));
  return level >= 1 && level <= 6 ? level : 1;
}

/** Классы элемента, которые разрешены фильтром, или null. */
function readClass(dom: HTMLElement, allow: ClassFilter): string | null {
  const kept = [...dom.classList].filter((c) => CLASS_TOKEN.test(c) && allow(c));
  return kept.length ? kept.join(' ') : null;
}

/** Атрибут class для вывода: только корректные имена (документ мог прийти из JSON). */
export function classAttr(value: unknown): { class?: string } {
  if (typeof value !== 'string') return {};
  const tokens = value.split(/\s+/).filter((c) => CLASS_TOKEN.test(c));
  return tokens.length ? { class: tokens.join(' ') } : {};
}

const classSpec = { class: { default: null } };

const buildNodes = (allow: ClassFilter) =>
  ({
    doc: { content: 'block+' },

    paragraph: {
      group: 'block',
      content: 'inline*',
      attrs: { ...blockStyleSpec, ...classSpec },
      parseDOM: [
        {
          tag: 'p',
          getAttrs: (dom) => ({
            ...readBlockStyle(dom as HTMLElement),
            class: readClass(dom as HTMLElement, allow),
          }),
        },
      ],
      toDOM: (node): DOMOutputSpec => [
        'p',
        { ...classAttr(node.attrs.class), ...blockStyleAttrs(node.attrs) },
        0,
      ],
    },

    heading: {
      group: 'block',
      content: 'inline*',
      defining: true,
      attrs: { level: { default: 1 }, ...blockStyleSpec, ...classSpec },
      parseDOM: [1, 2, 3, 4, 5, 6].map((level) => ({
        tag: `h${level}`,
        getAttrs: (dom: HTMLElement) => ({
          level,
          ...readBlockStyle(dom),
          class: readClass(dom, allow),
        }),
      })),
      toDOM: (node): DOMOutputSpec => [
        // Уровень мог прийти из JSON чем угодно — в имя тега попадает только 1–6.
        `h${headingLevel(node.attrs.level)}`,
        { ...classAttr(node.attrs.class), ...blockStyleAttrs(node.attrs) },
        0,
      ],
    },

    blockquote: {
      group: 'block',
      content: 'block+',
      defining: true,
      attrs: { ...classSpec },
      parseDOM: [
        {
          tag: 'blockquote',
          getAttrs: (dom) => ({ class: readClass(dom as HTMLElement, allow) }),
        },
      ],
      toDOM: (node): DOMOutputSpec => ['blockquote', classAttr(node.attrs.class), 0],
    },

    horizontal_rule: {
      group: 'block',
      parseDOM: [{ tag: 'hr' }],
      toDOM: (): DOMOutputSpec => ['hr'],
    },

    code_block: {
      group: 'block',
      content: 'text*',
      marks: '',
      code: true,
      defining: true,
      attrs: { language: { default: null } },
      parseDOM: [
        {
          tag: 'pre',
          preserveWhitespace: 'full',
          getAttrs: (dom) => {
            const code = (dom as HTMLElement).querySelector('code');
            const match = code?.className.match(/language-([\w-]+)/);
            return { language: match?.[1] ?? null };
          },
        },
      ],
      toDOM: (node): DOMOutputSpec => [
        'pre',
        ['code', node.attrs.language ? { class: `language-${node.attrs.language}` } : {}, 0],
      ],
    },

    bullet_list: {
      group: 'block',
      content: 'list_item+',
      attrs: { listStyle: { default: null } },
      parseDOM: [
        {
          tag: 'ul',
          getAttrs: (dom) => ({
            listStyle: readListStyle(dom as HTMLElement, BULLET_STYLES, 'disc'),
          }),
        },
      ],
      toDOM: (node): DOMOutputSpec => [
        'ul',
        listStyleAttrs(node.attrs.listStyle, BULLET_STYLES),
        0,
      ],
    },

    ordered_list: {
      group: 'block',
      content: 'list_item+',
      attrs: { start: { default: 1 }, listStyle: { default: null } },
      parseDOM: [
        {
          tag: 'ol',
          getAttrs: (dom) => {
            const start = (dom as HTMLElement).getAttribute('start');
            return {
              start: start ? Number(start) : 1,
              listStyle: readListStyle(dom as HTMLElement, ORDERED_STYLES, 'decimal'),
            };
          },
        },
      ],
      toDOM: (node): DOMOutputSpec => [
        'ol',
        {
          ...(node.attrs.start === 1 ? {} : { start: node.attrs.start }),
          ...listStyleAttrs(node.attrs.listStyle, ORDERED_STYLES),
        },
        0,
      ],
    },

    list_item: {
      content: 'paragraph block*',
      defining: true,
      parseDOM: [{ tag: 'li' }],
      toDOM: (): DOMOutputSpec => ['li', 0],
    },

    text: { group: 'inline' },

    /**
     * Картинка с подписью: <figure><img><figcaption>…</figcaption></figure> — как в HTML, два блока
     * внутри. Поэтому подпись нельзя превратить в заголовок или список (схема не пустит другой блок
     * в figure) — картинка не потеряется. Атрибуты картинки — у figure_image, выравнивание — у figure.
     */
    figure: {
      group: 'block',
      content: 'figure_image figcaption',
      draggable: true,
      isolating: true,
      attrs: { align: { default: null }, ...classSpec },
      parseDOM: [
        {
          tag: 'figure',
          getAttrs: (dom) => {
            const el = dom as HTMLElement;
            // Только «картинка + подпись»; прочие <figure> (с таблицей, цитатой) разбираются как обычно.
            const img = el.querySelector('img');
            if (!img || !isSafeImageUrl(img.getAttribute('src') ?? '')) return false;
            return { align: readImageAlign(el), class: readClass(el, allow) };
          },
        },
      ],
      toDOM: (node): DOMOutputSpec => {
        const width = imageSize(node.firstChild?.attrs.width);
        const align = IMAGE_ALIGN_STYLES[node.attrs.align as ImageAlign] ?? '';
        const style = `${align}${width ? `${align ? ' ' : ''}width: ${width}px;` : ''}`;
        return ['figure', { ...classAttr(node.attrs.class), ...(style ? { style } : {}) }, 0];
      },
    },
    /** Картинка внутри figure (блочная, в отличие от картинки в строке). */
    figure_image: {
      atom: true,
      selectable: false,
      attrs: {
        // Значение по умолчанию нужно ProseMirror, чтобы обязательный узел можно было достроить.
        src: { default: '' },
        alt: { default: null },
        title: { default: null },
        width: { default: null },
        height: { default: null },
      },
      parseDOM: [
        {
          tag: 'img[src]',
          context: 'figure/',
          priority: 60,
          getAttrs: (dom) => {
            const el = dom as HTMLElement;
            if (!isSafeImageUrl(el.getAttribute('src') ?? '')) return false;
            return {
              src: el.getAttribute('src'),
              alt: el.getAttribute('alt'),
              title: el.getAttribute('title'),
              width: imageSize(el.getAttribute('width') ?? el.style.width),
              height: imageSize(el.getAttribute('height') ?? el.style.height),
            };
          },
        },
      ],
      toDOM: (node): DOMOutputSpec => {
        const { alt, title } = node.attrs;
        // Документ мог прийти из JSON в обход parseDOM — проверяем и на выходе.
        const src = isSafeImageUrl(node.attrs.src) ? node.attrs.src : '';
        const width = imageSize(node.attrs.width);
        const height = imageSize(node.attrs.height);
        return [
          'img',
          {
            src,
            ...(alt ? { alt } : {}),
            ...(title ? { title } : {}),
            ...(width ? { width: String(width) } : {}),
            ...(height ? { height: String(height) } : {}),
          },
        ];
      },
    },
    figcaption: {
      content: 'inline*',
      parseDOM: [{ tag: 'figcaption', context: 'figure/' }],
      toDOM: (): DOMOutputSpec => ['figcaption', 0],
    },
    image: {
      group: 'inline',
      inline: true,
      draggable: true,
      attrs: {
        src: {},
        alt: { default: null },
        title: { default: null },
        width: { default: null },
        height: { default: null },
        align: { default: null },
        ...classSpec,
      },
      parseDOM: [
        {
          tag: 'img[src]',
          getAttrs: (dom) => {
            const el = dom as HTMLElement;
            if (!isSafeImageUrl(el.getAttribute('src') ?? '')) return false;
            return {
              src: el.getAttribute('src'),
              alt: el.getAttribute('alt'),
              title: el.getAttribute('title'),
              width: imageSize(el.getAttribute('width') ?? el.style.width),
              height: imageSize(el.getAttribute('height') ?? el.style.height),
              align: readImageAlign(el),
              class: readClass(el, allow),
            };
          },
        },
      ],
      toDOM: (node): DOMOutputSpec => {
        const { alt, title } = node.attrs;
        // Документ мог прийти из JSON в обход parseDOM — проверяем и на выходе.
        const src = isSafeImageUrl(node.attrs.src) ? node.attrs.src : '';
        const width = imageSize(node.attrs.width);
        const height = imageSize(node.attrs.height);
        const style = IMAGE_ALIGN_STYLES[node.attrs.align as ImageAlign];
        return [
          'img',
          {
            src,
            ...classAttr(node.attrs.class),
            ...(alt ? { alt } : {}),
            ...(title ? { title } : {}),
            ...(width ? { width: String(width) } : {}),
            ...(height ? { height: String(height) } : {}),
            ...(style ? { style } : {}),
          },
        ];
      },
    },

    hard_break: {
      group: 'inline',
      inline: true,
      selectable: false,
      parseDOM: [{ tag: 'br' }],
      toDOM: (): DOMOutputSpec => ['br'],
    },

    ...buildTableNodes(allow),
  }) satisfies Record<string, NodeSpec>;

const nodes = buildNodes(NO_CLASSES);

const buildMarks = (allow: ClassFilter) =>
  ({
    link: {
      attrs: { href: {}, title: { default: null }, target: { default: null } },
      inclusive: false,
      parseDOM: [
        {
          tag: 'a[href]',
          getAttrs: (dom) => {
            const el = dom as HTMLElement;
            if (!isSafeLinkUrl(el.getAttribute('href') ?? '')) return false;
            return {
              href: el.getAttribute('href'),
              title: el.getAttribute('title'),
              target: el.getAttribute('target'),
            };
          },
        },
      ],
      toDOM: (mark): DOMOutputSpec => {
        const { title, target } = mark.attrs;
        const href = isSafeLinkUrl(mark.attrs.href) ? mark.attrs.href : '#';
        return [
          'a',
          {
            href,
            ...(title ? { title } : {}),
            ...(target ? { target, rel: 'noopener noreferrer' } : {}),
          },
          0,
        ];
      },
    },

    bold: {
      parseDOM: [
        { tag: 'strong' },
        // <b style="font-weight: normal"> встречается при вставке из Google Docs — это не жирный.
        {
          tag: 'b',
          getAttrs: (dom) => (dom as HTMLElement).style?.fontWeight !== 'normal' && null,
        },
        {
          style: 'font-weight',
          getAttrs: (value) => /^(bold(er)?|[5-9]\d{2,})$/.test(value as string) && null,
        },
      ],
      toDOM: (): DOMOutputSpec => ['strong', 0],
    },

    italic: {
      parseDOM: [{ tag: 'em' }, { tag: 'i' }, { style: 'font-style=italic' }],
      toDOM: (): DOMOutputSpec => ['em', 0],
    },

    underline: {
      parseDOM: [{ tag: 'u' }, { style: 'text-decoration=underline' }],
      toDOM: (): DOMOutputSpec => ['u', 0],
    },

    strike: {
      parseDOM: [
        { tag: 's' },
        { tag: 'del' },
        { tag: 'strike' },
        { style: 'text-decoration=line-through' },
      ],
      toDOM: (): DOMOutputSpec => ['s', 0],
    },

    code: {
      parseDOM: [{ tag: 'code' }],
      toDOM: (): DOMOutputSpec => ['code', 0],
    },

    subscript: {
      excludes: 'superscript',
      // vertical-align — так нижний индекс передают Google Docs и Word.
      parseDOM: [{ tag: 'sub' }, { style: 'vertical-align=sub' }],
      toDOM: (): DOMOutputSpec => ['sub', 0],
    },

    superscript: {
      excludes: 'subscript',
      parseDOM: [{ tag: 'sup' }, { style: 'vertical-align=super' }],
      toDOM: (): DOMOutputSpec => ['sup', 0],
    },

    // ---------- текстовые стили (PRD §4.2): <span style="…"> как у TinyMCE ----------

    color: {
      attrs: { value: {} },
      parseDOM: [
        { style: 'color', getAttrs: (v) => styleAttr(cssValue.color(v)) },
        {
          tag: 'font[color]',
          getAttrs: (dom) => styleAttr(cssValue.color((dom as HTMLElement).getAttribute('color'))),
        },
      ],
      toDOM: (mark): DOMOutputSpec => styleSpan('color', cssValue.color(mark.attrs.value)),
    },

    background: {
      attrs: { value: {} },
      parseDOM: [
        { style: 'background-color', getAttrs: (v) => styleAttr(cssValue.color(v)) },
        { tag: 'mark', getAttrs: () => ({ value: 'yellow' }) },
      ],
      toDOM: (mark): DOMOutputSpec =>
        styleSpan('background-color', cssValue.color(mark.attrs.value)),
    },

    font_family: {
      attrs: { value: {} },
      parseDOM: [{ style: 'font-family', getAttrs: (v) => styleAttr(cssValue.fontFamily(v)) }],
      toDOM: (mark): DOMOutputSpec =>
        styleSpan('font-family', cssValue.fontFamily(mark.attrs.value)),
    },

    font_size: {
      attrs: { value: {} },
      parseDOM: [{ style: 'font-size', getAttrs: (v) => styleAttr(cssValue.length(v)) }],
      toDOM: (mark): DOMOutputSpec => styleSpan('font-size', cssValue.length(mark.attrs.value)),
    },

    /** <span class="…"> — инлайн-стиль из style_formats. Только разрешённые классы. */
    span_class: {
      attrs: { class: {} },
      parseDOM: [
        {
          tag: 'span[class]',
          // Не «съедает» span: его style-атрибуты разбирают марки цвета и шрифта.
          consuming: false,
          getAttrs: (dom) => {
            const value = readClass(dom as HTMLElement, allow);
            return value ? { class: value } : false;
          },
        },
      ],
      toDOM: (mark): DOMOutputSpec => ['span', classAttr(mark.attrs.class), 0],
    },
  }) satisfies Record<string, MarkSpec>;

const marks = buildMarks(NO_CLASSES);

function styleAttr(value: string | null): { value: string } | false {
  return value ? { value } : false;
}

function styleSpan(property: string, value: string | null): DOMOutputSpec {
  // Невалидное значение (например, из JSON) просто не выводится как стиль.
  return value ? ['span', { style: `${property}: ${value};` }, 0] : ['span', 0];
}

export type NodeName = keyof typeof nodes;
export type MarkName = keyof typeof marks;

/**
 * Схема редактора: базовые узлы и марки + расширения плагинов. Тип оставляем «базовым»: встроенный
 * код обращается только к своим узлам (`schema.nodes.paragraph`), а узлы плагинов доступны по имени.
 */
export type NovaSchema = Schema<NodeName, MarkName>;

/** Базовая схема без расширений — у редакторов без плагинов-узлов она общая. */
export const schema: NovaSchema = new Schema<NodeName, MarkName>({ nodes, marks });

export interface SchemaExtensions {
  nodes?: Record<string, NodeSpec>;
  marks?: Record<string, MarkSpec>;
}

/**
 * Схема с узлами и марками плагинов. Без расширений возвращает общую базовую схему.
 * Новые узлы и марки добавляются в конец: базовые правила разбора HTML остаются в приоритете,
 * если плагин не задал свой `priority` в parseDOM.
 */
export function createSchema(
  extensions: SchemaExtensions = {},
  /** Какие классы сохранять (style_formats, validClasses). Без фильтра — никакие. */
  classFilter?: ClassFilter,
): NovaSchema {
  const extraNodes = Object.entries(extensions.nodes ?? {});
  const extraMarks = Object.entries(extensions.marks ?? {});
  if (!extraNodes.length && !extraMarks.length && !classFilter) return schema;
  const baseNodes = classFilter ? buildNodes(classFilter) : nodes;
  const baseMarks = classFilter ? buildMarks(classFilter) : marks;
  for (const [name] of extraNodes) {
    if (name in nodes) throw new Error(`[nova] node "${name}" already exists in the base schema`);
  }
  for (const [name] of extraMarks) {
    if (name in marks) throw new Error(`[nova] mark "${name}" already exists in the base schema`);
  }
  return new Schema({
    nodes: { ...baseNodes, ...Object.fromEntries(extraNodes) },
    marks: { ...baseMarks, ...Object.fromEntries(extraMarks) },
  }) as unknown as NovaSchema;
}
