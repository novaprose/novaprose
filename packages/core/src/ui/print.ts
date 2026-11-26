import type { Editor } from '../editor';
import { pageLayout, type PageLayout } from '../plugins/pagelayout';
import { h } from './dom';

/**
 * Печать как на экране: копия текста редактора — вместе с видами узлов (формулы, подсветка кода,
 * свои блоки) — в скрытом iframe со всеми стилями страницы, включая contentStyle/contentCss.
 * В режиме страниц (pagelayout) лист тот же: размер и поля — в @page, ширина текста та же, поэтому
 * страницы делятся там же, где редактор рисует их границы. Ленивый модуль: грузится при печати.
 */

interface StyleSource {
  css?: string;
  href?: string;
  media?: string;
}

/** Правила таблицы стилей текстом (сторонние, без доступа к правилам, — ссылкой). */
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
 * Стили, в которых редактор рисует текст. Внутри теневого корня — его стили и шрифты документа
 * (стили документа туда не проникают — не берём их и в печать).
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

/** Печать поверх стилей страницы: только содержимое, лист из режима страниц, без рамок редактора. */
export function printCss(layout: PageLayout | undefined): string {
  const page = layout
    ? `size: ${layout.width}mm ${layout.height}mm; margin: ${layout.margins.top}mm ${layout.margins.right}mm ${layout.margins.bottom}mm ${layout.margins.left}mm;`
    : 'margin: 20mm;';
  return `
@page { ${page} }
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

/** Копия текста редактора без следов редактирования. */
function contentClone(dom: HTMLElement): HTMLElement {
  const clone = dom.cloneNode(true) as HTMLElement;
  clone.removeAttribute('contenteditable');
  clone.classList.remove('ProseMirror-focused', 'nova-empty');
  for (const el of clone.querySelectorAll('.ProseMirror-gapcursor, .nova-image-handle'))
    el.remove();
  // Ленивые картинки в невидимом iframe не загрузились бы никогда.
  for (const el of clone.querySelectorAll('[loading]')) el.removeAttribute('loading');
  // cloneNode не копирует рисунок canvas — переносим картинкой.
  const originals = dom.querySelectorAll('canvas');
  clone.querySelectorAll('canvas').forEach((canvas, index) => {
    try {
      const image = document.createElement('img');
      image.src = originals[index]!.toDataURL();
      image.style.cssText = canvas.style.cssText;
      image.className = canvas.className;
      canvas.replaceWith(image);
    } catch {
      // холст с чужими картинками (tainted) — останется пустым
    }
  });
  return clone;
}

/** Документ печати: стили страницы, печатные правила и корень как у редактора. */
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
  // Бумага светлая и при тёмной теме системы.
  doc.documentElement.setAttribute('data-theme', 'light');
  if (editor.root.closest('[lang]'))
    doc.documentElement.lang = editor.root.closest('[lang]')!.getAttribute('lang')!;
  // Классы корня редактора: области стилей содержимого (contentStyle/contentCss) и режим страниц.
  const root = doc.createElement('div');
  root.className = `${editor.root.className} nova-print`;
  root.dir = editor.direction;
  const content = doc.createElement('div');
  content.className = 'nova-content';
  content.append(contentClone(editor.view.dom));
  root.append(content);
  doc.body.append(root);
}

/** Картинки, таблицы стилей и шрифты документа печати загружены (но не дольше 2 с). */
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
  void doc.body.offsetHeight; // раскладка запускает загрузку шрифтов
  if (doc.fonts) waits.push(doc.fonts.ready);
  return Promise.race([
    Promise.all(waits).then(() => undefined),
    new Promise<void>((resolve) => setTimeout(resolve, 2000)),
  ]);
}

/** Напечатать содержимое редактора (диалог печати браузера; там же — «Сохранить как PDF»). */
export async function print(editor: Editor): Promise<void> {
  const iframe = h('iframe', { title: 'print', 'aria-hidden': 'true', tabindex: '-1' });
  iframe.style.cssText =
    'position:fixed;width:0;height:0;border:0;right:0;bottom:0;visibility:hidden';
  document.body.append(iframe);
  const doc = iframe.contentDocument;
  const win = iframe.contentWindow;
  if (!doc || !win) return iframe.remove();
  // Стандартный режим, как у страницы с редактором: пустой iframe — в режиме совместимости (quirks),
  // где строки и таблицы раскладываются иначе и страницы делились бы не там.
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
