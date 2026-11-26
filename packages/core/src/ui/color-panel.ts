import { activeElement, h, icon, logicalKey } from './dom';
import { icons } from './icons';

/** The default palette: 8 hues × (dark, base, light) plus a gray scale. */
export const defaultColors: string[] = [
  '#000000',
  '#434343',
  '#666666',
  '#999999',
  '#b7b7b7',
  '#d9d9d9',
  '#efefef',
  '#ffffff',
  '#b91c1c',
  '#c2410c',
  '#a16207',
  '#15803d',
  '#0e7490',
  '#1d4ed8',
  '#6d28d9',
  '#be185d',
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#06b6d4',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
  '#fecaca',
  '#fed7aa',
  '#fef08a',
  '#bbf7d0',
  '#a5f3fc',
  '#bfdbfe',
  '#ddd6fe',
  '#fbcfe8',
];

export interface ColorPanelOptions {
  colors: string[];
  current: string | null;
  label: string;
  removeLabel: string;
  customLabel: string;
  onPick: (color: string | null) => void;
}

/** The color palette: a grid of swatches (arrows across the grid), "remove color" and a custom color. */
export function createColorPanel(options: ColorPanelOptions): HTMLElement {
  const COLUMNS = 8;
  const swatches: HTMLButtonElement[] = [];
  const current = options.current?.toLowerCase() ?? null;

  const grid = h('div', { className: 'nova-swatches', role: 'grid', 'aria-label': options.label });
  // role=grid requires rows (role=row): otherwise a screen reader can't name the row and column.
  // A row is display: contents; the .nova-swatches CSS grid still sets the layout.
  let row: HTMLElement | null = null;
  for (const color of options.colors) {
    const selected = current === color.toLowerCase();
    const swatch = h(
      'button',
      {
        type: 'button',
        className: 'nova-swatch',
        role: 'gridcell',
        'aria-label': color,
        'aria-selected': String(selected),
        title: color,
        tabindex: '-1',
      },
      selected ? icon(icons.check) : null,
    );
    swatch.style.setProperty('--swatch', color);
    swatch.addEventListener('click', () => options.onPick(color));
    swatches.push(swatch);
    if (!row || row.childElementCount === COLUMNS) {
      row = h('div', { className: 'nova-swatch-row', role: 'row' });
      grid.append(row);
    }
    row.append(swatch);
  }
  (swatches.find((s) => s.getAttribute('aria-selected') === 'true') ?? swatches[0])?.setAttribute(
    'tabindex',
    '0',
  );

  grid.addEventListener('keydown', (event) => {
    const index = swatches.indexOf(activeElement(grid) as HTMLButtonElement);
    if (index < 0) return;
    const delta: Record<string, number> = {
      ArrowRight: 1,
      ArrowLeft: -1,
      ArrowDown: COLUMNS,
      ArrowUp: -COLUMNS,
    };
    const step = delta[logicalKey(event, grid)];
    if (step === undefined) return;
    event.preventDefault();
    const next = swatches[Math.min(swatches.length - 1, Math.max(0, index + step))]!;
    swatches[index]!.tabIndex = -1;
    next.tabIndex = 0;
    next.focus();
  });

  const remove = h(
    'button',
    { type: 'button', className: 'nova-panel-action' },
    icon(icons.clearFormatting),
    options.removeLabel,
  );
  remove.addEventListener('click', () => options.onPick(null));

  const custom = h('input', {
    type: 'color',
    className: 'nova-color-input',
    'aria-label': options.customLabel,
    value: /^#[0-9a-f]{6}$/i.test(current ?? '') ? current : '#000000',
  });
  // change (not input), so dragging the slider doesn't create a pile of history steps.
  custom.addEventListener('change', () => options.onPick(custom.value));

  return h(
    'div',
    { className: 'nova-color-panel' },
    grid,
    h(
      'div',
      { className: 'nova-panel-footer' },
      remove,
      h('label', { className: 'nova-panel-action' }, custom, options.customLabel),
    ),
  );
}
