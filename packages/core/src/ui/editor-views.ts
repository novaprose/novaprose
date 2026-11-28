import type { Editor } from '../editor';
import css from './editor-views.css?raw';
import { activeElement, FOCUSABLE, h } from './dom';

/**
 * Views: a plugin's own screen in place of the editor (a review, a history, a report), with its own
 * buttons. One view is open at a time; while it is, the editor's toolbar, text and status bar are out
 * of sight (and out of the Tab order), and Escape or the view's buttons bring the text back.
 *
 *   editor.ui.registry.addView('report', {
 *     title: 'Report',
 *     buttons: [{ text: 'Done', buttonType: 'primary', onAction: (e) => e.ui.view.hide() }],
 *     onShow: (api) => api.getContainer().replaceChildren(…),
 *   });
 *   editor.ui.view.toggle('report');
 */
export interface ViewButton {
  text: string;
  /** primary: the view's main action (a filled button). */
  buttonType?: 'primary' | 'secondary';
  onAction: (editor: Editor) => void;
}

export interface ViewApi {
  /** The element the view draws its content into. */
  getContainer(): HTMLElement;
}

export interface ViewSpec {
  /** The view's heading (visible and announced); without it the view is named after its name. */
  title?: string;
  /** Buttons at the top of the view, on the end side. */
  buttons?: ViewButton[];
  /** Draw or refresh the content: called every time the view is shown. */
  onShow?: (api: ViewApi) => void;
  onHide?: (api: ViewApi) => void;
}

interface Mounted {
  el: HTMLElement;
  api: ViewApi;
}

export class Views {
  private current: string | null = null;
  private readonly mounted = new Map<string, Mounted>();

  constructor(private readonly editor: Editor) {}

  /** The name of the open view, or null. */
  get active(): string | null {
    return this.current;
  }

  isOpen(name: string): boolean {
    return this.current === name;
  }

  show(name: string): void {
    const spec = this.editor.ui.registry.getView(name);
    if (!spec) {
      console.warn(`[nova] view "${name}" is not registered`);
      return;
    }
    if (this.current === name) return;
    this.hide({ restoreFocus: false });
    this.editor.ui.closeOverlays();
    this.editor.ui.addStyles('nova-editor-views', css);
    const mounted = this.mount(name, spec);
    this.current = name;
    mounted.el.hidden = false;
    this.editor.root.classList.add('nova-view-open');
    try {
      spec.onShow?.(mounted.api);
    } catch (error) {
      console.error(`[nova] view "${name}" failed to show`, error);
    }
    (mounted.el.querySelector<HTMLElement>(FOCUSABLE) ?? mounted.el).focus();
    this.editor.updateUI();
  }

  /** Close the open view: the editor comes back, and focus returns to the text. */
  hide(options: { restoreFocus?: boolean } = {}): void {
    const name = this.current;
    if (!name) return;
    this.current = null;
    const mounted = this.mounted.get(name);
    if (!mounted) return;
    const hadFocus = mounted.el.contains(activeElement(mounted.el));
    mounted.el.hidden = true;
    this.editor.root.classList.remove('nova-view-open');
    try {
      this.editor.ui.registry.getView(name)?.onHide?.(mounted.api);
    } catch (error) {
      console.error(`[nova] view "${name}" failed to hide`, error);
    }
    this.editor.updateUI();
    if (hadFocus && options.restoreFocus !== false) this.editor.focus();
  }

  toggle(name: string): void {
    if (this.current === name) this.hide();
    else this.show(name);
  }

  destroy(): void {
    this.mounted.forEach(({ el }) => el.remove());
    this.mounted.clear();
    this.current = null;
  }

  private mount(name: string, spec: ViewSpec): Mounted {
    const existing = this.mounted.get(name);
    if (existing) return existing;
    const body = h('div', { className: 'nova-view-body' });
    const buttons = (spec.buttons ?? []).map((button) =>
      h(
        'button',
        {
          type: 'button',
          className:
            button.buttonType === 'primary' ? 'nova-button nova-button-primary' : 'nova-button',
          onClick: () => {
            try {
              button.onAction(this.editor);
            } catch (error) {
              console.error(`[nova] a button of view "${name}" failed`, error);
            }
          },
        },
        button.text,
      ),
    );
    const el = h(
      'section',
      {
        className: 'nova-view',
        hidden: true,
        tabindex: '-1',
        'data-view': name,
        'aria-label': spec.title ?? name,
        ...(this.editor.options.language ? { lang: this.editor.options.language } : {}),
        onKeydown: ((event: KeyboardEvent) => {
          if (event.key !== 'Escape' || event.defaultPrevented) return;
          event.preventDefault();
          this.hide();
        }) as EventListener,
      },
      h(
        'div',
        { className: 'nova-view-head' },
        spec.title ? h('h2', { className: 'nova-view-title' }, spec.title) : null,
        h('div', { className: 'nova-view-buttons' }, ...buttons),
      ),
      body,
    );
    this.editor.root.append(el);
    const mounted: Mounted = { el, api: { getContainer: () => body } };
    this.mounted.set(name, mounted);
    return mounted;
  }
}
