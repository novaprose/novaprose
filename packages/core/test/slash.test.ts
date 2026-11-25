import { TextSelection } from 'prosemirror-state';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createEditor,
  createTranslator,
  defaultSlashCommands,
  rankSlashCommands,
  type Editor,
} from '../src';

let editor: Editor | null = null;

function mount(
  content = '<p></p>',
  options: Parameters<typeof createEditor>[0] extends infer O ? Partial<O> : never = {},
) {
  const element = document.createElement('div');
  document.body.append(element);
  editor = createEditor({ element, content, ...options });
  editor.focus();
  return editor;
}

/** Набрать текст в конце документа (как ввод с клавиатуры — через транзакцию). */
function type(e: Editor, text: string) {
  const { state } = e.view;
  const end = state.doc.content.size - 1;
  e.view.dispatch(state.tr.setSelection(TextSelection.create(state.doc, end)).insertText(text));
}

const key = (e: Editor, k: string) =>
  e.view.dom.dispatchEvent(
    new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }),
  );

const list = (e: Editor) => e.root.querySelector<HTMLElement>('.nova-ac')!;
const flush = () => new Promise((r) => setTimeout(r, 0));

afterEach(() => {
  editor?.destroy();
  editor = null;
  document.body.innerHTML = '';
});

describe('rankSlashCommands', () => {
  const tEn = createTranslator('en');
  const tRu = createTranslator('ru');
  const names = (q: string, t = tEn) =>
    rankSlashCommands(defaultSlashCommands, q, t).map((c) => c.name);

  it('пустой запрос — все команды по порядку', () => {
    expect(names('')).toEqual(defaultSlashCommands.map((c) => c.name));
  });

  it('ищет по подписи и ключевым словам; начало важнее середины', () => {
    expect(names('head').slice(0, 3)).toEqual(['h1', 'h2', 'h3']);
    expect(names('h2')[0]).toBe('h2');
    expect(names('quote')).toEqual(['blockquote']);
    expect(names('zzz')).toEqual([]);
  });

  it('русские подписи и английские ключевые слова работают в русском UI', () => {
    expect(names('загол', tRu).slice(0, 3)).toEqual(['h1', 'h2', 'h3']);
    expect(names('цит', tRu)).toEqual(['blockquote']);
    expect(names('quote', tRu)).toEqual(['blockquote']);
  });
});

describe('слэш-команды в редакторе', () => {
  it('«/» показывает список, Enter применяет команду и убирает «/запрос»', async () => {
    const e = mount();
    type(e, '/hea');
    await flush();
    expect(list(e).hidden).toBe(false);
    expect(e.view.dom.getAttribute('aria-expanded')).toBe('true');
    const options = [...list(e).querySelectorAll('[role="option"]')].map((o) => o.textContent);
    expect(options[0]).toContain('Heading 1');
    key(e, 'ArrowDown');
    key(e, 'Enter');
    expect(e.getHTML()).toBe('<h2></h2>');
    expect(list(e).hidden).toBe(true);
  });

  it('Escape закрывает и не открывает снова для того же «/»', async () => {
    const e = mount();
    type(e, '/');
    await flush();
    key(e, 'Escape');
    expect(list(e).hidden).toBe(true);
    type(e, 'q');
    await flush();
    expect(list(e).hidden).toBe(true);
    expect(e.getHTML()).toBe('<p>/q</p>');
  });

  it('не срабатывает посреди слова (адреса, дроби)', async () => {
    const e = mount();
    type(e, 'and/or');
    await flush();
    expect(list(e).hidden).toBe(true);
  });

  it('после пробела срабатывает', async () => {
    const e = mount();
    type(e, 'text /quo');
    await flush();
    expect(list(e).hidden).toBe(false);
  });

  it('не срабатывает в блоке кода', async () => {
    const e = mount('<pre><code></code></pre>');
    type(e, '/');
    await flush();
    expect(list(e).hidden).toBe(true);
  });

  it('пустой результат показывает текст «ничего не найдено»', async () => {
    const e = mount();
    type(e, '/zzzz');
    await flush();
    expect(list(e).hidden).toBe(false);
    expect(list(e).textContent).toBe('No matching commands');
    // Enter при пустом списке не перехватывается — обычный перенос строки.
    key(e, 'Enter');
    expect(e.getHTML()).toBe('<p>/zzzz</p><p></p>');
  });

  it('свои команды через опцию и выключение', async () => {
    const run = vi.fn();
    const e = mount('<p></p>', {
      slashCommands: [{ name: 'sig', label: 'link', icon: '', keywords: ['signature'], run }],
    });
    type(e, '/signa');
    await flush();
    key(e, 'Enter');
    expect(run).toHaveBeenCalledWith(e);
    e.destroy();
    const off = mount('<p></p>', { slashCommands: false });
    expect(off.ui.registry.getAutocompleters()).toHaveLength(0);
  });
});
