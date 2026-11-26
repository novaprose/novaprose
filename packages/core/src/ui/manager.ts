import type { Editor } from '../editor';
import type { Translator } from '../i18n';
import { openDialog, type DialogHandle, type DialogOptions } from './dialog';
import { h } from './dom';
import type { DialogData, DialogSpec } from './form-dialog-types';
import { Notifications, type NotificationHandle, type NotificationOptions } from './notification';
import { Popover, type PopoverOptions } from './popover';
import { Registry } from './registry';
import { Sidebars } from './sidebar';
import { Tooltip } from './tooltip';

/**
 * UI-слой экземпляра редактора: реестр кнопок, оверлеи (поповеры, диалоги, подсказки),
 * уведомления и переводы. Доступен как editor.ui.
 */
export class UiManager {
  readonly registry = new Registry();
  readonly t: Translator;
  /** Слой для всех плавающих элементов. Лежит внутри .nova-editor, поэтому наследует тему. */
  readonly overlayHost: HTMLDivElement;
  readonly tooltip: Tooltip;
  /** Боковые панели плагинов: show / hide / toggle (регистрация — registry.addSidebar). */
  readonly sidebar: Sidebars;
  private readonly notifications: Notifications;
  private popover: Popover | null = null;
  private currentDialog: DialogHandle | null = null;

  constructor(
    root: HTMLElement,
    t: Translator,
    private readonly focusEditor: () => void,
    editor: Editor,
  ) {
    this.t = t;
    this.overlayHost = h('div', { className: 'nova-overlays' });
    root.append(this.overlayHost);
    this.tooltip = new Tooltip(this.overlayHost);
    this.notifications = new Notifications(root, t('dialog.close'));
    this.sidebar = new Sidebars(editor);
  }

  /**
   * Диалог по описанию полей (для плагинов): проверка, ошибки у полей, доступность.
   * Возвращает данные или null, если диалог закрыли. Реализация грузится при первом открытии.
   */
  async dialog(spec: DialogSpec): Promise<DialogData | null> {
    const { openFormDialog } = await import('./form-dialog');
    return openFormDialog(spec, this.t, (options) => this.openDialog(options));
  }

  /** Открыть поповер; одновременно открыт только один (кроме панели переполнения тулбара). */
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
   * Подписаться на открытие диалога (вернёт отписку). Тулбар так закрывает панель «⋯»: иначе на узком
   * экране она оставалась открытой поверх текста после закрытия диалога, открытого из неё.
   */
  onDialogOpen(listener: () => void): () => void {
    this.dialogListeners.add(listener);
    return () => this.dialogListeners.delete(listener);
  }

  /**
   * Закрыть всплывающие панели и «⋯» тулбара — перед тем как плагин открывает свою панель или вид
   * (история версий, комментарии), чтобы они не остались поверх.
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
    this.closePopover();
    this.currentDialog?.close();
    this.tooltip.destroy();
    this.notifications.destroy();
    this.overlayHost.remove();
  }
}
