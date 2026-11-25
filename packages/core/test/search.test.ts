import { TextSelection } from 'prosemirror-state';
import { afterEach, describe, expect, it } from 'vitest';
import { createEditor, schema, type Editor } from '../src';
import {
  findMatches,
  findNext,
  getSearchState,
  replaceAll,
  replaceCurrent,
  setSearch,
} from '../src/search';
import { formatHTML, isFullscreen, toggleFullscreen } from '../src/ui/views';

let editor: Editor | null = null;

function mount(content: string) {
  const element = document.createElement('div');
  document.body.append(element);
  editor = createEditor({ element, content, language: 'en' });
  return editor;
}

const opts = (
  query: string,
  extra: Partial<{ caseSensitive: boolean; wholeWord: boolean }> = {},
) => ({
  query,
  caseSensitive: false,
  wholeWord: false,
  ...extra,
});

/** Текст по найденным диапазонам — так проверяем, что позиции указывают куда надо. */
const texts = (e: Editor, query: string, extra = {}) =>
  findMatches(e.view.state.doc, opts(query, extra)).map((m) =>
    e.view.state.doc.textBetween(m.from, m.to),
  );

afterEach(() => {
  editor?.destroy();
  editor = null;
  document.body.innerHTML = '';
  document.documentElement.className = '';
});

describe('findMatches', () => {
  it('без учёта регистра по умолчанию, с учётом — по флагу', () => {
    const e = mount('<p>Cat cat CAT</p>');
    expect(texts(e, 'cat')).toEqual(['Cat', 'cat', 'CAT']);
    expect(texts(e, 'cat', { caseSensitive: true })).toEqual(['cat']);
  });

  it('целые слова, включая кириллицу', () => {
    const e = mount('<p>кот котик кот, скот</p>');
    expect(texts(e, 'кот')).toHaveLength(4);
    expect(texts(e, 'кот', { wholeWord: true })).toEqual(['кот', 'кот']);
  });

  it('совпадение через границу форматирования и после картинки — позиции верные', () => {
    const e = mount(
      '<p>a<img src="https://a.io/x.png"><strong>he</strong>llo world</p><h2>hello</h2>',
    );
    expect(texts(e, 'hello')).toEqual(['hello', 'hello']);
  });

  it('спецсимволы в запросе ищутся буквально', () => {
    const e = mount('<p>1+1=2 (a.b) [x]</p>');
    expect(texts(e, '1+1')).toEqual(['1+1']);
    expect(texts(e, '(a.b)')).toEqual(['(a.b)']);
    expect(texts(e, '.')).toEqual(['.']);
  });

  it('пустой запрос — нет совпадений', () => {
    expect(findMatches(mount('<p>a</p>').view.state.doc, opts(''))).toEqual([]);
  });
});

describe('команды поиска', () => {
  it('findNext переходит по кругу и выделяет совпадение', () => {
    const e = mount('<p>one two one two one</p>');
    e.exec(setSearch(opts('one')));
    const sel = () =>
      e.view.state.doc.textBetween(e.view.state.selection.from, e.view.state.selection.to);
    e.exec(findNext(1));
    expect(getSearchState(e.view.state).current).toBe(0);
    expect(sel()).toBe('one');
    e.exec(findNext(1));
    e.exec(findNext(1));
    expect(getSearchState(e.view.state).current).toBe(2);
    e.exec(findNext(1));
    expect(getSearchState(e.view.state).current).toBe(0);
    e.exec(findNext(-1));
    expect(getSearchState(e.view.state).current).toBe(2);
  });

  it('replaceCurrent сохраняет форматирование и пересчитывает совпадения', () => {
    const e = mount('<p><strong>foo</strong> foo</p>');
    e.view.dispatch(e.view.state.tr.setSelection(TextSelection.create(e.view.state.doc, 1)));
    e.exec(setSearch(opts('foo')));
    e.exec(replaceCurrent('bar'));
    expect(e.getHTML()).toBe('<p><strong>bar</strong> foo</p>');
    expect(getSearchState(e.view.state).matches).toHaveLength(1);
  });

  it('replaceAll — один шаг отмены', () => {
    const e = mount('<p>a-a-a</p><p>a</p>');
    e.exec(setSearch(opts('a')));
    e.exec(replaceAll('bb'));
    expect(e.getHTML()).toBe('<p>bb-bb-bb</p><p>bb</p>');
    e.exec('undo');
    expect(e.getHTML()).toBe('<p>a-a-a</p><p>a</p>');
  });

  it('совпадения подсвечиваются декорациями и пересчитываются при правке', () => {
    const e = mount('<p>x y x</p>');
    e.exec(setSearch(opts('x')));
    expect(e.view.dom.querySelectorAll('.nova-search-match')).toHaveLength(2);
    e.view.dispatch(e.view.state.tr.insertText(' x', e.view.state.doc.content.size - 1));
    expect(getSearchState(e.view.state).matches).toHaveLength(3);
  });
});

describe('панель поиска', () => {
  it('Mod-f открывает, выделенный текст становится запросом, счётчик, Esc закрывает', async () => {
    const e = mount('<p>alpha beta alpha</p>');
    e.view.dispatch(e.view.state.tr.setSelection(TextSelection.create(e.view.state.doc, 1, 6)));
    e.openSearch();
    const bar = e.root.querySelector<HTMLElement>('.nova-search')!;
    expect(bar.hidden).toBe(false);
    const input = bar.querySelector<HTMLInputElement>('input[type="search"]')!;
    expect(input.value).toBe('alpha');
    expect(bar.querySelector('.nova-search-count')!.textContent).toBe('1 of 2');
    bar.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(bar.hidden).toBe(true);
    expect(e.view.dom.querySelectorAll('.nova-search-match')).toHaveLength(0);
  });

  it('«Заменить все» из панели', () => {
    const e = mount('<p>cat cat</p>');
    e.openSearch();
    const bar = e.root.querySelector<HTMLElement>('.nova-search')!;
    const [find, replace] = bar.querySelectorAll<HTMLInputElement>('input');
    find!.value = 'cat';
    find!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    replace!.value = 'dog';
    [...bar.querySelectorAll<HTMLButtonElement>('button')]
      .find((b) => b.textContent === 'Replace all')!
      .click();
    expect(e.getHTML()).toBe('<p>dog dog</p>');
    expect(bar.querySelector('.nova-search-count')!.textContent).toBe('No results');
  });
});

describe('режимы просмотра', () => {
  it('formatHTML переносит строки после блоков', () => {
    expect(formatHTML('<h1>a</h1><ul><li><p>b</p></li></ul><p>c</p>')).toBe(
      '<h1>a</h1>\n<ul>\n<li><p>b</p>\n</li>\n</ul>\n<p>c</p>',
    );
  });

  it('HTML-код: правка в диалоге применяется через схему', async () => {
    const e = mount('<p>a</p>');
    (await import('../src/ui/views')).openSourceCode(e);
    const dialog = e.root.querySelector<HTMLFormElement>('.nova-dialog')!;
    const area = dialog.querySelector('textarea')!;
    expect(area.value).toBe('<p>a</p>');
    area.value = '<h2>new</h2><script>alert(1)</script>';
    dialog.requestSubmit();
    await new Promise((r) => setTimeout(r, 0));
    expect(e.getHTML()).toBe('<h2>new</h2>');
  });

  it('предпросмотр показывает содержимое без редактирования', async () => {
    const e = mount('<p><a href="https://a.io">link</a></p>');
    (await import('../src/ui/views')).openPreview(e);
    const preview = e.root.querySelector('.nova-preview')!;
    expect(preview.querySelector('a')!.getAttribute('target')).toBe('_blank');
    expect(preview.getAttribute('contenteditable')).toBeNull();
    // Нет кнопки «сохранить» — только «закрыть».
    expect(e.root.querySelector<HTMLButtonElement>('.nova-dialog [type="submit"]')!.hidden).toBe(
      true,
    );
  });

  it('справка по горячим клавишам', async () => {
    const e = mount('<p>a</p>');
    (await import('../src/ui/views')).openHelp(e);
    const rows = e.root.querySelectorAll('.nova-help-table tr');
    expect(rows.length).toBeGreaterThan(20);
    expect(e.root.querySelector('.nova-help')!.textContent).toContain('Bold');
  });

  it('полноэкранный режим включается и выключается', () => {
    const e = mount('<p>a</p>');
    toggleFullscreen(e);
    expect(isFullscreen(e)).toBe(true);
    expect(document.documentElement.classList.contains('nova-fullscreen-lock')).toBe(true);
    toggleFullscreen(e);
    expect(isFullscreen(e)).toBe(false);
    expect(document.documentElement.classList.contains('nova-fullscreen-lock')).toBe(false);
  });

  it('schema экспортирована (sanity)', () => {
    expect(schema.nodes.table).toBeDefined();
  });
});
