export type Placement = 'bottom-start' | 'bottom-end' | 'top-start' | 'bottom';

export type Anchor = HTMLElement | (() => DOMRect);

const GAP = 6;
const VIEWPORT_PADDING = 8;

/**
 * Позиционирует плавающий элемент (position: fixed) относительно якоря:
 * снизу, а если не помещается — сверху; по горизонтали прижимает к краям окна.
 */
export function positionFloating(
  floating: HTMLElement,
  anchorRect: DOMRect,
  placement: Placement,
): void {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const { width, height } = floating.getBoundingClientRect();

  const spaceBelow = vh - anchorRect.bottom;
  const spaceAbove = anchorRect.top;
  const preferTop = placement === 'top-start';
  const placeTop = preferTop
    ? spaceAbove >= height + GAP || spaceAbove > spaceBelow
    : spaceBelow < height + GAP && spaceAbove > spaceBelow;

  let top = placeTop ? anchorRect.top - height - GAP : anchorRect.bottom + GAP;
  let left =
    placement === 'bottom-end'
      ? anchorRect.right - width
      : placement === 'bottom'
        ? anchorRect.left + anchorRect.width / 2 - width / 2
        : anchorRect.left;

  left = Math.max(VIEWPORT_PADDING, Math.min(left, vw - width - VIEWPORT_PADDING));
  top = Math.max(VIEWPORT_PADDING, Math.min(top, vh - height - VIEWPORT_PADDING));

  floating.style.left = `${Math.round(left)}px`;
  floating.style.top = `${Math.round(top)}px`;
  floating.dataset.side = placeTop ? 'top' : 'bottom';
}

export interface PopoverOptions {
  host: HTMLElement;
  anchor: Anchor;
  content: HTMLElement;
  placement?: Placement;
  className?: string;
  /** Закрывать по клику вне панели (по умолчанию да). */
  dismissOnOutside?: boolean;
  /** Элементы, клик по которым не считается «вне» (например, кнопка-якорь). */
  ignore?: HTMLElement[];
  onClose?: (reason: 'escape' | 'outside' | 'api') => void;
}

const openStack: Popover[] = [];

/** Всплывающая панель: меню, палитра цветов, панель ссылки, переполнение тулбара. */
export class Popover {
  readonly el: HTMLDivElement;
  private readonly options: PopoverOptions;
  private closed = false;

  constructor(options: PopoverOptions) {
    this.options = options;
    this.el = document.createElement('div');
    this.el.className = `nova-popover ${options.className ?? ''}`.trim();
    this.el.append(options.content);
    options.host.append(this.el);

    this.reposition();
    // Escape ловим на документе: панель, открытая мышью, не забирает фокус у текста,
    // но закрываться по Escape всё равно должна.
    document.addEventListener('keydown', this.onKeyDown, true);
    document.addEventListener('pointerdown', this.onPointerDown, true);
    openStack.push(this);
    window.addEventListener('resize', this.reposition);
    window.addEventListener('scroll', this.reposition, true);
  }

  get isOpen(): boolean {
    return !this.closed;
  }

  reposition = (): void => {
    if (this.closed) return;
    const { anchor, placement = 'bottom-start' } = this.options;
    const rect = typeof anchor === 'function' ? anchor() : anchor.getBoundingClientRect();
    positionFloating(this.el, rect, placement);
  };

  close(reason: 'escape' | 'outside' | 'api' = 'api'): void {
    if (this.closed) return;
    this.closed = true;
    openStack.splice(openStack.indexOf(this), 1);
    document.removeEventListener('keydown', this.onKeyDown, true);
    document.removeEventListener('pointerdown', this.onPointerDown, true);
    window.removeEventListener('resize', this.reposition);
    window.removeEventListener('scroll', this.reposition, true);
    this.el.remove();
    this.options.onClose?.(reason);
  }

  /** Был ли фокус внутри панели в момент закрытия (тогда его надо вернуть на кнопку). */
  focusWasInside = false;

  private onKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape' || event.defaultPrevented) return;
    // Вложенные панели («⋯» → меню): Escape закрывает только верхнюю.
    if (openStack[openStack.length - 1] !== this) return;
    // Если поверх открыт диалог — Escape принадлежит ему.
    if ((event.target as Element | null)?.closest?.('.nova-dialog')) return;
    event.preventDefault();
    event.stopPropagation();
    this.focusWasInside = this.el.contains(document.activeElement);
    this.close('escape');
  };

  private onPointerDown = (event: PointerEvent): void => {
    if (this.options.dismissOnOutside === false) return;
    const target = event.target as Node;
    if (this.el.contains(target)) return;
    if (this.options.ignore?.some((el) => el.contains(target))) return;
    this.close('outside');
  };
}
