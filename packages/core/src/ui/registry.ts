import type { Editor } from '../editor';
import type { StyleFormat } from '../formats';
import { isSafeImageUrl } from '../url';
import type { AutocompleterSpec } from './autocompleter';
import type { MenuEntry } from './menu';
import { icons } from './icons';
import type { SidebarSpec } from './sidebar';
import type { ViewSpec } from './editor-views';

const sidebarIcon = icons.sidebar;
const builtInIcons: Record<string, string> = icons;
/** A built-in icon's name by its SVG (an icon pack or addIcon replaces it by name). */
const BUILT_IN = new Map(Object.entries(builtInIcons).map(([name, svg]) => [svg, name]));

const SVG_NS = 'http://www.w3.org/2000/svg';
/**
 * SVG elements an icon must not carry: code, styles for the whole page, other content, links,
 * animation, and text (a title would show the browser's own tooltip over the editor's).
 */
const UNSAFE_IN_ICON = new Set([
  'script',
  'style',
  'foreignobject',
  'a',
  'set',
  'animate',
  'animatemotion',
  'animatetransform',
  'title',
  'desc',
  'metadata',
]);
/** What a saved SVG file may have before <svg>: an XML declaration, a doctype, comments. */
const SVG_PROLOG = /^(?:\s+|<\?xml[\s\S]*?\?>|<!doctype[^>]*>|<!--[\s\S]*?-->)*/i;

/** Whether a string is SVG markup (an icon), the prolog of a saved file allowed. */
export function isSvgMarkup(value: unknown): value is string {
  return typeof value === 'string' && value.replace(SVG_PROLOG, '').startsWith('<svg');
}
/** Cleaned SVGs by the string they came from: a page with several editors cleans each icon once. */
const cleaned = new Map<string, string | undefined>();

/**
 * An icon that doesn't come with the editor (an icon pack, addIcon, a control's own SVG), as it is
 * drawn: one <svg> element of SVG elements only, without scripts, page styles, event handlers,
 * links or comments, marked decorative; undefined when it isn't an SVG. Icons are drawn as markup,
 * so this is where an unexpected one is defused.
 */
export function cleanIcon(svg: string): string | undefined {
  if (cleaned.has(svg)) return cleaned.get(svg);
  let out: string | undefined;
  if (isSvgMarkup(svg)) {
    // A template parses without running anything: no scripts, no image loads, no handlers.
    const template = document.createElement('template');
    template.innerHTML = svg.replace(SVG_PROLOG, '');
    const root = template.content.firstElementChild;
    if (
      root?.namespaceURI === SVG_NS &&
      root.localName === 'svg' &&
      template.content.children.length === 1
    ) {
      // Only SVG stays: <desc>, <title> and <foreignObject> parse their content as HTML (a form,
      // an image with a handler), and nothing of that kind belongs in an icon.
      for (const el of [...root.querySelectorAll('*')]) {
        if (el.namespaceURI !== SVG_NS || UNSAFE_IN_ICON.has(el.localName.toLowerCase())) {
          el.remove();
        }
      }
      const comments = document.createTreeWalker(root, NodeFilter.SHOW_COMMENT);
      const found: Node[] = [];
      while (comments.nextNode()) found.push(comments.currentNode);
      found.forEach((comment) => comment.parentNode?.removeChild(comment));
      for (const el of [root, ...root.querySelectorAll('*')]) {
        for (const { name, value } of [...el.attributes]) {
          const lower = name.toLowerCase();
          const link = lower === 'href' || lower.endsWith(':href');
          if (
            lower.startsWith('on') ||
            (link && !value.trim().startsWith('#') && !isSafeImageUrl(value))
          ) {
            el.removeAttribute(name);
          }
        }
      }
      // Decorative: a control is named by its label (aria-label), never by its icon.
      root.setAttribute('aria-hidden', 'true');
      out = root.outerHTML;
    }
  }
  cleaned.set(svg, out);
  return out;
}

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
  /** Icons by name: editor.ui.registry.addIcon, over the icon pack and the built-in ones. */
  private readonly icons = new Map<string, string>();

  /** @param pack the editor's icon pack (the `icons` option): icons by name over the built-in ones. */
  constructor(private readonly pack: Record<string, string> = {}) {}

  /** An icon for buttons and menu items by name (as in TinyMCE): it replaces a built-in one of that name too. */
  addIcon(name: string, svg: string): void {
    if (isSvgMarkup(svg)) this.icons.set(name, svg);
  }

  /**
   * The SVG of an icon: a name ('bold', 'alignLeft') or a built-in icon's SVG, either one replaced
   * by addIcon or the icon pack when they have it; another SVG of its own is drawn cleaned
   * (cleanIcon). Undefined for a name no icon has.
   */
  getIcon(value: string | undefined): string | undefined {
    if (typeof value !== 'string' || !value) return undefined;
    const own = value.trimStart().startsWith('<');
    const name = own ? BUILT_IN.get(value) : value;
    if (name === undefined) return cleanIcon(value);
    const replaced =
      this.icons.get(name) ?? (typeof this.pack[name] === 'string' ? this.pack[name] : undefined);
    // A replacement that isn't a drawable SVG leaves the built-in icon.
    const clean = replaced === undefined ? undefined : cleanIcon(replaced);
    if (clean) return clean;
    if (own) return value;
    return Object.hasOwn(builtInIcons, name) ? builtInIcons[name] : undefined;
  }

  /** A spec whose icon is looked up when it is drawn: addIcon after the button still counts. */
  private withIcon<T extends { icon?: string }>(spec: T): T {
    const value = spec.icon;
    if (typeof value !== 'string') return spec;
    const out = { ...spec };
    Object.defineProperty(out, 'icon', {
      get: () => this.getIcon(value),
      enumerable: true,
      configurable: true,
    });
    return out;
  }

  addButton(name: string, spec: WithoutType<ButtonSpec>): void {
    this.controls.set(name.toLowerCase(), this.withIcon({ type: 'button', ...spec }));
  }

  /** A synonym of addButton with isActive, for the familiar API. */
  addToggleButton(name: string, spec: WithoutType<ButtonSpec>): void {
    this.addButton(name, spec);
  }

  addMenuButton(name: string, spec: WithoutType<MenuButtonSpec>): void {
    this.controls.set(name.toLowerCase(), this.withIcon({ type: 'menu', ...spec }));
  }

  addPanelButton(name: string, spec: WithoutType<PanelButtonSpec>): void {
    this.controls.set(name.toLowerCase(), this.withIcon({ type: 'panel', ...spec }));
  }

  addSplitButton(name: string, spec: WithoutType<SplitButtonSpec>): void {
    this.controls.set(name.toLowerCase(), this.withIcon({ type: 'split', ...spec }));
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
    this.menuItems.set(name.toLowerCase(), this.withIcon(spec));
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
