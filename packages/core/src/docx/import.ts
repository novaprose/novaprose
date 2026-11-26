import type { PageLayoutOptions, PageMargins, PageSizeName } from '../plugins/pagelayout';
import { PAGE_SIZES } from '../plugins/pagelayout';
import { element, elements, parseXml, path, textContent, type XmlElement } from './xml';
import { unzip } from './zip';

/**
 * .docx → HTML without a DOM (also works on the server). The editor's schema then parses the HTML
 * with all the usual cleanup: what the schema doesn't know is dropped, addresses are checked.
 *
 * What comes across: paragraphs and headings (Word styles, including localized ones — built-in names
 * in the file are English — and the outline level), lists from the document's numbering (and from
 * a style, like "List Bullet"), tables with merged cells, fill and widths, images (drawing and the
 * old VML), links (and the HYPERLINK field), text formatting, footnotes at the end, tracked changes
 * as accepted, and the sheet and margins.
 */

export interface DocxImportResult {
  html: string;
  /** The document's sheet and margins, for page layout. */
  page?: PageLayoutOptions;
  /** What couldn't be brought across (to tell the user). */
  warnings: string[];
}

interface Rel {
  type: string;
  target: string;
  external: boolean;
}

interface Style {
  name: string;
  basedOn?: string;
  outline?: number;
  numPr?: XmlElement;
  jc?: string;
  rPr?: XmlElement;
}

interface Level {
  format: string;
  text: string;
  start: number;
}

const HIGHLIGHT: Record<string, string> = {
  yellow: '#ffff00',
  green: '#00ff00',
  cyan: '#00ffff',
  magenta: '#ff00ff',
  blue: '#0000ff',
  red: '#ff0000',
  darkBlue: '#000080',
  darkCyan: '#008080',
  darkGreen: '#008000',
  darkMagenta: '#800080',
  darkRed: '#800000',
  darkYellow: '#808000',
  darkGray: '#808080',
  lightGray: '#c0c0c0',
  black: '#000000',
  white: '#ffffff',
};

const LIST_STYLE: Record<string, string> = {
  lowerLetter: 'lower-alpha',
  upperLetter: 'upper-alpha',
  lowerRoman: 'lower-roman',
  upperRoman: 'upper-roman',
};

const MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  bmp: 'image/bmp',
  webp: 'image/webp',
};

const escape = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const on = (el: XmlElement | undefined) =>
  !!el && !['0', 'false', 'off', 'none'].includes(el.attrs['w:val'] ?? '');

const val = (el: XmlElement | undefined) => el?.attrs['w:val'];

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000)
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

/** A part's path relative to the folder of the referring part: word/ + media/x.png → word/media/x.png. */
function resolvePart(base: string, target: string): string {
  if (target.startsWith('/')) return target.slice(1);
  const parts = base.split('/').slice(0, -1);
  for (const piece of target.split('/')) {
    if (piece === '..') parts.pop();
    else if (piece !== '.') parts.push(piece);
  }
  return parts.join('/');
}

class DocxReader {
  readonly warnings = new Set<string>();
  private readonly styles = new Map<string, Style>();
  private readonly levels = new Map<string, Level[]>(); // numId → levels
  private readonly starts = new Map<string, number>(); // numId:ilvl → startOverride
  private readonly footnotes = new Map<string, XmlElement>();
  private readonly notes: string[] = [];
  private rels = new Map<string, Rel>();
  private part = 'word/document.xml';
  private images = 0;
  /** Inside a table header row: th is bold anyway, so text boldness isn't carried over. */
  private inHeader = false;

  constructor(private readonly files: Map<string, Uint8Array>) {}

  private xml(name: string): XmlElement | undefined {
    const bytes = this.files.get(name);
    return bytes ? parseXml(new TextDecoder().decode(bytes)) : undefined;
  }

  private relsOf(part: string): Map<string, Rel> {
    const map = new Map<string, Rel>();
    const dir = part.split('/').slice(0, -1).join('/');
    const name = part.split('/').pop();
    const rels = this.xml(`${dir ? `${dir}/` : ''}_rels/${name}.rels`);
    for (const rel of elements(path(rels, 'Relationships'), 'Relationship')) {
      const external = rel.attrs.TargetMode === 'External';
      map.set(rel.attrs.Id ?? '', {
        type: (rel.attrs.Type ?? '').split('/').pop() ?? '',
        target: external ? (rel.attrs.Target ?? '') : resolvePart(part, rel.attrs.Target ?? ''),
        external,
      });
    }
    return map;
  }

  load(): XmlElement | undefined {
    const root = this.relsOf('_rels/.rels');
    // The main part comes through the officeDocument relationship (usually word/document.xml).
    const rootRels = this.xml('_rels/.rels');
    for (const rel of elements(path(rootRels, 'Relationships'), 'Relationship'))
      if ((rel.attrs.Type ?? '').endsWith('/officeDocument'))
        this.part = resolvePart('', rel.attrs.Target ?? 'word/document.xml');
    void root;
    this.rels = this.relsOf(this.part);
    const target = (type: string) => [...this.rels.values()].find((r) => r.type === type)?.target;

    for (const style of elements(path(this.xml(target('styles') ?? ''), 'w:styles'), 'w:style')) {
      const pPr = element(style, 'w:pPr');
      const outline = val(element(pPr, 'w:outlineLvl'));
      this.styles.set(style.attrs['w:styleId'] ?? '', {
        name: (val(element(style, 'w:name')) ?? '').toLowerCase(),
        basedOn: val(element(style, 'w:basedOn')),
        outline: outline !== undefined ? Number(outline) : undefined,
        numPr: element(pPr, 'w:numPr'),
        jc: val(element(pPr, 'w:jc')),
        rPr: element(style, 'w:rPr'),
      });
    }

    const numbering = path(this.xml(target('numbering') ?? ''), 'w:numbering');
    const abstracts = new Map<string, Level[]>();
    for (const abstract of elements(numbering, 'w:abstractNum')) {
      const levels: Level[] = [];
      for (const lvl of elements(abstract, 'w:lvl'))
        levels[Number(lvl.attrs['w:ilvl']) || 0] = {
          format: val(element(lvl, 'w:numFmt')) ?? 'decimal',
          text: val(element(lvl, 'w:lvlText')) ?? '',
          start: Number(val(element(lvl, 'w:start')) ?? 1),
        };
      abstracts.set(abstract.attrs['w:abstractNumId'] ?? '', levels);
    }
    for (const num of elements(numbering, 'w:num')) {
      const id = num.attrs['w:numId'] ?? '';
      this.levels.set(id, abstracts.get(val(element(num, 'w:abstractNumId')) ?? '') ?? []);
      for (const override of elements(num, 'w:lvlOverride')) {
        const start = val(element(override, 'w:startOverride'));
        if (start !== undefined)
          this.starts.set(`${id}:${override.attrs['w:ilvl']}`, Number(start));
      }
    }

    for (const note of elements(
      path(this.xml(target('footnotes') ?? ''), 'w:footnotes'),
      'w:footnote',
    ))
      this.footnotes.set(note.attrs['w:id'] ?? '', note);

    return path(this.xml(this.part), 'w:document', 'w:body');
  }

  /** A style and its ancestors (basedOn), without cycles. */
  private styleChain(id: string | undefined): Style[] {
    const chain: Style[] = [];
    const seen = new Set<string>();
    while (id && !seen.has(id)) {
      seen.add(id);
      const style = this.styles.get(id);
      if (!style) break;
      chain.push(style);
      id = style.basedOn;
    }
    return chain;
  }

  private headingLevel(styleId: string | undefined, pPr: XmlElement | undefined): number {
    const own = val(element(pPr, 'w:outlineLvl'));
    if (own !== undefined && Number(own) < 6) return Number(own) + 1;
    for (const style of this.styleChain(styleId)) {
      const named = /^heading (\d)$/.exec(style.name);
      if (named) return Math.min(6, Number(named[1]));
      if (style.name === 'title') return 1;
      if (style.outline !== undefined && style.outline < 6) return style.outline + 1;
    }
    return 0;
  }

  private styleKind(styleId: string | undefined): 'quote' | 'code' | null {
    for (const style of this.styleChain(styleId)) {
      if (/quote/.test(style.name)) return 'quote';
      if (/^(html preformatted|code|source code|macro text)/.test(style.name)) return 'code';
    }
    return null;
  }

  // ---------- text ----------

  /** A run's formatting. Inside a link, color and underline belong to the link itself and aren't carried over. */
  private runStyle(rPr: XmlElement | undefined, inLink = false): { open: string; close: string } {
    const props: XmlElement[] = [];
    // A character style (Strong, Emphasis…) comes before direct formatting.
    for (const style of this.styleChain(val(element(rPr, 'w:rStyle'))).reverse())
      if (style.rPr && !(inLink && style.name === 'hyperlink')) props.push(style.rPr);
    if (rPr) props.push(rPr);
    let bold = false;
    let italic = false;
    let underline = false;
    let strike = false;
    let vertical = '';
    let color = '';
    let background = '';
    let font = '';
    let size = '';
    for (const p of props) {
      if (element(p, 'w:b') && !this.inHeader) bold = on(element(p, 'w:b'));
      if (element(p, 'w:i')) italic = on(element(p, 'w:i'));
      if (element(p, 'w:u') && !inLink) underline = on(element(p, 'w:u'));
      if (element(p, 'w:strike') || element(p, 'w:dstrike'))
        strike = on(element(p, 'w:strike') ?? element(p, 'w:dstrike'));
      const align = val(element(p, 'w:vertAlign'));
      if (align) vertical = align;
      const ownColor = val(element(p, 'w:color'));
      if (ownColor && !inLink && /^[0-9a-f]{6}$/i.test(ownColor))
        color = `#${ownColor.toLowerCase()}`;
      const highlight = HIGHLIGHT[val(element(p, 'w:highlight')) ?? ''];
      const fill = element(p, 'w:shd')?.attrs['w:fill'];
      if (highlight) background = highlight;
      else if (fill && /^[0-9a-f]{6}$/i.test(fill)) background = `#${fill.toLowerCase()}`;
      const ownFont = element(p, 'w:rFonts')?.attrs['w:ascii'];
      if (ownFont) font = ownFont.replace(/[;"<>{}]/g, '');
      const sz = Number(val(element(p, 'w:sz')));
      if (sz > 0) size = `${sz / 2}pt`;
    }
    // A monospace font means code (the editor's code styling sets its background and font).
    const code = MONOSPACE.test(font);
    const css: string[] = [];
    if (color) css.push(`color: ${color}`);
    if (background && !(code && CODE_SHADES.has(background)))
      css.push(`background-color: ${background}`);
    if (font && !code) css.push(`font-family: ${font}`);
    if (size) css.push(`font-size: ${size}`);
    // Default formatting (font and size) isn't carried over, to keep the text clean.
    const tags: string[] = [];
    if (bold) tags.push('strong');
    if (italic) tags.push('em');
    if (underline) tags.push('u');
    if (strike) tags.push('s');
    if (vertical === 'superscript') tags.push('sup');
    if (vertical === 'subscript') tags.push('sub');
    if (code) tags.push('code');
    let open = tags.map((t) => `<${t}>`).join('');
    let close = tags
      .reverse()
      .map((t) => `</${t}>`)
      .join('');
    if (css.length) {
      open = `<span style="${escape(css.join('; '))}">${open}`;
      close = `${close}</span>`;
    }
    return { open, close };
  }

  private image(rid: string | undefined, width?: number, height?: number, alt = ''): string {
    const rel = rid ? this.rels.get(rid) : undefined;
    if (!rel) return '';
    if (rel.external) {
      return /^https?:/i.test(rel.target)
        ? `<img src="${escape(rel.target)}" alt="${escape(alt)}"${width ? ` width="${width}"` : ''}${height ? ` height="${height}"` : ''}>`
        : '';
    }
    const bytes = this.files.get(rel.target);
    const ext = rel.target.split('.').pop()?.toLowerCase() ?? '';
    const mime = MIME[ext];
    if (!bytes || !mime) {
      this.warnings.add(`image format .${ext || '?'}`);
      return '';
    }
    this.images++;
    return `<img src="data:${mime};base64,${bytesToBase64(bytes)}" alt="${escape(alt)}"${width ? ` width="${width}"` : ''}${height ? ` height="${height}"` : ''}>`;
  }

  private drawing(drawing: XmlElement): string {
    const holder = element(drawing, 'wp:inline') ?? element(drawing, 'wp:anchor');
    const extent = element(holder, 'wp:extent');
    const px = (emu: string | undefined) => (emu ? Math.round(Number(emu) / 9525) : undefined);
    const docPr = element(holder, 'wp:docPr');
    let blip: XmlElement | undefined;
    const find = (el: XmlElement) => {
      for (const child of elements(el)) {
        if (blip) return;
        if (child.name === 'a:blip') blip = child;
        else find(child);
      }
    };
    if (holder) find(holder);
    return this.image(
      blip?.attrs['r:embed'] ?? blip?.attrs['r:link'],
      px(extent?.attrs.cx),
      px(extent?.attrs.cy),
      docPr?.attrs.descr ?? docPr?.attrs.title ?? '',
    );
  }

  /** Old images (VML): v:imagedata inside w:pict / w:object. */
  private vml(pict: XmlElement): string {
    let data: XmlElement | undefined;
    let shape: XmlElement | undefined;
    const find = (el: XmlElement) => {
      for (const child of elements(el)) {
        if (child.name === 'v:shape') shape = child;
        if (child.name === 'v:imagedata') data = child;
        else find(child);
      }
    };
    find(pict);
    if (!data) return '';
    const style = shape?.attrs.style ?? '';
    const size = (prop: string) => {
      const m = new RegExp(`${prop}:\\s*([\\d.]+)(pt|px|in)`).exec(style);
      if (!m) return undefined;
      const n = Number(m[1]);
      return Math.round(m[2] === 'pt' ? n * (4 / 3) : m[2] === 'in' ? n * 96 : n);
    };
    return this.image(
      data.attrs['r:id'],
      size('width'),
      size('height'),
      data.attrs['o:title'] ?? '',
    );
  }

  /**
   * Paragraph content as HTML. Returns pieces separated by page breaks.
   * Fields (fldChar): between begin and separate is the code (not text), after separate the result.
   */
  private inline(parent: XmlElement, state: InlineState): void {
    for (const node of elements(parent)) {
      switch (node.name) {
        case 'w:r':
          this.run(node, state);
          break;
        case 'w:hyperlink': {
          const rel = node.attrs['r:id'] ? this.rels.get(node.attrs['r:id']) : undefined;
          const anchor = node.attrs['w:anchor'];
          const href = rel?.external ? rel.target : anchor ? `#${anchor}` : '';
          if (href) state.push(`<a href="${escape(href)}">`);
          state.links++;
          this.inline(node, state);
          state.links--;
          if (href) state.push('</a>');
          break;
        }
        case 'w:ins':
        case 'w:moveTo':
        case 'w:smartTag':
        case 'w:customXml':
        case 'w:fldSimple':
        case 'w:dir':
        case 'w:bdo':
          this.inline(node, state);
          break;
        case 'w:sdt':
          this.inline(element(node, 'w:sdtContent') ?? node, state);
          break;
        case 'm:oMath':
        case 'm:oMathPara':
          state.push(`<em>${escape(textContent(node))}</em>`);
          this.warnings.add('equations');
          break;
        default:
          // w:del, w:moveFrom (accepted revisions), bookmarks, comments, w:proofErr: no text.
          break;
      }
    }
  }

  private run(run: XmlElement, state: InlineState): void {
    const rPr = element(run, 'w:rPr');
    if (element(rPr, 'w:rFonts')?.attrs['w:ascii'] === 'Cambria Math' && state.field !== 'code') {
      const latex = elements(run, 'w:t').map(textContent).join('');
      if (latex)
        state.push(
          `<span data-type="inline-math" data-latex="${escape(latex)}">${escape(latex)}</span>`,
        );
      return;
    }
    const { open, close } = this.runStyle(rPr, state.links > 0);
    let text = '';
    const flush = () => {
      if (text && state.field !== 'code') state.push(`${open}${text}${close}`);
      text = '';
    };
    for (const node of elements(run)) {
      switch (node.name) {
        case 'w:t':
          text += escape(textContent(node));
          break;
        case 'w:tab':
        case 'w:ptab':
          text += ' ';
          break;
        case 'w:noBreakHyphen':
          text += '-';
          break;
        case 'w:sym': {
          const code = parseInt(node.attrs['w:char'] ?? '', 16);
          // Characters of the Symbol/Wingdings fonts sit in the F000 range: there is no guessing them.
          if (Number.isFinite(code) && code < 0xe000) text += escape(String.fromCodePoint(code));
          break;
        }
        case 'w:br':
        case 'w:cr':
          flush();
          if (node.attrs['w:type'] === 'page') state.pageBreak();
          else if (node.attrs['w:type'] !== 'column' && state.field !== 'code') state.push('<br>');
          break;
        case 'w:drawing':
          flush();
          if (state.field !== 'code') state.push(this.drawing(node));
          break;
        case 'w:pict':
        case 'w:object':
          flush();
          if (state.field !== 'code') state.push(this.vml(node));
          break;
        case 'w:fldChar': {
          flush();
          const type = node.attrs['w:fldCharType'];
          if (type === 'begin') {
            state.fields.push({ code: '', link: false });
            state.field = 'code';
          } else if (type === 'separate') {
            const field = state.fields[state.fields.length - 1];
            state.field = 'result';
            const link = field && /^\s*HYPERLINK\s+(?:\\l\s+)?"([^"]+)"/.exec(field.code);
            if (field && link) {
              const local = /\\l/.test(field.code.split('"')[0] ?? '');
              state.push(`<a href="${escape(local ? `#${link[1]}` : link[1]!)}">`);
              field.link = true;
              state.links++;
            }
          } else if (type === 'end') {
            const field = state.fields.pop();
            if (field?.link) {
              state.push('</a>');
              state.links--;
            }
            state.field = state.fields.length ? 'result' : null;
          }
          break;
        }
        case 'w:instrText': {
          const field = state.fields[state.fields.length - 1];
          if (field) field.code += textContent(node);
          break;
        }
        case 'w:footnoteReference': {
          flush();
          const note = this.footnotes.get(node.attrs['w:id'] ?? '');
          if (note) {
            const n = this.notes.length + 1;
            this.notes.push(`<p><sup>${n}</sup> ${this.noteText(note)}</p>`);
            state.push(`<sup>${n}</sup>`);
          }
          break;
        }
        default:
          break;
      }
    }
    flush();
  }

  private noteText(note: XmlElement): string {
    return elements(note, 'w:p')
      .map((p) => {
        const state = new InlineState();
        this.inline(p, state);
        return state.parts().join(' ');
      })
      .join(' ')
      .trim();
  }

  // ---------- blocks ----------

  private paragraph(p: XmlElement, list: ListState, out: string[]): void {
    const pPr = element(p, 'w:pPr');
    const styleId = val(element(pPr, 'w:pStyle'));
    const level = this.headingLevel(styleId, pPr);
    const kind = level ? null : this.styleKind(styleId);
    const state = new InlineState();
    this.inline(p, state);
    const parts = state.parts();

    // Paragraph formatting.
    const styles = this.styleChain(styleId);
    const jc = val(element(pPr, 'w:jc')) ?? styles.find((s) => s.jc)?.jc;
    const css: string[] = [];
    if (jc === 'center') css.push('text-align: center');
    else if (jc === 'right' || jc === 'end') css.push('text-align: right');
    else if (jc === 'both' || jc === 'distribute') css.push('text-align: justify');
    const ind = element(pPr, 'w:ind');
    const left = Number(ind?.attrs['w:left'] ?? ind?.attrs['w:start'] ?? 0);
    const numPr = element(pPr, 'w:numPr') ?? styles.find((s) => s.numPr)?.numPr;
    const numId = val(element(numPr, 'w:numId'));
    if (left > 0 && !numId) css.push(`margin-left: ${Math.round(left / 15)}px`);
    const spacing = element(pPr, 'w:spacing');
    const line = Number(spacing?.attrs['w:line']);
    if (line && (spacing?.attrs['w:lineRule'] ?? 'auto') === 'auto' && line !== 240)
      css.push(`line-height: ${Math.round((line / 240) * 100) / 100}`);
    const rtl = on(element(pPr, 'w:bidi'));
    const attrs = `${css.length ? ` style="${css.join('; ')}"` : ''}${rtl ? ' dir="rtl"' : ''}`;

    // A bookmark at the start of a heading becomes its id (Word's table of contents links point to it).
    const mark = elements(p, 'w:bookmarkStart').find((b) => b.attrs['w:name'] !== '_GoBack');
    const id = level && mark ? ` id="${escape(mark.attrs['w:name'] ?? '')}"` : '';

    if (on(element(pPr, 'w:pageBreakBefore'))) {
      list.close(out);
      out.push(PAGE_BREAK);
    }
    // An empty paragraph with a bottom border is a horizontal rule (that is how Word and our export write it).
    if (parts.length === 1 && !parts[0] && !level && element(element(pPr, 'w:pBdr'), 'w:bottom')) {
      list.close(out);
      out.push('<hr>');
      return;
    }
    // A checklist item: "☐ "/"☒ " at the start of a regular paragraph.
    const check = !level && !numId ? /^([☐☒☑]) /.exec(parts[0] ?? '') : null;
    if (check && parts.length === 1) {
      list.item(out, 'checklist', 0, false, '', 1, check[1] !== '☐');
      const plain = css.filter((rule) => !rule.startsWith('margin-left'));
      out.push(
        `<p${plain.length ? ` style="${plain.join('; ')}"` : ''}${rtl ? ' dir="rtl"' : ''}>${parts[0]!.slice(2)}</p>`,
      );
      return;
    }
    parts.forEach((html, index) => {
      if (index > 0) {
        list.close(out);
        out.push(PAGE_BREAK);
      }
      // Empty pieces around a page break are not paragraphs.
      if (!html && parts.length > 1) return;
      if (numId && numId !== '0' && index === 0) {
        const ilvl = Number(val(element(numPr, 'w:ilvl')) ?? 0);
        const lvl = this.levels.get(numId)?.[ilvl];
        if (lvl && lvl.format !== 'none') {
          const ordered = lvl.format !== 'bullet';
          const start = this.starts.get(`${numId}:${ilvl}`) ?? lvl.start;
          list.item(
            out,
            numId,
            ilvl,
            ordered,
            ordered ? (LIST_STYLE[lvl.format] ?? '') : '',
            start,
          );
          out.push(`<p${attrs}>${html}</p>`);
          return;
        }
      }
      list.close(out);
      if (level) out.push(`<h${level}${id}${attrs}>${html}</h${level}>`);
      else if (kind === 'quote') out.push(`<blockquote><p${attrs}>${html}</p></blockquote>`);
      else if (kind === 'code') out.push(`<pre><code>${html.replace(/<br>/g, '\n')}</code></pre>`);
      else out.push(`<p${attrs}>${html}</p>`);
    });
  }

  private table(tbl: XmlElement, out: string[]): void {
    const grid = elements(element(tbl, 'w:tblGrid'), 'w:gridCol').map((col) =>
      Math.round(Number(col.attrs['w:w'] ?? 0) / 15),
    );
    interface Cell {
      tc: XmlElement;
      col: number;
      span: number;
      merge: 'restart' | 'continue' | null;
      rowspan: number;
    }
    const rows = elements(tbl, 'w:tr').map((tr) => {
      let col = Number(val(element(element(tr, 'w:trPr'), 'w:gridBefore')) ?? 0);
      const cells: Cell[] = [];
      for (const tc of elements(tr, 'w:tc')) {
        const tcPr = element(tc, 'w:tcPr');
        const span = Math.max(1, Number(val(element(tcPr, 'w:gridSpan')) ?? 1));
        const vMerge = element(tcPr, 'w:vMerge');
        const merge = vMerge ? (val(vMerge) === 'restart' ? 'restart' : 'continue') : null;
        cells.push({ tc, col, span, merge, rowspan: 1 });
        col += span;
      }
      return { tr, cells };
    });
    // A vertical merge: the start (restart) takes the continuations below it.
    rows.forEach((row, r) => {
      for (const cell of row.cells) {
        if (cell.merge !== 'restart') continue;
        for (let below = r + 1; below < rows.length; below++) {
          const next = rows[below]!.cells.find((c) => c.col === cell.col);
          if (next?.merge !== 'continue') break;
          cell.rowspan++;
        }
      }
    });
    out.push('<table><tbody>');
    for (const { tr, cells } of rows) {
      const header = on(element(element(tr, 'w:trPr'), 'w:tblHeader'));
      out.push('<tr>');
      for (const cell of cells) {
        if (cell.merge === 'continue') continue;
        const tcPr = element(cell.tc, 'w:tcPr');
        const tag = header ? 'th' : 'td';
        const css: string[] = [];
        const fill = element(tcPr, 'w:shd')?.attrs['w:fill'];
        if (fill && /^[0-9a-f]{6}$/i.test(fill))
          css.push(`background-color: #${fill.toLowerCase()}`);
        const valign = val(element(tcPr, 'w:vAlign'));
        if (valign === 'center') css.push('vertical-align: middle');
        else if (valign === 'bottom') css.push('vertical-align: bottom');
        const widths = grid.slice(cell.col, cell.col + cell.span);
        const colwidth =
          widths.length === cell.span && widths.every((w) => w > 0)
            ? ` data-colwidth="${widths.join(',')}"`
            : '';
        out.push(
          `<${tag}${cell.span > 1 ? ` colspan="${cell.span}"` : ''}${cell.rowspan > 1 ? ` rowspan="${cell.rowspan}"` : ''}${colwidth}${css.length ? ` style="${css.join('; ')}"` : ''}>`,
        );
        this.inHeader = header;
        this.blocks(cell.tc, out);
        this.inHeader = false;
        out.push(`</${tag}>`);
      }
      out.push('</tr>');
    }
    out.push('</tbody></table>');
  }

  blocks(parent: XmlElement, out: string[]): void {
    const list = new ListState();
    const before = out.length;
    for (const node of elements(parent)) {
      if (node.name === 'w:p') this.paragraph(node, list, out);
      else if (node.name === 'w:tbl') {
        list.close(out);
        this.table(node, out);
      } else if (node.name === 'w:sdt') {
        list.close(out);
        this.blocks(element(node, 'w:sdtContent') ?? node, out);
      } else if (node.name === 'w:altChunk') this.warnings.add('embedded content (altChunk)');
    }
    list.close(out);
    // Footnotes go to the end of the document.
    if (parent.name === 'w:body' && this.notes.length) out.push('<hr>', ...this.notes.splice(0));
    if (out.length === before && parent.name === 'w:tc') out.push('<p></p>');
  }

  page(body: XmlElement): PageLayoutOptions | undefined {
    const sect = element(body, 'w:sectPr');
    const size = element(sect, 'w:pgSz');
    const margin = element(sect, 'w:pgMar');
    if (!size) return undefined;
    const mm = (tw: string | undefined) => Math.round((Number(tw) / 1440) * 25.4 * 10) / 10;
    let width = mm(size.attrs['w:w']);
    let height = mm(size.attrs['w:h']);
    if (!(width > 0 && height > 0)) return undefined;
    // Landscape orientation with portrait sizes (some programs write it that way): trust the orientation.
    if (size.attrs['w:orient'] === 'landscape' && width < height) [width, height] = [height, width];
    const margins: Partial<PageMargins> = {};
    for (const side of ['top', 'right', 'bottom', 'left'] as const) {
      const value = margin?.attrs[`w:${side}`];
      if (value !== undefined) margins[side] = Math.abs(mm(value));
    }
    const [short, long] = width < height ? [width, height] : [height, width];
    const named = (Object.keys(PAGE_SIZES) as PageSizeName[]).find(
      (name) =>
        Math.abs(PAGE_SIZES[name][0] - short) < 1.5 && Math.abs(PAGE_SIZES[name][1] - long) < 1.5,
    );
    return {
      size: named ?? { width, height },
      orientation: width > height ? 'landscape' : 'portrait',
      margins,
    };
  }
}

const PAGE_BREAK = '<div class="nova-pagebreak" style="break-after: page;"></div>';

const MONOSPACE =
  /^(consolas|courier( new)?|menlo|monaco|lucida console|source code pro|fira (code|mono)|jetbrains mono|cascadia (code|mono)|monospace)$/i;
/** The background our export and code editors use to shade code: code in the editor has its own. */
const CODE_SHADES = new Set(['#f3f4f6', '#f6f8fa']);

/** Paragraph content cut by page breaks. */
class InlineState {
  private current: string[] = [];
  private readonly done: string[] = [];
  /** Inside a field: code is the field code (not text), result is its result. */
  field: 'code' | 'result' | null = null;
  readonly fields: Array<{ code: string; link: boolean }> = [];
  /** Link depth (w:hyperlink, the HYPERLINK field). */
  links = 0;

  push(html: string): void {
    this.current.push(html);
  }

  pageBreak(): void {
    this.done.push(this.current.join(''));
    this.current = [];
  }

  parts(): string[] {
    return [...this.done, this.current.join('')];
  }
}

/** Open lists: nesting by ilvl, a new list when the numbering or the kind changes. */
class ListState {
  private readonly stack: Array<{ numId: string; level: number; tag: 'ul' | 'ol' }> = [];

  item(
    out: string[],
    numId: string,
    level: number,
    ordered: boolean,
    style: string,
    start: number,
    checked?: boolean,
  ) {
    const tag = ordered ? 'ol' : 'ul';
    const li = checked === undefined ? '<li>' : `<li data-checked="${checked}">`;
    while (this.stack.length && this.stack[this.stack.length - 1]!.level > level) {
      out.push(`</li></${this.stack.pop()!.tag}>`);
    }
    const top = this.stack[this.stack.length - 1];
    if (top && top.level === level) {
      if (top.numId === numId && top.tag === tag) {
        out.push(`</li>${li}`);
        return;
      }
      out.push(`</li></${this.stack.pop()!.tag}>`);
    }
    const attrs =
      (ordered && start !== 1 ? ` start="${start}"` : '') +
      (style ? ` style="list-style-type: ${style}"` : '') +
      (checked === undefined ? '' : ' data-type="checklist"');
    out.push(`<${tag}${attrs}>${li}`);
    this.stack.push({ numId, level, tag });
  }

  close(out: string[]): void {
    while (this.stack.length) out.push(`</li></${this.stack.pop()!.tag}>`);
  }
}

/** .docx → HTML (plus the sheet and margins). Throws when the file isn't a .docx or is damaged. */
export async function fromDocx(input: Uint8Array | ArrayBuffer): Promise<DocxImportResult> {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const files = await unzip(bytes);
  const reader = new DocxReader(files);
  const body = reader.load();
  if (!body) throw new Error('Not a Word document (.docx)');
  const out: string[] = [];
  reader.blocks(body, out);
  return { html: out.join(''), page: reader.page(body), warnings: [...reader.warnings] };
}
