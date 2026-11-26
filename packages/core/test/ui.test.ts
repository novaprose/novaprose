import { TextSelection } from 'prosemirror-state';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  applyLink,
  countWords,
  createEditor,
  createTranslator,
  getStyle,
  normalizeUrl,
  parseToolbar,
  registerLanguage,
  setLineHeight,
  setStyle,
  uploadImages,
  type Editor,
  type EditorOptions,
} from '../src';
import ruPack from '../src/i18n/packs/ru';

// Русский — пакет (не встроен в ядро): подключаем, как это делает клиент.
registerLanguage('ru', ruPack);

let editor: Editor | null = null;

function mount(content = '', options: Partial<EditorOptions> = {}) {
  const element = document.createElement('div');
  document.body.appendChild(element);
  editor = createEditor({ element, content, ...options });
  return editor;
}

function select(e: Editor, from: number, to: number) {
  e.view.dispatch(e.view.state.tr.setSelection(TextSelection.create(e.view.state.doc, from, to)));
}

function selectAll(e: Editor) {
  select(e, 1, e.view.state.doc.content.size - 1);
}

const control = (e: Editor, name: string) =>
  e.root.querySelector<HTMLButtonElement>(`[data-control="${name}"]`)!;

const flush = () => new Promise((r) => setTimeout(r, 0));

beforeAll(() => {
  // jsdom не реализует blob-URL.
  let n = 0;
  URL.createObjectURL ??= () => `blob:test/${++n}`;
  URL.revokeObjectURL ??= () => {};
});

afterEach(() => {
  editor?.destroy();
  editor = null;
  document.body.innerHTML = '';
});

describe('стили текста', () => {
  it.each([
    '<p><span style="color: #ff0000;">красный</span></p>',
    '<p><span style="background-color: yellow;">маркер</span></p>',
    '<p><span style="font-size: 18pt;">крупно</span></p>',
    '<p><span style="font-family: Georgia, serif;">шрифт</span></p>',
    '<p style="line-height: 1.5;">интервал</p>',
    '<h2 style="text-align: center; line-height: 2;">оба стиля</h2>',
  ])('сохраняет %s', (html) => {
    expect(mount(html).getHTML()).toBe(html);
  });

  it('приводит цвета к #rrggbb', () => {
    expect(
      mount(
        '<p><span style="color: rgb(255, 0, 0)">a</span><span style="background-color: #ABC">b</span></p>',
      ).getHTML(),
    ).toBe(
      '<p><span style="color: #ff0000;">a</span><span style="background-color: #aabbcc;">b</span></p>',
    );
  });

  it('отбрасывает опасные и невалидные значения стилей', () => {
    const html = mount(
      '<p><span style="font-size: expression(alert(1))">a</span><span style="color: url(javascript:x)">b</span></p>',
    ).getHTML();
    expect(html).toBe('<p>ab</p>');
  });

  it('не выводит невалидный стиль, пришедший через JSON', () => {
    const e = mount();
    e.setContent({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'x',
              marks: [{ type: 'color', attrs: { value: 'red; position: fixed' } }],
            },
          ],
        },
      ],
    });
    expect(e.getHTML()).toBe('<p><span>x</span></p>');
  });

  it('setStyle ставит, меняет и снимает цвет', () => {
    const e = mount('<p>текст</p>');
    selectAll(e);
    e.exec(setStyle('color', '#ff0000'));
    expect(e.getHTML()).toBe('<p><span style="color: #ff0000;">текст</span></p>');
    expect(getStyle(e.view.state, 'color')).toBe('#ff0000');
    e.exec(setStyle('color', '#00ff00'));
    expect(e.getHTML()).toBe('<p><span style="color: #00ff00;">текст</span></p>');
    e.exec(setStyle('color', null));
    expect(e.getHTML()).toBe('<p>текст</p>');
  });

  it('setStyle отказывается от невалидного значения', () => {
    const e = mount('<p>текст</p>');
    selectAll(e);
    expect(e.exec(setStyle('font_size', '12px; color: red'))).toBe(false);
  });

  it('межстрочный интервал', () => {
    const e = mount('<p>текст</p>');
    selectAll(e);
    e.exec(setLineHeight('1.5'));
    expect(e.getHTML()).toBe('<p style="line-height: 1.5;">текст</p>');
    e.exec('h1');
    expect(e.getHTML()).toBe('<h1 style="line-height: 1.5;">текст</h1>');
  });

  it('очистка форматирования убирает и стили', () => {
    const e = mount('<p><strong><span style="color: red;">текст</span></strong></p>');
    selectAll(e);
    e.exec('clearFormatting');
    expect(e.getHTML()).toBe('<p>текст</p>');
  });
});

describe('ссылки', () => {
  it.each([
    ['example.com', 'https://example.com'],
    ['www.example.com/path?q=1', 'https://www.example.com/path?q=1'],
    ['user@mail.ru', 'mailto:user@mail.ru'],
    ['https://a.b', 'https://a.b'],
    ['/docs', '/docs'],
    ['#top', '#top'],
  ])('normalizeUrl(%s) = %s', (input, output) => {
    expect(normalizeUrl(input)).toBe(output);
  });

  it('applyLink на выделении', () => {
    const e = mount('<p>текст</p>');
    selectAll(e);
    e.exec(applyLink({ href: 'example.com', target: '_blank' }));
    expect(e.getHTML()).toBe(
      '<p><a href="https://example.com" target="_blank" rel="noopener noreferrer">текст</a></p>',
    );
  });

  it('applyLink без выделения вставляет текст ссылки', () => {
    const e = mount('<p>a</p>');
    select(e, 2, 2);
    e.exec(applyLink({ href: 'https://x.io', text: ' сайт' }));
    expect(e.getHTML()).toBe('<p>a<a href="https://x.io"> сайт</a></p>');
  });

  it('applyLink меняет текст и сохраняет жирный', () => {
    const e = mount('<p><strong>старый</strong></p>');
    selectAll(e);
    e.exec(applyLink({ href: 'https://x.io', text: 'новый' }));
    expect(e.getHTML()).toBe('<p><a href="https://x.io"><strong>новый</strong></a></p>');
  });

  it('applyLink отказывается от javascript:', () => {
    const e = mount('<p>текст</p>');
    selectAll(e);
    expect(e.exec(applyLink({ href: 'javascript:alert(1)' }))).toBe(false);
  });

  it('диалог ссылки: Mod-k открывает, отправка вставляет ссылку', () => {
    const e = mount('<p>текст</p>');
    selectAll(e);
    control(e, 'link').click();
    const dialog = e.root.querySelector<HTMLFormElement>('.nova-dialog')!;
    expect(dialog).not.toBeNull();
    const [url] = dialog.querySelectorAll<HTMLInputElement>('input');
    url!.value = 'example.com';
    dialog.requestSubmit();
    return flush().then(() => {
      expect(e.root.querySelector('.nova-dialog')).toBeNull();
      expect(e.getHTML()).toBe('<p><a href="https://example.com">текст</a></p>');
    });
  });

  it('диалог ссылки показывает ошибку на небезопасный адрес и не закрывается', async () => {
    const e = mount('<p>текст</p>');
    selectAll(e);
    control(e, 'link').click();
    const dialog = e.root.querySelector<HTMLFormElement>('.nova-dialog')!;
    dialog.querySelector<HTMLInputElement>('input')!.value = 'javascript:alert(1)';
    dialog.requestSubmit();
    await flush();
    expect(e.root.querySelector('.nova-dialog')).not.toBeNull();
    expect(dialog.querySelector('.nova-dialog-error')!.textContent).not.toBe('');
    expect(e.getHTML()).toBe('<p>текст</p>');
  });

  it('Escape закрывает диалог', () => {
    const e = mount('<p>текст</p>');
    control(e, 'link').click();
    const dialog = e.root.querySelector('.nova-dialog')!;
    dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(e.root.querySelector('.nova-dialog')).toBeNull();
  });
});

describe('тулбар', () => {
  it('парсит строковый конфиг с группами', () => {
    expect(parseToolbar('undo redo |  bold italic | | link')).toEqual([
      ['undo', 'redo'],
      ['bold', 'italic'],
      ['link'],
    ]);
    expect(parseToolbar(['bold', '|', 'link'])).toEqual([['bold'], ['link']]);
  });

  it('рендерит кнопки из конфига и пропускает неизвестные', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const e = mount('<p>a</p>', { toolbar: 'bold italic | nonexistent link' });
    const names = [...e.root.querySelectorAll('[data-control]')].map((b) =>
      b.getAttribute('data-control'),
    );
    expect(names).toEqual(['bold', 'italic', 'link']);
    expect(e.root.querySelectorAll('.nova-tb-group')).toHaveLength(2);
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });

  it('кастомная кнопка через setup и registry', () => {
    const onAction = vi.fn();
    const e = mount('<p>a</p>', {
      toolbar: 'bold mybutton',
      setup: (ed) => ed.ui.registry.addButton('myButton', { text: 'Hi', tooltip: 'Мой', onAction }),
    });
    control(e, 'mybutton').click();
    expect(onAction).toHaveBeenCalledWith(e);
  });

  it('кнопка bold отражает состояние aria-pressed', () => {
    const e = mount('<p><strong>a</strong>b</p>');
    select(e, 1, 2);
    expect(control(e, 'bold').getAttribute('aria-pressed')).toBe('true');
    select(e, 3, 3);
    expect(control(e, 'bold').getAttribute('aria-pressed')).toBe('false');
  });

  it('меню стиля блока показывает текущий стиль и применяет выбранный', () => {
    const e = mount('<h2>заголовок</h2>', { language: 'ru' });
    select(e, 2, 2);
    const blocks = control(e, 'blocks');
    expect(blocks.textContent).toContain('Заголовок 2');
    blocks.click();
    expect(blocks.getAttribute('aria-expanded')).toBe('true');
    const menu = e.root.querySelector('.nova-menu')!;
    expect(menu.querySelector('[aria-checked="true"]')?.textContent).toContain('Заголовок 2');
    menu.querySelector<HTMLButtonElement>('[data-id="paragraph"]')!.click();
    expect(e.getHTML()).toBe('<p>заголовок</p>');
    expect(e.root.querySelector('.nova-menu')).toBeNull();
    expect(blocks.getAttribute('aria-expanded')).toBe('false');
  });

  it('меню: навигация стрелками', () => {
    const e = mount('<p>a</p>');
    control(e, 'blocks').click();
    const menu = e.root.querySelector<HTMLElement>('.nova-menu')!;
    const items = menu.querySelectorAll<HTMLButtonElement>('.nova-menu-item');
    expect(document.activeElement).toBe(items[0]); // отмеченный «Paragraph»
    menu.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(document.activeElement).toBe(items[1]);
    menu.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    expect(document.activeElement).toBe(items[items.length - 1]);
    menu.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(document.activeElement).toBe(items[0]);
  });

  it('палитра цвета применяет цвет', () => {
    const e = mount('<p>текст</p>');
    selectAll(e);
    control(e, 'forecolor').click();
    e.root.querySelector<HTMLButtonElement>('.nova-swatch[aria-label="#3b82f6"]')!.click();
    expect(e.getHTML()).toBe('<p><span style="color: #3b82f6;">текст</span></p>');
    expect(e.root.querySelector('.nova-color-panel')).toBeNull();
  });

  it('roving tabindex: в тулбаре только одна кнопка с tabindex=0', () => {
    const e = mount('<p>a</p>');
    const tabbable = e.root.querySelectorAll('.nova-toolbar button[tabindex="0"]');
    expect(tabbable).toHaveLength(1);
  });
});

describe('i18n', () => {
  it('английский по умолчанию, русский по language', () => {
    expect(control(mount('<p>a</p>'), 'bold').getAttribute('aria-label')).toBe('Bold');
    editor!.destroy();
    expect(control(mount('<p>a</p>', { language: 'ru' }), 'bold').getAttribute('aria-label')).toBe(
      'Жирный',
    );
  });

  it('фолбэк: pt-BR → pt → en, overrides и параметры', () => {
    registerLanguage('pt', { bold: 'Negrito' });
    expect(createTranslator('pt-BR')('bold')).toBe('Negrito');
    expect(createTranslator('pt-BR')('italic')).toBe('Italic');
    expect(createTranslator('xx')('bold')).toBe('Bold');
    expect(createTranslator('en', { bold: 'B' })('bold')).toBe('B');
    expect(createTranslator('ru')('status.words', { count: 5 })).toBe('Слов: 5');
  });
});

describe('статусбар', () => {
  it.each([
    ['', 0],
    ['Привет, мир!', 2],
    ["don't stop-motion 2026 год", 4],
    ['  много   пробелов  ', 2],
    // Китайский и японский — без пробелов: каждый знак — слово (как в текстовых процессорах).
    ['日本語の文章です', 8],
    ['你好，世界', 4],
    ['Hello 世界 and カタカナ', 8],
    // Корейский пишется с пробелами между словами.
    ['한국어 문장입니다', 2],
  ])('countWords(%j) = %i', (text, count) => {
    expect(countWords(text)).toBe(count);
  });

  it('показывает путь к элементу', () => {
    const e = mount('<ul><li><p><strong>a</strong></p></li></ul>');
    select(e, 4, 4);
    expect(e.root.querySelector('.nova-path')!.textContent).toBe('ul › li › p › strong');
  });

  it('можно отключить', () => {
    expect(
      mount('<p>a</p>', { statusbar: false }).root.querySelector('.nova-statusbar'),
    ).toBeNull();
  });
});

describe('загрузка изображений', () => {
  const png = () => new File([new Uint8Array([137, 80, 78, 71])], 'a.png', { type: 'image/png' });

  it('через uploadImage: показывает blob, затем подменяет на URL сервера', async () => {
    let resolve!: (url: string) => void;
    const uploadImage = vi.fn(() => new Promise<string>((r) => (resolve = r)));
    const e = mount('<p>a</p>', { uploadImage });
    select(e, 2, 2);
    uploadImages(e, [png()]);
    expect(e.getHTML()).toMatch(/<img src="blob:/);
    resolve('https://cdn.example.com/a.png');
    await flush();
    expect(e.getHTML()).toBe('<p>a<img src="https://cdn.example.com/a.png"></p>');
    // Подмена src не создаёт отдельный шаг undo: одна отмена убирает картинку целиком.
    e.exec('undo');
    expect(e.getHTML()).toBe('<p>a</p>');
  });

  describe('сбой загрузки', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.spyOn(console, 'error').mockImplementation(() => {});
    });
    afterEach(() => vi.useRealTimers());

    /** Обработчик, который падает `fails` раз, потом отдаёт адрес. */
    const flaky = (fails: number) => {
      let calls = 0;
      return vi.fn(() =>
        ++calls <= fails
          ? Promise.reject(new Error('503'))
          : Promise.resolve(`https://cdn.example.com/${calls}.png`),
      );
    };
    const errorBox = (e: Editor) => e.root.querySelector('.nova-notification-error');
    const action = (e: Editor, label: string) =>
      [...e.root.querySelectorAll<HTMLButtonElement>('.nova-notification-action')].find(
        (b) => b.textContent === label,
      )!;

    it('временный сбой: автоповтор, картинка загружается без участия пользователя', async () => {
      const uploadImage = flaky(2);
      const e = mount('<p>a</p>', { uploadImage });
      select(e, 2, 2);
      uploadImages(e, [png()]);
      await vi.advanceTimersByTimeAsync(5000);
      expect(uploadImage).toHaveBeenCalledTimes(3);
      expect(e.getHTML()).toBe('<p>a<img src="https://cdn.example.com/3.png"></p>');
      expect(errorBox(e)).toBeNull();
    });

    it('стойкий сбой: картинка остаётся, «Повторить» загружает её', async () => {
      const uploadImage = flaky(3);
      const e = mount('<p>a</p>', { uploadImage });
      select(e, 2, 2);
      uploadImages(e, [png()]);
      await vi.advanceTimersByTimeAsync(5000);
      expect(uploadImage).toHaveBeenCalledTimes(3);
      expect(e.getHTML()).toMatch(/<img src="blob:/);
      expect(errorBox(e)).not.toBeNull();
      action(e, 'Retry').click();
      await vi.advanceTimersByTimeAsync(0);
      expect(e.getHTML()).toBe('<p>a<img src="https://cdn.example.com/4.png"></p>');
      expect(errorBox(e)).toBeNull();
    });

    it('«Убрать картинку» и закрытие уведомления убирают её (blob: не попадёт в документ)', async () => {
      for (const how of ['remove', 'close'] as const) {
        const e = mount('<p>a</p>', { uploadImage: flaky(99) });
        select(e, 2, 2);
        uploadImages(e, [png()]);
        await vi.advanceTimersByTimeAsync(5000);
        if (how === 'remove') action(e, 'Remove image').click();
        else errorBox(e)!.querySelector<HTMLButtonElement>('[aria-label="Close"]')!.click();
        expect(e.getHTML()).toBe('<p>a</p>');
      }
    });

    it('небезопасный адрес от сервера не повторяется', async () => {
      const uploadImage = vi.fn(() => Promise.resolve('javascript:alert(1)'));
      const e = mount('<p>a</p>', { uploadImage });
      uploadImages(e, [png()]);
      await vi.advanceTimersByTimeAsync(5000);
      expect(uploadImage).toHaveBeenCalledTimes(1);
      expect(errorBox(e)).not.toBeNull();
    });

    it('картинку удалили во время загрузки — без ошибок и повторов', async () => {
      const uploadImage = flaky(99);
      const e = mount('<p>a</p>', { uploadImage });
      select(e, 2, 2);
      uploadImages(e, [png()]);
      e.setContent('<p>other</p>');
      await vi.advanceTimersByTimeAsync(5000);
      expect(uploadImage).toHaveBeenCalledTimes(1);
      expect(errorBox(e)).toBeNull();
    });
  });

  it('игнорирует не-изображения', () => {
    const e = mount('<p>a</p>');
    uploadImages(e, [new File(['x'], 'a.txt', { type: 'text/plain' })]);
    expect(e.getHTML()).toBe('<p>a</p>');
  });
});
