import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEditor, type Editor } from '../src';

/**
 * What the toolbar does when it doesn't fit: 'floating' (default: "⋯" opens a panel over the text),
 * 'sliding' ("⋯" opens a strip under the toolbar), 'scrolling' (one row that scrolls), 'wrap'.
 * jsdom has no layout: the toolbar is made too narrow for its groups by hand.
 */

const editors: Editor[] = [];
afterEach(() => {
  editors.splice(0).forEach((e) => e.destroy());
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

function mount(toolbarMode?: 'floating' | 'sliding' | 'scrolling' | 'wrap') {
  // Every toolbar is wider than it is: groups go into "⋯" until one is left.
  vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(1000);
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(300);
  const element = document.createElement('div');
  document.body.appendChild(element);
  const editor = createEditor({
    element,
    content: '<p>x</p>',
    ...(toolbarMode ? { toolbarMode } : {}),
  });
  editors.push(editor);
  return editor;
}

const toolbar = (e: Editor) => e.root.querySelector<HTMLElement>('.nova-toolbar[role="toolbar"]')!;
const more = (e: Editor) => toolbar(e).querySelector<HTMLButtonElement>('.nova-tb-more')!;

describe('toolbar modes', () => {
  it('floating is the default: "⋯" opens a panel', () => {
    const e = mount();
    expect(toolbar(e).classList).toContain('nova-toolbar-floating');
    expect(more(e).hidden).toBe(false);
    expect(more(e).getAttribute('aria-haspopup')).toBe('true');
    more(e).click();
    expect(document.querySelector('.nova-tb-overflow-popover .nova-tb-group')).not.toBeNull();
  });

  it('sliding: "⋯" opens a strip under the toolbar; Escape in it closes it and goes back to "⋯"', () => {
    const e = mount('sliding');
    const strip = e.root.querySelector<HTMLElement>('.nova-tb-strip')!;
    expect(toolbar(e).nextElementSibling).toBe(strip);
    expect(strip.hidden).toBe(true);
    expect(strip.querySelector('.nova-tb-group')).not.toBeNull();
    expect(more(e).getAttribute('aria-controls')).toBe(strip.id);
    expect(more(e).getAttribute('aria-expanded')).toBe('false');
    // From the keyboard (a click with detail 0): open, and the focus goes into the strip.
    more(e).dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 0 }));
    expect(strip.hidden).toBe(false);
    expect(more(e).getAttribute('aria-expanded')).toBe('true');
    expect(strip.contains(document.activeElement)).toBe(true);
    // The first Escape dismisses the focused button's tooltip (WCAG 1.4.13), the next one the strip.
    for (let i = 0; i < 2; i++)
      document.activeElement!.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
      );
    expect(strip.hidden).toBe(true);
    expect(document.activeElement).toBe(more(e));
    // Destroyed with the editor's toolbar.
    e.destroy();
    expect(document.querySelector('.nova-tb-strip')).toBeNull();
  });

  it('scrolling: one row, no "⋯", the focused button scrolls into view', () => {
    const e = mount('scrolling');
    expect(toolbar(e).classList).toContain('nova-toolbar-scrolling');
    expect(more(e)).toBeNull();
    const button = toolbar(e).querySelectorAll<HTMLButtonElement>('button')[5]!;
    const scroll = vi.fn();
    button.scrollIntoView = scroll;
    button.focus();
    expect(scroll).toHaveBeenCalledWith({ block: 'nearest', inline: 'nearest' });
  });

  it('wrap: no "⋯", every group stays in the toolbar', () => {
    const e = mount('wrap');
    expect(more(e)).toBeNull();
    expect(e.root.querySelector('.nova-tb-strip, .nova-tb-overflow .nova-tb-group')).toBeNull();
  });
});
