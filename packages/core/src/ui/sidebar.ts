import type { Editor } from '../editor';
import { activeElement, FOCUSABLE, h, icon, uniqueId } from './dom';
import { icons } from './icons';

/**
 * Plugin sidebars (comments, an outline, your own tools): a column next to the text, below it on a
 * narrow screen. One sidebar is open at a time. Its content is drawn on first show (it can load
 * lazily), and the sidebar stays in the DOM, keeping its state between shows.
 *
 *   editor.ui.registry.addSidebar('outline', {
 *     title: 'Outline',
 *     icon: '<svg …>',
 *     render: (container, editor) => { … },
 *   });
 *   editor.ui.sidebar.toggle('outline');
 */
export interface SidebarSpec {
  /** The sidebar's title (visible and announced) and the default button label. */
  title: string;
  /** Icon of the toolbar button (an SVG string). */
  icon?: string;
  /** Tooltip of the button (title by default). */
  tooltip?: string;
  /**
   * A toolbar toggle button and a menu item named after the sidebar (yes by default, if the name is
   * free). false — toggle the sidebar with your own buttons through editor.ui.sidebar.
   */
  button?: boolean;
  /** false — the sidebar draws its own title and close button (the container then has no role). */
  header?: boolean;
  /** Draw the content — once, on first show. May return a cleanup function. */
  render: (
    container: HTMLElement,
    editor: Editor,
  ) => void | (() => void) | Promise<void | (() => void)>;
  onShow?: (editor: Editor) => void;
  onHide?: (editor: Editor) => void;
}

interface Mounted {
  el: HTMLElement;
  ready: Promise<boolean>;
  cleanup?: () => void;
}

export class Sidebars {
  private current: string | null = null;
  private readonly mounted = new Map<string, Mounted>();
  private column: HTMLElement | null = null;
  private opening: Promise<void> = Promise.resolve();
  private destroyed = false;

  constructor(private readonly editor: Editor) {}

  /** Name of the open sidebar, or null. */
  get active(): string | null {
    return this.current;
  }

  isOpen(name: string): boolean {
    return this.current === name;
  }

  /**
   * Show a sidebar (another open one closes). `focus` — move focus into the sidebar (for example,
   * when it was opened from the keyboard, to work with it right away).
   */
  async show(name: string, options: { focus?: boolean } = {}): Promise<void> {
    const spec = this.editor.ui.registry.getSidebar(name);
    if (!spec) {
      console.warn(`[nova] sidebar "${name}" is not registered`);
      return;
    }
    if (this.current !== name) {
      this.hide({ restoreFocus: false });
      this.editor.ui.closeOverlays();
      this.current = name;
      const mounted = this.mount(name, spec);
      this.opening = mounted.ready.then((ok) => {
        if (!ok || this.current !== name || this.destroyed) {
          if (this.current === name) this.current = null;
          return;
        }
        mounted.el.hidden = false;
        this.editor.root.classList.add('nova-sidebar-open');
        spec.onShow?.(this.editor);
        this.editor.updateUI();
      });
    }
    // A repeated call while the panel is loading waits for the same load.
    await this.opening;
    if (options.focus && this.current === name) {
      const el = this.mounted.get(name)!.el;
      (el.querySelector<HTMLElement>(FOCUSABLE) ?? el).focus();
    }
  }

  /** Close the open sidebar. Focus returns from it to the text. */
  hide(options: { restoreFocus?: boolean } = {}): void {
    const name = this.current;
    if (!name) return;
    this.current = null;
    const mounted = this.mounted.get(name);
    if (!mounted) return;
    const hadFocus = mounted.el.contains(activeElement(mounted.el));
    mounted.el.hidden = true;
    this.editor.root.classList.remove('nova-sidebar-open');
    this.editor.ui.registry.getSidebar(name)?.onHide?.(this.editor);
    this.editor.updateUI();
    if (hadFocus && options.restoreFocus !== false) this.editor.focus();
  }

  toggle(name: string, options: { focus?: boolean } = {}): Promise<void> {
    if (this.current === name) {
      this.hide();
      return Promise.resolve();
    }
    return this.show(name, options);
  }

  destroy(): void {
    this.destroyed = true;
    this.mounted.forEach((mounted) => mounted.cleanup?.());
    this.mounted.clear();
  }

  /** The "text + sidebar" column: created with the first sidebar; without sidebars the markup doesn't change. */
  private host(): HTMLElement {
    if (this.column) return this.column;
    const content = this.editor.view.dom.parentElement!;
    const column = h('div', { className: 'nova-body' });
    content.before(column);
    column.append(content);
    this.column = column;
    return column;
  }

  private mount(name: string, spec: SidebarSpec): Mounted {
    const existing = this.mounted.get(name);
    if (existing) return existing;
    const titleId = uniqueId('nova-sidebar-title');
    const body = h('div', { className: 'nova-sidebar-body' });
    const close = h(
      'button',
      {
        type: 'button',
        className: 'nova-btn nova-sidebar-close',
        'aria-label': this.editor.ui.t('dialog.close'),
        onClick: () => this.hide(),
      },
      icon(icons.close),
    );
    const header =
      spec.header === false
        ? null
        : h(
            'div',
            { className: 'nova-sidebar-head' },
            h('h2', { id: titleId, className: 'nova-sidebar-title' }, spec.title),
            close,
          );
    const el = h(
      'div',
      {
        className: `nova-sidebar${header ? '' : ' nova-sidebar-bare'}`,
        hidden: true,
        'data-sidebar': name,
        ...(this.editor.options.language ? { lang: this.editor.options.language } : {}),
        ...(header ? { role: 'complementary', 'aria-labelledby': titleId } : {}),
        onKeydown: ((event: KeyboardEvent) => {
          if (event.key !== 'Escape' || event.defaultPrevented) return;
          event.preventDefault();
          this.hide();
        }) as EventListener,
      },
      header,
      body,
    );
    this.host().append(el);
    const mounted: Mounted = { el, ready: Promise.resolve(false) };
    mounted.ready = (async () => {
      try {
        const cleanup = await spec.render(body, this.editor);
        if (typeof cleanup === 'function') mounted.cleanup = cleanup;
        return true;
      } catch (error) {
        console.error(`[nova] sidebar "${name}" failed to render`, error);
        el.remove();
        this.mounted.delete(name);
        return false;
      }
    })();
    this.mounted.set(name, mounted);
    return mounted;
  }
}
