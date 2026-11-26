import type { Editor } from '../editor';
import { activeElement, h, logicalKey } from '../ui/dom';
import { registerPluginMessages, type PluginLabels } from '../i18n';

/**
 * Labels of a built-in plugin. Plugins load lazily, so the strings live in the plugin itself
 * (en is the reference; translations live in the language packs), but they go through the shared i18n system under the keys
 * `<plugin>.<key>`: registerLanguage('de', { 'anchor.title': … }) and the `translations` option see them.
 */
export function pickLabels<T extends PluginLabels>(
  editor: Editor,
  namespace: string,
  dict: { en: T } & Record<string, PluginLabels | undefined>,
): T {
  registerPluginMessages(namespace, dict);
  const out: Record<string, string | string[]> = {};
  for (const [key, value] of Object.entries(dict.en)) {
    out[key] =
      typeof value === 'string'
        ? editor.ui.t(`${namespace}.${key}`)
        : value.map((_, i) => editor.ui.t(`${namespace}.${key}.${i}`));
  }
  return out as T;
}

export function insertText(editor: Editor, text: string): void {
  const { state, dispatch } = editor.view;
  dispatch(state.tr.insertText(text).scrollIntoView());
  editor.focus();
}

export interface SymbolGroup {
  title: string;
  /** [character, name for search and screen readers] */
  items: readonly (readonly [string, string])[];
}

/**
 * A character picker panel: search + a grid of buttons by group. Arrows move focus across the grid,
 * Enter/space inserts, Esc closes the panel (the shared popover stack).
 */
export function symbolPanel(options: {
  groups: SymbolGroup[];
  searchLabel: string;
  emptyText: string;
  className: string;
  onPick: (symbol: string) => void;
}): HTMLElement {
  const search = h('input', {
    type: 'search',
    className: 'nova-input nova-symbols-search',
    placeholder: options.searchLabel,
    'aria-label': options.searchLabel,
  }) as HTMLInputElement;
  const list = h('div', { className: 'nova-symbols-list' });
  const panel = h('div', { className: `nova-symbols ${options.className}` }, search, list);

  const render = (query: string) => {
    const q = query.trim().toLowerCase();
    const sections = options.groups
      .map((group) => ({
        title: group.title,
        items: q ? group.items.filter(([s, name]) => name.includes(q) || s === q) : group.items,
      }))
      .filter((g) => g.items.length);
    if (!sections.length) {
      list.replaceChildren(h('div', { className: 'nova-symbols-empty' }, options.emptyText));
      return;
    }
    list.replaceChildren(
      ...sections.map((section) =>
        h(
          'div',
          { className: 'nova-symbols-group', role: 'group', 'aria-label': section.title },
          h('div', { className: 'nova-symbols-title' }, section.title),
          h(
            'div',
            { className: 'nova-symbols-grid' },
            ...section.items.map(([symbol, name]) =>
              h(
                'button',
                {
                  type: 'button',
                  className: 'nova-symbols-cell',
                  title: name,
                  'aria-label': name,
                  onclick: () => options.onPick(symbol),
                },
                symbol,
              ),
            ),
          ),
        ),
      ),
    );
  };

  search.addEventListener('input', () => render(search.value));
  search.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      list.querySelector<HTMLButtonElement>('.nova-symbols-cell')?.focus();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      list.querySelector<HTMLButtonElement>('.nova-symbols-cell')?.click();
    }
  });
  list.addEventListener('keydown', (event) => {
    const cells = [...list.querySelectorAll<HTMLButtonElement>('.nova-symbols-cell')];
    const index = cells.indexOf(activeElement(list) as HTMLButtonElement);
    if (index < 0) return;
    // The width of a grid row comes from the actual position of the buttons.
    const perRow = Math.max(1, cells.filter((c) => c.offsetTop === cells[0]!.offsetTop).length);
    const step: Record<string, number> = {
      ArrowRight: 1,
      ArrowLeft: -1,
      ArrowDown: perRow,
      ArrowUp: -perRow,
    };
    const key = logicalKey(event, list);
    if (!(key in step)) return;
    event.preventDefault();
    const next = index + step[key]!;
    if (next < 0) search.focus();
    else cells[Math.min(cells.length - 1, next)]?.focus();
  });

  render('');
  queueMicrotask(() => search.focus());
  return panel;
}

/** Opens the character panel in a dialog (for a menu item when the button isn't on the toolbar). */
export function openSymbolDialog(
  editor: Editor,
  title: string,
  build: (close: () => void) => HTMLElement,
): void {
  let handle: { close(): void } | null = null;
  const body = build(() => handle?.close());
  handle = editor.ui.openDialog({ title, body, cancelLabel: editor.ui.t('dialog.close') });
}
