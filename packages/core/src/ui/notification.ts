import { h, icon } from './dom';
import { icons } from './icons';

export type NotificationType = 'info' | 'success' | 'warning' | 'error';

export interface NotificationOptions {
  text: string;
  type?: NotificationType;
  /** мс до автозакрытия; 0 — не закрывать автоматически. По умолчанию 4000 (ошибки — 0). */
  timeout?: number;
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
    const el = h(
      'div',
      {
        className: `nova-notification nova-notification-${type}`,
        role: type === 'error' ? 'alert' : 'status',
      },
      text,
      closeBtn,
    );
    this.region.append(el);

    let timer: ReturnType<typeof setTimeout> | null = null;
    const close = () => {
      if (timer) clearTimeout(timer);
      el.remove();
    };
    closeBtn.addEventListener('click', close);
    if (timeout > 0) timer = setTimeout(close, timeout);

    return { close, setText: (value) => (text.textContent = value) };
  }

  destroy(): void {
    this.region.remove();
  }
}
