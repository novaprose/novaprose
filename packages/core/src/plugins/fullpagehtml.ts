import type { Editor } from '../editor';
import { definePlugin, type PageHandler } from '../plugins';
import { cssValue } from '../schema';
import { escapeAttr, escapeText } from '../serializer';

/**
 * The fullpagehtml plugin: a whole HTML document, not only its content. The doctype, the attributes
 * of <html> and <body> and the head (title, meta tags, style sheets) are kept around the content:
 * getHTML() gives the whole page, and setContent() of a whole page reads its head. The page lives in
 * the document's `page` attribute, so undo, JSON and the server renderer keep it. The Document
 * properties dialog is in fullpagehtml-ui.ts.
 *
 * Security: a page's scripts are never kept, nor <base>, a refresh or cookie from <meta>, event
 * handlers, or addresses other than http(s) and relative ones. Everything is checked again whenever
 * the page is written: a document can arrive as JSON with anything in it.
 */

export interface FullPageHtmlOptions {
  /** The doctype of a page that has none (`<!DOCTYPE html>`). */
  doctype?: string;
  /** The title of a page that has none. */
  title?: string;
  /** The character encoding a page declares when it declares none, as `<meta charset>`: 'UTF-8'. */
  encoding?: string;
  /** The body's style for a page whose body has none: 'font-family: Georgia; color: #222222'. */
  bodyStyle?: string;
  /** The source code view shows only the content, not the whole page. */
  hideInSourceView?: boolean;
}

/** The parts of a page kept around the content (the document's `page` attribute). */
export interface PageData {
  /** `<!DOCTYPE html>` or an older HTML or XHTML doctype. */
  doctype?: string;
  /** The attributes of <html>: lang, dir. */
  html?: Record<string, string>;
  /** The head, in order. */
  head?: HeadElement[];
  /** The attributes of <body>: style, class, dir, lang. */
  body?: Record<string, string>;
}

export type HeadElement =
  | { tag: 'title'; text: string }
  | { tag: 'meta' | 'link'; attrs: Record<string, string> }
  | { tag: 'style'; attrs: Record<string, string>; text: string };

type Check = (value: string) => string | null;

const LANG_RE = /^[a-z]{1,8}(?:-[a-z0-9]{1,8}){0,4}$/i;
const NAME_RE = /^[\w.:-]{1,100}$/;
const DOCTYPE_RE =
  /^<!doctype html(?:\s+(?:public|system)(?:\s+(?:"[^"<>]{0,300}"|'[^'<>]{0,300}')){1,2})?\s*>$/i;
const HTTP_EQUIV = new Set([
  'content-type',
  'content-language',
  'x-ua-compatible',
  'default-style',
]);
const LINK_RELS = new Set([
  'stylesheet',
  'icon',
  'shortcut',
  'apple-touch-icon',
  'canonical',
  'alternate',
  'author',
  'license',
  'next',
  'prev',
]);
const DEFAULT_DOCTYPE = '<!DOCTYPE html>';

/**
 * A string without control characters (tabs and line breaks are fine), at most `max` long. Line
 * breaks are \n, as the HTML parser reads them, so a page reads back the same.
 */
function text(value: unknown, max: number): string | null {
  if (typeof value !== 'string' || value.length > max) return null;
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) return null;
  return value.replace(/\r\n?/g, '\n');
}

const lang: Check = (v) => (LANG_RE.test(v) ? v : null);
const dir: Check = (v) =>
  ['ltr', 'rtl', 'auto'].includes(v.toLowerCase()) ? v.toLowerCase() : null;
const short: Check = (v) => text(v, 300);
const classes: Check = (v) => {
  const names = v.split(/\s+/).filter(Boolean);
  return names.length && names.length <= 20 && names.every((n) => /^[\w-]{1,60}$/.test(n))
    ? names.join(' ')
    : null;
};

/** An address for a <link>: http(s), or relative. */
const href: Check = (v) => {
  const value = v.trim();
  // eslint-disable-next-line no-control-regex
  const protocol = /^([a-z][a-z0-9+.-]*):/i.exec(value.replace(/[\u0000- ]/g, ''))?.[1];
  return value && value.length <= 2000 && (!protocol || /^https?$/i.test(protocol)) ? value : null;
};

/** One to four lengths (margin, padding). */
const box: Check = (v) => {
  const parts = v.trim().split(/\s+/);
  return parts.length <= 4 && parts.every((p) => p === '0' || p === 'auto' || cssValue.length(p))
    ? parts.join(' ')
    : null;
};

const BODY_STYLES: Record<string, Check> = {
  'background-color': cssValue.color,
  color: cssValue.color,
  'font-family': cssValue.fontFamily,
  'font-size': cssValue.length,
  'line-height': cssValue.lineHeight,
  'text-align': (v) => (['left', 'center', 'right', 'justify'].includes(v) ? v : null),
  'max-width': cssValue.length,
  margin: box,
  'margin-top': box,
  'margin-right': box,
  'margin-bottom': box,
  'margin-left': box,
  padding: box,
  'padding-top': box,
  'padding-right': box,
  'padding-bottom': box,
  'padding-left': box,
};

/**
 * The body's style: only colors, the font, sizes and spacing, each value checked (no url(), no
 * positions). `background` with a plain color is read as background-color.
 */
export function bodyStyle(value: unknown): string {
  if (typeof value !== 'string') return '';
  const kept = new Map<string, string>();
  for (const declaration of value.slice(0, 2000).split(';')) {
    const colon = declaration.indexOf(':');
    if (colon < 0) continue;
    let name = declaration.slice(0, colon).trim().toLowerCase();
    if (name === 'background') name = 'background-color';
    const checked = BODY_STYLES[name]?.(declaration.slice(colon + 1).trim());
    if (checked) {
      kept.delete(name);
      kept.set(name, checked);
    }
  }
  return [...kept].map(([name, v]) => `${name}: ${v}`).join('; ');
}

const HTML_ATTRS: Record<string, Check> = {
  lang,
  dir,
  xmlns: (v) => (v === 'http://www.w3.org/1999/xhtml' ? v : null),
  'xml:lang': lang,
};
const BODY_ATTRS: Record<string, Check> = {
  style: (v) => bodyStyle(v) || null,
  class: classes,
  dir,
  lang,
};
const META_ATTRS: Record<string, Check> = {
  charset: (v) => (/^[\w.:-]{1,40}$/.test(v) ? v : null),
  name: (v) => (NAME_RE.test(v) ? v : null),
  property: (v) => (NAME_RE.test(v) ? v : null),
  'http-equiv': (v) => (HTTP_EQUIV.has(v.toLowerCase()) ? v : null),
  content: (v) => text(v, 2000),
};
const LINK_ATTRS: Record<string, Check> = {
  rel: (v) => {
    const rels = v.toLowerCase().split(/\s+/).filter(Boolean);
    return rels.length && rels.every((r) => LINK_RELS.has(r)) ? rels.join(' ') : null;
  },
  href,
  type: (v) => (/^[\w.+-]{1,60}\/[\w.+-]{1,60}$/.test(v) ? v : null),
  media: short,
  sizes: (v) => (/^(?:any|\d{1,4}x\d{1,4}(?:\s+\d{1,4}x\d{1,4}){0,9})$/i.test(v) ? v : null),
  hreflang: lang,
  title: short,
};
const STYLE_ATTRS: Record<string, Check> = {
  media: short,
  type: (v) => (v.toLowerCase() === 'text/css' ? 'text/css' : null),
};

/** The attributes that pass their checks, in the checks' order (so the output is always the same). */
function cleanAttrs(value: unknown, checks: Record<string, Check>): Record<string, string> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const out: Record<string, string> = {};
  for (const [name, check] of Object.entries(checks)) {
    const v = typeof raw[name] === 'string' ? check(raw[name] as string) : null;
    if (v !== null) out[name] = v;
  }
  return Object.keys(out).length ? out : null;
}

function cleanHead(item: unknown): HeadElement | null {
  if (!item || typeof item !== 'object') return null;
  const { tag, attrs, text: content } = item as Record<string, unknown>;
  if (tag === 'title') {
    const title = text(content, 1000);
    return title === null ? null : { tag, text: title.replace(/\s+/g, ' ').trim() };
  }
  if (tag === 'meta') {
    const a = cleanAttrs(attrs, META_ATTRS);
    const named = a && (a.name ?? a.property ?? a['http-equiv']) && a.content !== undefined;
    return a && (a.charset || named) ? { tag, attrs: a } : null;
  }
  if (tag === 'link') {
    const a = cleanAttrs(attrs, LINK_ATTRS);
    return a?.rel && a.href ? { tag, attrs: a } : null;
  }
  if (tag === 'style') {
    const css = text(content, 200_000);
    return css === null ? null : { tag, attrs: cleanAttrs(attrs, STYLE_ATTRS) ?? {}, text: css };
  }
  return null;
}

/** A page from anywhere (a document's JSON, a parsed head): only what passes the checks. */
export function cleanPage(value: unknown): PageData {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const raw = value as Record<string, unknown>;
  const page: PageData = {};
  const doctype = text(raw.doctype, 700)?.trim();
  if (doctype && DOCTYPE_RE.test(doctype)) page.doctype = doctype;
  const html = cleanAttrs(raw.html, HTML_ATTRS);
  if (html) page.html = html;
  const head = Array.isArray(raw.head)
    ? raw.head
        .slice(0, 300)
        .map(cleanHead)
        .filter((el): el is HeadElement => el !== null)
    : [];
  // One title.
  const firstTitle = head.findIndex((el) => el.tag === 'title');
  const kept = head.filter((el, i) => el.tag !== 'title' || i === firstTitle);
  if (kept.length) page.head = kept;
  const body = cleanAttrs(raw.body, BODY_ATTRS);
  if (body) page.body = body;
  return page;
}

const attrsHTML = (attrs: Record<string, string> = {}) =>
  Object.entries(attrs)
    .map(([name, value]) => ` ${name}="${escapeAttr(value)}"`)
    .join('');

function headHTML(el: HeadElement): string {
  if (el.tag === 'title') return `<title>${escapeText(el.text)}</title>`;
  if (el.tag === 'style')
    // Nothing in the style sheet may close its element.
    return `<style${attrsHTML(el.attrs)}>${el.text.replace(/<\/(style)/gi, '<\\/$1')}</style>`;
  return `<${el.tag}${attrsHTML(el.attrs)}>`;
}

/** The page of an HTML document parsed with DOMParser (inert: nothing in it runs or loads). */
function pageOf(dom: Document): PageData {
  const attrs = (el: Element | null) =>
    el ? Object.fromEntries([...el.attributes].map((a) => [a.name.toLowerCase(), a.value])) : {};
  const type = dom.doctype;
  const doctype = type
    ? `<!DOCTYPE ${type.name}${type.publicId ? ` PUBLIC "${type.publicId}"` : ''}${
        type.systemId ? `${type.publicId ? '' : ' SYSTEM'} "${type.systemId}"` : ''
      }>`
    : undefined;
  const head = [...dom.head.children].map((el) => {
    const tag = el.tagName.toLowerCase();
    return tag === 'title' || tag === 'style'
      ? { tag, attrs: attrs(el), text: el.textContent ?? '' }
      : { tag, attrs: attrs(el) };
  });
  // Old pages color the body with attributes: they become its style.
  const body = attrs(dom.body);
  const legacy = [
    body.bgcolor && `background-color: ${body.bgcolor}`,
    body.text && `color: ${body.text}`,
    body.style,
  ].filter(Boolean);
  if (legacy.length) body.style = legacy.join('; ');
  return cleanPage({ doctype, html: attrs(dom.documentElement), head, body });
}

/** HTML that is a whole document, not only content. */
const WHOLE_PAGE = /<!doctype\b|<(?:html|head|body)[\s>/]/i;

export function fullPageOptions(context: { options: Editor['options'] }) {
  const raw = (context.options.pluginOptions?.fullpagehtml ?? {}) as FullPageHtmlOptions;
  const doctype = text(raw.doctype, 700)?.trim();
  return {
    doctype: doctype && DOCTYPE_RE.test(doctype) ? doctype : DEFAULT_DOCTYPE,
    title: text(raw.title, 1000)?.replace(/\s+/g, ' ').trim() ?? '',
    encoding: typeof raw.encoding === 'string' ? (META_ATTRS.charset!(raw.encoding) ?? '') : '',
    bodyStyle: bodyStyle(raw.bodyStyle),
    hideInSourceView: raw.hideInSourceView === true,
  };
}

type Settings = ReturnType<typeof fullPageOptions>;

/** Everything before the content: the doctype, <html>, the head and <body>. */
function pageStart(value: unknown, settings: Settings): string {
  const page = cleanPage(value);
  const head = (page.head ?? []).map(headHTML);
  // The settings fill in what the page doesn't say.
  if (settings.encoding && !page.head?.some((el) => el.tag === 'meta' && el.attrs.charset))
    head.unshift(`<meta charset="${escapeAttr(settings.encoding)}">`);
  if (settings.title && !page.head?.some((el) => el.tag === 'title'))
    head.push(`<title>${escapeText(settings.title)}</title>`);
  const body = { ...page.body };
  if (!body.style && settings.bodyStyle) body.style = settings.bodyStyle;
  return [
    page.doctype ?? settings.doctype,
    `<html${attrsHTML(page.html)}>`,
    '<head>',
    ...head,
    '</head>',
    `<body${attrsHTML(body)}>`,
  ].join('\n');
}

function pageHandler(context: { options: Editor['options'] }): PageHandler {
  const settings = fullPageOptions(context);
  return {
    inSource: !settings.hideInSourceView,
    read(html) {
      if (!WHOLE_PAGE.test(html)) return null;
      const dom = new DOMParser().parseFromString(html, 'text/html');
      return { content: dom.body.innerHTML, attrs: { page: pageOf(dom) } };
    },
    // Checked every time: a page from JSON may have been changed since it was last written.
    write: (content, attrs) => `${pageStart(attrs.page, settings)}\n${content}\n</body>\n</html>`,
  };
}

export default definePlugin({
  name: 'fullpagehtml',
  toolbar: 'fullpagehtml',
  nodeAttributes: {
    // The page around the content: on the document itself, so undo, JSON and the server keep it.
    page: { nodes: ['doc'], default: null, parse: () => null, render: () => ({}) },
  },
  page: pageHandler,
  load: () => import('./fullpagehtml-ui'),
});
