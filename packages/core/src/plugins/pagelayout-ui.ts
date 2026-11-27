import { Plugin, PluginKey } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';
import type { Editor } from '../editor';
import { definePlugin } from '../plugins';
import { h } from '../ui/dom';
import {
  fillBand,
  pageLayout,
  setPageCount,
  type PageBandParts,
  type PageLayout,
} from './pagelayout';
import css from './pagelayout-ui.css?raw';
import { pickLabels } from './shared';

/**
 * The lazy part of page mode: where each page ends. Text lines, images and table rows
 * are measured in the editor itself (the sheet has the same width as the printed page), then
 * laid out into pages the way printing will do it (orphans/widows: 1, table rows and
 * images aren't split, a page break starts a new page). The lines are drawn on top of the sheet,
 * outside ProseMirror's DOM, so they don't interfere with typing.
 */

export const LABELS = { en: { page: 'Page {page}' } };

/** CSS pixels per millimetre (96 dpi: both the screen and browser printing count this way). */
export const PX_PER_MM = 96 / 25.4;

export interface Line {
  top: number;
  bottom: number;
  /** A page break: the next line starts a new page. */
  forced?: boolean;
  /** At a break: the top margin of the next block (it is kept after a forced break). */
  offset?: number;
}

/** Kept whole on one page: images, table rows, input fields of node views. */
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

/** Rectangles of content lines in sheet coordinates (from its top edge). */
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
          // An empty paragraph: no text line, but it takes up space.
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

/** Lines that share one line (text in different fonts, an inline image) count as one line. */
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
  /** Where the text of the new page starts (for the layout). */
  at: number;
  /** Where to draw the border: between lines or at the page break itself. */
  mark: number;
}

/**
 * Where pages start from the second one on (in sheet coordinates). `start` is the top of the text area of the first
 * page, `height` is the height of a page's text area.
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
    // Images finish loading, fonts get swapped: lines shift.
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
    // The sheet is narrower than the page (a narrow screen): lines wrap differently from print.
    if (!width || Math.abs(width - layout.width * PX_PER_MM) > 1.5)
      return this.render(null, layout);
    const start = parseFloat(getComputedStyle(dom).paddingTop) || 0;
    const height = (layout.height - layout.margins.top - layout.margins.bottom) * PX_PER_MM;
    this.render(paginate(collectLines(dom), start, height), layout);
  }

  private render(breaks: PageBreak[] | null, layout: PageLayout): void {
    const dom = this.view.dom;
    const { root } = this.editor;
    const signature = breaks
      ? `${breaks.map((b) => b.mark.toFixed(1)).join(',')}|${JSON.stringify([layout.header, layout.footer, layout.differentFirstPage, layout.margins])}`
      : 'none';
    this.overlay.style.cssText = `top:${dom.offsetTop}px;left:${dom.offsetLeft}px;width:${dom.offsetWidth}px`;
    if (signature !== this.signature) {
      this.signature = signature;
      // The last page runs to the end, like a sheet of paper: from its start, the text and the bottom margin.
      const last = breaks?.[breaks.length - 1]?.at;
      if (last !== undefined) {
        const rest = (layout.height - layout.margins.top) * PX_PER_MM;
        root.style.setProperty('--nova-pages-height', `${last + rest}px`);
      } else root.style.removeProperty('--nova-pages-height');
      this.overlay.replaceChildren(
        ...(breaks ?? []).map((pageBreak, index) =>
          h(
            'div',
            { className: 'nova-page-break', style: `top:${pageBreak.mark}px` },
            h('span', {}, this.editor.ui.t('pagelayout.page', { page: index + 2 })),
          ),
        ),
        ...(breaks ? this.bands(layout, breaks.length + 1, dom.offsetHeight) : []),
      );
    }
    setPageCount(this.editor, breaks ? breaks.length + 1 : null);
  }

  /**
   * The header in the top margin of the first page and the footer in the bottom margin of the last one, with
   * their page numbers: a preview of what prints on every page. The sheet here is one long page, so there is
   * no margin between pages to draw them in.
   */
  private bands(layout: PageLayout, pages: number, sheetHeight: number): HTMLElement[] {
    const { margins } = layout;
    const band = (parts: PageBandParts, page: number, top: number, className: string) =>
      h(
        'div',
        {
          className: `nova-page-band ${className}`,
          style: `top:${top}px;padding:0 ${margins.right}mm 0 ${margins.left}mm`,
        },
        ...(['left', 'center', 'right'] as const).map((side) =>
          h('span', {}, fillBand(parts[side], page, pages)),
        ),
      );
    const result: HTMLElement[] = [];
    if (layout.header && !layout.differentFirstPage)
      result.push(band(layout.header, 1, (margins.top * PX_PER_MM) / 2, 'nova-page-header'));
    if (layout.footer && !(layout.differentFirstPage && pages === 1))
      result.push(
        band(
          layout.footer,
          pages,
          sheetHeight - (margins.bottom * PX_PER_MM) / 2,
          'nova-page-footer',
        ),
      );
    return result;
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
