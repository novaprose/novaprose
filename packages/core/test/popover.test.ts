import { afterEach, describe, expect, it } from 'vitest';
import { positionFloating } from '../src/ui/popover';

/**
 * Floating panels on a phone: with the keyboard open, the visible part of the window (visualViewport) is smaller
 * than the window and may be shifted, while getBoundingClientRect and position: fixed are relative to the whole page.
 * The panel must sit by its anchor inside the visible part, not by the window height.
 */

const original = Object.getOwnPropertyDescriptor(window, 'visualViewport');
afterEach(() => {
  if (original) Object.defineProperty(window, 'visualViewport', original);
  else delete (window as { visualViewport?: unknown }).visualViewport;
});

function floating(width = 200, height = 40): HTMLElement {
  const el = document.createElement('div');
  Object.defineProperty(el, 'offsetWidth', { value: width });
  Object.defineProperty(el, 'offsetHeight', { value: height });
  return el;
}

function setViewport(offsetTop: number, height: number, offsetLeft = 0, width = 390): void {
  Object.defineProperty(window, 'visualViewport', {
    configurable: true,
    value: { offsetTop, offsetLeft, height, width },
  });
}

describe('positionFloating and the visible part of the window', () => {
  it('the keyboard is open, the page scrolled: the panel under the anchor, inside the visible part', () => {
    // The visible part spans 400 to 800 of the page height; the anchor (a line) is at 600…624.
    setViewport(400, 400);
    const el = floating();
    positionFloating(el, new DOMRect(20, 600, 100, 24), 'bottom-start');
    expect(el.dataset.side).toBe('bottom');
    expect(parseInt(el.style.top)).toBe(630);
  });

  it('little room below: above, but not above the visible part', () => {
    setViewport(400, 400);
    const el = floating();
    positionFloating(el, new DOMRect(20, 770, 100, 24), 'bottom-start');
    expect(el.dataset.side).toBe('top');
    const top = parseInt(el.style.top);
    expect(top).toBe(770 - 40 - 6);
    expect(top).toBeGreaterThanOrEqual(400);
  });

  it('horizontally within the visible part when zoomed in', () => {
    setViewport(0, 600, 100, 200);
    const el = floating(150);
    positionFloating(el, new DOMRect(20, 100, 50, 20), 'bottom-start');
    expect(parseInt(el.style.left)).toBe(108);
  });
});
