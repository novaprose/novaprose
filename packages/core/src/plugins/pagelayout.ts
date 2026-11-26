import type { Editor } from '../editor';
import { definePlugin } from '../plugins';
import css from './pagelayout.css?raw';

/**
 * Плагин pagelayout: режим страниц. Текст — на листе точного размера с полями, как при печати;
 * границы страниц видны прямо в тексте; печать и экспорт берут те же размеры.
 *
 *   plugins: ['pagelayout'],
 *   pluginOptions: { pagelayout: { size: 'A4', orientation: 'portrait', margins: 20 } }
 *
 * Здесь — вид листа (он нужен с первого кадра: лист, появившийся позже, сдвинул бы весь текст)
 * и настройки с pageLayout(editor). Расчёт границ страниц — ленивая часть pagelayout-ui.ts.
 */

export type PageSizeName = 'A3' | 'A4' | 'A5' | 'A6' | 'Letter' | 'Legal';

export interface PageMargins {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface PageLayoutOptions {
  /** Размер листа: 'A4' (по умолчанию), 'A3', 'A5', 'A6', 'Letter', 'Legal' или { width, height } в мм. */
  size?: PageSizeName | { width: number; height: number };
  /** Ориентация; без неё — книжная для стандартных размеров и как задано для своего размера. */
  orientation?: 'portrait' | 'landscape';
  /** Поля в мм: одно число для всех сторон или по сторонам. По умолчанию 20. */
  margins?: number | Partial<PageMargins>;
}

/** Лист в мм (уже с учётом ориентации) и поля. */
export interface PageLayout {
  size: PageSizeName | 'custom';
  orientation: 'portrait' | 'landscape';
  width: number;
  height: number;
  margins: PageMargins;
}

/** Размеры листов в мм (книжная ориентация). */
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

/** Настройки → лист. Мусор из конфига — умолчания; поле не больше трети листа. */
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
  };
}

export interface PageLayoutController {
  /** Текущий лист (мм). */
  readonly layout: PageLayout;
  /**
   * Сколько страниц в документе. null — пока не посчитано или лист уже страницы (узкий экран:
   * строки переносятся не так, как при печати).
   */
  readonly pages: number | null;
  /** Сменить размер, ориентацию или поля (остальное сохраняется). */
  set(options: PageLayoutOptions): void;
  /** Изменились лист или число страниц. Возвращает отписку. */
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

/** Режим страниц редактора (плагин pagelayout); undefined — плагин не подключён. */
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

/** Для ленивой части: число страниц посчитано. */
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
