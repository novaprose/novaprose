import { Plugin, PluginKey } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';
import type { Editor } from '../editor';
import { formatShortcut, h, icon, uniqueId } from './dom';
import { positionFloating } from './popover';

export interface AutocompleterItem {
  value: string;
  label: string;
  icon?: string;
  /** A hint on the right: a shortcut in 'Mod-b' format. */
  shortcut?: string;
  /** A hint on the right as plain text (a job title, an e-mail). */
  detail?: string;
}

export interface AutocompleterSpec {
  /** The trigger character: '/', '@', ':'. */
  trigger: string;
  /** How many characters after the trigger before the list shows (0 by default). */
  minChars?: number;
  /** Items for a query; may return a Promise (a search on the server). */
  fetch: (query: string, editor: Editor) => AutocompleterItem[] | Promise<AutocompleterItem[]>;
  /** An item was chosen. range — the positions of "trigger + query", usually deleted. */
  onSelect: (item: AutocompleterItem, range: { from: number; to: number }, editor: Editor) => void;
  /** Label of the list for screen readers. */
  label: string;
  /** Text when nothing is found (otherwise the list hides). */
  emptyText?: string;
  maxResults?: number;
}

interface Match {
  name: string;
  spec: AutocompleterSpec;
  from: number;
  to: number;
  query: string;
}

const MAX_QUERY = 30;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Looks for "trigger + query" right before the cursor: at the start of a block or after a space. */
function findMatch(view: EditorView, editor: Editor): Match | null {
  const { selection } = view.state;
  if (!selection.empty) return null;
  const $pos = selection.$from;
  if (!$pos.parent.isTextblock || $pos.parent.type.spec.code) return null;
  const before = $pos.parent.textBetween(
    Math.max(0, $pos.parentOffset - MAX_QUERY - 1),
    $pos.parentOffset,
    '\0',
    '\0',
  );
  for (const [name, spec] of editor.ui.registry.getAutocompleters()) {
    const re = new RegExp(`(?:^|\\s)${escapeRegExp(spec.trigger)}([\\p{L}\\p{N}_-]*)$`, 'u');
    const m = before.match(re);
    if (!m) continue;
    const query = m[1] ?? '';
    if (query.length < (spec.minChars ?? 0)) continue;
    // The trigger at the start of the requested piece could be in the middle of a word we can't see.
    const start = $pos.parentOffset - query.length - spec.trigger.length;
    const prevChar = start > 0 ? $pos.parent.textBetween(start - 1, start, '\0', '\0') : '';
    if (prevChar && !/\s/.test(prevChar)) continue;
    return { name, spec, from: $pos.pos - query.length - spec.trigger.length, to: $pos.pos, query };
  }
  return null;
}

/**
 * The autocompleters plugin (slash commands, mentions, emoji).
 * Focus stays in the text; the list is linked to the editor through aria-activedescendant (the combobox pattern).
 */
export function autocompleterPlugin(editor: Editor): Plugin {
  let list: HTMLDivElement;
  let items: AutocompleterItem[] = [];
  let active = 0;
  let match: Match | null = null;
  /** The position of a trigger the user pressed Escape for: it isn't opened again. */
  let dismissedAt: number | null = null;
  let requestId = 0;
  const listId = uniqueId('nova-ac');

  const isOpen = () => !list.hidden;

  const close = (view: EditorView) => {
    list.hidden = true;
    match = null;
    items = [];
    view.dom.removeAttribute('aria-activedescendant');
    view.dom.removeAttribute('aria-controls');
    // aria-expanded isn't allowed on role=textbox (axe: aria-allowed-attr): the list is linked through
    // aria-controls and aria-activedescendant, which is enough for screen readers.
    view.dom.removeAttribute('aria-expanded');
  };

  const select = (view: EditorView, index: number) => {
    const item = items[index];
    if (!item || !match) return;
    const { spec, from, to } = match;
    close(view);
    spec.onSelect(item, { from, to }, editor);
  };

  const renderItems = (view: EditorView) => {
    if (!match) return;
    const { spec } = match;
    list.replaceChildren();
    list.setAttribute('aria-label', spec.label);
    if (!items.length) {
      if (!spec.emptyText) return close(view);
      list.append(h('div', { className: 'nova-ac-empty' }, spec.emptyText));
    }
    items.forEach((item, index) => {
      const option = h(
        'div',
        {
          id: `${listId}-${index}`,
          className: 'nova-menu-item nova-ac-item',
          role: 'option',
          'aria-selected': String(index === active),
        },
        item.icon ? icon(item.icon, editor.ui.registry) : null,
        h('span', { className: 'nova-menu-label' }, item.label),
        item.shortcut
          ? h('kbd', { className: 'nova-menu-shortcut' }, formatShortcut(item.shortcut))
          : item.detail
            ? h('span', { className: 'nova-menu-shortcut' }, item.detail)
            : null,
      );
      // mousedown, not click: otherwise the editor loses focus and the selection before the choice.
      option.addEventListener('mousedown', (event) => {
        event.preventDefault();
        select(view, index);
      });
      option.addEventListener('mousemove', () => {
        if (active !== index) setActive(view, index);
      });
      list.append(option);
    });
    list.hidden = false;
    view.dom.setAttribute('aria-controls', listId);
    setActive(view, Math.min(active, Math.max(0, items.length - 1)));
    const coords = view.coordsAtPos(match.from);
    positionFloating(
      list,
      new DOMRect(coords.left, coords.top, 1, coords.bottom - coords.top),
      'bottom-start',
    );
  };

  const setActive = (view: EditorView, index: number) => {
    active = index;
    list
      .querySelectorAll('[role="option"]')
      .forEach((el, i) => el.setAttribute('aria-selected', String(i === index)));
    const current = list.querySelector<HTMLElement>(`#${listId}-${index}`);
    if (current) {
      view.dom.setAttribute('aria-activedescendant', current.id);
      current.scrollIntoView?.({ block: 'nearest' });
    }
  };

  const refresh = (view: EditorView) => {
    const next = editor.isEditable() && view.hasFocus() ? findMatch(view, editor) : null;
    if (!next || next.from === dismissedAt) {
      if (!next) dismissedAt = null;
      if (isOpen() || match) close(view);
      return;
    }
    const changed = !match || match.query !== next.query || match.from !== next.from;
    match = next;
    if (!changed && isOpen()) return renderItems(view);
    const id = ++requestId;
    void Promise.resolve(next.spec.fetch(next.query, editor)).then((result) => {
      // The answer is outdated: the user has kept typing.
      if (id !== requestId || !match) return;
      items = result.slice(0, next.spec.maxResults ?? 10);
      active = 0;
      renderItems(view);
    });
  };

  return new Plugin({
    key: new PluginKey('nova-autocompleter'),
    view(view) {
      list = h('div', {
        className: 'nova-popover nova-ac',
        id: listId,
        role: 'listbox',
        hidden: true,
      });
      editor.ui.overlayHost.append(list);
      view.dom.setAttribute('aria-autocomplete', 'list');
      const onBlur = () => close(view);
      view.dom.addEventListener('blur', onBlur);
      return {
        update: (v) => refresh(v),
        destroy() {
          view.dom.removeEventListener('blur', onBlur);
          list.remove();
        },
      };
    },
    props: {
      handleKeyDown(view, event) {
        if (!isOpen() || !match) return false;
        const count = items.length;
        switch (event.key) {
          case 'ArrowDown':
            if (count) setActive(view, (active + 1) % count);
            return true;
          case 'ArrowUp':
            if (count) setActive(view, (active - 1 + count) % count);
            return true;
          case 'Enter':
          case 'Tab':
            if (!count) return false;
            select(view, active);
            return true;
          case 'Escape':
            dismissedAt = match.from;
            close(view);
            return true;
          default:
            return false;
        }
      },
    },
  });
}
