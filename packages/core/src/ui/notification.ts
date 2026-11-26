import { h, icon } from './dom';
import { icons } from './icons';

export type NotificationType = 'info' | 'success' | 'warning' | 'error';

export interface NotificationOptions {
  text: string;
  type?: NotificationType;
  /** ms until it closes by itself; 0 — never. Default 4000 (errors: 0). */
  timeout?: number;
  /** Action buttons ("Retry"): clicking one runs the action and closes the notification. */
  actions?: NotificationAction[];
  /** The notification was closed with the close button or by its timer (not through an action). */
  onClose?: () => void;
}

export interface NotificationAction {
  label: string;
  onAction: () => void;
}

export interface NotificationHandle {
  close(): void;
  setText(text: string): void;
}

/** Уведомления внутри редактора (аналог editor.notificationManager). */
export class Notifications {
  private readonly region: HTMLDivElement;
  private readonly closeLabel: string;

  constructor(host: HTMLElement, closeLabel: string) {
    this.closeLabel = closeLabel;
    // aria-live — экранный диктор зачитывает уведомления без переноса фокуса.
    this.region = h('div', { className: 'nova-notifications', 'aria-live': 'polite' });
    host.append(this.region);
  }

  open(options: NotificationOptions): NotificationHandle {
    const type = options.type ?? 'info';
    const timeout = options.timeout ?? (type === 'error' ? 0 : 4000);
    const text = h('span', { className: 'nova-notification-text' }, options.text);
    const closeBtn = h(
      'button',
      { type: 'button', className: 'nova-btn', 'aria-label': this.closeLabel },
      icon(icons.close),
    );
    const actions = (options.actions ?? []).map((action) =>
      h('button', { type: 'button', className: 'nova-btn nova-notification-action' }, action.label),
    );
    const el = h(
      'div',
      {
        className: `nova-notification nova-notification-${type}`,
        role: type === 'error' ? 'alert' : 'status',
      },
      text,
      ...actions,
      closeBtn,
    );
    this.region.append(el);

    let timer: ReturnType<typeof setTimeout> | null = null;
    let closed = false;
    const close = () => {
      if (closed) return;
      closed = true;
      if (timer) clearTimeout(timer);
      el.remove();
    };
    const dismiss = () => {
      if (closed) return;
      close();
      options.onClose?.();
    };
    actions.forEach((button, i) =>
      button.addEventListener('click', () => {
        close();
        options.actions![i]!.onAction();
      }),
    );
    closeBtn.addEventListener('click', dismiss);
    if (timeout > 0) timer = setTimeout(dismiss, timeout);
    // Есть действие — фокус на нём: с клавиатуры можно сразу нажать «Повторить».
    actions[0]?.focus({ preventScroll: true });

    return { close, setText: (value) => (text.textContent = value) };
  }

  destroy(): void {
    this.region.remove();
  }
}
