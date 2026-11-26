import { TextSelection } from 'prosemirror-state';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEditor, type Editor, type EditorOptions, type MergeTagsOptions } from '../src';

/** Переменные шаблона (mergetags): узел, HTML туда-обратно, вставка из меню и по «{{». */

let editor: Editor | null = null;
afterEach(() => {
  editor?.destroy();
  editor = null;
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

const LIST: MergeTagsOptions['list'] = [
  {
    title: 'Клиент',
    items: [
      { key: 'client', label: 'Имя клиента' },
      { key: 'phone', label: 'Телефон' },
    ],
  },
  { key: 'orderId', label: 'Номер заказа' },
];

function mount(
  content: string,
  mergetags: MergeTagsOptions = { list: LIST },
  extra: Partial<EditorOptions> = {},
) {
  const element = document.createElement('div');
  document.body.append(element);
  editor = createEditor({
    element,
    content,
    plugins: ['mergetags'],
    pluginOptions: { mergetags },
    ...extra,
  });
  editor.focus();
  return editor;
}

function type(e: Editor, text: string) {
  const { state } = e.view;
  const end = state.doc.content.size - 1;
  e.view.dispatch(state.tr.setSelection(TextSelection.create(state.doc, end)).insertText(text));
}

const key = (e: Editor, k: string) =>
  e.view.dom.dispatchEvent(
    new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }),
  );
const flush = () => new Promise((r) => setTimeout(r, 0));

describe('mergetags: HTML', () => {
  // Найдено property-based тестом: JSON приходит снаружи, метка может оказаться числом.
  it('getHTML не падает, если в JSON метка — не строка', () => {
    const e = mount('<p>a</p>');
    e.setContent({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'mergetag', attrs: { key: 'client', label: 1 } },
            { type: 'mergetag', attrs: { key: 'phone', label: null } },
          ],
        },
      ],
    });
    expect(e.getHTML()).toBe(
      '<p><span data-mergetag="client" contenteditable="false">1</span><span data-mergetag="phone" contenteditable="false">phone</span></p>',
    );
  });

  it('туда-обратно без изменений (атрибут по умолчанию)', () => {
    const html =
      '<p>Клиент: <span data-mergetag="client" contenteditable="false">Имя клиента</span>, заказ № <span data-mergetag="orderId" contenteditable="false">Номер заказа</span></p>';
    const e = mount(html);
    expect(e.getHTML()).toBe(html);
    expect(e.root.querySelectorAll('.nova-mergetag')).toHaveLength(2);
  });

  it('свой атрибут (data-var): «фишка» из чужого редактора со стилями сохраняет ключ и подпись', () => {
    const e = mount(
      '<p>от <span contenteditable="false" data-var="client" style="background:#dbeafe;color:#1d4ed8;font-weight:500">Имя клиента</span></p>',
      { list: LIST, attribute: 'data-var' },
    );
    expect(e.getHTML()).toBe(
      '<p>от <span data-var="client" contenteditable="false">Имя клиента</span></p>',
    );
  });

  it('подпись берётся из списка; неизвестный ключ не теряется, а подсвечивается', () => {
    const e = mount(
      '<p><span data-mergetag="phone">Старая подпись</span> <span data-mergetag="legacy_key">Что-то</span></p>',
    );
    const chips = [...e.root.querySelectorAll<HTMLElement>('.nova-mergetag')];
    expect(chips.map((c) => c.textContent)).toEqual(['Телефон', 'Что-то']);
    expect(chips[1]!.classList.contains('is-unknown')).toBe(true);
    expect(e.getHTML()).toContain('data-mergetag="legacy_key"');
  });

  it('некорректный ключ и атрибут не попадают в HTML', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const e = mount('<p><span data-mergetag="a b">x</span></p>');
    expect(e.getHTML()).toBe('<p>x</p>');
    e.destroy();
    mount('<p><span onclick="x">y</span></p>', { attribute: 'onclick' });
    expect(warn.mock.calls.join('\n')).toMatch(/data-name/);
    expect(editor!.getHTML()).toBe('<p>y</p>');
  });
});

describe('mergetags: вставка', () => {
  it('меню: группы, вставка в позицию курсора', async () => {
    const e = mount('<p>Заказ №</p>', { list: LIST }, { toolbar: 'mergetags' });
    // Кнопки плагина регистрирует его ленивая часть — после editor.ready.
    await e.ready;
    const button = e.root.querySelector<HTMLButtonElement>('[data-control="mergetags"]')!;
    expect(button.getAttribute('aria-label')).toBe('Insert variable');
    const { state } = e.view;
    e.view.dispatch(
      state.tr.setSelection(TextSelection.create(state.doc, state.doc.content.size - 1)),
    );
    button.click();
    const menu = e.root.querySelector<HTMLElement>('.nova-menu')!;
    expect(menu.querySelector('.nova-menu-heading')!.textContent).toBe('Клиент');
    [...menu.querySelectorAll<HTMLButtonElement>('.nova-menu-item')]
      .find((b) => b.textContent?.includes('Номер заказа'))!
      .click();
    expect(e.getHTML()).toBe(
      '<p>Заказ №<span data-mergetag="orderId" contenteditable="false">Номер заказа</span></p>',
    );
  });

  it('пустой список — кнопка неактивна', async () => {
    const e = mount('<p>x</p>', { list: [] }, { toolbar: 'mergetags' });
    await e.ready;
    expect(e.root.querySelector<HTMLButtonElement>('[data-control="mergetags"]')!.disabled).toBe(
      true,
    );
  });

  it('«{{» и поиск по подписи: Enter вставляет переменную вместо набранного', async () => {
    const e = mount('<p>Здравствуйте, </p>');
    await e.ready;
    type(e, ' {{тел');
    await flush();
    const list = e.root.querySelector<HTMLElement>('.nova-ac')!;
    expect(list.textContent).toContain('Телефон');
    key(e, 'Enter');
    expect(e.getHTML()).toBe(
      '<p>Здравствуйте, <span data-mergetag="phone" contenteditable="false">Телефон</span></p>',
    );
  });
});
