/**
 * Cleans up HTML pasted from Word, Word Online, Google Docs, Excel, Google Sheets, LibreOffice
 * and regular web pages. Runs before the schema parses it: turns "office" markup into clean HTML
 * that the schema understands correctly (real lists instead of paragraphs with markers, styles from
 * classes moved into style, no service tags or styles).
 *
 * Built from the public description of the Office clipboard format and the observed behavior of
 * the applications, without anyone else's code (clean room, see CLAUDE.md).
 */

// Images of desktop Word come in the RTF: read there, at paste time, with this chunk.
export { extractRtfImages, replaceLocalImages } from './paste-rtf';

export type PasteSource =
  | 'nova'
  | 'word'
  | 'word-online'
  | 'google-docs'
  | 'excel'
  | 'google-sheets'
  | 'libreoffice'
  | 'web';

/** 'clean' (default) — without fonts, sizes, spacing and "default" colors; 'keep' — as it is. */
export type PasteStyles = 'clean' | 'keep';

/** Where the HTML was copied from (by telltale signs in the markup). */
export function detectPasteSource(html: string): PasteSource {
  if (/data-pm-slice=/.test(html)) return 'nova';
  if (/<google-sheets-html-origin|data-sheets-(root|value)/i.test(html)) return 'google-sheets';
  if (/id="docs-internal-guid-/.test(html)) return 'google-docs';
  if (/urn:schemas-microsoft-com:office:excel|ProgId"?\s+content="?Excel\.Sheet/i.test(html))
    return 'excel';
  if (
    /urn:schemas-microsoft-com:office:word|class="?Mso|mso-list:|content="?Microsoft Word/i.test(
      html,
    )
  )
    return 'word';
  if (
    /class="[^"]*\b(TextRun|OutlineElement|EOP|SCXW\d+|BCX\d+)\b|data-ccp-props|paraid=/.test(html)
  )
    return 'word-online';
  if (/content="?LibreOffice|content="?OpenOffice/i.test(html)) return 'libreoffice';
  return 'web';
}

/** Cleans up pasted HTML. NovaProse's own internal copy is left alone. */
export function cleanPastedHTML(html: string, styles: PasteStyles = 'clean'): string {
  const source = detectPasteSource(html);
  if (source === 'nova') return html;

  const template = document.createElement('template');
  template.innerHTML = html;
  const root = document.createElement('div');
  root.append(template.content);

  inlineClassStyles(root);
  removeJunk(root);
  if (source === 'word') convertWordLists(root);
  if (source === 'google-docs') unwrapGoogleDocsWrapper(root);
  normalizeLists(root);
  convertWordParagraphStyles(root);
  root.querySelectorAll<HTMLElement>('[style]').forEach((el) => cleanStyle(el, styles));
  if (styles === 'clean') stripLayoutAttributes(root);
  unwrapMeaningless(root);
  removeBreaksBetweenBlocks(root);
  normalizeEmptyParagraphs(root);
  wrapCellContent(root);
  // Office classes (MsoNormal, xl65, TextRun…) mean nothing outside Office: their styles are already in style.
  if (source !== 'web')
    root.querySelectorAll('[class]').forEach((el) => el.removeAttribute('class'));
  return root.innerHTML;
}

// ---------- styles from <style> (Word, Excel and LibreOffice keep formatting in classes) ----------

type Declarations = Map<string, string>;

function parseDeclarations(css: string): Declarations {
  const out: Declarations = new Map();
  for (const part of css.split(';')) {
    const colon = part.indexOf(':');
    if (colon < 0) continue;
    const name = part.slice(0, colon).trim().toLowerCase();
    const value = part
      .slice(colon + 1)
      .trim()
      .replace(/\s*!important$/i, '');
    if (name && value) out.set(name, value);
  }
  return out;
}

function serializeDeclarations(decls: Declarations): string {
  return [...decls].map(([name, value]) => `${name}: ${value}`).join('; ');
}

/** Moves rules like `.xl65 {…}` and `p.MsoTitle {…}` into the elements' style. The element's own style wins. */
function inlineClassStyles(root: HTMLElement): void {
  const sheets = [...root.querySelectorAll('style')].map((s) => s.textContent ?? '');
  if (!sheets.length) return;
  const rules: { tag: string; cls: string; decls: Declarations }[] = [];
  const css = sheets
    .join('\n')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/<!--|-->/g, '');
  for (const match of css.matchAll(/([^{}@]+)\{([^{}]*)\}/g)) {
    const decls = parseDeclarations(match[2]!);
    for (const selector of match[1]!.split(',')) {
      const m = selector.trim().match(/^([a-z][a-z0-9]*)?\.([\w-]+)$/i);
      if (m) rules.push({ tag: (m[1] ?? '').toLowerCase(), cls: m[2]!, decls });
    }
  }
  if (!rules.length) return;
  root.querySelectorAll<HTMLElement>('[class]').forEach((el) => {
    const classes = el.className.split(/\s+/).filter(Boolean);
    const merged: Declarations = new Map();
    for (const rule of rules) {
      if (!classes.includes(rule.cls)) continue;
      if (rule.tag && rule.tag !== el.tagName.toLowerCase()) continue;
      rule.decls.forEach((value, name) => merged.set(name, value));
    }
    if (!merged.size) return;
    parseDeclarations(el.getAttribute('style') ?? '').forEach((value, name) =>
      merged.set(name, value),
    );
    el.setAttribute('style', serializeDeclarations(merged));
  });
}

// ---------- service elements ----------

const DROP_TAGS = /^(STYLE|SCRIPT|META|LINK|TITLE|XML|HEAD|NOSCRIPT|TEMPLATE)$/;

function removeJunk(root: HTMLElement): void {
  // Comments (including Word's conditional <!--[if …]-->).
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_COMMENT);
  const comments: Node[] = [];
  while (walker.nextNode()) comments.push(walker.currentNode);
  comments.forEach((c) => c.parentNode?.removeChild(c));

  for (const el of [...root.querySelectorAll('*')]) {
    if (!root.contains(el)) continue;
    const tag = el.tagName.toUpperCase();
    if (DROP_TAGS.test(tag)) {
      el.remove();
      continue;
    }
    if (tag.includes(':')) {
      // <o:p> is Word's "end of paragraph", <v:…> is vector graphics (VML): removed.
      // Other namespaced tags (smart tags <st1:…>, <w:sdt>) are unwrapped.
      const prefix = tag.split(':')[0];
      if (prefix === 'O' || prefix === 'V') el.remove();
      else unwrap(el);
    }
  }

  // Word Online: the end of paragraph marker <span class="EOP">&nbsp;</span>.
  root.querySelectorAll<HTMLElement>('span.EOP').forEach((span) => {
    if (/^\s*$/.test(span.textContent ?? '')) span.remove();
  });

  root.querySelectorAll<HTMLElement>('a').forEach((a) => {
    const href = a.getAttribute('href') ?? '';
    // Google Docs wraps external links in a google.com/url?q=… redirect: restore the address.
    const redirect = href.match(/^https?:\/\/(www\.)?google\.[a-z.]+\/url\?(.*)$/i);
    if (redirect) {
      const target = new URLSearchParams(redirect[2]).get('q');
      if (target) a.setAttribute('href', target);
    }
    // Word bookmarks and table of contents (<a name="_Toc…">), links to footnotes and comments.
    if (!href || /^#_(ftn|edn|msocom|Toc|Ref)/i.test(href)) unwrap(a);
  });

  // Word page breaks: <br clear=all style='page-break-before:always'>.
  root.querySelectorAll<HTMLElement>('br[style*="page-break"]').forEach((br) => br.remove());
  // Word's footnote and comment blocks at the end of the document.
  root
    .querySelectorAll<HTMLElement>(
      '[style*="mso-element:footnote-list"], [style*="mso-element:comment-list"], [style*="mso-element:endnote-list"]',
    )
    .forEach((el) => el.remove());
}

// ---------- desktop Word lists: paragraphs with mso-list → <ul>/<ol> ----------

interface WordListItem {
  el: HTMLElement;
  level: number;
  ordered: boolean;
  start: number;
  /** list-style-type when it differs from the default (disc / decimal). */
  style?: string | null;
}

/**
 * A numbered list marker: "1.", "1.1.", "1", "a)", "iv.", "(2)". A letter without a dot or a parenthesis
 * is not a number: "o" is Word's standard marker for the second level of a bulleted list.
 */
const ORDERED_MARKER = /^[([]?(\d+(\.\d+)*[.)\]]?|[a-z]{1,4}[.)\]])$/i;

function readWordListItem(el: HTMLElement): WordListItem | null {
  const css = el.getAttribute('style') ?? '';
  const match = css.match(/mso-list:\s*(l\d+)\s+level(\d+)/i);
  if (!match) return null;
  // Word puts the marker into <span style="mso-list:Ignore">1.<span>&nbsp;&nbsp;</span></span>.
  const markerEl = [...el.querySelectorAll<HTMLElement>('[style]')].find((s) =>
    /mso-list:\s*Ignore/i.test(s.getAttribute('style') ?? ''),
  );
  const marker = (markerEl?.textContent ?? '').replace(/\s+/g, '');
  markerEl?.remove();
  const ordered = ORDERED_MARKER.test(marker);
  const { style, start } = ordered ? numbering(marker) : { style: bulletStyle(marker), start: 1 };
  return {
    el,
    level: Math.max(1, Math.min(9, Number(match[2]))),
    ordered,
    start,
    style,
  };
}

const ROMAN = /^(i|ii|iii|iv|v|vi|vii|viii|ix|x|xi|xii)$/i;
const ROMAN_VALUES: Record<string, number> = { i: 1, v: 5, x: 10 };

function romanToNumber(roman: string): number {
  let total = 0;
  const chars = roman.toLowerCase();
  for (let i = 0; i < chars.length; i++) {
    const value = ROMAN_VALUES[chars[i]!]!;
    const next = ROMAN_VALUES[chars[i + 1] ?? ''] ?? 0;
    total += value < next ? -value : value;
  }
  return total;
}

/** Style and start of the numbering from the marker: "3." → decimal from 3, "c)" → lower-alpha from 3, "iv." → lower-roman from 4. */
function numbering(marker: string): { style: string | null; start: number } {
  const digits = marker.match(/\d+/);
  if (digits) return { style: null, start: Number(digits[0]) };
  const letters = marker.replace(/[^a-z]/gi, '');
  if (ROMAN.test(letters)) {
    return {
      style: letters === letters.toLowerCase() ? 'lower-roman' : 'upper-roman',
      start: romanToNumber(letters),
    };
  }
  const lower = letters === letters.toLowerCase();
  return {
    style: lower ? 'lower-alpha' : 'upper-alpha',
    start: letters.toLowerCase().charCodeAt(0) - 96,
  };
}

/** Word's second-level marker "o" is a circle, "§" and "▪" (Wingdings) a square, anything else a disc. */
function bulletStyle(marker: string): string | null {
  if (marker === 'o') return 'circle';
  if (/^[§▪■]$/.test(marker)) return 'square';
  return null;
}

function convertWordLists(root: HTMLElement): void {
  const candidates = [
    ...root.querySelectorAll<HTMLElement>('p, div, h1, h2, h3, h4, h5, h6'),
  ].filter((el) => /mso-list:\s*l\d+\s+level\d+/i.test(el.getAttribute('style') ?? ''));
  // Numbered headings ("1. Introduction") are not a list: the marker stays as text.
  for (const heading of candidates.filter((el) => /^H[1-6]$/.test(el.tagName))) {
    heading.querySelectorAll<HTMLElement>('[style]').forEach((s) => {
      if (!/mso-list:\s*Ignore/i.test(s.getAttribute('style') ?? '')) return;
      // The "1." marker + an indent of non-breaking spaces → "1. ".
      const marker = (s.textContent ?? '').replace(/\s+/g, '');
      s.replaceWith(s.ownerDocument.createTextNode(`${marker} `));
    });
  }
  const paragraphs = candidates.filter((el) => !/^H[1-6]$/.test(el.tagName));
  const done = new Set<HTMLElement>();
  for (const first of paragraphs) {
    if (done.has(first)) continue;
    // A run: consecutive siblings that are list items.
    const run: WordListItem[] = [];
    let node: Element | null = first;
    while (node instanceof HTMLElement && paragraphs.includes(node)) {
      const item = readWordListItem(node);
      if (!item) break;
      run.push(item);
      done.add(node);
      node = nextElement(node);
    }
    if (run.length) buildNestedList(run);
  }
}

function nextElement(el: Element): Element | null {
  let next = el.nextSibling;
  // Skip empty text between paragraphs.
  while (next && next.nodeType === Node.TEXT_NODE && !next.textContent?.trim())
    next = next.nextSibling;
  return next instanceof Element ? next : null;
}

/** Builds nested lists from a flat run of items with levels and puts them in place of the first item. */
function buildNestedList(run: WordListItem[]): void {
  const doc = run[0]!.el.ownerDocument;
  const anchor = run[0]!.el;
  const stack: { list: HTMLElement; level: number }[] = [];
  let top: HTMLElement | null = null;
  for (const item of run) {
    while (stack.length && stack[stack.length - 1]!.level > item.level) stack.pop();
    let current = stack[stack.length - 1];
    if (!current || current.level < item.level) {
      const list = doc.createElement(item.ordered ? 'ol' : 'ul');
      if (item.ordered && item.start !== 1) list.setAttribute('start', String(item.start));
      if (item.style) list.style.listStyleType = item.style;
      if (current) {
        // A nested list goes inside the parent's last item.
        const parentItem =
          current.list.lastElementChild ?? current.list.appendChild(doc.createElement('li'));
        parentItem.appendChild(list);
      } else top = list;
      current = { list, level: item.level };
      stack.push(current);
    }
    const li = doc.createElement('li');
    const p = doc.createElement('p');
    while (item.el.firstChild) p.appendChild(item.el.firstChild);
    li.appendChild(p);
    current.list.appendChild(li);
  }
  anchor.replaceWith(top!);
  run.slice(1).forEach((item) => item.el.remove());
}

// ---------- Google Docs and Word Online lists: aria-level, split <ul> ----------

function levelOf(li: Element): number | null {
  const raw = li.getAttribute('aria-level') ?? li.getAttribute('data-aria-level');
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) && n >= 1 ? Math.min(9, n) : null;
}

function normalizeLists(root: HTMLElement): void {
  // Word Online wraps each item in <div class="ListContainerWrapper"><ul>…</ul></div>.
  root.querySelectorAll<HTMLElement>('div').forEach((div) => {
    const only = div.children.length === 1 ? div.firstElementChild : null;
    if (
      only &&
      /^(UL|OL)$/.test(only.tagName) &&
      !div.textContent?.replace(only.textContent ?? '', '').trim()
    )
      unwrap(div);
  });

  // A list directly inside a list (<ul><li/><ul>…</ul></ul>, happens in Google Docs) goes into a nested item.
  root.querySelectorAll<HTMLElement>('ul > ul, ul > ol, ol > ul, ol > ol').forEach((list) => {
    const prev = list.previousElementSibling;
    if (prev?.tagName === 'LI') prev.appendChild(list);
  });

  // Runs of adjacent lists with aria-level are rebuilt with the right nesting.
  const lists = [...root.querySelectorAll<HTMLElement>('ul, ol')].filter(
    (l) =>
      !l.parentElement?.closest('ul, ol') && l.querySelector('li[aria-level], li[data-aria-level]'),
  );
  const done = new Set<Element>();
  for (const first of lists) {
    if (done.has(first) || !root.contains(first)) continue;
    const run: WordListItem[] = [];
    let node: Element | null = first;
    while (node && /^(UL|OL)$/.test(node.tagName)) {
      done.add(node);
      collectListItems(node, 1, run);
      const next = nextElement(node);
      if (node !== first) node.remove();
      node = next;
    }
    if (!run.length) continue;
    const placeholder = first.ownerDocument.createElement('div');
    first.replaceWith(placeholder);
    buildNestedListFromBlocks(run, placeholder);
  }
}

/** List items in document order: nested lists come out one level deeper (when there is no aria-level). */
function collectListItems(list: Element, depth: number, run: WordListItem[]): void {
  for (const li of [...list.children]) {
    if (li.tagName !== 'LI') continue;
    const level = levelOf(li) ?? depth;
    const nested = [...li.children].filter((c) => /^(UL|OL)$/.test(c.tagName));
    nested.forEach((n) => n.remove());
    const holder = li.ownerDocument.createElement('div');
    while (li.firstChild) holder.appendChild(li.firstChild);
    run.push({
      el: holder,
      level,
      ordered: list.tagName === 'OL',
      start: Number(list.getAttribute('start') ?? 1) || 1,
    });
    nested.forEach((n) => collectListItems(n, level + 1, run));
  }
}

/** Like buildNestedList, but an item's content may already be blocks (<p>). */
function buildNestedListFromBlocks(run: WordListItem[], placeholder: HTMLElement): void {
  const doc = placeholder.ownerDocument;
  const stack: { list: HTMLElement; level: number }[] = [];
  let top: HTMLElement | null = null;
  for (const item of run) {
    while (stack.length && stack[stack.length - 1]!.level > item.level) stack.pop();
    let current = stack[stack.length - 1];
    if (!current || current.level < item.level) {
      const list = doc.createElement(item.ordered ? 'ol' : 'ul');
      if (item.ordered && item.start !== 1 && !current)
        list.setAttribute('start', String(item.start));
      if (current) {
        const parentItem =
          current.list.lastElementChild ?? current.list.appendChild(doc.createElement('li'));
        parentItem.appendChild(list);
      } else top = list;
      current = { list, level: item.level };
      stack.push(current);
    }
    const li = doc.createElement('li');
    while (item.el.firstChild) li.appendChild(item.el.firstChild);
    current.list.appendChild(li);
  }
  placeholder.replaceWith(top!);
}

// ---------- Google Docs ----------

function unwrapGoogleDocsWrapper(root: HTMLElement): void {
  // All Google Docs content is wrapped in <b style="font-weight:normal" id="docs-internal-guid-…">.
  root.querySelectorAll<HTMLElement>('[id^="docs-internal-guid-"]').forEach(unwrap);
  // Checkbox items become regular items.
  root.querySelectorAll<HTMLElement>('li[role="checkbox"]').forEach((li) => {
    li.removeAttribute('role');
    li.removeAttribute('aria-checked');
  });
}

// ---------- Word paragraph styles ----------

function convertWordParagraphStyles(root: HTMLElement): void {
  root.querySelectorAll<HTMLElement>('p.MsoTitle, p[class*="Title"]').forEach((p) => {
    if (!/\bMsoTitle\b|^Title$/.test(p.className)) return;
    renameElement(p, 'h1');
  });
  // Word section wrappers.
  root
    .querySelectorAll<HTMLElement>('div.WordSection1, div[class^="WordSection"], div.Section1')
    .forEach(unwrap);
}

// ---------- styles ----------

const DEFAULT_TEXT_COLORS =
  /^(black|windowtext|auto|#000|#000000|rgb\(0,\s*0,\s*0\)|initial|inherit)$/i;
const DEFAULT_BACKGROUNDS =
  /^(transparent|white|window|auto|none|#fff|#ffffff|rgba?\(255,\s*255,\s*255(,\s*1)?\)|rgba\(\d+,\s*\d+,\s*\d+,\s*0\)|initial|inherit)$/i;
/** Properties that describe the look of the source document, not the meaning of the text. */
const CLEAN_DROP =
  /^(font|font-family|font-size|line-height|margin|margin-.+|padding|padding-.+|text-indent|letter-spacing|word-spacing|white-space|height|width|min-height|border|border-.+|tab-stops|layout-grid-mode|page-break-.+|break-.+|orphans|widows|direction|unicode-bidi|font-variant.*|text-transform)$/i;

function cleanStyle(el: HTMLElement, mode: PasteStyles): void {
  const decls = parseDeclarations(el.getAttribute('style') ?? '');
  const out: Declarations = new Map();
  decls.forEach((value, name) => {
    if (name.startsWith('mso-')) {
      // Text highlighting in Word: mso-highlight:yellow → background color.
      if (
        name === 'mso-highlight' &&
        !DEFAULT_BACKGROUNDS.test(value) &&
        !decls.has('background-color')
      )
        out.set('background-color', value);
      return;
    }
    if (name.startsWith('-webkit-') || name.startsWith('-moz-')) return;
    if (name === 'background') {
      // Word and Excel write the background in shorthand: background:yellow. Only a plain color is taken.
      const color = value.split(/\s+/)[0]!;
      if (/^(#[0-9a-f]{3,8}|rgba?\([^)]*\)|[a-z]+)$/i.test(color) && !out.has('background-color'))
        out.set('background-color', color);
      return;
    }
    if (name === 'text-decoration' || name === 'text-decoration-line') {
      // "underline line-through" and "underline" with extra parts → what the schema understands.
      if (/underline/.test(value)) out.set('text-decoration', 'underline');
      else if (/line-through/.test(value)) out.set('text-decoration', 'line-through');
      return;
    }
    if (mode === 'clean' && CLEAN_DROP.test(name)) return;
    // Vertical alignment of table cells (Sheets and Excel put "bottom" in every cell) is the source's look.
    if (mode === 'clean' && name === 'vertical-align' && /^(TD|TH)$/.test(el.tagName)) return;
    out.set(name, value);
  });

  // "Default" colors (black text, white/transparent background) are not formatting.
  const color = out.get('color');
  if (color && DEFAULT_TEXT_COLORS.test(color.trim()) && mode === 'clean') out.delete('color');
  const background = out.get('background-color');
  if (background && DEFAULT_BACKGROUNDS.test(background.trim())) out.delete('background-color');
  if (out.get('font-weight') === 'normal' && el.tagName !== 'B') out.delete('font-weight');
  if (out.get('font-style') === 'normal') out.delete('font-style');
  if (out.get('text-decoration') === 'none') out.delete('text-decoration');
  if (out.get('vertical-align') === 'baseline') out.delete('vertical-align');
  // Left alignment is the default, not formatting.
  if (/^(left|start)$/i.test(out.get('text-align') ?? '')) out.delete('text-align');

  // The blue color and underline of links are the source's look; on the site its CSS styles the links.
  if (mode === 'clean' && el.closest('a')) {
    out.delete('color');
    if (out.get('text-decoration') === 'underline') out.delete('text-decoration');
  }

  if (out.size) el.setAttribute('style', serializeDeclarations(out));
  else el.removeAttribute('style');
}

/** Table and cell sizes from attributes (width="256", height, valign) are the source document's layout. */
function stripLayoutAttributes(root: HTMLElement): void {
  root.querySelectorAll('table, tr, td, th, col, colgroup').forEach((el) => {
    el.removeAttribute('width');
    el.removeAttribute('height');
    el.removeAttribute('valign');
  });
}

// ---------- unwrapping empty wrappers, empty paragraphs, extra <br> ----------

function unwrapMeaningless(root: HTMLElement): void {
  for (const el of [...root.querySelectorAll<HTMLElement>('span, font')].reverse()) {
    if (!root.contains(el)) continue;
    const hasFormatting =
      el.hasAttribute('style') || (el.tagName === 'FONT' && el.hasAttribute('color'));
    if (!hasFormatting) unwrap(el);
  }
  root.querySelectorAll('[class]').forEach((el) => el.removeAttribute('class'));
  root.querySelectorAll('[lang]').forEach((el) => el.removeAttribute('lang'));
  // Google Docs puts dir="ltr" on every paragraph: that is the default; rtl is kept.
  root.querySelectorAll('[dir]').forEach((el) => {
    if (!/^rtl$/i.test(el.getAttribute('dir') ?? '')) el.removeAttribute('dir');
  });
}

const BLOCK = /^(P|DIV|H[1-6]|UL|OL|TABLE|BLOCKQUOTE|PRE|HR)$/;

/** <br> between top-level blocks (Google Docs puts them between paragraphs) are extra empty lines. */
function removeBreaksBetweenBlocks(root: HTMLElement): void {
  root.querySelectorAll('br').forEach((br) => {
    const parent = br.parentElement;
    if (
      !parent ||
      !(
        parent === root ||
        parent.tagName === 'DIV' ||
        parent.tagName === 'TD' ||
        parent.tagName === 'LI'
      )
    )
      return;
    const prev = siblingElement(br, -1);
    const next = siblingElement(br, 1);
    if (
      (prev && BLOCK.test(prev.tagName)) ||
      (next && BLOCK.test(next.tagName)) ||
      (!prev && !next && parent === root)
    )
      br.remove();
  });
}

function siblingElement(node: Node, dir: -1 | 1): Element | null {
  let s = dir < 0 ? node.previousSibling : node.nextSibling;
  while (s && s.nodeType === Node.TEXT_NODE && !s.textContent?.trim())
    s = dir < 0 ? s.previousSibling : s.nextSibling;
  return s instanceof Element ? s : null;
}

/** A paragraph of a single non-breaking space (the way Word writes an empty line) is an empty paragraph. */
function normalizeEmptyParagraphs(root: HTMLElement): void {
  root.querySelectorAll<HTMLElement>('p').forEach((p) => {
    if (p.children.length === 0 && /^\s*$/.test(p.textContent ?? '')) p.textContent = '';
  });
}

/**
 * Excel and Google Sheets cells hold text without a paragraph, with the alignment set on the cell itself.
 * The inline content is wrapped in a paragraph that takes the text-align, otherwise the alignment is lost.
 */
function wrapCellContent(root: HTMLElement): void {
  root.querySelectorAll<HTMLElement>('td, th').forEach((cell) => {
    // Word formulas come as MathML: a "td" there without style is not a table cell.
    if (!cell.style) return;
    const align = cell.style.textAlign;
    const hasBlock = [...cell.children].some((c) => BLOCK.test(c.tagName));
    if (!align || hasBlock || !cell.textContent?.trim()) return;
    const p = cell.ownerDocument.createElement('p');
    p.style.textAlign = align;
    while (cell.firstChild) p.appendChild(cell.firstChild);
    cell.appendChild(p);
    cell.style.removeProperty('text-align');
    if (!cell.getAttribute('style')) cell.removeAttribute('style');
  });
}

// ---------- utilities ----------

function unwrap(el: Element): void {
  const parent = el.parentNode;
  if (!parent) return;
  while (el.firstChild) parent.insertBefore(el.firstChild, el);
  parent.removeChild(el);
}

function renameElement(el: HTMLElement, tag: string): HTMLElement {
  const next = el.ownerDocument.createElement(tag);
  for (const attr of [...el.attributes]) next.setAttribute(attr.name, attr.value);
  while (el.firstChild) next.appendChild(el.firstChild);
  el.replaceWith(next);
  return next;
}
