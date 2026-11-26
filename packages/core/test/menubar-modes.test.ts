import { TextSelection } from 'prosemirror-state';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEditor, type Editor, type EditorOptions } from '../src';

let editor: Editor | null = null;

function mount(options: Partial<EditorOptions> = {}, content = '<p>text</p>') {
  const element = document.createElement('div');
  document.body.append(element);
  editor = createEditor({ element, content, language: 'en', ...options });
  return editor;
}

const menubar = (e: Editor) => e.root.querySelector<HTMLElement>('.nova-menubar');
const menuButton = (e: Editor, name: string) =>
  e.root.querySelector<HTMLButtonElement>(`.nova-menubar [data-menu="${name}"]`)!;
const openItems = (e: Editor) =>
  [...e.root.querySelectorAll<HTMLButtonElement>('.nova-menu .nova-menu-item')].map(
    (b) => b.dataset.id,
  );

afterEach(() => {
  editor?.destroy();
  editor = null;
  document.body.innerHTML = '';
});

describe('menubar', () => {
  it('off by default', () => {
    expect(menubar(mount())).toBeNull();
  });

  it('menubar: true gives the standard menus in order', () => {
    const e = mount({ menubar: true });
    const names = [...menubar(e)!.querySelectorAll('[data-menu]')].map((b) => b.textContent);
    expect(names).toEqual(['File', 'Edit', 'View', 'Insert', 'Format', 'Table', 'Help']);
    expect(menubar(e)!.getAttribute('role')).toBe('menubar');
  });

  it("items are built from buttons when there is no menu item of its own; separators aren't duplicated", () => {
    const e = mount({ menubar: true });
    menuButton(e, 'format').click();
    const ids = openItems(e);
    expect(ids.slice(0, 3)).toEqual(['bold', 'italic', 'underline']);
    expect(ids).toContain('paragraph');
    expect(ids).toContain('removeformat');
    // Insert: insertdatetime without the plugin is skipped, the trailing separator is removed.
    menuButton(e, 'insert').click();
    expect(openItems(e)).toEqual(['image', 'link', 'inserttable', 'hr']);
    expect(
      e.root.querySelector('.nova-menu')!.lastElementChild!.classList.contains('nova-menu-sep'),
    ).toBe(false);
  });

  it('a menu item runs its action and shows its state (a check mark)', () => {
    const e = mount({ menubar: true }, '<p>text</p>');
    e.view.dispatch(e.view.state.tr.setSelection(TextSelection.create(e.view.state.doc, 1, 5)));
    menuButton(e, 'format').click();
    const bold = e.root.querySelector<HTMLButtonElement>('.nova-menu [data-id="bold"]')!;
    expect(bold.getAttribute('role')).toBe('menuitemcheckbox');
    expect(bold.getAttribute('aria-checked')).toBe('false');
    bold.click();
    expect(e.getHTML()).toBe('<p><strong>text</strong></p>');
    menuButton(e, 'format').click();
    expect(e.root.querySelector('.nova-menu [data-id="bold"]')!.getAttribute('aria-checked')).toBe(
      'true',
    );
  });

  it('a custom set of menus and overrides', () => {
    const onAction = vi.fn();
    const e = mount({
      menubar: 'insert custom',
      menu: {
        insert: { title: 'Add', items: 'link' },
        custom: { title: 'Mine', items: 'mything' },
      },
      setup: (ed) => ed.ui.registry.addMenuItem('mything', { text: 'Do it', onAction }),
    });
    expect(menuButton(e, 'insert').textContent).toBe('Add');
    menuButton(e, 'custom').click();
    e.root.querySelector<HTMLButtonElement>('.nova-menu [data-id="mything"]')!.click();
    expect(onAction).toHaveBeenCalledWith(e);
  });

  it('respects the content restrictions', () => {
    const e = mount({ menubar: true, invalidElements: 'table,img' });
    menuButton(e, 'insert').click();
    expect(openItems(e)).toEqual(['link', 'hr']);
  });

  it('the insert table dialog from the menu validates the size', async () => {
    const e = mount({ menubar: true }, '<p></p>');
    menuButton(e, 'table').click();
    e.root.querySelector<HTMLButtonElement>('.nova-menu [data-id="inserttable"]')!.click();
    const dialog = e.root.querySelector<HTMLFormElement>('.nova-dialog')!;
    const [rows, cols] = dialog.querySelectorAll<HTMLInputElement>('input');
    rows!.value = '0';
    dialog.requestSubmit();
    await new Promise((r) => setTimeout(r, 0));
    expect(dialog.querySelector('.nova-dialog-error')!.textContent).toBe(
      'Enter a number from 1 to 50',
    );
    rows!.value = '2';
    cols!.value = '4';
    dialog.requestSubmit();
    await new Promise((r) => setTimeout(r, 0));
    expect(e.getHTML().match(/<tr>/g)).toHaveLength(2);
    expect(e.getHTML().match(/<th>/g)).toHaveLength(4);
  });
});

describe('modes', () => {
  it('classic: header, toolbar and statusbar', () => {
    const e = mount();
    expect(e.root.classList.contains('nova-mode-classic')).toBe(true);
    expect(e.root.querySelector('.nova-header .nova-toolbar')).not.toBeNull();
    expect(e.root.querySelector('.nova-statusbar')).not.toBeNull();
  });

  it('inline: a toolbar, no statusbar, the is-focused class on focus', async () => {
    const e = mount({ mode: 'inline' });
    expect(e.root.querySelector('.nova-toolbar')).not.toBeNull();
    expect(e.root.querySelector('.nova-statusbar')).toBeNull();
    e.root.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    expect(e.root.classList.contains('is-focused')).toBe(true);
  });

  it('distraction-free: no header and no statusbar, quickbars attach by themselves', async () => {
    const e = mount({ mode: 'distraction-free' });
    expect(e.root.querySelector('.nova-header')).toBeNull();
    expect(e.root.querySelector('.nova-statusbar')).toBeNull();
    await e.ready;
    expect(e.hasPlugin('quickbars')).toBe(true);
  });

  it('distraction-free with an explicit toolbar shows the toolbar', () => {
    const e = mount({ mode: 'distraction-free', toolbar: 'bold italic' });
    expect(e.root.querySelector('.nova-toolbar')).not.toBeNull();
  });
});
