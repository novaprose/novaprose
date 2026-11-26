import { activeElement, isRtl, listenDocument } from './dom';

export type Placement = 'bottom-start' | 'bottom-end' | 'top-start' | 'top-end' | 'bottom';

export type Anchor = HTMLElement | (() => DOMRect);

const GAP = 6;
const VIEWPORT_PADDING = 8;

/**
 * The visible part of the window in getBoundingClientRect and position: fixed coordinates. On a phone with the
 * keyboard open it is smaller than the window and shifts with scrolling (visualViewport); window.innerHeight there is
 * the height of the visible part, while coordinates are relative to the whole page: mixing them made the panel drift.
 */
export function visibleArea(): { left: number; top: number; right: number; bottom: number } {
  const vv = window.visualViewport;
  if (!vv) return { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight };
  return {
    left: vv.offsetLeft,
    top: vv.offsetTop,
    right: vv.offsetLeft + vv.width,
    bottom: vv.offsetTop + vv.height,
  };
}

/**
 * Positions a floating element (position: fixed) relative to an anchor:
 * below it, or above when it doesn't fit; horizontally it is kept within the window edges.
 */
export function positionFloating(
  floating: HTMLElement,
  anchorRect: DOMRect,
  placement: Placement,
): void {
  const area = visibleArea();
  // The size without transforms: the panel appears with an animation (scale 0.98), and getBoundingClientRect
  // is smaller than the real size at that moment, so an edge aligned with the button's right edge drifted by 2%.
  const width = floating.offsetWidth;
  const height = floating.offsetHeight;

  const spaceBelow = area.bottom - anchorRect.bottom;
  const spaceAbove = anchorRect.top - area.top;
  const preferTop = placement === 'top-start' || placement === 'top-end';
  const placeTop = preferTop
    ? spaceAbove >= height + GAP || spaceAbove > spaceBelow
    : spaceBelow < height + GAP && spaceAbove > spaceBelow;

  let top = placeTop ? anchorRect.top - height - GAP : anchorRect.bottom + GAP;
  // start/end are the edges of the start and end of the line: right to left, the "start" is the right edge.
  const rtl = isRtl(floating);
  const alignEnd = (placement === 'bottom-end' || placement === 'top-end') !== rtl;
  let left =
    placement === 'bottom'
      ? anchorRect.left + anchorRect.width / 2 - width / 2
      : alignEnd
        ? anchorRect.right - width
        : anchorRect.left;

  left = Math.max(
    area.left + VIEWPORT_PADDING,
    Math.min(left, area.right - width - VIEWPORT_PADDING),
  );
  top = Math.max(
    area.top + VIEWPORT_PADDING,
    Math.min(top, area.bottom - height - VIEWPORT_PADDING),
  );

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
  /** Close on a click outside the panel (yes by default). */
  dismissOnOutside?: boolean;
  /** Elements whose clicks don't count as "outside" (for example, the anchor button). */
  ignore?: HTMLElement[];
  onClose?: (reason: 'escape' | 'outside' | 'api') => void;
}

const openStack: Popover[] = [];

/** A floating panel: a menu, the color palette, the link panel, the toolbar overflow. */
export class Popover {
  readonly el: HTMLDivElement;
  private readonly options: PopoverOptions;
  private closed = false;
  private unlisten: (() => void)[] = [];

  constructor(options: PopoverOptions) {
    this.options = options;
    this.el = document.createElement('div');
    this.el.className = `nova-popover ${options.className ?? ''}`.trim();
    this.el.append(options.content);
    options.host.append(this.el);

    this.reposition();
    // Escape is caught on the document: a panel opened with the mouse doesn't take focus from the text,
    // but it still has to close on Escape.
    this.unlisten = [
      listenDocument(this.el, 'keydown', this.onKeyDown),
      listenDocument(this.el, 'pointerdown', this.onPointerDown),
    ];
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
    this.unlisten.forEach((stop) => stop());
    window.removeEventListener('resize', this.reposition);
    window.removeEventListener('scroll', this.reposition, true);
    this.el.remove();
    this.options.onClose?.(reason);
  }

  /** Whether focus was inside the panel when it closed (then it goes back to the button). */
  focusWasInside = false;

  private onKeyDown = (event: KeyboardEvent, target: Node | null): void => {
    if (event.key !== 'Escape' || event.defaultPrevented) return;
    // Nested panels ("⋯" → menu): Escape closes only the top one.
    if (openStack[openStack.length - 1] !== this) return;
    // If a dialog is open on top, Escape belongs to it.
    if ((target as Element | null)?.closest?.('.nova-dialog')) return;
    event.preventDefault();
    event.stopPropagation();
    this.focusWasInside = this.el.contains(activeElement(this.el));
    this.close('escape');
  };

  private onPointerDown = (_event: PointerEvent, target: Node | null): void => {
    if (this.options.dismissOnOutside === false) return;
    if (this.el.contains(target)) return;
    if (this.options.ignore?.some((el) => el.contains(target))) return;
    this.close('outside');
  };
}
