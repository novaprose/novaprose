import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEditor, type Editor } from '../src';

/**
 * Tooltips are content shown on hover and focus (WCAG 1.4.13): Escape dismisses one without moving
 * focus or the pointer, and the pointer can move onto it without it disappearing.
 */

const editors: Editor[] = [];
afterEach(() => {
  editors.splice(0).forEach((e) => e.destroy());
  document.body.innerHTML = '';
  vi.useRealTimers();
});

function mount() {
  const element = document.createElement('div');
  document.body.appendChild(element);
  const editor = createEditor({ element, content: '<p>text</p>', toolbar: 'bold italic' });
  editors.push(editor);
  return editor;
}

/** A pointer event of a mouse (jsdom has no PointerEvent). */
function pointer(type: string, target: Element) {
  const event = new MouseEvent(type, {
    bubbles: type !== 'pointerenter' && type !== 'pointerleave',
  });
  Object.defineProperty(event, 'pointerType', { value: 'mouse' });
  target.dispatchEvent(event);
}

describe('tooltips', () => {
  it('Escape dismisses a tooltip shown by hovering, without touching focus', () => {
    vi.useFakeTimers();
    const e = mount();
    const bold = e.root.querySelector<HTMLElement>('[data-control="bold"]')!;
    const tooltip = e.root.querySelector<HTMLElement>('.nova-tooltip')!;
    e.view.focus();
    pointer('pointerenter', bold);
    vi.advanceTimersByTime(1000);
    expect(tooltip.hidden).toBe(false);
    const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    e.view.dom.dispatchEvent(escape);
    expect(tooltip.hidden).toBe(true);
    expect(document.activeElement).toBe(e.view.dom);
  });

  it('Escape dismisses a tooltip shown by keyboard focus; focus stays on the button', () => {
    const e = mount();
    const bold = e.root.querySelector<HTMLElement>('[data-control="bold"]')!;
    const tooltip = e.root.querySelector<HTMLElement>('.nova-tooltip')!;
    e.ui.tooltip.show(bold);
    bold.focus();
    expect(tooltip.hidden).toBe(false);
    const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    bold.dispatchEvent(escape);
    expect(tooltip.hidden).toBe(true);
    // The Escape was the tooltip's: the toolbar doesn't send focus back to the text with it.
    expect(escape.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(bold);
  });

  it('the pointer can move from the button onto the tooltip; leaving the tooltip hides it', () => {
    vi.useFakeTimers();
    const e = mount();
    const bold = e.root.querySelector<HTMLElement>('[data-control="bold"]')!;
    const tooltip = e.root.querySelector<HTMLElement>('.nova-tooltip')!;
    pointer('pointerenter', bold);
    vi.advanceTimersByTime(1000);
    pointer('pointerleave', bold);
    pointer('pointerenter', tooltip);
    vi.advanceTimersByTime(1000);
    expect(tooltip.hidden).toBe(false);
    pointer('pointerleave', tooltip);
    vi.advanceTimersByTime(1000);
    expect(tooltip.hidden).toBe(true);
    // Leaving the button for elsewhere hides it after the short grace period.
    pointer('pointerenter', bold);
    vi.advanceTimersByTime(1000);
    pointer('pointerleave', bold);
    vi.advanceTimersByTime(1000);
    expect(tooltip.hidden).toBe(true);
  });
});
