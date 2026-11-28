import type { Editor } from '../editor';
import type { StyleFormat } from '../formats';
import type { AutocompleterSpec } from './autocompleter';
import type { MenuEntry } from './menu';
import { icons } from './icons';
import type { SidebarSpec } from './sidebar';
import type { ViewSpec } from './editor-views';

const sidebarIcon = icons.sidebar;

interface ControlBase {
  /** Text for the tooltip and aria-label. */
  tooltip: string;
  /** An SVG icon (string). Without one, `text` is shown. */
  icon?: string;
  /** Text on the button (for dropdowns: "Paragraph ▾"). */
  text?: string;
  /** Shortcut in ProseMirror format ('Mod-b'), shown in the tooltip only. */
  shortcut?: string;
  isEnabled?: (editor: Editor) => boolean;
}

export interface ButtonSpec extends ControlBase {
  type: 'button';
  onAction: (editor: Editor) => void;
  /** When set, the button becomes a toggle (aria-pressed). */
  isActive?: (editor: Editor) => boolean;
}

export interface MenuButtonSpec extends ControlBase {
  type: 'menu';
  items: (editor: Editor) => MenuEntry[];
  /** A dynamic label (the current block style, font and so on). */
  label?: (editor: Editor) => string;
  isActive?: (editor: Editor) => boolean;
  /** Minimum label width in characters, so the toolbar doesn't jump. */
  minChars?: number;
}

export interface PanelButtonSpec extends ControlBase {
  type: 'panel';
  render: (editor: Editor, close: () => void) => HTMLElement;
  /** Color of the bar under the icon (the current text or background color). */
  indicator?: (editor: Editor) => string | null;
  isActive?: (editor: Editor) => boolean;
}

/**
 * A split button: the main part runs an action (toggle a list), the arrow opens a menu of variants
 * (the bullet style). Like bullist/numlist with the advlist plugin.
 */
export interface SplitButtonSpec extends ControlBase {
  type: 'split';
  onAction: (editor: Editor) => void;
  items: (editor: Editor) => MenuEntry[];
  isActive?: (editor: Editor) => boolean;
}

export type ControlSpec = ButtonSpec | MenuButtonSpec | PanelButtonSpec | SplitButtonSpec;

/** A menu bar item. */
export interface MenuItemSpec {
  text: string;
  icon?: string;
  shortcut?: string;
  onAction: (editor: Editor) => void;
  /** A check mark (toggle). */
  isActive?: (editor: Editor) => boolean;
  isEnabled?: (editor: Editor) => boolean;
}

export type ContextPlacement = 'top-start' | 'top-end' | 'bottom-start' | 'bottom-end';

/** A context toolbar: appears next to the selected object (image, table, link). */
export interface ContextToolbarSpec {
  /** When to show it. Checked in order of registration; the first match wins. */
  predicate: (editor: Editor) => boolean;
  /** Buttons in toolbar format ('a b | c'), from the same registry. */
  items: string | string[];
  /** Label for screen readers. */
  label: string;
  /** Where to show it: above the selected node (default) or below the selection. */
  position?: 'node' | 'selection';
  /** Your own anchor (for example, the whole table). Overrides position. */
  anchor?: (editor: Editor) => DOMRect | null;
  /**
   * The side relative to the anchor; flips when there isn't room. A function when the side depends
   * on the state (a code block is always left-to-right, even in a right-to-left document).
   */
  placement?: ContextPlacement | ((editor: Editor) => ContextPlacement);
  /** Check order: higher goes first (default 0). Text selected in a table → the quickbar beats the table. */
  priority?: number;
}

type WithoutType<T> = Omit<T, 'type'>;

/**
 * The registry of toolbar controls (like editor.ui.registry). Built-in buttons are registered the
 * same way as yours, so plugins can do everything the core can.
 */
export class Registry {
  private readonly controls = new Map<string, ControlSpec>();

  addButton(name: string, spec: WithoutType<ButtonSpec>): void {
    this.controls.set(name.toLowerCase(), { type: 'button', ...spec });
  }

  /** A synonym of addButton with isActive, for the familiar API. */
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

  private styleFormats: { items: StyleFormat[]; replace: boolean } = { items: [], replace: false };

  /**
   * Items for the Styles menu from a plugin (importcss): after the menu's own items, or instead of
   * them (`replace`).
   */
  addStyleFormats(items: StyleFormat[], { replace = false } = {}): void {
    this.styleFormats = {
      items: [...this.styleFormats.items, ...items],
      replace: this.styleFormats.replace || replace,
    };
  }

  /** What plugins added to the Styles menu. */
  getStyleFormats(): { items: readonly StyleFormat[]; replace: boolean } {
    return this.styleFormats;
  }

  /** A menu bar item (like addMenuItem). */
  addMenuItem(name: string, spec: MenuItemSpec): void {
    this.menuItems.set(name.toLowerCase(), spec);
  }

  /** A toggle item (with a check mark). */
  addToggleMenuItem(
    name: string,
    spec: MenuItemSpec & { isActive: (editor: Editor) => boolean },
  ): void {
    this.addMenuItem(name, spec);
  }

  /**
   * A menu item by name. If there is no separate item, it is built from the toolbar button of the
   * same name (label = tooltip), so each feature isn't defined twice.
   */
  getMenuItem(name: string): MenuItemSpec | undefined {
    const own = this.menuItems.get(name.toLowerCase());
    if (own) return own;
    const control = this.get(name);
    // In a menu a split button is its main action.
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

  /** An autocompleter on a trigger character: '/' — commands, '@' — mentions, ':' — emoji. */
  private readonly sidebars = new Map<string, SidebarSpec>();

  /**
   * A sidebar (shown with editor.ui.sidebar). If the name is free, a toggle button with that name is
   * added for the toolbar and menus too (`button: false` — without it).
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

  private readonly views = new Map<string, ViewSpec>();

  /** A view: a plugin's screen in place of the editor (shown with editor.ui.view). */
  addView(name: string, spec: ViewSpec): void {
    this.views.set(name, spec);
  }

  getView(name: string): ViewSpec | undefined {
    return this.views.get(name);
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

  /** By descending priority; equal ones in registration order (the sort is stable). */
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
