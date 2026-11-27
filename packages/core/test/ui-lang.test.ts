import { afterEach, describe, expect, it } from 'vitest';
import { createEditor, registerLanguage, type Editor } from '../src';
import dePack from '../src/i18n/packs/de';

/**
 * The interface says which language it speaks (WCAG 3.1.2): with `language`, the toolbar, menus,
 * dialogs, tooltips, the status bar and side panels carry `lang`, so a screen reader reads German
 * buttons with a German voice on an English page. The text area keeps the page's language.
 */

registerLanguage('de', dePack);

const editors: Editor[] = [];
afterEach(() => {
  editors.splice(0).forEach((e) => e.destroy());
  document.body.innerHTML = '';
});

function mount(options: Record<string, unknown> = {}) {
  const element = document.createElement('div');
  document.body.appendChild(element);
  const editor = createEditor({ element, content: '<p>Hello</p>', menubar: true, ...options });
  editors.push(editor);
  return editor;
}

describe('the language of the interface', () => {
  it('the interface parts carry lang; the text area does not take it', async () => {
    const e = mount({ language: 'de' });
    expect(e.root.querySelector('.nova-header')!.getAttribute('lang')).toBe('de');
    expect(e.root.querySelector('.nova-statusbar')!.getAttribute('lang')).toBe('de');
    expect(e.ui.overlayHost.getAttribute('lang')).toBe('de');
    expect(e.view.dom.closest('[lang]')).toBeNull();
    e.ui.registry.addSidebar('notes', { title: 'Notizen', render: () => {} });
    await e.ui.sidebar.show('notes');
    expect(e.root.querySelector('[data-sidebar="notes"]')!.getAttribute('lang')).toBe('de');
  });

  it('without the option nothing is marked: the interface follows the page', () => {
    const e = mount();
    expect(e.root.querySelector('[lang]')).toBeNull();
  });
});
