import type { Editor } from '../editor';
import { definePlugin } from '../plugins';
import css from './pagelayout.css?raw';

/**
 * The pagelayout plugin: page layout. The text sits on a sheet of the exact size with margins, as
 * when printed; page boundaries show right in the text; printing and export use the same sizes.
 *
 *   plugins: ['pagelayout'],
 *   pluginOptions: { pagelayout: { size: 'A4', orientation: 'portrait', margins: 20 } }
 *
 * This part is the sheet itself (needed from the first frame: a sheet appearing later would shift
 * the whole text) and the settings with pageLayout(editor). Page boundaries are computed in the lazy part, pagelayout-ui.ts.
 */

export type PageSizeName = 'A3' | 'A4' | 'A5' | 'A6' | 'Letter' | 'Legal';

export interface PageMargins {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/** Text in a page margin: one string (centered), or parts at the left, the center and the right. */
export type PageBand = string | { left?: string; center?: string; right?: string };

export interface PageLayoutOptions {
  /** Sheet size: 'A4' (default), 'A3', 'A5', 'A6', 'Letter', 'Legal' or { width, height } in mm. */
  size?: PageSizeName | { width: number; height: number };
  /** Orientation; without it, portrait for standard sizes and as given for your own size. */
  orientation?: 'portrait' | 'landscape';
  /** Margins in mm: one number for all sides, or per side. Default 20. */
  margins?: number | Partial<PageMargins>;
  /**
   * Text in the top margin of every page: one string (centered) or { left, center, right }.
   * `{page}` and `{pages}` become the page number and the number of pages: 'Page {page} of {pages}'.
   */
  header?: PageBand;
  /** Text in the bottom margin of every page, like `header`. */
  footer?: PageBand;
  /** The first page without header and footer (a title page), as "Different first page" in Word. */
  differentFirstPage?: boolean;
}

/** A header or footer: its three parts, '' where there is nothing. */
export interface PageBandParts {
  left: string;
  center: string;
  right: string;
}

/** The sheet in mm (orientation already applied), the margins and the header and footer. */
export interface PageLayout {
  size: PageSizeName | 'custom';
  orientation: 'portrait' | 'landscape';
  width: number;
  height: number;
  margins: PageMargins;
  /** null when there is none. */
  header: PageBandParts | null;
  footer: PageBandParts | null;
  differentFirstPage: boolean;
}

/** Sheet sizes in mm (portrait). */
export const PAGE_SIZES: Readonly<Record<PageSizeName, readonly [number, number]>> = {
  A3: [297, 420],
  A4: [210, 297],
  A5: [148, 210],
  A6: [105, 148],
  Letter: [215.9, 279.4],
  Legal: [215.9, 355.6],
};

const DEFAULT_MARGIN = 20;

function millimetres(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n * 10) / 10)) : fallback;
}

/** One line of plain text, at most 200 characters; anything but a string gives ''. */
function bandText(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, 200) : '';
}

/** A header or footer setting → its parts; null when it has no text. */
export function resolveBand(value: unknown): PageBandParts | null {
  let parts: PageBandParts | null = null;
  if (typeof value === 'string') parts = { left: '', center: bandText(value), right: '' };
  else if (typeof value === 'object' && value !== null) {
    const given = value as Record<string, unknown>;
    parts = {
      left: bandText(given.left),
      center: bandText(given.center),
      right: bandText(given.right),
    };
  }
  return parts && (parts.left || parts.center || parts.right) ? parts : null;
}

/** `{page}` and `{pages}` in a header or footer replaced with numbers (for the screen and for Word previews). */
export function fillBand(text: string, page: number, pages: number): string {
  return text.replace(/\{page\}/g, String(page)).replace(/\{pages\}/g, String(pages));
}

/** Settings → the sheet. Garbage from the config gets the defaults; a margin is at most a third of the sheet. */
export function resolvePageLayout(options: PageLayoutOptions = {}): PageLayout {
  const custom = typeof options.size === 'object' && options.size !== null;
  const name: PageSizeName =
    !custom && typeof options.size === 'string' && options.size in PAGE_SIZES
      ? (options.size as PageSizeName)
      : 'A4';
  const given = options.size as { width?: unknown; height?: unknown } | undefined;
  let [width, height] = custom
    ? [millimetres(given?.width, 30, 2000, 210), millimetres(given?.height, 30, 2000, 297)]
    : PAGE_SIZES[name];
  if (options.orientation === 'landscape' || options.orientation === 'portrait') {
    const landscape = options.orientation === 'landscape';
    const wide = width > height;
    if (landscape !== wide) [width, height] = [height, width];
  }
  const limit = Math.min(width, height) / 3;
  const raw = options.margins;
  const side = (key: keyof PageMargins) =>
    millimetres(
      typeof raw === 'object' && raw !== null ? raw[key] : raw,
      0,
      limit,
      Math.min(DEFAULT_MARGIN, limit),
    );
  return {
    size: custom ? 'custom' : name,
    orientation: width > height ? 'landscape' : 'portrait',
    width,
    height,
    margins: { top: side('top'), right: side('right'), bottom: side('bottom'), left: side('left') },
    header: resolveBand(options.header),
    footer: resolveBand(options.footer),
    differentFirstPage: options.differentFirstPage === true,
  };
}

export interface PageLayoutController {
  /** The current sheet (mm). */
  readonly layout: PageLayout;
  /**
   * How many pages the document has. null — not counted yet, or the sheet is narrower than the page
   * (a narrow screen: lines wrap differently than in print).
   */
  readonly pages: number | null;
  /** Change the size, orientation or margins (the rest stays). */
  set(options: PageLayoutOptions): void;
  /** The sheet or the page count changed. Returns an unsubscribe function. */
  onChange(listener: () => void): () => void;
}

interface State {
  options: PageLayoutOptions;
  layout: PageLayout;
  pages: number | null;
  listeners: Set<() => void>;
}

const states = new WeakMap<Editor, State>();

function notify(state: State): void {
  for (const listener of [...state.listeners]) {
    try {
      listener();
    } catch (error) {
      console.error('[nova] pagelayout: listener failed', error);
    }
  }
}

function applyLayout(editor: Editor, layout: PageLayout): void {
  const { style } = editor.root;
  const { top, right, bottom, left } = layout.margins;
  style.setProperty('--nova-page-width', `${layout.width}mm`);
  style.setProperty('--nova-page-height', `${layout.height}mm`);
  style.setProperty('--nova-page-margins', `${top}mm ${right}mm ${bottom}mm ${left}mm`);
}

/** The editor's page layout (the pagelayout plugin); undefined when the plugin isn't active. */
export function pageLayout(editor: Editor): PageLayoutController | undefined {
  const state = states.get(editor);
  if (!state) return undefined;
  return {
    get layout() {
      return state.layout;
    },
    get pages() {
      return state.pages;
    },
    set(options) {
      state.options = { ...state.options, ...options };
      state.layout = resolvePageLayout(state.options);
      applyLayout(editor, state.layout);
      notify(state);
    },
    onChange(listener) {
      state.listeners.add(listener);
      return () => state.listeners.delete(listener);
    },
  };
}

/** For the lazy part: the number of pages has been computed. */
export function setPageCount(editor: Editor, pages: number | null): void {
  const state = states.get(editor);
  if (!state || state.pages === pages) return;
  state.pages = pages;
  notify(state);
}

export default definePlugin({
  name: 'pagelayout',
  setup(editor) {
    const options = (editor.options.pluginOptions?.pagelayout ?? {}) as PageLayoutOptions;
    const layout = resolvePageLayout(options);
    states.set(editor, { options, layout, pages: null, listeners: new Set() });
    editor.ui.addStyles('nova-pagelayout', css);
    editor.root.classList.add('nova-pages');
    applyLayout(editor, layout);
    return () => {
      states.delete(editor);
      editor.root.classList.remove('nova-pages');
    };
  },
  load: () => import('./pagelayout-ui'),
});
