import { afterEach, describe, expect, it } from 'vitest';
import { positionFloating } from '../src/ui/popover';

/**
 * Плавающие панели на телефоне: с открытой клавиатурой видимая часть окна (visualViewport) меньше
 * окна и может быть сдвинута, а getBoundingClientRect и position: fixed считаются от всей страницы.
 * Панель должна вставать у якоря внутри видимой части, а не по высоте окна.
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

describe('positionFloating и видимая часть окна', () => {
  it('клавиатура открыта, страница прокручена: панель под якорем, внутри видимой части', () => {
    // Видимая часть — с 400 до 800 по высоте страницы; якорь (строка) — 600…624.
    setViewport(400, 400);
    const el = floating();
    positionFloating(el, new DOMRect(20, 600, 100, 24), 'bottom-start');
    expect(el.dataset.side).toBe('bottom');
    expect(parseInt(el.style.top)).toBe(630);
  });

  it('места снизу мало — сверху, но не выше видимой части', () => {
    setViewport(400, 400);
    const el = floating();
    positionFloating(el, new DOMRect(20, 770, 100, 24), 'bottom-start');
    expect(el.dataset.side).toBe('top');
    const top = parseInt(el.style.top);
    expect(top).toBe(770 - 40 - 6);
    expect(top).toBeGreaterThanOrEqual(400);
  });

  it('по горизонтали — в пределах видимой части при увеличении', () => {
    setViewport(0, 600, 100, 200);
    const el = floating(150);
    positionFloating(el, new DOMRect(20, 100, 50, 20), 'bottom-start');
    expect(parseInt(el.style.left)).toBe(108);
  });
});
