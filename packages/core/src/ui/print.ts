import type { Editor } from '../editor';
import { pageLayout, type PageBandParts, type PageLayout } from '../plugins/pagelayout';
import { h } from './dom';

/**
 * Printing as on screen: a copy of the editor's text, node views included (formulas, code highlighting,
 * custom blocks), in a hidden iframe with every style of the page, contentStyle/contentCss included.
 * In page mode (pagelayout) the sheet is the same: size and margins in @page, the same text width, so
 * pages break where the editor draws their borders. A lazy module: it loads on print.
 */

interface StyleSource {
  css?: string;
  href?: string;
  media?: string;
}

/** A style sheet's rules as text (third-party sheets without access to their rules, as a link). */
function sourceOf(sheet: CSSStyleSheet, fontsOnly: boolean): StyleSource | null {
  if (sheet.disabled) return null;
  const media = sheet.media?.mediaText;
  try {
    const rules = [...sheet.cssRules].filter((rule) => !fontsOnly || rule.type === 5);
    return { css: rules.map((rule) => rule.cssText).join('\n'), media };
  } catch {
    return !fontsOnly && sheet.href ? { href: sheet.href, media } : null;
  }
}

/**
 * The styles the editor draws the text with. Inside a shadow root, its styles and the document's fonts
 * (document styles don't reach inside it, so they don't go into the print either).
 */
function styleSources(editor: Editor): StyleSource[] {
  const root = editor.root.getRootNode();
  const shadow = typeof ShadowRoot !== 'undefined' && root instanceof ShadowRoot ? root : null;
  const sheets = (target: Document | ShadowRoot, fontsOnly: boolean) =>
    [...target.styleSheets, ...(target.adoptedStyleSheets ?? [])]
      .map((sheet) => sourceOf(sheet, fontsOnly))
      .filter((source): source is StyleSource => !!source);
  return [...sheets(document, !!shadow), ...(shadow ? sheets(shadow, false) : [])];
}

/**
 * Text as a CSS string. Quotes, backslashes and angle brackets become escapes, so the text can't end the
 * string or the <style> it sits in (the print document also goes to a server as HTML for PDF files).
 */
function cssString(text: string): string {
  const escaped = text
    .replace(/[\\"<>]/g, (ch) => `\\${ch.charCodeAt(0).toString(16)} `)
    .replace(/[\n\r\f]/g, ' ');
  return `"${escaped}"`;
}

/** A header or footer part → the CSS `content` value: text in quotes, {page} and {pages} as page counters. */
export function marginBoxContent(template: string): string {
  const parts = template.split(/(\{pages?\})/).filter((part) => part !== '');
  const tokens = parts.map((part) =>
    part === '{page}' ? 'counter(page)' : part === '{pages}' ? 'counter(pages)' : cssString(part),
  );
  return tokens.join(' ') || '""';
}

const SIDES = ['left', 'center', 'right'] as const;
/** Header and footer text: small, grey, in the system font, as in the editor's page view. */
const BAND_STYLE = "font: 9pt/1.3 system-ui, -apple-system, 'Segoe UI', sans-serif; color: #444;";

/** CSS page margin boxes (@top-left … @bottom-right) for the header and footer. */
function marginBoxes(band: PageBandParts | null, edge: 'top' | 'bottom'): string {
  if (!band) return '';
  return SIDES.filter((side) => band[side])
    .map((side) => `@${edge}-${side} { content: ${marginBoxContent(band[side])}; ${BAND_STYLE} }`)
    .join(' ');
}

/** Printing on top of the page styles: only the content, the sheet from page mode, no editor frame. */
export function printCss(layout: PageLayout | undefined): string {
  const page = layout
    ? `size: ${layout.width}mm ${layout.height}mm; margin: ${layout.margins.top}mm ${layout.margins.right}mm ${layout.margins.bottom}mm ${layout.margins.left}mm;`
    : 'margin: 20mm;';
  // Headers and footers: CSS margin boxes, printed by Chromium (Chrome, Edge) and by headless Chrome into PDF files.
  const bands = layout
    ? `${marginBoxes(layout.header, 'top')} ${marginBoxes(layout.footer, 'bottom')}`.trim()
    : '';
  const titlePage =
    bands && layout?.differentFirstPage
      ? `@page :first { ${(['top', 'bottom'] as const)
          .flatMap((edge) => SIDES.map((side) => `@${edge}-${side} { content: none; }`))
          .join(' ')} }`
      : '';
  return `
@page { ${page}${bands ? ` ${bands}` : ''} }${titlePage ? `\n${titlePage}` : ''}
html, body { margin: 0 !important; padding: 0 !important; background: #fff !important;
  height: auto !important; overflow: visible !important; }
body > .nova-print { display: block !important; }
.nova-print, .nova-print * { visibility: visible !important; }
.nova-print, .nova-print > .nova-content { position: static !important; inset: auto !important;
  display: block !important; width: auto !important; height: auto !important; min-height: 0 !important;
  max-height: none !important; margin: 0 !important; padding: 0 !important; border: 0 !important;
  border-radius: 0 !important; box-shadow: none !important; background: none !important;
  overflow: visible !important; contain: none !important; }
.nova-print .nova-prosemirror { width: auto !important; max-width: none !important; min-height: 0 !important;
  margin: 0 !important; padding: 0 !important; box-shadow: none !important; background: none !important;
  orphans: 1; widows: 1; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
.nova-print tr, .nova-print img, .nova-print figure, .nova-print video, .nova-print iframe,
.nova-print canvas, .nova-print svg { break-inside: avoid; }
.nova-print .nova-pagebreak { break-after: page !important; height: 0 !important; margin: 0 !important;
  padding: 0 !important; border: 0 !important; visibility: hidden !important; }
.nova-print .nova-pagebreak::before, .nova-print .nova-pagebreak::after { display: none !important; }
.nova-print .ProseMirror-selectednode { outline: none !important; }
`;
}

/** A copy of the editor's text without traces of editing. */
function contentClone(dom: HTMLElement): HTMLElement {
  const clone = dom.cloneNode(true) as HTMLElement;
  clone.removeAttribute('contenteditable');
  clone.classList.remove('ProseMirror-focused', 'nova-empty');
  for (const el of clone.querySelectorAll('.ProseMirror-gapcursor, .nova-image-handle'))
    el.remove();
  // Lazy images in an invisible iframe would never load.
  for (const el of clone.querySelectorAll('[loading]')) el.removeAttribute('loading');
  // cloneNode doesn't copy a canvas drawing, so it is carried over as an image.
  const originals = dom.querySelectorAll('canvas');
  clone.querySelectorAll('canvas').forEach((canvas, index) => {
    try {
      const image = document.createElement('img');
      image.src = originals[index]!.toDataURL();
      image.style.cssText = canvas.style.cssText;
      image.className = canvas.className;
      canvas.replaceWith(image);
    } catch {
      // a canvas with cross-origin images (tainted) stays empty
    }
  });
  return clone;
}

/** The print document: the page styles, print rules and a root like the editor's. */
export function buildPrintDocument(editor: Editor, doc: Document): void {
  for (const source of styleSources(editor)) {
    if (source.href) {
      const link = doc.createElement('link');
      link.rel = 'stylesheet';
      link.href = source.href;
      if (source.media) link.media = source.media;
      doc.head.append(link);
    } else {
      const style = doc.createElement('style');
      style.textContent =
        source.media && source.media !== 'all'
          ? `@media ${source.media} {\n${source.css}\n}`
          : source.css!;
      doc.head.append(style);
    }
  }
  const style = doc.createElement('style');
  style.textContent = printCss(pageLayout(editor)?.layout);
  doc.head.append(style);
  // Paper is light even with a dark system theme.
  doc.documentElement.setAttribute('data-theme', 'light');
  if (editor.root.closest('[lang]'))
    doc.documentElement.lang = editor.root.closest('[lang]')!.getAttribute('lang')!;
  // Classes of the editor root: the content style scopes (contentStyle/contentCss) and page mode.
  const root = doc.createElement('div');
  root.className = `${editor.root.className} nova-print`;
  root.dir = editor.direction;
  const content = doc.createElement('div');
  content.className = 'nova-content';
  content.append(contentClone(editor.view.dom));
  root.append(content);
  doc.body.append(root);
}

/**
 * The print document as one HTML string, for a server that makes a PDF from it (headless Chrome:
 * `page.setContent(html)`, `page.pdf({ preferCSSPageSize: true })`). Addresses of images and style sheets
 * resolve against this page (`<base href>`); the sheet, margins, header and footer are in its @page rule.
 */
export function printDocumentHtml(editor: Editor, title = ''): string {
  const doc = document.implementation.createHTMLDocument(title);
  const charset = doc.createElement('meta');
  charset.setAttribute('charset', 'utf-8');
  const base = doc.createElement('base');
  base.href = document.baseURI;
  doc.head.prepend(charset, base);
  buildPrintDocument(editor, doc);
  return `<!doctype html>\n${doc.documentElement.outerHTML}`;
}

/** The print document's images, style sheets and fonts have loaded (but no longer than 2 s). */
function loaded(doc: Document): Promise<void> {
  const waits: Promise<unknown>[] = [];
  const onLoad = (el: HTMLElement) =>
    new Promise((resolve) => {
      el.addEventListener('load', resolve, { once: true });
      el.addEventListener('error', resolve, { once: true });
    });
  for (const image of doc.images) if (!image.complete) waits.push(onLoad(image));
  for (const link of doc.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'))
    if (!link.sheet) waits.push(onLoad(link));
  void doc.body.offsetHeight; // layout starts loading the fonts
  if (doc.fonts) waits.push(doc.fonts.ready);
  return Promise.race([
    Promise.all(waits).then(() => undefined),
    new Promise<void>((resolve) => setTimeout(resolve, 2000)),
  ]);
}

/** Prints the editor's content (the browser's print dialog, which also offers "Save as PDF"). */
export async function print(editor: Editor): Promise<void> {
  const iframe = h('iframe', { title: 'print', 'aria-hidden': 'true', tabindex: '-1' });
  iframe.style.cssText =
    'position:fixed;width:0;height:0;border:0;right:0;bottom:0;visibility:hidden';
  document.body.append(iframe);
  const doc = iframe.contentDocument;
  const win = iframe.contentWindow;
  if (!doc || !win) return iframe.remove();
  // Standards mode, as on the page with the editor: an empty iframe is in quirks mode,
  // where lines and tables are laid out differently and pages would break in the wrong places.
  doc.open();
  doc.write('<!doctype html><html><head><meta charset="utf-8"></head><body></body></html>');
  doc.close();
  buildPrintDocument(editor, doc);
  await loaded(doc);
  const cleanup = () => setTimeout(() => iframe.remove(), 1000);
  win.addEventListener('afterprint', cleanup);
  win.focus();
  win.print();
  cleanup();
}
