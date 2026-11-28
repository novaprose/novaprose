import {
  Fragment,
  Schema,
  type Attrs,
  type DOMOutputSpec,
  type MarkSpec,
  type Node as PMNode,
  type NodeSpec,
} from 'prosemirror-model';
import type { HtmlRulesInstance } from './html-rules-api';
import { tableNodes } from './table-nodes';
import { isSafeImageUrl, isSafeLinkUrl } from './url';
import { codeLanguage } from './code-language';
import { elementId } from './element-id';

/**
 * The base document schema of NovaProse. Every node and mark defines both HTML parsing (parseDOM)
 * and serialization (toDOM), so the HTML going in and out is predictable.
 */

export const ALIGNMENTS = ['left', 'center', 'right', 'justify'] as const;
export type TextAlign = (typeof ALIGNMENTS)[number];

// ---------- CSS value validation ----------
// Style values end up in the style attribute, so only the expected formats get through:
// content can't smuggle in position:fixed, url(...) or other injections.

const COLOR_RE =
  /^(#[0-9a-f]{3,8}|rgba?\(\s*[\d.]+%?\s*,\s*[\d.]+%?\s*,\s*[\d.]+%?\s*(,\s*[\d.]+%?\s*)?\)|[a-z]{3,20})$/i;
const LENGTH_RE = /^\d{1,4}(\.\d{1,3})?(px|pt|em|rem|%)$/;
const LINE_HEIGHT_RE = /^\d{1,2}(\.\d{1,3})?(px|em|%)?$/;
const FONT_FAMILY_RE = /^[\w\s,'"-]{1,200}$/;

/** The canonical form of a color: lowercase #rrggbb; rgba with transparency and names as they are. */
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
    // Not colors but "default": transparent (Google Docs), windowtext and auto (Word).
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

// ---------- block styles: alignment, line height, text direction ----------

export type TextDirection = 'ltr' | 'rtl';

interface BlockStyle {
  align: TextAlign | null;
  lineHeight: string | null;
  dir: TextDirection | null;
  indent: number;
}

/** The paragraph indent step in px (as in familiar editors) and the level limit. */
export const INDENT_STEP = 40;
export const MAX_INDENT = 10;

/** Indent level 0…MAX_INDENT from any value (JSON can contain anything). */
export function indentLevel(value: unknown): number {
  const level = Math.trunc(Number(value));
  return Number.isFinite(level) ? Math.min(MAX_INDENT, Math.max(0, level)) : 0;
}

const CSS_LENGTH = /^(\d+(?:\.\d+)?)(px|pt|em|rem)$/;
const PX_PER: Record<string, number> = { px: 1, pt: 4 / 3, em: 16, rem: 16 };

/** A block's indent from margin/padding on the line-start side (on the right for RTL). */
function readIndent(dom: HTMLElement, dir: TextDirection | null): number {
  // A paragraph indent inside a list item is the list level, not a paragraph indent.
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

/**
 * `rtl` is the editor's default direction (the direction option): a block without its own dir is indented
 * on the line-start side, that is, on the right.
 */
function readBlockStyle(dom: HTMLElement, rtl = false): BlockStyle {
  const align = dom.style.textAlign;
  const dir = readDir(dom);
  return {
    align: (ALIGNMENTS as readonly string[]).includes(align) ? (align as TextAlign) : null,
    lineHeight: cssValue.lineHeight(dom.style.lineHeight),
    dir,
    indent: readIndent(dom, dir ?? (rtl ? 'rtl' : null)),
  };
}

function blockStyleAttrs(attrs: Record<string, unknown>, rtl = false): Record<string, string> {
  const out: Record<string, string> = {};
  // Direction goes into the dir attribute (both the browser and screen readers understand it that way).
  if (attrs.dir === 'rtl' || attrs.dir === 'ltr') out.dir = attrs.dir;
  const end = attrs.dir === 'rtl' || (rtl && attrs.dir !== 'ltr');
  const parts: string[] = [];
  const align = attrs.align as string | null;
  if (align && (ALIGNMENTS as readonly string[]).includes(align))
    parts.push(`text-align: ${align};`);
  const lineHeight = cssValue.lineHeight(attrs.lineHeight);
  if (lineHeight) parts.push(`line-height: ${lineHeight};`);
  const indent = indentLevel(attrs.indent);
  // The indent is on the line-start side: for right-to-left text that is the right edge.
  if (indent) {
    parts.push(`margin-${end ? 'right' : 'left'}: ${indent * INDENT_STEP}px;`);
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

// ---------- list marker and numbering styles (advlist) ----------

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

/** The list style from style or the type attribute; the default (disc / decimal) is null. */
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

// ---------- images: size and alignment ----------

export type ImageAlign = 'left' | 'center' | 'right';

/** Image alignment with familiar styles (float / a centered block), as in TinyMCE content. */
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

/** Image size in px: an integer 1…10000, otherwise null ('300', '300px', 300). */
export function imageSize(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const match = String(value)
    .trim()
    .match(/^(\d{1,5})(px)?$/);
  if (!match) return null;
  const n = Number(match[1]);
  return n >= 1 && n <= 10000 ? n : null;
}

// ---------- tables (prosemirror-tables) ----------

export const CELL_VALIGN = ['top', 'middle', 'bottom'] as const;
export type CellVAlign = (typeof CELL_VALIGN)[number];
export type TableAlign = 'center' | 'right';

/** The table's style from its attributes: width and alignment through margin (every browser and mail client understands it). */
export function tableStyle(attrs: Record<string, unknown>): string {
  const parts: string[] = [];
  const width = cssValue.length(attrs.width);
  if (width) parts.push(`width: ${width};`);
  if (attrs.align === 'center') parts.push('margin-left: auto; margin-right: auto;');
  else if (attrs.align === 'right') parts.push('margin-left: auto;');
  return parts.join(' ');
}

const MAX_SPAN = 100;

/** Table nodes protected from harmful values in pasted content, with column widths in style. */
function buildTableNodes(allow: ClassFilter) {
  const specs = tableNodes({
    tableGroup: 'block',
    cellContent: 'block+',
    cellAttributes: {
      // A cell style from the list (tableCellClassList): the site's CSS sets borders and padding.
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
        // The background was moved into a data attribute beforehand (parser.ts → preprocessDOM); style is the fallback.
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

  // Table: width (px or %) and alignment on the page (centered / right).
  specs.table.attrs = {
    width: { default: null },
    align: { default: null },
    // A table style from the list (tableClassList): "with borders", "layout without borders"…
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
      // colspan="99999" from pasted content would inflate the table map: it is capped.
      const clamp = (n: unknown) =>
        Math.min(MAX_SPAN, Math.max(1, Number.isFinite(n) ? Math.floor(n as number) : 1));
      return { ...attrs, colspan: clamp(attrs.colspan), rowspan: clamp(attrs.rowspan) };
    };
    const toDOM = spec.toDOM!;
    spec.toDOM = (node) => {
      const out = toDOM(node) as [string, Record<string, string>, 0];
      const widths = node.attrs.colwidth as number[] | null;
      // Width in style, so the table looks the same outside the editor (only the editor knows data-colwidth).
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

// ---------- classes (style_formats, validClasses) ----------

/** Which classes from HTML to keep. By default none: output without classes. */
export type ClassFilter = (className: string) => boolean;
const NO_CLASSES: ClassFilter = () => false;
const CLASS_TOKEN = /^-?[_a-zA-Z][\w-]*$/;

const LANGUAGE_CLASS = /(?:^|\s)lang(?:uage)?-(\S+)/;

/**
 * The language from the markup: class="language-x" on <code> (CommonMark, highlight.js, Prism, Tiptap) or on
 * <pre> (TinyMCE, Prism), «lang-x» (Prettify), data-language.
 */
function readCodeLanguage(pre: HTMLElement): string | null {
  for (const el of [pre.querySelector('code'), pre]) {
    if (!el) continue;
    const value =
      codeLanguage(LANGUAGE_CLASS.exec(el.getAttribute('class') ?? '')?.[1]) ??
      codeLanguage(el.getAttribute('data-language'));
    if (value) return value;
  }
  return null;
}

const PRE_BLOCKS =
  /^(?:P|DIV|H[1-6]|LI|UL|OL|DL|DT|DD|TABLE|TR|BLOCKQUOTE|PRE|SECTION|ARTICLE|HEADER|FOOTER)$/;

/**
 * The text of a <pre>, exactly: its text as it is, a new line for <br> and between the blocks some
 * sources put inside it (lines as <div> or <p>). Its children aren't parsed as blocks: a block in
 * a code block used to leave it and carry its "keep spaces" mode into the paragraphs after it.
 */
export function preText(pre: Node): string {
  let out = '';
  // After a block, the next text starts on a new line (and the code doesn't end with an empty line).
  let pendingLine = false;
  const add = (text: string) => {
    if (!text) return;
    if (pendingLine) out += '\n';
    pendingLine = false;
    out += text;
  };
  const walk = (node: Node) => {
    for (const child of node.childNodes) {
      if (child.nodeType === 3) add((child as Text).data);
      else if (child.nodeType === 1) {
        const tag = (child as Element).tagName;
        if (tag === 'BR') {
          pendingLine = false;
          out += '\n';
        } else if (PRE_BLOCKS.test(tag)) {
          if (out && (pendingLine || !out.endsWith('\n'))) out += '\n';
          pendingLine = false;
          walk(child);
          pendingLine = true;
        } else walk(child);
      }
    }
  };
  walk(pre);
  return out;
}

/** A checklist in someone else's markup: Tiptap, TinyMCE (the checklist plugin), GitHub/Markdown. */
function isChecklistElement(dom: HTMLElement): boolean {
  return (
    dom.getAttribute('data-type') === 'taskList' ||
    dom.classList.contains('tox-checklist') ||
    dom.classList.contains('contains-task-list')
  );
}

/** Whether a checklist item is checked (null means a regular list item). */
function readChecked(dom: HTMLElement): boolean | null {
  const list = dom.parentElement;
  if (!list || !isChecklistElement(list)) return null;
  const data = dom.getAttribute('data-checked');
  if (data === 'true' || data === 'false') return data === 'true';
  if (dom.classList.contains('tox-checklist--checked')) return true;
  // A checkbox at the start of the item (GitHub, Tiptap): the schema doesn't keep the <input> itself.
  const box = [...dom.querySelectorAll('input[type="checkbox"]')].find(
    (el) => el.closest('li') === dom,
  );
  if (box) return box.hasAttribute('checked');
  return false;
}

/** Heading level 1–6 (the value could come from JSON as a string, an out-of-range number, null). */
function headingLevel(value: unknown): number {
  const level = Math.trunc(Number(value));
  return level >= 1 && level <= 6 ? level : 1;
}

/** The element's classes that the filter allows, or null. */
function readClass(dom: HTMLElement, allow: ClassFilter): string | null {
  const kept = [...dom.classList].filter((c) => CLASS_TOKEN.test(c) && allow(c));
  return kept.length ? kept.join(' ') : null;
}

/** The class attribute for output: only valid names (the document could come from JSON). */
export function classAttr(value: unknown): { class?: string } {
  if (typeof value !== 'string') return {};
  const tokens = value.split(/\s+/).filter((c) => CLASS_TOKEN.test(c));
  return tokens.length ? { class: tokens.join(' ') } : {};
}

const classSpec = { class: { default: null } };

const buildNodes = (allow: ClassFilter, rtl = false) =>
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
            ...readBlockStyle(dom as HTMLElement, rtl),
            class: readClass(dom as HTMLElement, allow),
          }),
        },
      ],
      toDOM: (node): DOMOutputSpec => [
        'p',
        { ...classAttr(node.attrs.class), ...blockStyleAttrs(node.attrs, rtl) },
        0,
      ],
    },

    heading: {
      group: 'block',
      content: 'inline*',
      defining: true,
      // id is for links to a section (table of contents, #anchor); checked both when parsing and on output.
      attrs: { level: { default: 1 }, id: { default: null }, ...blockStyleSpec, ...classSpec },
      parseDOM: [1, 2, 3, 4, 5, 6].map((level) => ({
        tag: `h${level}`,
        getAttrs: (dom: HTMLElement) => ({
          level,
          id: elementId(dom.getAttribute('id')),
          ...readBlockStyle(dom, rtl),
          class: readClass(dom, allow),
        }),
      })),
      toDOM: (node): DOMOutputSpec => [
        // The level could come from JSON as anything: only 1–6 gets into the tag name.
        `h${headingLevel(node.attrs.level)}`,
        {
          ...(elementId(node.attrs.id) ? { id: node.attrs.id } : {}),
          ...classAttr(node.attrs.class),
          ...blockStyleAttrs(node.attrs, rtl),
        },
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
          getAttrs: (dom) => ({ language: readCodeLanguage(dom as HTMLElement) }),
          // The text, read as it is (see preText).
          getContent: (dom, schema) => {
            const text = preText(dom);
            return text ? Fragment.from(schema.text(text)) : Fragment.empty;
          },
        },
      ],
      toDOM: (node): DOMOutputSpec => {
        const language = codeLanguage(node.attrs.language);
        return ['pre', ['code', language ? { class: `language-${language}` } : {}, 0]];
      },
    },

    // A checklist is a bulleted list with the checklist flag (items with checked): all the list mechanics
    // (Enter, Tab, indents, paste, Markdown) work without a second list type. The HTML is Tiptap's
    // (data-type="taskList"/"taskItem", data-checked); parsing understands TinyMCE and GitHub too.
    bullet_list: {
      group: 'block',
      content: 'list_item+',
      attrs: { listStyle: { default: null }, checklist: { default: false } },
      parseDOM: [
        {
          tag: 'ul',
          getAttrs: (dom) => {
            const checklist = isChecklistElement(dom as HTMLElement);
            return {
              listStyle: checklist
                ? null
                : readListStyle(dom as HTMLElement, BULLET_STYLES, 'disc'),
              checklist,
            };
          },
        },
      ],
      toDOM: (node): DOMOutputSpec =>
        node.attrs.checklist === true
          ? ['ul', { 'data-type': 'taskList' }, 0]
          : ['ul', listStyleAttrs(node.attrs.listStyle, BULLET_STYLES), 0],
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
      // checked: null is a regular item; true/false is a checklist item (checked / not).
      attrs: { checked: { default: null } },
      parseDOM: [{ tag: 'li', getAttrs: (dom) => ({ checked: readChecked(dom as HTMLElement) }) }],
      toDOM: (node): DOMOutputSpec =>
        typeof node.attrs.checked === 'boolean'
          ? ['li', { 'data-type': 'taskItem', 'data-checked': String(node.attrs.checked) }, 0]
          : ['li', 0],
    },

    text: { group: 'inline' },

    /**
     * An image with a caption: <figure><img><figcaption>…</figcaption></figure>, as in HTML — two
     * blocks inside. So the caption can't become a heading or a list (the schema won't let another
     * block into figure) and the image is never lost. Image attributes live on figure_image, alignment on figure.
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
            // Only "image + caption"; other <figure>s (with a table, a quote) are parsed as usual.
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
    /** An image inside figure (a block, unlike an image in a line). */
    figure_image: {
      atom: true,
      selectable: false,
      attrs: {
        // ProseMirror needs a default value so that a required node can be filled in.
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
        // The document could come from JSON past parseDOM, so it is checked on output too.
        const src = isSafeImageUrl(node.attrs.src) ? node.attrs.src : '';
        const width = imageSize(node.attrs.width);
        const height = imageSize(node.attrs.height);
        return [
          'img',
          {
            src,
            // alt="" (a decorative image) is kept: screen readers skip such an image instead of
            // reading its file name. No alt at all means it was never given.
            ...(alt === null || alt === undefined ? {} : { alt: String(alt) }),
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
        // The document could come from JSON past parseDOM, so it is checked on output too.
        const src = isSafeImageUrl(node.attrs.src) ? node.attrs.src : '';
        const width = imageSize(node.attrs.width);
        const height = imageSize(node.attrs.height);
        const style = IMAGE_ALIGN_STYLES[node.attrs.align as ImageAlign];
        return [
          'img',
          {
            src,
            ...classAttr(node.attrs.class),
            // alt="" (a decorative image) is kept: screen readers skip such an image instead of
            // reading its file name. No alt at all means it was never given.
            ...(alt === null || alt === undefined ? {} : { alt: String(alt) }),
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
        // <b style="font-weight: normal"> shows up in content pasted from Google Docs: that is not bold.
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
      // Code: typing rules (-- → —, ... → …) and autocorrect leave it as typed.
      code: true,
      parseDOM: [{ tag: 'code' }],
      toDOM: (): DOMOutputSpec => ['code', 0],
    },

    subscript: {
      excludes: 'superscript',
      // vertical-align: the way Google Docs and Word pass subscript.
      parseDOM: [{ tag: 'sub' }, { style: 'vertical-align=sub' }],
      toDOM: (): DOMOutputSpec => ['sub', 0],
    },

    superscript: {
      excludes: 'subscript',
      parseDOM: [{ tag: 'sup' }, { style: 'vertical-align=super' }],
      toDOM: (): DOMOutputSpec => ['sup', 0],
    },

    // ---------- text styles: <span style="…"> as in TinyMCE ----------

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

    /** <span class="…"> — an inline style from style_formats. Allowed classes only. */
    span_class: {
      attrs: { class: {} },
      parseDOM: [
        {
          tag: 'span[class]',
          // Doesn't "consume" the span: the color and font marks parse its style attributes.
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
  // An invalid value (from JSON, for example) is simply not output as a style.
  return value ? ['span', { style: `${property}: ${value};` }, 0] : ['span', 0];
}

export type NodeName = keyof typeof nodes;
export type MarkName = keyof typeof marks;

/**
 * An editor's schema: base nodes and marks plus plugin extensions. The type stays the base one:
 * built-in code only touches its own nodes (`schema.nodes.paragraph`), plugin nodes are available by name.
 */
export type NovaSchema = Schema<NodeName, MarkName>;

/** The base schema without extensions, shared by editors without node plugins. */
export const schema: NovaSchema = new Schema<NodeName, MarkName>({ nodes, marks });

export interface SchemaExtensions {
  nodes?: Record<string, NodeSpec>;
  marks?: Record<string, MarkSpec>;
  /** Attributes plugins add to existing nodes, by attribute name. */
  attributes?: Record<string, NodeAttribute>;
}

/**
 * An attribute a plugin adds to existing nodes: read from the node's element when HTML is parsed and
 * written back to it. The value can come from JSON as anything: `render` must cope with that.
 */
export interface NodeAttribute {
  /**
   * Which nodes get it: their names, 'textblock' for every node that holds text, or 'all' for every
   * node but the document and text.
   */
  nodes: readonly string[] | 'textblock' | 'all';
  default: unknown;
  /** The value from the element (null or undefined: none). */
  parse(dom: HTMLElement): unknown;
  /** The element's attributes for a value ({} for none). */
  render(value: unknown): Record<string, string>;
}

/** A node with a plugin's attribute: kept in the model, read from and written to its element. */
function withAttribute(name: string, attr: NodeAttribute, spec: NodeSpec): NodeSpec {
  const toDOM = spec.toDOM;
  return {
    ...spec,
    attrs: { ...spec.attrs, [name]: { default: attr.default } },
    parseDOM: spec.parseDOM?.map((rule) => {
      if (!rule.tag) return rule;
      const getAttrs = rule.getAttrs as ((dom: HTMLElement) => Attrs | false | null) | undefined;
      return {
        ...rule,
        getAttrs: (dom: HTMLElement) => {
          const base = getAttrs ? getAttrs(dom) : (rule.attrs ?? null);
          if (base === false) return false;
          const value = attr.parse(dom);
          return value == null ? base : { ...base, [name]: value };
        },
      };
    }),
    ...(toDOM
      ? {
          toDOM: (node: PMNode) => {
            const out = toDOM(node);
            const extra = attr.render(node.attrs[name]);
            if (!Array.isArray(out) || typeof out[0] !== 'string' || !Object.keys(extra).length)
              return out;
            const second = out[1] as unknown;
            const hasAttrs =
              !!second &&
              typeof second === 'object' &&
              !Array.isArray(second) &&
              (second as { nodeType?: unknown }).nodeType === undefined;
            return [
              out[0],
              { ...(hasAttrs ? (second as Attrs) : {}), ...extra },
              ...(out as unknown[]).slice(hasAttrs ? 2 : 1),
            ] as unknown as DOMOutputSpec;
          },
        }
      : {}),
  };
}

/** Whether a node spec holds text (inline content). */
const holdsText = (spec: NodeSpec) => /\b(inline|text)\b/.test(spec.content ?? '');

/**
 * A schema with the nodes and marks of plugins; without extensions, the shared base schema. New
 * nodes and marks go at the end, so the base HTML parse rules keep priority unless a plugin sets its
 * own `priority` in parseDOM.
 */
export function createSchema(
  extensions: SchemaExtensions = {},
  /** Which classes to keep (style_formats, validClasses). Without a filter, none. */
  classFilter?: ClassFilter,
  /** Rules for elements and attributes (validElements with attributes, extendedValidElements…). */
  htmlRules?: HtmlRulesInstance | null,
  /** The editor's direction: right-to-left, a block's indent is margin-right. */
  direction: 'ltr' | 'rtl' = 'ltr',
): NovaSchema {
  const rtl = direction === 'rtl';
  const extraNodes = Object.entries(extensions.nodes ?? {});
  const extraMarks = Object.entries(extensions.marks ?? {});
  const attributes = Object.entries(extensions.attributes ?? {});
  if (
    !extraNodes.length &&
    !extraMarks.length &&
    !attributes.length &&
    !classFilter &&
    !htmlRules &&
    !rtl
  )
    return schema;
  let baseNodes: Record<string, NodeSpec> =
    classFilter || rtl ? buildNodes(classFilter ?? NO_CLASSES, rtl) : nodes;
  let baseMarks: Record<string, MarkSpec> = classFilter ? buildMarks(classFilter) : marks;
  const ref: { schema?: Schema } = {};
  if (htmlRules) {
    ({ nodes: baseNodes, marks: baseMarks } = htmlRules.apply(
      { nodes: baseNodes, marks: baseMarks },
      ref,
    ));
  }
  for (const [name] of extraNodes) {
    if (name in nodes) throw new Error(`[nova] node "${name}" already exists in the base schema`);
  }
  for (const [name] of extraMarks) {
    if (name in marks) throw new Error(`[nova] mark "${name}" already exists in the base schema`);
  }
  let allNodes: Record<string, NodeSpec> = { ...baseNodes, ...Object.fromEntries(extraNodes) };
  const gets = (attr: NodeAttribute, node: string, spec: NodeSpec) =>
    attr.nodes === 'all'
      ? node !== 'doc' && node !== 'text'
      : attr.nodes === 'textblock'
        ? holdsText(spec)
        : attr.nodes.includes(node);
  for (const [name, attr] of attributes) {
    allNodes = Object.fromEntries(
      Object.entries(allNodes).map(([node, spec]) => [
        node,
        gets(attr, node, spec) && !spec.attrs?.[name] ? withAttribute(name, attr, spec) : spec,
      ]),
    );
  }
  ref.schema = new Schema({
    nodes: allNodes,
    marks: { ...baseMarks, ...Object.fromEntries(extraMarks) },
  });
  return ref.schema as unknown as NovaSchema;
}
