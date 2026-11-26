import { formatShortcut, h } from './dom';
import { positionFloating } from './popover';

const SHOW_DELAY = 450;

/**
 * One shared tooltip per editor: the button name plus its shortcut. With a delay for the mouse, at
 * once for keyboard focus. Not shown on touch devices (there the label is in aria-label rather than
 * hidden in a tooltip).
 */
export class Tooltip {
  private readonly el: HTMLDivElement;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private target: HTMLElement | null = null;

  constructor(host: HTMLElement) {
    this.el = h('div', { className: 'nova-tooltip', role: 'tooltip', hidden: true });
    host.append(this.el);
  }

  /** Attach the tooltip to an element. The text comes from data-tooltip and data-shortcut. */
  attach(target: HTMLElement): void {
    target.addEventListener('pointerenter', (e) => {
      if (e.pointerType === 'mouse') this.schedule(target);
    });
    target.addEventListener('pointerleave', () => this.hide());
    target.addEventListener('focus', () => {
      if (target.matches(':focus-visible')) this.show(target);
    });
    target.addEventListener('blur', () => this.hide());
    target.addEventListener('pointerdown', () => this.hide());
  }

  private schedule(target: HTMLElement): void {
    this.clearTimer();
    this.timer = setTimeout(() => this.show(target), SHOW_DELAY);
  }

  show(target: HTMLElement): void {
    this.clearTimer();
    const text = target.dataset.tooltip;
    if (!text || target.getAttribute('aria-expanded') === 'true') return;
    this.target = target;
    const shortcut = target.dataset.shortcut;
    this.el.replaceChildren(h('span', {}, text));
    if (shortcut) this.el.append(h('kbd', {}, formatShortcut(shortcut)));
    this.el.hidden = false;
    positionFloating(this.el, target.getBoundingClientRect(), 'bottom');
  }

  hide(): void {
    this.clearTimer();
    this.el.hidden = true;
    this.target = null;
  }

  get current(): HTMLElement | null {
    return this.target;
  }

  destroy(): void {
    this.hide();
    this.el.remove();
  }

  private clearTimer(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }
}
