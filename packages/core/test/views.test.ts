import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEditor, type Editor } from '../src';

/** Views: a plugin's screen in place of the editor (editor.ui.registry.addView, editor.ui.view). */

let editor: Editor | null = null;
afterEach(() => {
  editor?.destroy();
  editor = null;
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

function mount() {
  const element = document.createElement('div');
  document.body.appendChild(element);
  editor = createEditor({ element, content: '<p>Text</p>' });
  return editor;
}

describe('views', () => {
  it('a view takes the place of the editor: its title, buttons and content; Escape brings the text back', () => {
    const e = mount();
    const shown = vi.fn();
    const hidden = vi.fn();
    const done = vi.fn((ed: Editor) => ed.ui.view.hide());
    e.ui.registry.addView('report', {
      title: 'Report',
      buttons: [
        { text: 'Export', onAction: () => {} },
        { text: 'Done', buttonType: 'primary', onAction: done },
      ],
      onShow: (api) => {
        shown();
        api
          .getContainer()
          .replaceChildren(Object.assign(document.createElement('p'), { textContent: '3 words' }));
      },
      onHide: hidden,
    });
    e.focus();
    e.ui.view.show('report');
    const view = e.root.querySelector<HTMLElement>('.nova-view[data-view="report"]')!;
    expect(view.hidden).toBe(false);
    expect(view.getAttribute('aria-label')).toBe('Report');
    expect(view.querySelector('.nova-view-title')!.textContent).toBe('Report');
    expect(view.querySelector('.nova-view-body')!.textContent).toBe('3 words');
    expect(e.root.classList.contains('nova-view-open')).toBe(true);
    expect(e.ui.view.active).toBe('report');
    expect(shown).toHaveBeenCalledTimes(1);
    // The editor's own parts step aside (by CSS on the class: checked in e2e), the view has the focus.
    expect(view.contains(document.activeElement)).toBe(true);
    const primary = view.querySelector<HTMLButtonElement>('.nova-button-primary')!;
    expect(primary.textContent).toBe('Done');

    view.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
    );
    expect(view.hidden).toBe(true);
    expect(e.root.classList.contains('nova-view-open')).toBe(false);
    expect(e.ui.view.active).toBeNull();
    expect(hidden).toHaveBeenCalledTimes(1);
    expect(e.view.hasFocus() || e.view.dom.contains(document.activeElement)).toBe(true);

    // The button of the view closes it too; toggle opens and closes.
    e.ui.view.toggle('report');
    primary.click();
    expect(done).toHaveBeenCalledWith(e);
    expect(e.ui.view.active).toBeNull();
    expect(shown).toHaveBeenCalledTimes(2);
  });

  it('one view at a time; an unknown one is a warning; a failing onShow keeps the editor working', () => {
    const e = mount();
    const firstHidden = vi.fn();
    e.ui.registry.addView('one', { onHide: firstHidden });
    e.ui.registry.addView('two', {
      onShow: () => {
        throw new Error('broken');
      },
    });
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    e.ui.view.show('one');
    e.ui.view.show('two');
    expect(firstHidden).toHaveBeenCalledTimes(1);
    expect(e.ui.view.active).toBe('two');
    expect(error).toHaveBeenCalled();
    e.ui.view.show('missing');
    expect(warn).toHaveBeenCalledWith('[nova] view "missing" is not registered');
    expect(e.ui.view.active).toBe('two');
    e.ui.view.hide();
    expect(e.root.querySelectorAll('.nova-view:not([hidden])')).toHaveLength(0);
  });
});
