import { splitBlock } from 'prosemirror-commands';
import { TextSelection } from 'prosemirror-state';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createEditor, type Editor } from '../src';

/** Встроенные плагины паритета с TinyMCE (ленивые, подключаются по имени). */

const editors: Editor[] = [];
async function mount(
  content: string,
  options: Partial<Parameters<typeof createEditor>[0]> = {},
): Promise<Editor> {
  const element = document.createElement('div');
  element.id = 'post';
  document.body.appendChild(element);
  const editor = createEditor({ element, content, ...options });
  editors.push(editor);
  await editor.ready;
  return editor;
}

afterEach(() => {
  editors.splice(0).forEach((e) => e.destroy());
  document.body.innerHTML = '';
  localStorage.clear();
  vi.useRealTimers();
});

/** Курсор в конец документа. */
function toEnd(editor: Editor): void {
  const { state } = editor.view;
  editor.view.dispatch(state.tr.setSelection(TextSelection.atEnd(state.doc)));
}

/** Набор текста посимвольно — как с клавиатуры (срабатывают правила ввода). */
function type(editor: Editor, text: string): void {
  for (const ch of text) {
    const view = editor.view;
    const { from, to } = view.state.selection;
    const handled = view.someProp('handleTextInput', (f) =>
      f(view, from, to, ch, () => view.state.tr.insertText(ch, from, to)),
    );
    if (!handled) view.dispatch(view.state.tr.insertText(ch, from, to));
  }
}

function clickControl(editor: Editor, name: string): void {
  editor.root.querySelector<HTMLElement>(`[data-control="${name}"]`)!.click();
}

describe('charmap', () => {
  it('панель с поиском вставляет символ', async () => {
    const editor = await mount('<p>Цена 100</p>', { plugins: ['charmap'], toolbar: 'charmap' });
    toEnd(editor);
    clickControl(editor, 'charmap');
    const search = document.querySelector<HTMLInputElement>('.nova-charmap input')!;
    search.value = 'euro';
    search.dispatchEvent(new Event('input'));
    const cells = [
      ...document.querySelectorAll<HTMLButtonElement>('.nova-charmap .nova-symbols-cell'),
    ];
    expect(cells.map((c) => c.textContent)).toEqual(['€']);
    expect(cells[0]!.getAttribute('aria-label')).toBe('euro');
    cells[0]!.click();
    expect(editor.getHTML()).toBe('<p>Цена 100€</p>');
    expect(document.querySelector('.nova-charmap')).toBeNull();
  });

  it('пункт меню открывает панель в диалоге', async () => {
    const editor = await mount('<p></p>', {
      plugins: ['charmap'],
      menubar: 'insert',
      menu: { insert: { title: 'Insert', items: 'charmap' } },
    });
    editor.ui.registry.getMenuItem('charmap')!.onAction(editor);
    expect(document.querySelector('[role="dialog"] .nova-charmap')).not.toBeNull();
  });
});

describe('emoticons', () => {
  it('автодополнение «:smi» находит эмодзи и заменяет набранное', async () => {
    const editor = await mount('<p>Привет</p>', { plugins: ['emoticons'] });
    const spec = editor.ui.registry.getAutocompleters().find(([name]) => name === 'emoticons')![1];
    const items = await spec.fetch('smi', editor);
    expect(items.map((i) => i.value)).toContain('😄');
    // «10:30» и «:)» — не запросы эмодзи.
    expect(await spec.fetch('30', editor)).toEqual([]);
    toEnd(editor);
    type(editor, ' :smi');
    const to = editor.view.state.selection.from;
    spec.onSelect(
      items.find((i) => i.value === '😄')!,
      { from: to - 4, to },
      editor,
    );
    expect(editor.getHTML()).toBe('<p>Привет 😄</p>');
  });
});

describe('nonbreaking', () => {
  it('кнопка вставляет неразрывный пробел', async () => {
    const editor = await mount('<p>100</p>', { plugins: ['nonbreaking'], toolbar: 'nonbreaking' });
    toEnd(editor);
    clickControl(editor, 'nonbreaking');
    type(editor, 'кг');
    expect(editor.getHTML()).toBe('<p>100&nbsp;кг</p>');
  });
});

describe('autolink', () => {
  it('адрес становится ссылкой после пробела, пунктуация в ссылку не входит', async () => {
    const editor = await mount('<p></p>', { plugins: ['autolink'] });
    type(editor, 'see https://example.com/a?b=1. ok');
    expect(editor.getHTML()).toBe(
      '<p>see <a href="https://example.com/a?b=1">https://example.com/a?b=1</a>. ok</p>',
    );
  });

  it('www и e-mail получают правильную схему', async () => {
    const editor = await mount('<p></p>', { plugins: ['autolink'] });
    type(editor, 'www.example.com and team@example.com ');
    expect(editor.getHTML()).toBe(
      '<p><a href="https://www.example.com">www.example.com</a> and <a href="mailto:team@example.com">team@example.com</a>&nbsp;</p>',
    );
  });

  it('Enter после адреса — тоже ссылка, и в списке', async () => {
    const editor = await mount('<ul><li><p></p></li></ul>', { plugins: ['autolink'] });
    type(editor, 'https://novaprose.com');
    // Enter в списке обрабатывает раскладка ядра (новый пункт), плагин смотрит на результат.
    editor.view.someProp('handleKeyDown', (f) =>
      f(editor.view, new KeyboardEvent('keydown', { key: 'Enter' })),
    );
    expect(editor.getHTML()).toBe(
      '<ul><li><p><a href="https://novaprose.com">https://novaprose.com</a></p></li><li><p></p></li></ul>',
    );
  });

  it('Enter в обычном абзаце', async () => {
    const editor = await mount('<p></p>', { plugins: ['autolink'] });
    type(editor, 'https://novaprose.com');
    splitBlock(editor.view.state, editor.view.dispatch);
    expect(editor.getHTML()).toBe(
      '<p><a href="https://novaprose.com">https://novaprose.com</a></p><p></p>',
    );
  });

  it('вставка адреса поверх выделения делает текст ссылкой; опасный адрес — нет', async () => {
    const editor = await mount('<p>docs here</p>', { plugins: ['autolink'] });
    const { state } = editor.view;
    editor.view.dispatch(state.tr.setSelection(TextSelection.create(state.doc, 1, 5)));
    const paste = (text: string) =>
      editor.view.dom.dispatchEvent(
        new ClipboardEvent('paste', {
          clipboardData: {
            getData: (t: string) => (t === 'text/plain' ? text : ''),
            types: ['text/plain'],
            files: [],
            items: [],
          } as unknown as DataTransfer,
          bubbles: true,
          cancelable: true,
        }),
      );
    // Опасный «адрес» вставляется как обычный текст, но не становится ссылкой.
    paste('javascript:alert(1)');
    expect(editor.getHTML()).not.toContain('href="javascript');
    editor.setContent('<p>docs here</p>');
    const s2 = editor.view.state;
    editor.view.dispatch(s2.tr.setSelection(TextSelection.create(s2.doc, 1, 5)));
    paste('https://novaprose.com/docs');
    expect(editor.getHTML()).toContain('<a href="https://novaprose.com/docs">docs</a>');
  });
});

describe('autosave', () => {
  beforeEach(() => vi.useFakeTimers());

  it('сохраняет черновик и предлагает восстановить его в новом редакторе', async () => {
    vi.useRealTimers();
    const first = await mount('<p>start</p>', {
      plugins: ['autosave'],
      pluginOptions: { autosave: { delay: 0 } },
    });
    toEnd(first);
    type(first, ' and more');
    await new Promise((r) => setTimeout(r, 5));
    first.destroy();
    editors.splice(0);
    document.body.innerHTML = '';

    const second = await mount('<p>start</p>', { plugins: ['autosave'], toolbar: 'restoredraft' });
    expect(document.body.textContent).toContain('unsaved draft');
    const button = second.root.querySelector<HTMLButtonElement>('[data-control="restoredraft"]')!;
    expect(button.disabled).toBe(false);
    button.click();
    expect(second.getHTML()).toBe('<p>start and more</p>');
  });

  it('устаревший черновик (retention) и черновик, равный содержимому, не предлагаются', async () => {
    vi.useRealTimers();
    localStorage.setItem(
      'novaprose-draft:/:post',
      JSON.stringify({ html: '<p>old</p>', time: Date.now() - 2 * 60_000 }),
    );
    const editor = await mount('<p>new</p>', {
      plugins: ['autosave'],
      toolbar: 'restoredraft',
      pluginOptions: { autosave: { retention: 1 } },
    });
    expect(
      editor.root.querySelector<HTMLButtonElement>('[data-control="restoredraft"]')!.disabled,
    ).toBe(true);
  });

  it('при закрытии редактора сохраняет изменения последней секунды', async () => {
    vi.useRealTimers();
    const editor = await mount('<p>a</p>', {
      plugins: ['autosave'],
      pluginOptions: { autosave: { key: 'k', delay: 60_000 } },
    });
    toEnd(editor);
    type(editor, 'b');
    editor.destroy();
    editors.splice(0);
    expect(JSON.parse(localStorage.getItem('k')!).html).toBe('<p>ab</p>');
  });
});

describe('autoresize и visualblocks', () => {
  it('autoresize задаёт пределы высоты', async () => {
    const editor = await mount('<p>a</p>', {
      plugins: ['autoresize'],
      pluginOptions: { autoresize: { minHeight: 120, maxHeight: 400 } },
    });
    expect(editor.root.classList.contains('nova-autoresize')).toBe(true);
    expect(editor.root.style.getPropertyValue('--nova-min-height')).toBe('120px');
    expect(editor.root.querySelector<HTMLElement>('.nova-content')!.style.maxHeight).toBe('400px');
  });

  it('visualblocks переключает показ границ блоков', async () => {
    const editor = await mount('<p>a</p>', { plugins: ['visualblocks'], toolbar: 'visualblocks' });
    const button = editor.root.querySelector<HTMLButtonElement>('[data-control="visualblocks"]')!;
    button.click();
    expect(editor.root.classList.contains('nova-visualblocks')).toBe(true);
    expect(button.getAttribute('aria-pressed')).toBe('true');
    button.click();
    expect(editor.root.classList.contains('nova-visualblocks')).toBe(false);
  });
});
