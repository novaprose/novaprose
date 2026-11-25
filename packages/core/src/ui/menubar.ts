import type { Editor } from '../editor';
import type { MessageKey } from '../i18n';
import { h } from './dom';
import { createMenu, focusMenu, type MenuEntry } from './menu';
import type { Popover } from './popover';

export interface MenuDefinition {
  /** Заголовок меню (строка) или ключ перевода. */
  title: string;
  /** Пункты через пробел, '|' — разделитель: 'undo redo | searchreplace'. */
  items: string;
}

/** Стандартные меню. Имена пунктов — из реестра пунктов меню или кнопок тулбара. */
export const DEFAULT_MENUS: Record<string, MenuDefinition> = {
  file: { title: 'menu.file', items: 'preview | print' },
  edit: { title: 'menu.edit', items: 'undo redo | selectall | searchreplace pastetext' },
  view: { title: 'menu.view', items: 'code preview | fullscreen' },
  insert: { title: 'menu.insert', items: 'image link inserttable hr | insertdatetime' },
  format: {
    title: 'menu.format',
    items:
      'bold italic underline strikethrough superscript subscript inlinecode | ' +
      'paragraph h1 h2 h3 blockquote codeblock | alignleft aligncenter alignright alignjustify | removeformat',
  },
  table: {
    title: 'menu.table',
    items:
      'inserttable | tableinsertrowbefore tableinsertrowafter tabledeleterow | ' +
      'tableinsertcolbefore tableinsertcolafter tabledeletecol | tablemergecells tablesplitcells | tabledelete',
  },
  help: { title: 'menu.help', items: 'help' },
};

export const DEFAULT_MENUBAR = 'file edit view insert format table help';

export interface MenubarHandle {
  focus(): void;
  destroy(): void;
}

/**
 * Менюбар по WAI-ARIA menubar: Alt+F9 — фокус, стрелки ←/→ — соседние меню (и при открытом меню
 * тоже), ↓/Enter — открыть, Esc — закрыть и вернуться в текст.
 */
export function createMenubar(
  editor: Editor,
  host: HTMLElement,
  config: string,
  menus: Record<string, MenuDefinition>,
): MenubarHandle {
  const { t } = editor.ui;
  host.className = 'nova-menubar';
  host.setAttribute('role', 'menubar');
  host.setAttribute('aria-label', t('menu.label'));
  const listeners = new AbortController();
  const { signal } = listeners;

  const title = (def: MenuDefinition) =>
    def.title.startsWith('menu.') ? t(def.title as MessageKey) : def.title;

  /** Пункты меню: неизвестные/запрещённые пропускаем, лишние разделители убираем. */
  const entries = (def: MenuDefinition): MenuEntry[] => {
    const out: MenuEntry[] = [];
    for (const token of def.items.split(/\s+/)) {
      if (!token) continue;
      if (token === '|') {
        if (out.length && out[out.length - 1]!.type !== 'separator')
          out.push({ type: 'separator' });
        continue;
      }
      if (!editor.isAllowed(token)) continue;
      const item = editor.ui.registry.getMenuItem(token);
      if (!item) continue;
      out.push({
        id: token,
        label: item.text,
        ...(item.icon ? { icon: item.icon } : {}),
        ...(item.shortcut ? { shortcut: item.shortcut } : {}),
        ...(item.isActive ? { active: item.isActive(editor), checkbox: true } : {}),
        disabled: !editor.isEditable() || (item.isEnabled ? !item.isEnabled(editor) : false),
        onSelect: () => item.onAction(editor),
      });
    }
    while (out.length && out[out.length - 1]!.type === 'separator') out.pop();
    return out;
  };

  const buttons: HTMLButtonElement[] = [];
  let open: { index: number; popover: Popover } | null = null;

  const close = () => {
    open?.popover.close();
    open = null;
  };

  const openMenu = (index: number, focusFirst: boolean) => {
    close();
    const button = buttons[index]!;
    const def = menus[button.dataset.menu!]!;
    const items = entries(def);
    if (!items.length) return;
    const menu = createMenu(items, () => editor.ui.closePopover(), title(def));
    // ←/→ внутри открытого меню — соседнее меню (стандартное поведение менюбара).
    menu.addEventListener('keydown', (event) => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      event.preventDefault();
      const next =
        (index + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length;
      openMenu(next, true);
    });
    button.setAttribute('aria-expanded', 'true');
    const popover = editor.ui.openPopover({
      anchor: button,
      content: menu,
      ignore: [host],
      className: 'nova-popover-menu',
      onClose: (reason) => {
        button.setAttribute('aria-expanded', 'false');
        if (open?.popover === popover) open = null;
        if (reason === 'escape') button.focus();
      },
    });
    open = { index, popover };
    if (focusFirst) focusMenu(menu);
  };

  for (const name of config.split(/\s+/).filter(Boolean)) {
    const def = menus[name];
    if (!def) continue;
    const button = h(
      'button',
      {
        type: 'button',
        className: 'nova-menubar-item',
        role: 'menuitem',
        'aria-haspopup': 'menu',
        'aria-expanded': 'false',
        'data-menu': name,
        tabindex: buttons.length === 0 ? '0' : '-1',
      },
      title(def),
    );
    const index = buttons.length;
    button.addEventListener('click', (event) => {
      if (open?.index === index) return close();
      openMenu(index, event.detail === 0);
    });
    // Меню открыто — наведение на соседний заголовок переключает меню (как в настольных приложениях).
    button.addEventListener('mouseenter', () => {
      if (open && open.index !== index) openMenu(index, false);
    });
    buttons.push(button);
    host.append(button);
  }

  host.addEventListener(
    'keydown',
    (event) => {
      const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
      if (index < 0) return;
      const move = (to: number) => {
        event.preventDefault();
        const next = (to + buttons.length) % buttons.length;
        buttons.forEach((b, i) => (b.tabIndex = i === next ? 0 : -1));
        buttons[next]!.focus();
      };
      if (event.key === 'ArrowRight') move(index + 1);
      else if (event.key === 'ArrowLeft') move(index - 1);
      else if (event.key === 'Home') move(0);
      else if (event.key === 'End') move(buttons.length - 1);
      else if (event.key === 'ArrowDown') {
        event.preventDefault();
        openMenu(index, true);
      } else if (event.key === 'Escape') {
        event.preventDefault();
        editor.focus();
      }
    },
    { signal },
  );
  // Не забираем фокус у текста при клике мышью — иначе пропадёт выделение.
  host.addEventListener(
    'mousedown',
    (event) => {
      if ((event.target as HTMLElement).closest('button')) event.preventDefault();
    },
    { signal },
  );

  return {
    focus: () => (buttons.find((b) => b.tabIndex === 0) ?? buttons[0])?.focus(),
    destroy: () => {
      close();
      listeners.abort();
      host.replaceChildren();
    },
  };
}
