import type { Mark, Node as PMNode } from 'prosemirror-model';
import {
  resolvePageLayout,
  type PageBandParts,
  type PageLayout,
  type PageLayoutOptions,
} from '../plugins/pagelayout';
import { isSafeLinkUrl } from '../url';
import { escapeXml } from './xml';
import { zip, type ZipEntry } from './zip';

/**
 * A document → .docx (Office Open XML) without third-party libraries or a DOM, so it also works on
 * the server. Paragraphs, headings (with bookmarks for table-of-contents links), lists (real Word
 * numbering), tables with merged cells and fill, images, links, text formatting, suggested edits as
 * Word tracked changes (accept/reject), and the sheet and margins from page layout. Child elements of
 * pPr/rPr/tcPr/tblPr/sectPr come in the order the schema requires: Word is strict about it.
 */

export interface DocxImage {
  data: Uint8Array;
  type: 'png' | 'jpeg' | 'gif';
  width?: number;
  height?: number;
}

export interface DocxExportOptions {
  /** Sheet and margins; A4 with 20 mm margins by default (from an editor — its page layout). */
  page?: PageLayoutOptions | PageLayout;
  /** Text font (Calibri by default) and size in points (12 — like 16px in the editor). */
  font?: string;
  fontSize?: number;
  /** Title in the file properties. */
  title?: string;
  /** An image's bytes by its address. By default data: URLs are decoded and others fetched. */
  loadImage?: (src: string) => Promise<DocxImage | null>;
}

const NS = {
  w: 'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
  r: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
  wp: 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing',
  a: 'http://schemas.openxmlformats.org/drawingml/2006/main',
  pic: 'http://schemas.openxmlformats.org/drawingml/2006/picture',
  rel: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
};
const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const TWIPS_PER_MM = 1440 / 25.4;
const EMU_PER_PX = 9525;
const INDENT_TWIPS = 600; // the editor's indent step is 40px

const twips = (mm: number) => Math.round(mm * TWIPS_PER_MM);

// ---------- images ----------

function sniff(bytes: Uint8Array): DocxImage['type'] | null {
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47)
    return 'png';
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpeg';
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return 'gif';
  return null;
}

/** Size in pixels from the file header (PNG, GIF, JPEG). */
export function imageSize(
  bytes: Uint8Array,
  type: DocxImage['type'],
): { width?: number; height?: number } {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  try {
    if (type === 'png') return { width: view.getUint32(16), height: view.getUint32(20) };
    if (type === 'gif') return { width: view.getUint16(6, true), height: view.getUint16(8, true) };
    for (let i = 2; i + 9 < bytes.length;) {
      if (bytes[i] !== 0xff) break;
      const marker = bytes[i + 1]!;
      const length = view.getUint16(i + 2);
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker))
        return { height: view.getUint16(i + 5), width: view.getUint16(i + 7) };
      i += 2 + length;
    }
  } catch {
    // a truncated file: the size is unknown
  }
  return {};
}

function base64(text: string): Uint8Array {
  const binary = atob(text.replace(/\s+/g, ''));
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

/** An image by address: data: from the address itself, the rest through fetch (CORS may block it). */
export async function loadImage(src: string): Promise<DocxImage | null> {
  let bytes: Uint8Array;
  const data = /^data:[^,;]*(;base64)?,([\s\S]*)$/i.exec(src);
  if (data) {
    bytes = data[1] ? base64(data[2]!) : new TextEncoder().encode(decodeURIComponent(data[2]!));
  } else if (typeof fetch === 'function' && !/^(javascript|vbscript):/i.test(src)) {
    const response = await fetch(src);
    if (!response.ok) return null;
    bytes = new Uint8Array(await response.arrayBuffer());
  } else return null;
  const type = sniff(bytes);
  return type ? { data: bytes, type, ...imageSize(bytes, type) } : null;
}

// ---------- colors, fonts, sizes ----------

const NAMED: Record<string, string> = {
  black: '000000',
  white: 'FFFFFF',
  red: 'FF0000',
  green: '008000',
  blue: '0000FF',
  yellow: 'FFFF00',
  orange: 'FFA500',
  purple: '800080',
  gray: '808080',
  grey: '808080',
};

/** A CSS color → RRGGBB for Word (or null: transparent, a variable, unknown). */
export function hexColor(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const css = value.trim().toLowerCase();
  const hex = /^#([0-9a-f]{3,8})$/.exec(css)?.[1];
  if (hex) {
    if (hex.length === 3 || hex.length === 4)
      return [...hex.slice(0, 3)]
        .map((ch) => ch + ch)
        .join('')
        .toUpperCase();
    if (hex.length === 6 || hex.length === 8) return hex.slice(0, 6).toUpperCase();
    return null;
  }
  const rgb = /^rgba?\(([^)]+)\)$/.exec(css)?.[1];
  if (rgb) {
    const parts = rgb.split(/[\s,/]+/).filter(Boolean);
    if (parts.length >= 4 && Number(parts[3]) === 0) return null;
    const channels = parts
      .slice(0, 3)
      .map((part) => (part.endsWith('%') ? (parseFloat(part) * 255) / 100 : parseFloat(part)));
    if (channels.length < 3 || channels.some((n) => !Number.isFinite(n))) return null;
    return channels
      .map((n) =>
        Math.round(Math.min(255, Math.max(0, n)))
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')
      .toUpperCase();
  }
  return NAMED[css] ?? null;
}

const GENERIC_FONTS: Record<string, string> = {
  serif: 'Times New Roman',
  'sans-serif': 'Arial',
  monospace: 'Consolas',
  'system-ui': 'Calibri',
  cursive: 'Comic Sans MS',
};

function fontName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const first = value
    .split(',')[0]!
    .trim()
    .replace(/^['"]|['"]$/g, '');
  if (!first) return null;
  return GENERIC_FONTS[first.toLowerCase()] ?? first.slice(0, 64);
}

/** '14px' / '11pt' → half-points (w:sz). */
function halfPoints(value: unknown): number | null {
  const m = typeof value === 'string' ? /^(\d+(?:\.\d+)?)(px|pt)$/.exec(value.trim()) : null;
  if (!m) return null;
  const pt = m[2] === 'px' ? Number(m[1]) * 0.75 : Number(m[1]);
  return pt > 0 && pt < 1000 ? Math.round(pt * 2) : null;
}

/** A Word bookmark name: a letter first, letters/digits/_, at most 40 long. */
export function bookmarkName(id: string): string {
  const name = id.replace(/[^\p{L}\p{N}_]/gu, '_');
  return (/^\p{L}/u.test(name) ? name : `b_${name}`).slice(0, 40);
}

function dateOf(ms: unknown): string {
  const time = Number(ms);
  return new Date(Number.isFinite(time) && time > 0 ? time : 0)
    .toISOString()
    .replace(/\.\d+Z$/, 'Z');
}

// ---------- writing the document ----------

/** A run's own formatting on top of the marks: style, font, italic. */
interface RunOptions {
  style?: string;
  font?: string;
  italic?: boolean;
}

const MATH: RunOptions = { font: 'Cambria Math', italic: true };

interface Context {
  /** List nesting level (-1 outside a list). */
  listLevel: number;
  /** The indent of a list item's continuation (the item's second paragraph and so on), twips. */
  continuation?: number;
  /** The style of the paragraphs inside (quote). */
  style?: string;
  /** Bold text (header cells, the title of a collapsible block). */
  bold?: boolean;
}

const BULLETS = ['•', '◦', '▪'];
const ORDERED_FORMATS = ['decimal', 'lowerLetter', 'lowerRoman'];
const LIST_STYLES: Record<string, string> = {
  decimal: 'decimal',
  'lower-alpha': 'lowerLetter',
  'lower-latin': 'lowerLetter',
  'upper-alpha': 'upperLetter',
  'upper-latin': 'upperLetter',
  'lower-roman': 'lowerRoman',
  'upper-roman': 'upperRoman',
  'lower-greek': 'lowerLetter',
};
const BULLET_STYLES: Record<string, string> = { disc: '•', circle: '◦', square: '▪' };

class DocxWriter {
  private readonly rels: string[] = [];
  private relCount = 2; // rId1 is the styles, rId2 the numbering
  private readonly media: ZipEntry[] = [];
  private readonly imageRels = new Map<string, string>();
  private readonly abstracts = new Map<string, number>();
  private readonly abstractXml: string[] = [];
  private readonly numXml: string[] = [];
  private numCount = 0;
  private drawingCount = 0;
  private bookmarkCount = 0;
  private changeCount = 0;
  private readonly textWidthPx: number;

  constructor(
    private readonly layout: PageLayout,
    private readonly images: Map<string, DocxImage | null>,
  ) {
    this.textWidthPx = ((layout.width - layout.margins.left - layout.margins.right) * 96) / 25.4;
  }

  private rel(type: string, target: string, external = false): string {
    const id = `rId${++this.relCount}`;
    this.rels.push(
      `<Relationship Id="${id}" Type="${NS.rel}/${type}" Target="${escapeXml(target)}"${external ? ' TargetMode="External"' : ''}/>`,
    );
    return id;
  }

  // ----- text -----

  private runProps(marks: readonly Mark[], ctx: Context, own: RunOptions = {}): string {
    let style = own.style ?? '';
    let fonts = own.font ?? '';
    let bold = !!ctx.bold;
    let italic = !!own.italic;
    let strike = false;
    let color = '';
    let size = '';
    let underline = false;
    let shade = '';
    let vertical = '';
    for (const mark of marks) {
      const name = mark.type.name;
      if (name === 'link') style = 'Hyperlink';
      else if (name === 'bold') bold = true;
      else if (name === 'italic') italic = true;
      else if (name === 'underline') underline = true;
      else if (name === 'strike') strike = true;
      else if (name === 'subscript') vertical = 'subscript';
      else if (name === 'superscript') vertical = 'superscript';
      else if (name === 'code') {
        fonts = 'Consolas';
        shade ||= 'F3F4F6';
      } else if (name === 'color') color = hexColor(mark.attrs.value) ?? color;
      else if (name === 'background') shade = hexColor(mark.attrs.value) ?? shade;
      else if (name === 'font_family') fonts = fontName(mark.attrs.value) ?? fonts;
      else if (name === 'font_size') {
        const sz = halfPoints(mark.attrs.value);
        if (sz) size = `<w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/>`;
      }
    }
    const props =
      (style ? `<w:rStyle w:val="${style}"/>` : '') +
      (fonts
        ? `<w:rFonts w:ascii="${escapeXml(fonts)}" w:hAnsi="${escapeXml(fonts)}" w:cs="${escapeXml(fonts)}" w:eastAsia="${escapeXml(fonts)}"/>`
        : '') +
      (bold ? '<w:b/><w:bCs/>' : '') +
      (italic ? '<w:i/><w:iCs/>' : '') +
      (strike ? '<w:strike/>' : '') +
      (color ? `<w:color w:val="${color}"/>` : '') +
      size +
      (underline ? '<w:u w:val="single"/>' : '') +
      (shade ? `<w:shd w:val="clear" w:color="auto" w:fill="${shade}"/>` : '') +
      (vertical ? `<w:vertAlign w:val="${vertical}"/>` : '');
    return props ? `<w:rPr>${props}</w:rPr>` : '';
  }

  /** Text as runs: a line break is w:br, a tab is w:tab. */
  private text(value: string, tag: 'w:t' | 'w:delText' = 'w:t'): string {
    let out = '';
    value.split('\n').forEach((line, index) => {
      if (index) out += '<w:br/>';
      line.split('\t').forEach((part, i) => {
        if (i) out += '<w:tab/>';
        if (part) out += `<${tag} xml:space="preserve">${escapeXml(part)}</${tag}>`;
      });
    });
    return out;
  }

  private run(value: string, marks: readonly Mark[], ctx: Context, own: RunOptions = {}): string {
    const deleted = marks.some((m) => m.type.name === 'suggestion_delete');
    const body = `<w:r>${this.runProps(marks, ctx, own)}${this.text(value, deleted ? 'w:delText' : 'w:t')}</w:r>`;
    return this.tracked(body, marks);
  }

  /** A suggested edit becomes a Word revision (w:ins / w:del with author and time). */
  private tracked(body: string, marks: readonly Mark[]): string {
    const change = marks.find(
      (m) => m.type.name === 'suggestion_insert' || m.type.name === 'suggestion_delete',
    );
    if (!change) return body;
    const tag = change.type.name === 'suggestion_insert' ? 'w:ins' : 'w:del';
    const author = String(change.attrs.name || change.attrs.author || 'NovaProse').slice(0, 80);
    return `<${tag} w:id="${++this.changeCount}" w:author="${escapeXml(author)}" w:date="${dateOf(change.attrs.time)}">${body}</${tag}>`;
  }

  private bookmark(id: unknown, inner = ''): string {
    if (typeof id !== 'string' || !id) return inner;
    const n = ++this.bookmarkCount;
    return `<w:bookmarkStart w:id="${n}" w:name="${escapeXml(bookmarkName(id))}"/>${inner}<w:bookmarkEnd w:id="${n}"/>`;
  }

  private drawing(src: unknown, alt: unknown, width: unknown, height: unknown): string {
    const image = typeof src === 'string' ? this.images.get(src) : null;
    const label = typeof alt === 'string' ? alt : '';
    if (!image || typeof src !== 'string') return label ? this.text(`[${label}]`) : '';
    let rel = this.imageRels.get(src);
    if (!rel) {
      const name = `image${this.media.length + 1}.${image.type}`;
      this.media.push({ name: `word/media/${name}`, data: image.data });
      rel = this.rel('image', `media/${name}`);
      this.imageRels.set(src, rel);
    }
    let w = Number(width) || image.width || 300;
    const ratio = image.width && image.height ? image.height / image.width : 0.75;
    let h = Number(height) || w * ratio;
    if (w > this.textWidthPx) {
      h *= this.textWidthPx / w;
      w = this.textWidthPx;
    }
    const cx = Math.round(w * EMU_PER_PX);
    const cy = Math.round(h * EMU_PER_PX);
    const id = ++this.drawingCount;
    return (
      `<w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/>` +
      `<wp:docPr id="${id}" name="Picture ${id}" descr="${escapeXml(label)}"/>` +
      `<wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr>` +
      `<a:graphic><a:graphicData uri="${NS.pic}"><pic:pic><pic:nvPicPr><pic:cNvPr id="${id}" name="Picture ${id}"/>` +
      `<pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${rel}"/><a:stretch><a:fillRect/></a:stretch>` +
      `</pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm>` +
      `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing>`
    );
  }

  private inlineNode(node: PMNode, ctx: Context): string {
    const name = node.type.name;
    if (node.isText) return this.run(node.text ?? '', node.marks, ctx);
    if (name === 'hard_break') return this.tracked('<w:r><w:br/></w:r>', node.marks);
    if (name === 'image')
      return `<w:r>${this.drawing(node.attrs.src, node.attrs.alt, node.attrs.width, node.attrs.height)}</w:r>`;
    if (name === 'anchor') return this.bookmark(node.attrs.id);
    if (name === 'math_inline')
      return this.run(String(node.attrs.latex ?? ''), node.marks, ctx, MATH);
    if (name === 'mergetag')
      return this.run(
        String(node.attrs.label || `{{${String(node.attrs.key ?? '')}}}`),
        node.marks,
        ctx,
      );
    const text = node.type.spec.leafText?.(node) ?? node.textContent;
    return text ? this.run(text, node.marks, ctx) : '';
  }

  /** Paragraph content; adjacent runs of the same link become one w:hyperlink. */
  private inline(node: PMNode, ctx: Context): string {
    let out = '';
    let open: string | null = null;
    node.forEach((child) => {
      const link = child.marks.find((m) => m.type.name === 'link');
      const href = link && isSafeLinkUrl(link.attrs.href) ? String(link.attrs.href) : null;
      if (href !== open) {
        if (open !== null) out += '</w:hyperlink>';
        if (href !== null)
          out += href.startsWith('#')
            ? `<w:hyperlink w:anchor="${escapeXml(bookmarkName(href.slice(1)))}">`
            : `<w:hyperlink r:id="${this.rel('hyperlink', href, true)}">`;
        open = href;
      }
      out += this.inlineNode(child, ctx);
    });
    if (open !== null) out += '</w:hyperlink>';
    return out;
  }

  private paragraph(
    node: PMNode | null,
    ctx: Context,
    options: {
      style?: string;
      numPr?: string;
      border?: string;
      jc?: string;
      indent?: number;
      prefix?: string;
      content?: string;
    } = {},
  ): string {
    const attrs = node?.attrs ?? {};
    const rtl = attrs.dir === 'rtl';
    const style = options.style ?? ctx.style;
    const align = options.jc ?? (typeof attrs.align === 'string' ? attrs.align : '');
    const jc =
      align === 'justify'
        ? 'both'
        : align === 'center' || align === 'right' || align === 'left'
          ? align
          : '';
    const level = Number(attrs.indent) || 0;
    const left = options.indent ?? (ctx.continuation ?? 0) + Math.max(0, level) * INDENT_TWIPS;
    let spacing = '';
    const lineHeight = typeof attrs.lineHeight === 'string' ? attrs.lineHeight : '';
    if (/^\d+(\.\d+)?$/.test(lineHeight))
      spacing = `<w:spacing w:line="${Math.round(Number(lineHeight) * 240)}" w:lineRule="auto"/>`;
    else {
      const sz = halfPoints(lineHeight);
      if (sz) spacing = `<w:spacing w:line="${sz * 10}" w:lineRule="exact"/>`;
    }
    const pPr =
      (style ? `<w:pStyle w:val="${style}"/>` : '') +
      (options.numPr ?? '') +
      (options.border ?? '') +
      (rtl ? '<w:bidi/>' : '') +
      spacing +
      (left && !options.numPr ? `<w:ind w:${rtl ? 'right' : 'left'}="${left}"/>` : '') +
      (jc ? `<w:jc w:val="${jc}"/>` : '');
    const content = options.content ?? (node ? this.inline(node, ctx) : '');
    return `<w:p>${pPr ? `<w:pPr>${pPr}</w:pPr>` : ''}${options.prefix ?? ''}${content}</w:p>`;
  }

  // ----- lists -----

  private numbering(ordered: boolean, style: unknown, start: number): number {
    const key = `${ordered ? 'o' : 'b'}:${typeof style === 'string' ? style : ''}`;
    let abstract = this.abstracts.get(key);
    if (abstract === undefined) {
      abstract = this.abstracts.size;
      this.abstracts.set(key, abstract);
      const first =
        typeof style === 'string'
          ? ordered
            ? LIST_STYLES[style]
            : BULLET_STYLES[style]
          : undefined;
      const levels = Array.from({ length: 9 }, (_, level) => {
        const indent = `<w:pPr><w:ind w:left="${720 * (level + 1)}" w:hanging="360"/></w:pPr>`;
        if (ordered) {
          const format = (level === 0 && first) || ORDERED_FORMATS[level % 3]!;
          return `<w:lvl w:ilvl="${level}"><w:start w:val="1"/><w:numFmt w:val="${format}"/><w:lvlText w:val="%${level + 1}."/><w:lvlJc w:val="left"/>${indent}</w:lvl>`;
        }
        const bullet = (level === 0 && first) || BULLETS[level % 3]!;
        return `<w:lvl w:ilvl="${level}"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="${bullet}"/><w:lvlJc w:val="left"/>${indent}</w:lvl>`;
      });
      this.abstractXml.push(
        `<w:abstractNum w:abstractNumId="${abstract}"><w:multiLevelType w:val="hybridMultilevel"/>${levels.join('')}</w:abstractNum>`,
      );
    }
    const id = ++this.numCount;
    // Every numbered list restarts its count (from its own start).
    const restart = ordered
      ? `<w:lvlOverride w:ilvl="0"><w:startOverride w:val="${Math.max(0, start)}"/></w:lvlOverride>`
      : '';
    this.numXml.push(
      `<w:num w:numId="${id}"><w:abstractNumId w:val="${abstract}"/>${restart}</w:num>`,
    );
    return id;
  }

  private list(node: PMNode, ctx: Context): string {
    const ordered = node.type.name === 'ordered_list';
    const checklist = node.attrs.checklist === true;
    const level = Math.min(8, ctx.listLevel + 1);
    const numId = checklist
      ? 0
      : this.numbering(ordered, node.attrs.listStyle, Number(node.attrs.start) || 1);
    const inner: Context = { ...ctx, listLevel: level, continuation: 720 * (level + 1) };
    let out = '';
    node.forEach((item) => {
      let first = true;
      item.forEach((child) => {
        const name = child.type.name;
        if (first && child.isTextblock) {
          first = false;
          out += this.paragraph(child, inner, {
            numPr: numId
              ? `<w:numPr><w:ilvl w:val="${level}"/><w:numId w:val="${numId}"/></w:numPr>`
              : undefined,
            prefix: checklist ? this.run(item.attrs.checked ? '☒ ' : '☐ ', [], inner) : '',
          });
        } else if (name === 'bullet_list' || name === 'ordered_list') {
          out += this.list(child, { ...ctx, listLevel: level });
        } else {
          first = false;
          out += this.block(child, inner);
        }
      });
    });
    return out;
  }

  // ----- tables -----

  private table(node: PMNode, ctx: Context): string {
    interface Placed {
      row: number;
      col: number;
      colspan: number;
      rowspan: number;
      cell: PMNode;
    }
    const rows: PMNode[] = [];
    node.forEach((row) => rows.push(row));
    const cover = new Map<string, Placed>();
    const starts = new Map<string, Placed>();
    let columns = 0;
    rows.forEach((row, r) => {
      let c = 0;
      row.forEach((cell) => {
        while (cover.has(`${r}:${c}`)) c++;
        const placed: Placed = {
          row: r,
          col: c,
          colspan: Math.max(1, Number(cell.attrs.colspan) || 1),
          rowspan: Math.max(1, Math.min(rows.length - r, Number(cell.attrs.rowspan) || 1)),
          cell,
        };
        starts.set(`${r}:${c}`, placed);
        for (let dr = 0; dr < placed.rowspan; dr++)
          for (let dc = 0; dc < placed.colspan; dc++) cover.set(`${r + dr}:${c + dc}`, placed);
        c += placed.colspan;
        columns = Math.max(columns, c);
      });
    });
    if (!columns) return '';

    // Column widths: from the cells' colwidth (px), the rest split evenly up to the text width.
    const widths: Array<number | null> = Array.from({ length: columns }, () => null);
    for (const placed of starts.values()) {
      const colwidth = placed.cell.attrs.colwidth;
      if (Array.isArray(colwidth))
        colwidth.forEach((w, i) => {
          if (typeof w === 'number' && w > 0 && widths[placed.col + i] == null)
            widths[placed.col + i] = w;
        });
    }
    const known = widths.reduce<number>((sum, w) => sum + (w ?? 0), 0);
    const unknown = widths.filter((w) => w == null).length;
    const rest = unknown ? Math.max(40, (this.textWidthPx - known) / unknown) : 0;
    const grid = widths.map((w) => Math.round((w ?? rest) * 15));

    const align =
      node.attrs.align === 'center' || node.attrs.align === 'right' ? node.attrs.align : '';
    const border = (side: string) =>
      `<w:${side} w:val="single" w:sz="4" w:space="0" w:color="auto"/>`;
    const tblPr =
      `<w:tblPr><w:tblW w:w="${grid.reduce((a, b) => a + b, 0)}" w:type="dxa"/>` +
      (align ? `<w:jc w:val="${align}"/>` : '') +
      `<w:tblBorders>${['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map(border).join('')}</w:tblBorders>` +
      `<w:tblLayout w:type="fixed"/><w:tblCellMar><w:left w:w="108" w:type="dxa"/><w:right w:w="108" w:type="dxa"/></w:tblCellMar></w:tblPr>`;
    const tblGrid = `<w:tblGrid>${grid.map((w) => `<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>`;

    const span = (col: number, colspan: number) =>
      grid.slice(col, col + colspan).reduce((a, b) => a + b, 0);
    let body = '';
    rows.forEach((row, r) => {
      let header = row.childCount > 0;
      row.forEach((cell) => {
        if (cell.type.name !== 'table_header') header = false;
      });
      let cells = '';
      for (let c = 0; c < columns;) {
        const placed = cover.get(`${r}:${c}`);
        if (!placed) {
          cells += `<w:tc><w:tcPr><w:tcW w:w="${grid[c]}" w:type="dxa"/></w:tcPr><w:p/></w:tc>`;
          c++;
          continue;
        }
        const width = `<w:tcW w:w="${span(placed.col, placed.colspan)}" w:type="dxa"/>`;
        const gridSpan = placed.colspan > 1 ? `<w:gridSpan w:val="${placed.colspan}"/>` : '';
        if (placed.row !== r) {
          // The continuation of a vertical merge.
          cells += `<w:tc><w:tcPr>${width}${gridSpan}<w:vMerge/></w:tcPr><w:p/></w:tc>`;
        } else {
          const { cell } = placed;
          const fill = hexColor(cell.attrs.background);
          const valign = cell.attrs.valign === 'middle' ? 'center' : cell.attrs.valign;
          const tcPr =
            width +
            gridSpan +
            (placed.rowspan > 1 ? '<w:vMerge w:val="restart"/>' : '') +
            (fill ? `<w:shd w:val="clear" w:color="auto" w:fill="${fill}"/>` : '') +
            (valign === 'top' || valign === 'center' || valign === 'bottom'
              ? `<w:vAlign w:val="${valign}"/>`
              : '');
          let content = this.blocks(cell, {
            ...ctx,
            listLevel: -1,
            continuation: undefined,
            style: undefined,
            bold: ctx.bold || cell.type.name === 'table_header',
          });
          // A Word cell ends with a paragraph.
          if (!content.endsWith('</w:p>')) content += '<w:p/>';
          cells += `<w:tc><w:tcPr>${tcPr}</w:tcPr>${content}</w:tc>`;
        }
        c += placed.colspan;
      }
      body += `<w:tr>${header ? '<w:trPr><w:tblHeader/></w:trPr>' : ''}${cells}</w:tr>`;
    });
    return `<w:tbl>${tblPr}${tblGrid}${body}</w:tbl>`;
  }

  // ----- blocks -----

  blocks(parent: PMNode, ctx: Context): string {
    let out = '';
    parent.forEach((child) => (out += this.block(child, ctx)));
    return out;
  }

  private block(node: PMNode, ctx: Context): string {
    const name = node.type.name;
    switch (name) {
      case 'paragraph':
        return this.paragraph(node, ctx);
      case 'heading': {
        const level = Math.min(6, Math.max(1, Number(node.attrs.level) || 1));
        return this.paragraph(node, ctx, {
          style: `Heading${level}`,
          content: this.bookmark(node.attrs.id, this.inline(node, ctx)),
        });
      }
      case 'blockquote':
        return this.blocks(node, { ...ctx, style: 'Quote' });
      case 'code_block':
        return this.paragraph(null, ctx, {
          style: 'Code',
          content: this.run(node.textContent, [], { ...ctx, bold: false }),
        });
      case 'bullet_list':
      case 'ordered_list':
        return this.list(node, ctx);
      case 'table':
        return this.table(node, ctx);
      case 'horizontal_rule':
        return this.paragraph(null, ctx, {
          border: '<w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="auto"/></w:pBdr>',
          content: '',
        });
      case 'pagebreak':
        return '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
      case 'figure': {
        let image = '';
        let caption = '';
        node.forEach((child) => {
          if (child.type.name === 'figure_image')
            image = this.drawing(
              child.attrs.src,
              child.attrs.alt,
              child.attrs.width,
              child.attrs.height,
            );
          else if (child.type.name === 'figcaption')
            caption = this.paragraph(child, ctx, { style: 'Caption' });
        });
        const jc =
          node.attrs.align === 'center' || node.attrs.align === 'right' ? node.attrs.align : '';
        return (
          this.paragraph(null, ctx, { jc, content: image ? `<w:r>${image}</w:r>` : '' }) + caption
        );
      }
      case 'math_block':
        return this.paragraph(null, ctx, {
          jc: 'center',
          content: this.run(String(node.attrs.latex ?? ''), [], ctx, MATH),
        });
      case 'details':
        return this.blocks(node, ctx);
      case 'details_summary':
        return this.paragraph(node, { ...ctx, bold: true });
      case 'toc': {
        const entries = Array.isArray(node.attrs.entries) ? node.attrs.entries : [];
        const title =
          typeof node.attrs.title === 'string' && node.attrs.title
            ? this.paragraph(null, ctx, {
                content: this.run(node.attrs.title, [], { ...ctx, bold: true }),
              })
            : '';
        return (
          title +
          entries
            .filter(
              (e): e is { id: string; text: string; level: number } =>
                !!e && typeof e.id === 'string',
            )
            .map((entry) =>
              this.paragraph(null, ctx, {
                indent: Math.max(0, (Number(entry.level) || 1) - 1) * 360,
                content: `<w:hyperlink w:anchor="${escapeXml(bookmarkName(entry.id))}">${this.run(String(entry.text ?? ''), [], ctx, { style: 'Hyperlink' })}</w:hyperlink>`,
              }),
            )
            .join('')
        );
      }
      case 'media': {
        const src = String(node.attrs.src ?? '');
        if (!isSafeLinkUrl(src)) return '';
        return this.paragraph(null, ctx, {
          content: `<w:hyperlink r:id="${this.rel('hyperlink', src, true)}">${this.run(String(node.attrs.title || src), [], ctx)}</w:hyperlink>`,
        });
      }
      default:
        if (node.isTextblock) return this.paragraph(node, ctx);
        if (node.isBlock && node.childCount) return this.blocks(node, ctx);
        return '';
    }
  }

  // ----- header and footer -----

  /** The header and footer parts written so far: word/header1.xml, word/footer1.xml. */
  private readonly bands: { name: string; xml: string; contentType: string }[] = [];

  /**
   * A header or footer part: one paragraph with the left part, a centre tab, the centre part, a right tab
   * and the right part, in small grey text as in print. {page} and {pages} become PAGE and NUMPAGES fields,
   * which Word fills in on every page.
   */
  private bandXml(kind: 'hdr' | 'ftr', parts: PageBandParts): string {
    const { layout } = this;
    const width = twips(layout.width - layout.margins.left - layout.margins.right);
    const rPr = '<w:rPr><w:color w:val="595959"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr>';
    const field = (instr: string) =>
      `<w:fldSimple w:instr=" ${instr} "><w:r>${rPr}<w:t>1</w:t></w:r></w:fldSimple>`;
    const runs = (text: string) =>
      text
        .split(/(\{pages?\})/)
        .filter((part) => part !== '')
        .map((part) =>
          part === '{page}'
            ? field('PAGE')
            : part === '{pages}'
              ? field('NUMPAGES')
              : `<w:r>${rPr}<w:t xml:space="preserve">${escapeXml(part)}</w:t></w:r>`,
        )
        .join('');
    const tab = `<w:r>${rPr}<w:tab/></w:r>`;
    return (
      `${XML}<w:${kind} xmlns:w="${NS.w}" xmlns:r="${NS.r}"><w:p><w:pPr>` +
      `<w:tabs><w:tab w:val="center" w:pos="${Math.round(width / 2)}"/><w:tab w:val="right" w:pos="${width}"/></w:tabs>` +
      `<w:spacing w:before="0" w:after="0"/></w:pPr>` +
      `${runs(parts.left)}${tab}${runs(parts.center)}${tab}${runs(parts.right)}</w:p></w:${kind}>`
    );
  }

  /** The header or footer part and its reference for the section ('' when there is none). */
  private bandReference(kind: 'header' | 'footer', parts: PageBandParts | null): string {
    if (!parts) return '';
    const name = `${kind}1.xml`;
    const id = this.rel(kind, name);
    this.bands.push({
      name: `word/${name}`,
      xml: this.bandXml(kind === 'header' ? 'hdr' : 'ftr', parts),
      contentType: `application/vnd.openxmlformats-officedocument.wordprocessingml.${kind}+xml`,
    });
    return `<w:${kind}Reference w:type="default" r:id="${id}"/>`;
  }

  /** The header and footer parts, after document(). */
  bandFiles(): { entries: ZipEntry[]; overrides: string } {
    const encode = (text: string) => new TextEncoder().encode(text);
    return {
      entries: this.bands.map((band) => ({ name: band.name, data: encode(band.xml) })),
      overrides: this.bands
        .map((band) => `<Override PartName="/${band.name}" ContentType="${band.contentType}"/>`)
        .join(''),
    };
  }

  // ----- parts of the file -----

  document(doc: PMNode): string {
    let body = this.blocks(doc, { listLevel: -1 });
    if (!body.endsWith('</w:p>')) body += '<w:p/>';
    const { layout } = this;
    const m = layout.margins;
    const landscape = layout.width > layout.height ? ' w:orient="landscape"' : '';
    const references =
      this.bandReference('header', layout.header) + this.bandReference('footer', layout.footer);
    // The header and footer sit in the middle of their margins, as in print and on screen.
    const distance = (margin: number) => twips(Math.min(12.5, Math.max(3, margin / 2)));
    // "Different first page": the first page gets no header and footer (no first-page parts are written).
    const titlePage = references && layout.differentFirstPage ? '<w:titlePg/>' : '';
    const sectPr =
      `<w:sectPr>${references}<w:pgSz w:w="${twips(layout.width)}" w:h="${twips(layout.height)}"${landscape}/>` +
      `<w:pgMar w:top="${twips(m.top)}" w:right="${twips(m.right)}" w:bottom="${twips(m.bottom)}" w:left="${twips(m.left)}" w:header="${distance(m.top)}" w:footer="${distance(m.bottom)}" w:gutter="0"/>${titlePage}</w:sectPr>`;
    return (
      XML +
      `<w:document xmlns:w="${NS.w}" xmlns:r="${NS.r}" xmlns:wp="${NS.wp}" xmlns:a="${NS.a}" xmlns:pic="${NS.pic}">` +
      `<w:body>${body}${sectPr}</w:body></w:document>`
    );
  }

  numberingXml(): string {
    return `${XML}<w:numbering xmlns:w="${NS.w}">${this.abstractXml.join('')}${this.numXml.join('')}</w:numbering>`;
  }

  relsXml(): string {
    return (
      `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
      `<Relationship Id="rId1" Type="${NS.rel}/styles" Target="styles.xml"/>` +
      `<Relationship Id="rId2" Type="${NS.rel}/numbering" Target="numbering.xml"/>` +
      `${this.rels.join('')}</Relationships>`
    );
  }

  mediaFiles(): ZipEntry[] {
    return this.media;
  }
}

function stylesXml(font: string, size: number): string {
  const f = escapeXml(font);
  const sz = Math.round(size * 2);
  const heading = (level: number, pt: number) =>
    `<w:style w:type="paragraph" w:styleId="Heading${level}"><w:name w:val="heading ${level}"/><w:basedOn w:val="Normal"/>` +
    `<w:next w:val="Normal"/><w:uiPriority w:val="9"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="${Math.round(pt * 20 * 1.2)}" w:after="${Math.round(pt * 10)}"/>` +
    `<w:outlineLvl w:val="${level - 1}"/></w:pPr><w:rPr><w:b/><w:bCs/><w:sz w:val="${Math.round(pt * 2)}"/><w:szCs w:val="${Math.round(pt * 2)}"/></w:rPr></w:style>`;
  const headingSizes = [2, 1.5, 1.25, 1, 0.875, 0.85];
  return (
    `${XML}<w:styles xmlns:w="${NS.w}">` +
    `<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="${f}" w:hAnsi="${f}" w:cs="${f}" w:eastAsia="${f}"/>` +
    `<w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/></w:rPr></w:rPrDefault>` +
    `<w:pPrDefault><w:pPr><w:spacing w:after="${Math.round(size * 20 * 0.75)}" w:line="384" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>` +
    `<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>` +
    headingSizes.map((k, i) => heading(i + 1, size * k)).join('') +
    `<w:style w:type="paragraph" w:styleId="Quote"><w:name w:val="Quote"/><w:basedOn w:val="Normal"/><w:qFormat/>` +
    `<w:pPr><w:pBdr><w:left w:val="single" w:sz="18" w:space="8" w:color="D0D7DE"/></w:pBdr><w:ind w:left="360"/></w:pPr>` +
    `<w:rPr><w:color w:val="59636E"/></w:rPr></w:style>` +
    `<w:style w:type="paragraph" w:styleId="Code"><w:name w:val="Code"/><w:basedOn w:val="Normal"/>` +
    `<w:pPr><w:shd w:val="clear" w:color="auto" w:fill="F6F8FA"/><w:spacing w:line="276" w:lineRule="auto"/></w:pPr>` +
    `<w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas" w:cs="Consolas"/><w:sz w:val="${Math.round(sz * 0.85)}"/></w:rPr></w:style>` +
    `<w:style w:type="paragraph" w:styleId="Caption"><w:name w:val="caption"/><w:basedOn w:val="Normal"/><w:qFormat/>` +
    `<w:rPr><w:i/><w:color w:val="59636E"/><w:sz w:val="${Math.round(sz * 0.85)}"/></w:rPr></w:style>` +
    `<w:style w:type="character" w:styleId="Hyperlink"><w:name w:val="Hyperlink"/>` +
    `<w:rPr><w:color w:val="0969DA"/><w:u w:val="single"/></w:rPr></w:style>` +
    `</w:styles>`
  );
}

/** The addresses of every image in the document. */
function imageSources(doc: PMNode): string[] {
  const sources = new Set<string>();
  doc.descendants((node) => {
    if ((node.type.name === 'image' || node.type.name === 'figure_image') && node.attrs.src)
      sources.add(String(node.attrs.src));
  });
  return [...sources];
}

/** A ProseMirror document → the bytes of a .docx. */
export async function toDocx(doc: PMNode, options: DocxExportOptions = {}): Promise<Uint8Array> {
  const layout =
    options.page && 'width' in options.page && typeof options.page.width === 'number'
      ? (options.page as PageLayout)
      : resolvePageLayout((options.page as PageLayoutOptions | undefined) ?? {});
  const load = options.loadImage ?? loadImage;
  const images = new Map<string, DocxImage | null>();
  await Promise.all(
    imageSources(doc).map(async (src) => {
      images.set(src, await load(src).catch(() => null));
    }),
  );
  const writer = new DocxWriter(layout, images);
  const documentXml = writer.document(doc);
  const bands = writer.bandFiles();
  const encode = (text: string) => new TextEncoder().encode(text);
  const title = options.title ? `<dc:title>${escapeXml(options.title)}</dc:title>` : '';
  const files: ZipEntry[] = [
    {
      name: '[Content_Types].xml',
      data: encode(
        `${XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
          `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
          `<Default Extension="xml" ContentType="application/xml"/>` +
          `<Default Extension="png" ContentType="image/png"/><Default Extension="jpeg" ContentType="image/jpeg"/>` +
          `<Default Extension="gif" ContentType="image/gif"/>` +
          `<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>` +
          `<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>` +
          `<Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>` +
          `<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>` +
          `<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>` +
          bands.overrides +
          `</Types>`,
      ),
    },
    {
      name: '_rels/.rels',
      data: encode(
        `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
          `<Relationship Id="rId1" Type="${NS.rel}/officeDocument" Target="word/document.xml"/>` +
          `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>` +
          `<Relationship Id="rId3" Type="${NS.rel}/extended-properties" Target="docProps/app.xml"/>` +
          `</Relationships>`,
      ),
    },
    { name: 'word/document.xml', data: encode(documentXml) },
    {
      name: 'word/styles.xml',
      data: encode(stylesXml(options.font ?? 'Calibri', options.fontSize ?? 12)),
    },
    { name: 'word/numbering.xml', data: encode(writer.numberingXml()) },
    { name: 'word/_rels/document.xml.rels', data: encode(writer.relsXml()) },
    {
      name: 'docProps/core.xml',
      data: encode(
        `${XML}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" ` +
          `xmlns:dc="http://purl.org/dc/elements/1.1/">${title}</cp:coreProperties>`,
      ),
    },
    {
      name: 'docProps/app.xml',
      data: encode(
        `${XML}<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties">` +
          `<Application>NovaProse</Application></Properties>`,
      ),
    },
    ...bands.entries,
    ...writer.mediaFiles(),
  ];
  return zip(files);
}
