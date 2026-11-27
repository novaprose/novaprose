import { loadCss, scopeSelector, splitSelectors, splitTopLevel } from './content-css';
import type { Editor } from './editor';

/**
 * Email HTML from the editor's content (a separate entry, @novaprose/core/email: it isn't part of the
 * first load). Email clients drop or ignore style sheets, so the content styles go into each
 * element's style attribute, with the cascade as a browser applies it: specificity, order,
 * !important, inline styles. What email clients can't show becomes something they can: a video
 * becomes a link, a collapsible block plain text, a formula its TeX. Optionally a whole email
 * document: a centered column that Outlook keeps too, preview text for the inbox, and the
 * @media rules in its head for the clients that read them.
 *
 * Runs in a browser, or on a server with a DOM such as jsdom (it parses HTML with DOMParser).
 */

/** A filter: a substring, a regular expression or a function. */
export type EmailFilter = string | RegExp | ((value: string) => boolean);

export interface EmailDocumentOptions {
  /** The document's title (a few email clients show it). */
  title?: string;
  /** Preview text that inboxes show after the subject; hidden in the email itself. */
  preheader?: string;
  /** The width of the email's column, in pixels: 600 by default. */
  width?: number;
  /** The background around the column: #ffffff by default. */
  background?: string;
  /** The background of the column: #ffffff by default. */
  contentBackground?: string;
  /** The language of the text (the editor's language by default). */
  lang?: string;
  /** The direction of the text (the editor's direction by default). */
  dir?: 'ltr' | 'rtl';
}

export interface EmailOptions {
  /** More CSS to put inline, after the editor's content styles. */
  css?: string;
  /**
   * Built-in styles that make the email look like the text in the editor: fonts, tables with
   * borders, quotes, code, images that fit. Yes by default; your styles override them.
   */
  baseStyles?: boolean;
  /** Which selectors are put inline (a substring, a RegExp or a function); all by default. */
  selectorFilter?: EmailFilter;
  /** Which content style files are read, by their address; all by default. */
  fileFilter?: EmailFilter;
  /** Relative links and images become absolute against this address: the page's address by default. */
  baseUrl?: string;
  /** A whole email document (doctype, head, a centered column) instead of the content alone. */
  document?: boolean | EmailDocumentOptions;
}

/** The built-in email styles: the editor's look in properties email clients understand. */
export const EMAIL_CSS = `
body { font-family: -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 16px; line-height: 1.6; color: #1f2328; }
p { margin: 0 0 12px; }
h1, h2, h3, h4, h5, h6 { margin: 20px 0 8px; line-height: 1.25; }
h1 { font-size: 32px; }
h2 { font-size: 24px; }
h3 { font-size: 19px; }
h4 { font-size: 16px; }
h5 { font-size: 14px; }
h6 { font-size: 13px; }
a { color: #0969da; text-decoration: underline; }
blockquote { margin: 0 0 12px; padding: 0 0 0 16px; border-left: 3px solid #d0d7de; color: #59636e; }
pre { margin: 0 0 12px; padding: 12px 14px; border-radius: 6px; background: #f6f8fa; font-family: Menlo, Consolas, 'Courier New', monospace; font-size: 14px; white-space: pre-wrap; }
code { padding: 1px 4px; border-radius: 4px; background: #f6f8fa; font-family: Menlo, Consolas, 'Courier New', monospace; font-size: 14px; }
pre code { padding: 0; background: transparent; }
ul, ol { margin: 0 0 12px; padding-left: 24px; }
li > p { margin: 0; }
ul[data-type="taskList"] { padding-left: 0; list-style: none; }
table { width: 100%; margin: 0 0 12px; border-collapse: collapse; }
th, td { padding: 6px 8px; border: 1px solid #afb8c1; vertical-align: top; }
th { background: #f6f8fa; font-weight: 600; }
td > :last-child, th > :last-child { margin-bottom: 0; }
img { max-width: 100%; height: auto; border: 0; }
figure { margin: 12px 0; }
figure img { display: block; }
figcaption { padding-top: 6px; color: #59636e; font-size: 14px; text-align: center; }
hr { margin: 20px 0; border: 0; border-top: 1px solid #d0d7de; }
[data-type="math-inline"], [data-type="math-block"] { font-family: Menlo, Consolas, 'Courier New', monospace; }
`;

// ---------- CSS ----------

export interface Declaration {
  name: string;
  value: string;
  important: boolean;
}

/** Splits a declaration block at the semicolons outside strings and brackets (url(data:…;…)). */
function splitDeclarations(body: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let quote = '';
  let start = 0;
  for (let i = 0; i < body.length; i++) {
    const ch = body[i]!;
    if (quote) {
      if (ch === '\\') i++;
      else if (ch === quote) quote = '';
    } else if (ch === '"' || ch === "'") quote = ch;
    else if (ch === '(') depth++;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    else if (ch === ';' && depth === 0) {
      parts.push(body.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(body.slice(start));
  return parts;
}

const IMPORTANT = /!\s*important\s*$/i;

/** `color: red; margin: 0 !important` → declarations, as written (shorthands stay shorthands). */
export function parseDeclarations(body: string): Declaration[] {
  const out: Declaration[] = [];
  for (const part of splitDeclarations(body.replace(/\/\*[\s\S]*?\*\//g, ''))) {
    const colon = part.indexOf(':');
    if (colon < 1) continue;
    const raw = part.slice(0, colon).trim();
    if (!/^(--[\w-]+|-?[a-zA-Z][\w-]*)$/.test(raw)) continue;
    let value = part.slice(colon + 1).trim();
    const important = IMPORTANT.test(value);
    if (important) value = value.replace(IMPORTANT, '').trim();
    if (!value) continue;
    // Custom property names are case-sensitive; the others are not.
    out.push({ name: raw.startsWith('--') ? raw : raw.toLowerCase(), value, important });
  }
  return out;
}

/** Pseudo-elements and states don't exist in a static email: such selectors aren't put inline. */
const PSEUDO_ELEMENT = /::|:(before|after|first-line|first-letter)\b/i;
const DYNAMIC =
  /:(hover|focus|focus-within|focus-visible|active|visited|target|checked|indeterminate|enabled|disabled|placeholder-shown|valid|invalid|in-range|out-of-range|read-only|read-write|autofill|user-valid|user-invalid|open|closed|popover-open|modal|fullscreen|playing|paused)\b/i;

const pass = (filter: EmailFilter | undefined, value: string): boolean => {
  if (filter === undefined) return true;
  if (typeof filter === 'function') return !!filter(value);
  if (filter instanceof RegExp) return filter.test(value);
  return value.includes(filter);
};

/** Specificity as one comparable number: ids, then classes, then types. */
export function specificity(selector: string): number {
  let ids = 0;
  let classes = 0;
  let types = 0;
  let rest = selector;
  // :is() :not() :has() count their most specific argument, :where() counts nothing.
  for (;;) {
    const m = /:(where|is|not|has|matches|-webkit-any|-moz-any)\(/i.exec(rest);
    if (!m) break;
    const open = m.index + m[0].length - 1;
    let depth = 0;
    let end = -1;
    for (let i = open; i < rest.length; i++) {
      if (rest[i] === '(') depth++;
      else if (rest[i] === ')' && --depth === 0) {
        end = i;
        break;
      }
    }
    if (end < 0) break;
    if (m[1]!.toLowerCase() !== 'where') {
      const inner = Math.max(0, ...splitSelectors(rest.slice(open + 1, end)).map(specificity));
      ids += Math.floor(inner / 1_000_000);
      classes += Math.floor(inner / 1000) % 1000;
      types += inner % 1000;
    }
    rest = `${rest.slice(0, m.index)} ${rest.slice(end + 1)}`;
  }
  rest = rest
    .replace(/\[[^\]]*\]/g, () => (classes++, ' '))
    .replace(/:[\w-]+\([^)]*\)/g, () => (classes++, ' '))
    .replace(/#[\w-]+/g, () => (ids++, ' '))
    .replace(/\.[\w-]+/g, () => (classes++, ' '))
    .replace(/::?[\w-]+/g, (pseudo) => (pseudo.startsWith('::') ? types++ : classes++, ' '));
  types += (rest.match(/(?:^|[\s>+~])[a-zA-Z][\w-]*/g) ?? []).length;
  return Math.min(ids, 999) * 1_000_000 + Math.min(classes, 999) * 1000 + Math.min(types, 999);
}

interface Rule {
  /** Scoped to the email's root: `p` → `nova-email-root p`, `body` → `nova-email-root`. */
  selector: string;
  specificity: number;
  order: number;
  declarations: Declaration[];
}

const ROOT_SCOPE = 'nova-email-root';
/** Selectors of the whole document, where custom properties (--color) are usually declared. */
const GLOBAL = /^(:root|html|body|\*)$/i;
/** At-rules a head <style> keeps for the clients that read it. */
const KEPT_AT_RULES = /^@(media|font-face|supports)\b/i;

function parseRules(
  css: string,
  filter: EmailFilter | undefined,
): { rules: Rule[]; kept: string[]; vars: Map<string, string> } {
  const rules: Rule[] = [];
  const kept: string[] = [];
  const vars = new Map<string, string>();
  let order = 0;
  for (const { prelude, body } of splitTopLevel(css)) {
    if (body === null) continue;
    if (prelude.startsWith('@')) {
      if (KEPT_AT_RULES.test(prelude)) kept.push(`${prelude} {${body}}`);
      continue;
    }
    const declarations = parseDeclarations(body);
    order++;
    for (const selector of splitSelectors(prelude)) {
      if (GLOBAL.test(selector)) {
        for (const d of declarations) if (d.name.startsWith('--')) vars.set(d.name, d.value);
      }
      if (PSEUDO_ELEMENT.test(selector) || DYNAMIC.test(selector) || !pass(filter, selector))
        continue;
      rules.push({
        selector: scopeSelector(selector, ROOT_SCOPE),
        specificity: specificity(selector),
        order,
        declarations: declarations.filter((d) => !d.name.startsWith('--')),
      });
    }
  }
  return { rules, kept, vars };
}

/** var(--name, fallback) → the value; null when a variable has no value and no fallback. */
function resolveVars(value: string, vars: Map<string, string>, depth = 0): string | null {
  const at = value.indexOf('var(');
  if (at < 0) return value;
  if (depth > 8) return null;
  let level = 0;
  let end = -1;
  let comma = -1;
  for (let i = at + 3; i < value.length; i++) {
    const ch = value[i];
    if (ch === '(') level++;
    else if (ch === ')' && --level === 0) {
      end = i;
      break;
    } else if (ch === ',' && level === 1 && comma < 0) comma = i;
  }
  if (end < 0) return null;
  const name = value.slice(at + 4, comma > 0 ? comma : end).trim();
  const fallback = comma > 0 ? value.slice(comma + 1, end).trim() : null;
  const found = vars.get(name) ?? fallback;
  if (found === null) return null;
  const inner = resolveVars(found, vars, depth + 1);
  if (inner === null) return null;
  return resolveVars(value.slice(0, at) + inner + value.slice(end + 1), vars, depth + 1);
}

/**
 * Puts the CSS into the style attributes of `root` and its descendants. Selectors are scoped to the
 * root the way the editor scopes content styles: `body` and `:root` rules style the root itself.
 * Returns the at-rules that can't go inline (@media, @font-face).
 */
function inlineInto(
  root: Element,
  css: string,
  filter: EmailFilter | undefined,
): { kept: string[] } {
  const { rules, kept, vars } = parseRules(css, filter);
  const matched = new Map<Element, Array<{ d: Declaration; rule: Rule }>>();
  const doc = root.ownerDocument;
  for (const rule of rules) {
    let hits: Element[];
    try {
      hits = [...doc.querySelectorAll(rule.selector)];
    } catch {
      continue; // a selector this DOM doesn't understand
    }
    for (const el of hits) {
      if (el !== root && !root.contains(el)) continue;
      const list = matched.get(el) ?? [];
      for (const d of rule.declarations) list.push({ d, rule });
      matched.set(el, list);
    }
  }
  const byPrecedence = (a: { rule: Rule }, b: { rule: Rule }) =>
    a.rule.specificity - b.rule.specificity || a.rule.order - b.rule.order;
  for (const [el, list] of matched) {
    const inline = parseDeclarations(el.getAttribute('style') ?? '');
    // The cascade, lowest first: style sheet, inline style, !important in the style sheet, inline !important.
    const sequence = [
      ...list
        .filter((x) => !x.d.important)
        .sort(byPrecedence)
        .map((x) => x.d),
      ...inline.filter((d) => !d.important),
      ...list
        .filter((x) => x.d.important)
        .sort(byPrecedence)
        .map((x) => x.d),
      ...inline.filter((d) => d.important),
    ];
    // Each property where its winning declaration is: a later shorthand still overrides a longhand before it.
    const seen = new Set<string>();
    const out: string[] = [];
    for (let i = sequence.length - 1; i >= 0; i--) {
      const d = sequence[i]!;
      if (d.name.startsWith('--') || seen.has(d.name)) continue;
      seen.add(d.name);
      const value = resolveVars(d.value, vars);
      if (value !== null) out.unshift(`${d.name}: ${value}`);
    }
    if (out.length) el.setAttribute('style', out.join('; '));
  }
  return { kept };
}

// ---------- markup email clients understand ----------

/** Template tags ({{unsubscribe_url}}, *|UNSUB|*) stay as they are: the email service replaces them. */
const TEMPLATE_TAG = /\{\{|\}\}|\*\||\|\*|%7B%7B/i;

function absolute(url: string, base: string): string {
  if (!url || /^(#|mailto:|tel:|sms:|data:|cid:)/i.test(url) || TEMPLATE_TAG.test(url)) return url;
  try {
    return new URL(url, base).href;
  } catch {
    return url;
  }
}

/** A page to open instead of a player that email clients won't show. */
function videoPage(src: string): string {
  const youtube = /youtube(?:-nocookie)?\.com\/embed\/([\w-]{6,})/i.exec(src);
  if (youtube) return `https://www.youtube.com/watch?v=${youtube[1]}`;
  const vimeo = /player\.vimeo\.com\/video\/(\d+)/i.exec(src);
  if (vimeo) return `https://vimeo.com/${vimeo[1]}`;
  return src;
}

function emailSafe(root: Element, base: string): void {
  const doc = root.ownerDocument;
  // Collapsible blocks: email clients don't open them, so they are shown open, the title in bold.
  for (const details of [...root.querySelectorAll('details')].reverse()) {
    const block = doc.createElement('div');
    for (const child of [...details.childNodes]) {
      if (child.nodeName === 'SUMMARY') {
        const p = doc.createElement('p');
        const strong = doc.createElement('strong');
        strong.append(...child.childNodes);
        p.append(strong);
        block.append(p);
      } else block.append(child);
    }
    details.replaceWith(block);
  }
  // Checklists: the box is a character, since email clients have no checkboxes in text.
  for (const item of root.querySelectorAll('li[data-type="taskItem"]')) {
    const mark = item.getAttribute('data-checked') === 'true' ? '☑' : '☐';
    (item.firstElementChild ?? item).prepend(`${mark} `);
  }
  // Formulas: their TeX, in a monospace font.
  for (const math of root.querySelectorAll('[data-type="math-inline"], [data-type="math-block"]')) {
    const latex = math.getAttribute('data-latex');
    if (latex !== null) math.textContent = latex;
  }
  // Players: a link to the video's page.
  for (const media of [...root.querySelectorAll('iframe, video, audio, object, embed')]) {
    const src = media.getAttribute('src') ?? media.getAttribute('data') ?? '';
    if (!src) {
      media.remove();
      continue;
    }
    const href = absolute(videoPage(src), base);
    const link = doc.createElement('a');
    link.setAttribute('href', href);
    link.textContent = media.getAttribute('title') || href;
    if (media.parentElement?.closest('p, li, td, th, figcaption')) media.replaceWith(link);
    else {
      const p = doc.createElement('p');
      p.append(link);
      media.replaceWith(p);
    }
  }
  // Page breaks mean nothing in an email.
  for (const pagebreak of root.querySelectorAll('.nova-pagebreak')) pagebreak.remove();
  // Addresses: absolute, since the email is read away from the page. Image widths as attributes for Outlook.
  for (const link of root.querySelectorAll('a[href]')) {
    link.setAttribute('href', absolute(link.getAttribute('href')!, base));
  }
  for (const img of root.querySelectorAll('img')) {
    const src = img.getAttribute('src');
    if (src) img.setAttribute('src', absolute(src, base));
    if (!img.hasAttribute('width')) {
      const width = /(?:^|;)\s*width\s*:\s*(\d+(?:\.\d+)?)px/i.exec(
        img.getAttribute('style') ?? '',
      );
      if (width) img.setAttribute('width', String(Math.round(Number(width[1]))));
    }
  }
}

// ---------- the document ----------

const escapeHTML = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** A color for an attribute: plain characters only, otherwise the default. */
const color = (value: unknown, fallback: string): string =>
  typeof value === 'string' && /^[#\w(),.%\s-]{1,64}$/.test(value.trim()) ? value.trim() : fallback;

function emailDocument(
  content: string,
  rootStyle: string,
  kept: string[],
  options: EmailDocumentOptions,
): string {
  const width = Math.min(Math.max(Math.round(Number(options.width) || 600), 280), 1200);
  const background = color(options.background, '#ffffff');
  const contentBackground = color(options.contentBackground, '#ffffff');
  const lang =
    typeof options.lang === 'string' && /^[\w-]{1,20}$/.test(options.lang) ? options.lang : 'en';
  const dir = options.dir === 'rtl' ? 'rtl' : 'ltr';
  const title = escapeHTML(String(options.title ?? ''));
  const preheader = options.preheader
    ? `<div style="display: none; max-height: 0; overflow: hidden; mso-hide: all;">${escapeHTML(String(options.preheader))}</div>\n`
    : '';
  // Your @media and @font-face rules, for the clients that read a style sheet in the head.
  const head = kept.join('\n').replace(/<\/style/gi, '<\\/style');
  const cell = ['padding: 24px', rootStyle].filter(Boolean).join('; ');
  return `<!DOCTYPE html>
<html lang="${lang}" dir="${dir}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${title}</title>
<style>
body { margin: 0; padding: 0; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
img { -ms-interpolation-mode: bicubic; }
${head}
</style>
</head>
<body style="margin: 0; padding: 0; background-color: ${background};">
${preheader}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: ${background};">
<tr><td align="center" style="padding: 24px 12px;">
<table role="presentation" width="${width}" cellpadding="0" cellspacing="0" border="0" style="width: 100%; max-width: ${width}px; background-color: ${contentBackground};">
<tr><td dir="${dir}" style="${escapeHTML(cell)}">
${content}
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>
`;
}

/**
 * HTML → email HTML: styles inline, markup email clients understand, and with `document` a whole
 * email. `contentCss` is the editor's content CSS (emailHTML reads it from the editor).
 */
export function toEmailHTML(
  html: string,
  options: EmailOptions & { contentCss?: string; dir?: 'ltr' | 'rtl' } = {},
): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const root = doc.createElement(ROOT_SCOPE);
  root.append(...doc.body.childNodes);
  doc.body.append(root);
  // A parsed document has no address of its own: links resolve against the page's.
  const base =
    options.baseUrl ?? (typeof document === 'undefined' ? doc.baseURI : document.baseURI);
  emailSafe(root, base);
  // Header cells start where the text starts, as in the editor (browsers center them by default).
  const baseCss =
    options.baseStyles === false
      ? ''
      : `${EMAIL_CSS}th { text-align: ${options.dir === 'rtl' ? 'right' : 'left'}; }\n`;
  const css = [baseCss, options.contentCss ?? '', options.css ?? ''].join('\n');
  const { kept } = inlineInto(root, css, options.selectorFilter);
  const rootStyle = root.getAttribute('style') ?? '';
  if (options.document) {
    const settings = typeof options.document === 'object' ? options.document : {};
    return emailDocument(root.innerHTML, rootStyle, kept, {
      ...settings,
      dir: settings.dir ?? options.dir,
    });
  }
  // The content alone: the document-wide styles (font, color) on a wrapper, so they travel with it.
  if (!rootStyle && options.dir !== 'rtl') return root.innerHTML;
  const wrapper = doc.createElement('div');
  if (options.dir === 'rtl') wrapper.setAttribute('dir', 'rtl');
  if (rootStyle) wrapper.setAttribute('style', rootStyle);
  wrapper.append(...root.childNodes);
  return wrapper.outerHTML;
}

/** The editor's content CSS as text: its contentCss files (those `fileFilter` lets through), then contentStyle. */
export async function editorContentCss(editor: Editor, fileFilter?: EmailFilter): Promise<string> {
  const { contentCss, contentStyle } = editor.options;
  const files =
    contentCss === undefined ? [] : Array.isArray(contentCss) ? contentCss : [contentCss];
  const sheets = await Promise.all(
    files
      .filter((url) => pass(fileFilter, new URL(url, document.baseURI).href))
      .map((url) =>
        loadCss(url).catch((error: unknown) => {
          console.warn(`[nova] email: could not load ${url}`, error);
          return '';
        }),
      ),
  );
  return [...sheets, contentStyle ?? ''].join('\n');
}

/** The email plugin's options (pluginOptions.email), then `options`, with the editor's language and direction. */
export function emailSettings(
  editor: Editor,
  options: EmailOptions = {},
): EmailOptions & { dir?: 'ltr' | 'rtl' } {
  const settings = {
    ...((editor.options.pluginOptions?.email ?? {}) as EmailOptions),
    ...options,
  };
  const { language, direction } = editor.options;
  const document =
    settings.document &&
    ({
      lang: language,
      dir: direction,
      ...(typeof settings.document === 'object' ? settings.document : {}),
    } satisfies EmailDocumentOptions);
  return { ...settings, document: document || false, ...(direction ? { dir: direction } : {}) };
}

/**
 * The editor's content as email HTML: its content styles (contentCss, contentStyle) and the email
 * plugin's options (pluginOptions.email) apply, then `options`.
 */
export async function emailHTML(editor: Editor, options: EmailOptions = {}): Promise<string> {
  const settings = emailSettings(editor, options);
  const contentCss = await editorContentCss(editor, settings.fileFilter);
  return toEmailHTML(editor.getHTML(), { ...settings, contentCss });
}
