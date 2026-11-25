import { TextSelection } from 'prosemirror-state';
import { afterEach, describe, expect, it } from 'vitest';
import { createEditor, type Editor } from '../src';

let editor: Editor | null = null;

afterEach(() => {
  editor?.destroy();
  editor = null;
  document.body.innerHTML = '';
});

describe('меню «Ещё формат»', () => {
  it('есть в тулбаре по умолчанию и включает надстрочный', () => {
    const element = document.createElement('div');
    document.body.append(element);
    editor = createEditor({ element, content: '<p>x2</p>' });
    const e = editor;
    e.view.dispatch(e.view.state.tr.setSelection(TextSelection.create(e.view.state.doc, 2, 3)));

    const button = e.root.querySelector<HTMLButtonElement>('[data-control="moreformats"]')!;
    expect(button).not.toBeNull();
    button.click();

    const sup = e.root.querySelector<HTMLButtonElement>('.nova-menu [data-id="superscript"]')!;
    expect(sup.getAttribute('role')).toBe('menuitemcheckbox');
    expect(sup.getAttribute('aria-checked')).toBe('false');
    sup.click();
    expect(e.getHTML()).toBe('<p>x<sup>2</sup></p>');
    expect(button.classList.contains('is-active')).toBe(true);

    // Пункт без состояния (очистка) — обычный menuitem.
    button.click();
    const clear = e.root.querySelector('.nova-menu [data-id="clearFormatting"]')!;
    expect(clear.getAttribute('role')).toBe('menuitem');
    expect(clear.hasAttribute('aria-checked')).toBe(false);
  });
});
