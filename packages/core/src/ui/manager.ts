import type { Editor } from '../editor';
import type { Translator } from '../i18n';

/** Which styles are already attached to the document or a shadow root (once per root). */
const addedStyles = new WeakMap<Document | ShadowRoot, Set<string>>();
import { openDialog, type DialogHandle, type DialogOptions } from './dialog';
import { h } from './dom';
import type { DialogData, DialogSpec } from './form-dialog-types';
import { Notifications, type NotificationHandle, type NotificationOptions } from './notification';
import { Popover, type PopoverOptions } from './popover';
import { isSvgMarkup, Registry } from './registry';
import { Sidebars } from './sidebar';
import { Views } from './editor-views';
import { Tooltip } from './tooltip';

/**
 * The UI layer of an editor instance: the control registry, overlays (popovers, dialogs, tooltips),
 * notifications and translations. Available as editor.ui.
 */
export class UiManager {
  readonly registry: Registry;
  readonly t: Translator;
  /** The layer for all floating elements. It sits inside .nova-editor, so it inherits the theme. */
  readonly overlayHost: HTMLDivElement;
  readonly tooltip: Tooltip;
  /** Plugin sidebars: show / hide / toggle (register them with registry.addSidebar). */
  readonly sidebar: Sidebars;
  /** Plugin views in place of the editor: show / hide / toggle (register them with registry.addView). */
  readonly view: Views;
  private readonly notifications: Notifications;
  private popover: Popover | null = null;
  private currentDialog: DialogHandle | null = null;
  /** The hidden polite live region for announce(); it exists from the start, so screen readers watch it. */
  private readonly liveRegion: HTMLElement;
  private announceTimer: ReturnType<typeof setTimeout> | undefined;

  private readonly rootEl: HTMLElement;

  constructor(
    root: HTMLElement,
    t: Translator,
    private readonly focusEditor: () => void,
    editor: Editor,
  ) {
    this.t = t;
    this.rootEl = root;
    // The icon pack (the icons option): SVGs by name over the built-in icons.
    const pack = editor.options.icons;
    this.registry = new Registry(
      pack && typeof pack === 'object'
        ? Object.fromEntries(Object.entries(pack).filter(([, svg]) => isSvgMarkup(svg)))
        : {},
    );
    this.overlayHost = h('div', { className: 'nova-overlays' });
    root.append(this.overlayHost);
    this.tooltip = new Tooltip(this.overlayHost);
    this.notifications = new Notifications(root, t('dialog.close'), this.registry);
    this.sidebar = new Sidebars(editor);
    this.view = new Views(editor);
    this.liveRegion = h('div', {
      className: 'nova-visually-hidden nova-announcer',
      role: 'status',
      'aria-live': 'polite',
      'aria-atomic': 'true',
    });
    root.append(this.liveRegion);
  }

  /**
   * Say a short message to screen readers without moving focus: what a shortcut or a typed Markdown
   * shortcut changed ("Bold on", "Bulleted list"). Plugins can use it for their own changes.
   */
  announce(message: string): void {
    const region = this.liveRegion;
    // Clear first and fill a moment later: the same text twice in a row (bold on, off, on) is read again.
    region.textContent = '';
    clearTimeout(this.announceTimer);
    this.announceTimer = setTimeout(() => {
      region.textContent = message;
    }, 50);
  }

  /**
   * Add a plugin's styles to the editor's document (or shadow root) — once per page, however many
   * editors there are. For panels and dialogs that load lazily: their styles don't belong in the
   * first-load style.css. Constructed style sheets don't need 'unsafe-inline' in your CSP; where they
   * aren't supported, a plain <style> is used. Override such styles with a selector at least as specific.
   */
  addStyles(id: string, css: string): void {
    const root = this.rootEl.getRootNode() as Document | ShadowRoot;
    let ids = addedStyles.get(root);
    if (!ids) addedStyles.set(root, (ids = new Set()));
    if (ids.has(id)) return;
    ids.add(id);
    if ('adoptedStyleSheets' in root && typeof CSSStyleSheet !== 'undefined') {
      try {
        const sheet = new CSSStyleSheet();
        sheet.replaceSync(css);
        root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet];
        return;
      } catch {
        // partial support: fall through to <style>
      }
    }
    const style = document.createElement('style');
    style.dataset.novaStyles = id;
    style.textContent = css;
    ((root as Document).head ?? root).append(style);
  }

  /**
   * A dialog described by its fields (for plugins): validation, errors at the fields, accessibility.
   * Returns the data, or null if the dialog was closed. The implementation loads when first opened.
   */
  async dialog(spec: DialogSpec): Promise<DialogData | null> {
    const { openFormDialog, formDialogCss } = await import('./form-dialog');
    this.addStyles('nova-form-dialog', formDialogCss);
    return openFormDialog(spec, this.t, (options) => this.openDialog(options));
  }

  /** Open a popover; only one is open at a time (except the toolbar overflow panel). */
  openPopover(options: Omit<PopoverOptions, 'host'>): Popover {
    this.closePopover();
    this.tooltip.hide();
    const popover = new Popover({
      ...options,
      host: this.overlayHost,
      onClose: (reason) => {
        if (this.popover === popover) this.popover = null;
        options.onClose?.(reason);
      },
    });
    this.popover = popover;
    return popover;
  }

  closePopover(): void {
    this.popover?.close('api');
    this.popover = null;
  }

  get activePopover(): Popover | null {
    return this.popover;
  }

  private readonly dialogListeners = new Set<() => void>();

  /**
   * Subscribe to a dialog opening (returns an unsubscribe function). The toolbar uses it to close
   * its "⋯" panel, which on a narrow screen otherwise stayed over the text after a dialog opened from it closed.
   */
  onDialogOpen(listener: () => void): () => void {
    this.dialogListeners.add(listener);
    return () => this.dialogListeners.delete(listener);
  }

  /**
   * Close floating panels and the toolbar's "⋯" before a plugin opens its own panel or view (version
   * history, comments), so they don't stay on top.
   */
  closeOverlays(): void {
    this.closePopover();
    this.dialogListeners.forEach((listener) => listener());
  }

  openDialog(
    options: Omit<DialogOptions, 'host' | 'cancelLabel' | 'closeLabel' | 'returnFocus'> & {
      cancelLabel?: string;
    },
  ): DialogHandle {
    this.closePopover();
    this.dialogListeners.forEach((listener) => listener());
    this.currentDialog?.close();
    const handle = openDialog({
      cancelLabel: this.t('dialog.cancel'),
      closeLabel: this.t('dialog.close'),
      ...options,
      host: this.overlayHost,
      iconSource: this.registry,
      returnFocus: this.focusEditor,
      onClose: () => {
        if (this.currentDialog === handle) this.currentDialog = null;
        options.onClose?.();
      },
    });
    this.currentDialog = handle;
    return handle;
  }

  get activeDialog(): DialogHandle | null {
    return this.currentDialog;
  }

  notify(options: NotificationOptions | string): NotificationHandle {
    return this.notifications.open(typeof options === 'string' ? { text: options } : options);
  }

  destroy(): void {
    this.sidebar.destroy();
    this.view.destroy();
    this.closePopover();
    this.currentDialog?.close();
    this.tooltip.destroy();
    this.notifications.destroy();
    this.overlayHost.remove();
    clearTimeout(this.announceTimer);
    this.liveRegion.remove();
  }
}
