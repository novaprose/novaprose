import type { Editor } from '../editor';
import type { AutocompleterSpec } from './autocompleter';
import type { MenuEntry } from './menu';
import { icons } from './icons';
import type { SidebarSpec } from './sidebar';

const sidebarIcon = icons.sidebar;

interface ControlBase {
  /** Подпись для подсказки и aria-label. */
  tooltip: string;
  /** SVG-иконка (строка). Если нет — показывается text. */
  icon?: string;
  /** Текст на кнопке (для выпадающих списков: «Обычный текст ▾»). */
  text?: string;
  /** Горячая клавиша в формате ProseMirror ('Mod-b') — только для подсказки. */
  shortcut?: string;
  isEnabled?: (editor: Editor) => boolean;
}

export interface ButtonSpec extends ControlBase {
  type: 'button';
  onAction: (editor: Editor) => void;
  /** Если задан — кнопка становится переключателем (aria-pressed). */
  isActive?: (editor: Editor) => boolean;
}

export interface MenuButtonSpec extends ControlBase {
  type: 'menu';
  items: (editor: Editor) => MenuEntry[];
  /** Динамическая подпись (текущий стиль блока, шрифт и т.п.). */
  label?: (editor: Editor) => string;
  isActive?: (editor: Editor) => boolean;
  /** Минимальная ширина подписи в символах — чтобы тулбар не прыгал. */
  minChars?: number;
}

export interface PanelButtonSpec extends ControlBase {
  type: 'panel';
  render: (editor: Editor, close: () => void) => HTMLElement;
  /** Цвет полоски под иконкой (текущий цвет текста/фона). */
  indicator?: (editor: Editor) => string | null;
  isActive?: (editor: Editor) => boolean;
}

/**
 * Составная кнопка: основная часть выполняет действие (переключить список), стрелка открывает
 * меню вариантов (стиль маркеров). Как bullist/numlist с плагином advlist.
 */
export interface SplitButtonSpec extends ControlBase {
  type: 'split';
  onAction: (editor: Editor) => void;
  items: (editor: Editor) => MenuEntry[];
  isActive?: (editor: Editor) => boolean;
}

export type ControlSpec = ButtonSpec | MenuButtonSpec | PanelButtonSpec | SplitButtonSpec;

/** Пункт меню менюбара. */
export interface MenuItemSpec {
  text: string;
  icon?: string;
  shortcut?: string;
  onAction: (editor: Editor) => void;
  /** Галочка (переключатель). */
  isActive?: (editor: Editor) => boolean;
  isEnabled?: (editor: Editor) => boolean;
}

/** Контекстный тулбар: появляется рядом с выделенным объектом (картинка, таблица, ссылка). */
export interface ContextToolbarSpec {
  /** Когда показывать. Проверяются по порядку регистрации — побеждает первый подходящий. */
  predicate: (editor: Editor) => boolean;
  /** Кнопки в формате тулбара ('a b | c'), из того же реестра. */
  items: string | string[];
  /** Подпись для экранного диктора. */
  label: string;
  /** Где показывать: над выделенным узлом (по умолчанию) или под выделением. */
  position?: 'node' | 'selection';
  /** Свой якорь (например, вся таблица). Перекрывает position. */
  anchor?: (editor: Editor) => DOMRect | null;
  /** Сторона относительно якоря; при нехватке места переворачивается. */
  placement?: 'top-start' | 'bottom-start';
  /** Порядок проверки: больше — раньше (по умолчанию 0). Выделение текста в таблице → quickbar важнее таблицы. */
  priority?: number;
}

type WithoutType<T> = Omit<T, 'type'>;

/**
 * Реестр кнопок тулбара (аналог editor.ui.registry). Встроенные кнопки регистрируются так же,
 * как пользовательские, — плагины ничем не ограничены по сравнению с ядром.
 */
export class Registry {
  private readonly controls = new Map<string, ControlSpec>();

  addButton(name: string, spec: WithoutType<ButtonSpec>): void {
    this.controls.set(name.toLowerCase(), { type: 'button', ...spec });
  }

  /** Синоним addButton с isActive — для совместимости с привычным API. */
  addToggleButton(name: string, spec: WithoutType<ButtonSpec>): void {
    this.addButton(name, spec);
  }

  addMenuButton(name: string, spec: WithoutType<MenuButtonSpec>): void {
    this.controls.set(name.toLowerCase(), { type: 'menu', ...spec });
  }

  addPanelButton(name: string, spec: WithoutType<PanelButtonSpec>): void {
    this.controls.set(name.toLowerCase(), { type: 'panel', ...spec });
  }

  addSplitButton(name: string, spec: WithoutType<SplitButtonSpec>): void {
    this.controls.set(name.toLowerCase(), { type: 'split', ...spec });
  }

  private readonly menuItems = new Map<string, MenuItemSpec>();

  /** Пункт меню менюбара (аналог addMenuItem). */
  addMenuItem(name: string, spec: MenuItemSpec): void {
    this.menuItems.set(name.toLowerCase(), spec);
  }

  /** Пункт-переключатель (с галочкой). */
  addToggleMenuItem(
    name: string,
    spec: MenuItemSpec & { isActive: (editor: Editor) => boolean },
  ): void {
    this.addMenuItem(name, spec);
  }

  /**
   * Пункт меню по имени. Если отдельного пункта нет — строится из одноимённой кнопки тулбара
   * (подпись = tooltip), чтобы не дублировать каждую функцию дважды.
   */
  getMenuItem(name: string): MenuItemSpec | undefined {
    const own = this.menuItems.get(name.toLowerCase());
    if (own) return own;
    const control = this.get(name);
    // В меню составная кнопка — её основное действие.
    if (control?.type !== 'button' && control?.type !== 'split') return undefined;
    return {
      text: control.tooltip,
      ...(control.icon ? { icon: control.icon } : {}),
      ...(control.shortcut ? { shortcut: control.shortcut } : {}),
      onAction: control.onAction,
      ...(control.isActive ? { isActive: control.isActive } : {}),
      ...(control.isEnabled ? { isEnabled: control.isEnabled } : {}),
    };
  }

  private readonly contextToolbars = new Map<string, ContextToolbarSpec>();
  private readonly autocompleters = new Map<string, AutocompleterSpec>();

  /** Автокомплитер по символу-триггеру: '/' — команды, '@' — упоминания, ':' — эмодзи. */
  private readonly sidebars = new Map<string, SidebarSpec>();

  /**
   * Боковая панель (показ — editor.ui.sidebar). Если имя свободно, добавляется и кнопка-переключатель
   * с этим именем для тулбара и меню (`button: false` — без неё).
   */
  addSidebar(name: string, spec: SidebarSpec): void {
    this.sidebars.set(name, spec);
    if (spec.button === false || this.has(name)) return;
    this.addToggleButton(name, {
      tooltip: spec.tooltip ?? spec.title,
      icon: spec.icon ?? sidebarIcon,
      isActive: (editor) => editor.ui.sidebar.isOpen(name),
      onAction: (editor) => void editor.ui.sidebar.toggle(name),
    });
  }

  getSidebar(name: string): SidebarSpec | undefined {
    return this.sidebars.get(name);
  }

  addAutocompleter(name: string, spec: AutocompleterSpec): void {
    this.autocompleters.set(name.toLowerCase(), spec);
  }

  getAutocompleters(): [string, AutocompleterSpec][] {
    return [...this.autocompleters];
  }

  addContextToolbar(name: string, spec: ContextToolbarSpec): void {
    this.contextToolbars.set(name.toLowerCase(), spec);
  }

  /** По убыванию priority; при равенстве — в порядке регистрации (sort стабильна). */
  getContextToolbars(): [string, ContextToolbarSpec][] {
    return [...this.contextToolbars].sort((a, b) => (b[1].priority ?? 0) - (a[1].priority ?? 0));
  }

  get(name: string): ControlSpec | undefined {
    return this.controls.get(name.toLowerCase());
  }

  has(name: string): boolean {
    return this.controls.has(name.toLowerCase());
  }

  names(): string[] {
    return [...this.controls.keys()];
  }
}
