import { Plugin, PluginKey } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';
import type { Editor } from '../editor';
import { definePlugin } from '../plugins';
import { h } from '../ui/dom';
import { pageLayout, setPageCount, type PageLayout } from './pagelayout';
import css from './pagelayout-ui.css?raw';
import { pickLabels } from './shared';

/**
 * Ленивая часть режима страниц: где кончается каждая страница. Строки текста, картинки и строки
 * таблиц меряются в самом редакторе (лист той же ширины, что и страница при печати), затем
 * раскладываются по страницам так же, как это сделает печать (orphans/widows: 1, строки таблиц и
 * картинки не делятся, разрыв страницы — с новой страницы). Линии рисуются поверх листа —
 * вне DOM ProseMirror, поэтому не мешают вводу.
 */

export const LABELS = { en: { page: 'Page {page}' } };

/** CSS-пикселей в миллиметре (96 dpi — так считают и экран, и печать браузера). */
export const PX_PER_MM = 96 / 25.4;

export interface Line {
  top: number;
  bottom: number;
  /** Разрыв страницы: следующая строка — с новой страницы. */
  forced?: boolean;
  /** У разрыва: верхнее поле следующего блока (после принудительного разрыва оно сохраняется). */
  offset?: number;
}

/** Целиком на одной странице: картинки, строки таблиц, поля ввода видов узлов. */
const ATOMIC = new Set([
  'IMG',
  'VIDEO',
  'IFRAME',
  'CANVAS',
  'HR',
  'TR',
  'INPUT',
  'SELECT',
  'TEXTAREA',
  'BUTTON',
]);

/** Прямоугольники строк содержимого в координатах листа (от его верхнего края). */
export function collectLines(root: HTMLElement): Line[] {
  const top = root.getBoundingClientRect().top;
  const lines: Line[] = [];
  const range = root.ownerDocument.createRange();
  const push = (rect: DOMRect) => {
    if (rect.height > 0) lines.push({ top: rect.top - top, bottom: rect.bottom - top });
  };
  const walk = (node: Node) => {
    for (let child = node.firstChild; child; child = child.nextSibling) {
      if (child.nodeType === 3) {
        range.selectNodeContents(child);
        for (const rect of range.getClientRects()) push(rect);
      } else if (child instanceof Element) {
        if (child.classList.contains('nova-pagebreak')) {
          const next = child.nextElementSibling;
          const margin = next ? parseFloat(getComputedStyle(next).marginTop) || 0 : 0;
          const bottom = child.getBoundingClientRect().bottom - top;
          lines.push({ top: bottom, bottom, forced: true, offset: margin });
        } else if (ATOMIC.has(child.tagName) || child.localName === 'svg') {
          push(child.getBoundingClientRect());
        } else if (child.childNodes.length === 1 && child.firstChild?.nodeName === 'BR') {
          // Пустой абзац: строки текста нет, но место он занимает.
          push(child.getBoundingClientRect());
        } else {
          walk(child);
        }
      }
    }
  };
  walk(root);
  return lines;
}

/** Строки, которые делят одну линию (текст разными шрифтами, картинка в строке), — одна строка. */
function mergeLines(lines: Line[]): Line[] {
  const merged: Line[] = [];
  for (const line of [...lines].sort((a, b) => a.top - b.top || a.bottom - b.bottom)) {
    const last = merged[merged.length - 1];
    if (last && !last.forced && !line.forced && line.top < last.bottom - 1)
      last.bottom = Math.max(last.bottom, line.bottom);
    else merged.push({ ...line });
  }
  return merged;
}

export interface PageBreak {
  /** Где начинается текст новой страницы (для раскладки). */
  at: number;
  /** Где рисовать границу: между строками или на самом разрыве страницы. */
  mark: number;
}

/**
 * Где начинаются страницы со второй (в координатах листа). `start` — верх области текста первой
 * страницы, `height` — высота области текста страницы.
 */
export function paginate(lines: Line[], start: number, height: number): PageBreak[] {
  const breaks: PageBreak[] = [];
  let pageTop = start;
  let previous = start;
  let forced: Line | null = null;
  for (const line of mergeLines(lines)) {
    if (line.forced) {
      forced = line;
      continue;
    }
    if (forced) {
      const at = line.top - (forced.offset ?? 0);
      const mark = forced.top;
      forced = null;
      if (at > pageTop + 0.5) {
        breaks.push({ at, mark });
        pageTop = at;
        previous = line.bottom;
        continue;
      }
    }
    if (line.bottom - pageTop > height + 0.5 && line.top > pageTop + 0.5) {
      breaks.push({ at: line.top, mark: (previous + line.top) / 2 });
      pageTop = line.top;
    }
    previous = line.bottom;
  }
  return breaks;
}

class PageBreaks {
  private readonly overlay: HTMLElement;
  private readonly observer: ResizeObserver | null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private frame = 0;
  private destroyed = false;
  private signature = '';

  constructor(
    private readonly editor: Editor,
    private readonly view: EditorView,
  ) {
    this.overlay = h('div', { className: 'nova-page-breaks', 'aria-hidden': 'true' });
    view.dom.after(this.overlay);
    this.observer =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => this.schedule());
    this.observer?.observe(view.dom);
    if (view.dom.parentElement) this.observer?.observe(view.dom.parentElement);
    // Картинки догружаются, шрифты подменяются — строки сдвигаются.
    view.dom.addEventListener('load', this.schedule, true);
    view.dom.ownerDocument.fonts?.ready.then(this.schedule, () => {});
    this.schedule();
  }

  update(view: EditorView, prev: { doc: unknown }): void {
    if (view.state.doc !== prev.doc) this.schedule();
  }

  readonly schedule = (): void => {
    if (this.timer || this.destroyed) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.frame = requestAnimationFrame(() => this.measure());
    }, 60);
  };

  private measure(): void {
    const layout = pageLayout(this.editor)?.layout;
    const dom = this.view.dom;
    if (!layout || this.destroyed) return;
    const width = dom.getBoundingClientRect().width;
    // Лист уже страницы (узкий экран): строки переносятся не так, как при печати.
    if (!width || Math.abs(width - layout.width * PX_PER_MM) > 1.5)
      return this.render(null, layout);
    const start = parseFloat(getComputedStyle(dom).paddingTop) || 0;
    const height = (layout.height - layout.margins.top - layout.margins.bottom) * PX_PER_MM;
    this.render(paginate(collectLines(dom), start, height), layout);
  }

  private render(breaks: PageBreak[] | null, layout: PageLayout): void {
    const dom = this.view.dom;
    const { root } = this.editor;
    const signature = breaks ? breaks.map((b) => b.mark.toFixed(1)).join(',') : 'none';
    this.overlay.style.cssText = `top:${dom.offsetTop}px;left:${dom.offsetLeft}px;width:${dom.offsetWidth}px`;
    if (signature !== this.signature) {
      this.signature = signature;
      this.overlay.replaceChildren(
        ...(breaks ?? []).map((pageBreak, index) =>
          h(
            'div',
            { className: 'nova-page-break', style: `top:${pageBreak.mark}px` },
            h('span', {}, this.editor.ui.t('pagelayout.page', { page: index + 2 })),
          ),
        ),
      );
      // Последняя страница — до конца, как лист бумаги: от её начала — текст и нижнее поле.
      const last = breaks?.[breaks.length - 1]?.at;
      if (last !== undefined) {
        const rest = (layout.height - layout.margins.top) * PX_PER_MM;
        root.style.setProperty('--nova-pages-height', `${last + rest}px`);
      } else root.style.removeProperty('--nova-pages-height');
    }
    setPageCount(this.editor, breaks ? breaks.length + 1 : null);
  }

  destroy(): void {
    this.destroyed = true;
    if (this.timer) clearTimeout(this.timer);
    cancelAnimationFrame(this.frame);
    this.observer?.disconnect();
    this.view.dom.removeEventListener('load', this.schedule, true);
    this.overlay.remove();
    this.editor.root.style.removeProperty('--nova-pages-height');
  }
}

export default definePlugin({
  name: 'pagelayout-ui',
  prosemirrorPlugins: (editor) => [
    new Plugin({
      key: new PluginKey('nova-pagelayout'),
      view: (view) => new PageBreaks(editor, view),
    }),
  ],
  setup(editor) {
    editor.ui.addStyles('nova-pagelayout-ui', css);
    pickLabels(editor, 'pagelayout', LABELS);
  },
});
