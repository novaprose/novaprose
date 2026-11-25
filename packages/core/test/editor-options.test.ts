import { TextSelection } from 'prosemirror-state';
import { afterEach, describe, expect, it } from 'vitest';
import { createEditor, type Editor, type EditorOptions } from '../src';

/** Опции паритета: blockFormats (block_formats), disabled, resize. */

let editor: Editor | null = null;
afterEach(() => {
  editor?.destroy();
  editor = null;
  document.body.innerHTML = '';
});

function mount(content = '<p>текст</p>', options: Partial<EditorOptions> = {}) {
  const element = document.createElement('div');
  document.body.appendChild(element);
  editor = createEditor({ element, content, ...options });
  return editor;
}

const control = (e: Editor, name: string) =>
  e.root.querySelector<HTMLButtonElement>(`[data-control="${name}"]`)!;

describe('blockFormats', () => {
  it('меню блоков показывает только заданные пункты, в заданном порядке и со своими подписями', () => {
    const e = mount('<h3>x</h3>', {
      blockFormats: [
        { label: 'Подзаголовок', block: 'h3' },
        { label: 'Текст', block: 'p' },
        { label: 'Неизвестно', block: 'h9' as 'h1' },
      ],
    });
    e.view.dispatch(e.view.state.tr.setSelection(TextSelection.create(e.view.state.doc, 1)));
    const blocks = control(e, 'blocks');
    expect(blocks.textContent).toContain('Подзаголовок');
    blocks.click();
    const items = [...e.root.querySelectorAll<HTMLButtonElement>('.nova-menu-item')];
    expect(items.map((i) => i.dataset.id)).toEqual(['h3', 'paragraph']);
    expect(items[0]!.textContent).toContain('Подзаголовок');
    items[1]!.click();
    expect(e.getHTML()).toBe('<p>x</p>');
  });
});

describe('disabled', () => {
  it('отключённый редактор не редактируется, не в порядке Tab, панели неактивны', () => {
    const e = mount('<p>текст</p>', { disabled: true });
    expect(e.isDisabled()).toBe(true);
    expect(e.isEditable()).toBe(false);
    expect(e.view.dom.getAttribute('contenteditable')).toBe('false');
    expect(e.view.dom.getAttribute('tabindex')).toBe('-1');
    expect(e.root.getAttribute('aria-disabled')).toBe('true');
    expect(e.root.classList.contains('nova-disabled')).toBe(true);
    expect(control(e, 'bold').disabled).toBe(true);
  });

  it('setDisabled переключает в рантайме и сообщает editableChange; «только чтение» не снимает', () => {
    const e = mount();
    let changes = 0;
    e.on('editableChange', () => changes++);
    e.setDisabled(true);
    expect(control(e, 'bold').disabled).toBe(true);
    e.setEditable(false);
    e.setDisabled(false);
    expect(changes).toBe(3);
    // Включили обратно, но «только чтение» осталось.
    expect(e.isEditable()).toBe(false);
    expect(e.root.hasAttribute('aria-disabled')).toBe(false);
    expect(e.view.dom.hasAttribute('tabindex')).toBe(false);
    e.setEditable(true);
    expect(e.isEditable()).toBe(true);
    expect(control(e, 'bold').disabled).toBe(false);
  });
});

describe('resize', () => {
  it('по умолчанию ручки нет', () => {
    const e = mount();
    expect(e.root.querySelector('.nova-resize-handle')).toBeNull();
  });

  it('ручка в статусбаре: доступна с клавиатуры, меняет высоту, не меньше минимума', () => {
    const e = mount('<p>x</p>', { resize: true });
    const handle = e.root.querySelector<HTMLElement>('.nova-statusbar .nova-resize-handle')!;
    expect(handle.getAttribute('role')).toBe('separator');
    expect(handle.getAttribute('aria-label')).toBe('Resize editor');
    expect(handle.tabIndex).toBe(0);
    expect(handle.querySelector('svg')).not.toBeNull();
    handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    // jsdom не считает вёрстку (высота 0) — срабатывает минимум.
    expect(e.root.style.height).toBe('100px');
    expect(e.root.style.width).toBe('');
  });

  it("'both' — ещё и ширина", () => {
    const e = mount('<p>x</p>', { resize: 'both' });
    const handle = e.root.querySelector<HTMLElement>('.nova-resize-handle')!;
    expect(e.root.dataset.resize).toBe('both');
    handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(e.root.style.width).toBe('200px');
  });
});
