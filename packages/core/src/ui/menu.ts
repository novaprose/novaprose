import { activeElement, formatShortcut, h, icon } from './dom';
import { icons } from './icons';

export interface MenuItem {
  type?: 'item';
  id: string;
  label: string;
  icon?: string;
  shortcut?: string;
  /** Checked (radio/checkbox): a check mark is shown. */
  active?: boolean;
  /** An independent toggle (bold, superscript): menuitemcheckbox rather than radio. */
  checkbox?: boolean;
  disabled?: boolean;
  /** Style of the label, to preview fonts and headings right in the menu. */
  labelStyle?: string;
  onSelect: () => void;
}

export interface MenuSeparator {
  type: 'separator';
}

/** A heading of a group of items (not clickable). */
export interface MenuHeading {
  type: 'heading';
  label: string;
}

export type MenuEntry = MenuItem | MenuSeparator | MenuHeading;

/**
 * A menu with keyboard navigation per WAI-ARIA: arrows, Home/End, Enter/Space,
 * search by the first letter. The parent Popover handles Escape.
 */
export function createMenu(entries: MenuEntry[], onDone: () => void, label: string): HTMLElement {
  const items: HTMLButtonElement[] = [];
  const menu = h('div', { className: 'nova-menu', role: 'menu', 'aria-label': label });
  const hasChecks = entries.some(
    (e) => (e.type === undefined || e.type === 'item') && e.active !== undefined,
  );

  for (const entry of entries) {
    if (entry.type === 'separator') {
      menu.append(h('div', { className: 'nova-menu-sep', role: 'separator' }));
      continue;
    }
    if (entry.type === 'heading') {
      menu.append(h('div', { className: 'nova-menu-heading', role: 'presentation' }, entry.label));
      continue;
    }
    const labelEl = h('span', { className: 'nova-menu-label' }, entry.label);
    if (entry.labelStyle) labelEl.setAttribute('style', entry.labelStyle);
    const button = h(
      'button',
      {
        type: 'button',
        className: 'nova-menu-item',
        role:
          entry.active === undefined
            ? 'menuitem'
            : entry.checkbox
              ? 'menuitemcheckbox'
              : 'menuitemradio',
        tabindex: '-1',
        'data-id': entry.id,
        disabled: entry.disabled ?? false,
        ...(entry.active !== undefined ? { 'aria-checked': String(entry.active) } : {}),
      },
      hasChecks
        ? h('span', { className: 'nova-menu-check' }, entry.active ? icon(icons.check) : null)
        : null,
      entry.icon ? icon(entry.icon) : null,
      labelEl,
      entry.shortcut
        ? h('kbd', { className: 'nova-menu-shortcut' }, formatShortcut(entry.shortcut))
        : null,
    );
    button.addEventListener('click', () => {
      onDone();
      entry.onSelect();
    });
    items.push(button);
    menu.append(button);
  }

  const enabled = () => items.filter((b) => !b.disabled);
  const focusAt = (index: number) => {
    const list = enabled();
    if (!list.length) return;
    list[(index + list.length) % list.length]!.focus();
  };

  menu.addEventListener('keydown', (event) => {
    const list = enabled();
    const current = list.indexOf(activeElement(menu) as HTMLButtonElement);
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        focusAt(current + 1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        focusAt(current - 1);
        break;
      case 'Home':
        event.preventDefault();
        focusAt(0);
        break;
      case 'End':
        event.preventDefault();
        focusAt(list.length - 1);
        break;
      case 'Tab':
        event.preventDefault();
        break;
      default:
        if (event.key.length === 1 && /\S/.test(event.key)) {
          const char = event.key.toLowerCase();
          const start = current + 1;
          const ordered = [...list.slice(start), ...list.slice(0, start)];
          ordered.find((b) => b.textContent?.trim().toLowerCase().startsWith(char))?.focus();
        }
    }
  });

  return menu;
}

/** Focuses the checked item or the first available one. */
export function focusMenu(menu: HTMLElement): void {
  const target =
    menu.querySelector<HTMLButtonElement>('[aria-checked="true"]:not(:disabled)') ??
    menu.querySelector<HTMLButtonElement>('.nova-menu-item:not(:disabled)');
  target?.focus();
}
