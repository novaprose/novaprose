import { TextSelection } from 'prosemirror-state';
import { afterEach, describe, expect, it } from 'vitest';
import {
  createEditor,
  isSuggesting,
  listSuggestions,
  resolveSuggestions,
  setSuggesting,
  suggestionsResult,
  type Editor,
} from '../src';

/** Режим правок: ввод превращается в предложения, их принимают и отклоняют. */

const editors: Editor[] = [];
afterEach(() => {
  editors.splice(0).forEach((e) => e.destroy());
  document.body.innerHTML = '';
});

function mount(content: string, options: Record<string, unknown> = { enabled: true }) {
  const element = document.createElement('div');
  document.body.appendChild(element);
  const editor = createEditor({
    element,
    content,
    plugins: ['suggestions'],
    pluginOptions: { suggestions: { author: { id: 'u1', name: 'Anna' }, ...options } },
  });
  editors.push(editor);
  return editor;
}

/** HTML без случайных id и времени. */
const html = (editor: Editor) =>
  editor
    .getHTML()
    .replace(/ data-suggestion="[^"]+"/g, '')
    .replace(/ data-time="\d+"/g, '')
    .replace(/ data-author="u1" data-name="Anna"/g, '');

const cursor = (editor: Editor, pos: number) =>
  editor.view.dispatch(
    editor.view.state.tr.setSelection(TextSelection.create(editor.view.state.doc, pos)),
  );
const type = (editor: Editor, text: string) => {
  for (const ch of text) editor.view.dispatch(editor.view.state.tr.insertText(ch));
};
/** Как Backspace: удалить символ перед курсором. */
const backspace = (editor: Editor) => {
  const { from } = editor.view.state.selection;
  editor.view.dispatch(editor.view.state.tr.delete(from - 1, from));
};
/** Как Delete: удалить символ после курсора. */
const del = (editor: Editor) => {
  const { from } = editor.view.state.selection;
  editor.view.dispatch(editor.view.state.tr.delete(from, from + 1));
};

describe('режим правок', () => {
  it('выключен по умолчанию: ввод меняет текст напрямую', () => {
    const editor = mount('<p>Hi</p>', {});
    expect(isSuggesting(editor.view.state)).toBe(false);
    cursor(editor, 3);
    type(editor, '!');
    expect(editor.getHTML()).toBe('<p>Hi!</p>');
  });

  it('набранный текст — одна вставка с автором', () => {
    const editor = mount('<p>Hello world</p>');
    cursor(editor, 7);
    type(editor, 'big ');
    expect(html(editor)).toBe('<p>Hello <ins>big </ins>world</p>');
    const [s] = listSuggestions(editor.view.state.doc);
    expect(s).toMatchObject({ kind: 'insert', text: 'big ', author: { id: 'u1', name: 'Anna' } });
    expect(listSuggestions(editor.view.state.doc)).toHaveLength(1);
  });

  it('Backspace помечает удаление, текст остаётся, курсор идёт влево; одна правка', () => {
    const editor = mount('<p>Hello world</p>');
    cursor(editor, 12);
    backspace(editor);
    backspace(editor);
    expect(html(editor)).toBe('<p>Hello wor<del>ld</del></p>');
    expect(editor.view.state.selection.from).toBe(10);
    expect(listSuggestions(editor.view.state.doc)).toHaveLength(1);
  });

  it('стёр слово и печатает: замена читается «удалено, затем вставлено»', () => {
    const editor = mount('<p>Ship in May</p>');
    cursor(editor, 12);
    for (let i = 0; i < 3; i += 1) backspace(editor);
    type(editor, 'June');
    expect(html(editor)).toBe('<p>Ship in <del>May</del><ins>June</ins></p>');
    expect(editor.view.state.selection.from).toBe(16);
  });

  it('Delete помечает символ справа и перепрыгивает его', () => {
    const editor = mount('<p>abc</p>');
    cursor(editor, 1);
    del(editor);
    del(editor);
    expect(html(editor)).toBe('<p><del>ab</del>c</p>');
    expect(editor.view.state.selection.from).toBe(3);
  });

  it('Backspace по своей ещё не принятой вставке удаляет её по-настоящему', () => {
    const editor = mount('<p>Hi</p>');
    cursor(editor, 3);
    type(editor, ' there');
    backspace(editor);
    backspace(editor);
    expect(html(editor)).toBe('<p>Hi<ins> the</ins></p>');
  });

  it('ввод поверх выделения: старое — удаление, новое — вставка после него', () => {
    const editor = mount('<p>The quick fox</p>');
    editor.view.dispatch(
      editor.view.state.tr.setSelection(TextSelection.create(editor.view.state.doc, 5, 10)),
    );
    type(editor, 'slow');
    expect(html(editor)).toBe('<p>The <del>quick</del><ins>slow</ins> fox</p>');
    expect(editor.view.state.selection.from).toBe(14);
  });

  it('принять всё / отклонить всё / одну правку', () => {
    const editor = mount('<p>The quick fox</p>');
    editor.view.dispatch(
      editor.view.state.tr.setSelection(TextSelection.create(editor.view.state.doc, 5, 10)),
    );
    type(editor, 'slow');
    expect(suggestionsResult(editor, 'accept').textContent).toBe('The slow fox');
    expect(suggestionsResult(editor, 'reject').textContent).toBe('The quick fox');

    const [deletion] = listSuggestions(editor.view.state.doc);
    editor.view.dispatch(resolveSuggestions(editor.view.state, 'reject', [deletion!.id]));
    expect(html(editor)).toBe('<p>The quick<ins>slow</ins> fox</p>');
    editor.view.dispatch(resolveSuggestions(editor.view.state, 'accept'));
    expect(editor.getHTML()).toBe('<p>The quickslow fox</p>');
  });

  it('Ctrl+Z отменяет предложение целиком, а не превращает отмену в новую правку', () => {
    const editor = mount('<p>Text</p>');
    cursor(editor, 5);
    type(editor, '!');
    expect(editor.exec('undo')).toBe(true);
    expect(editor.getHTML()).toBe('<p>Text</p>');
  });

  it('HTML туда-обратно без изменений; обычный <del> остаётся зачёркиванием', () => {
    const saved =
      '<p>A <ins data-suggestion="s1" data-author="u2" data-name="Boris" data-time="1700000000000">new</ins> <del data-suggestion="s2" data-author="u2" data-name="Boris" data-time="1700000000000">old</del> <s>gone</s></p>';
    const editor = mount(saved);
    expect(editor.getHTML()).toBe(saved);
    expect(mount('<p><del>struck</del></p>').getHTML()).toBe('<p><s>struck</s></p>');
  });

  it('данные из HTML проверяются: плохой id — не правка, имя — только текст', () => {
    const editor = mount(
      '<p><ins data-suggestion="bad id" data-name="x">a</ins><ins data-suggestion="ok" data-author="&quot;><img>" data-name="&lt;img src=x onerror=alert(1)&gt;">b</ins></p>',
    );
    const out = editor.getHTML();
    expect(out).not.toContain('<img');
    expect(out).toContain('data-name="&lt;img src=x onerror=alert(1)&gt;"');
    expect(out).not.toContain('data-author');
    expect(listSuggestions(editor.view.state.doc).map((s) => s.id)).toEqual(['ok']);
  });

  it('программные изменения без истории (addToHistory: false) не отслеживаются', () => {
    const editor = mount('<p>x</p>');
    editor.setContent('<p>Loaded</p>', { addToHistory: false });
    expect(editor.getHTML()).toBe('<p>Loaded</p>');
  });

  it('force: режим всегда включён, кнопка недоступна; без force — переключается', async () => {
    const forced = mount('<p>x</p>', { force: true });
    // Кнопки плагина регистрирует его ленивая часть — после editor.ready.
    await forced.ready;
    setSuggesting(forced, false);
    expect(isSuggesting(forced.view.state)).toBe(true);
    expect(
      forced.root.querySelector<HTMLButtonElement>('[data-control="suggestions"]')!.disabled,
    ).toBe(true);

    const free = mount('<p>x</p>', {});
    await free.ready;
    setSuggesting(free, true);
    expect(isSuggesting(free.view.state)).toBe(true);
    expect(free.view.dom.classList.contains('nova-suggesting')).toBe(true);
  });

  it('подсказка с автором и цвет автора — только в редакторе, не в HTML', () => {
    const editor = mount('<p>Hi</p>');
    cursor(editor, 3);
    type(editor, '!');
    expect(editor.view.dom.querySelector('[title]')?.getAttribute('title')).toMatch(
      /^Inserted by Anna/,
    );
    expect(editor.getHTML()).not.toContain('title');
  });

  it('отклонили текст нового абзаца — пустой строки не остаётся (Enter напрямую, текст — правка)', () => {
    const editor = mount('<p>One</p><p>Two</p>');
    cursor(editor, 4);
    editor.view.dispatch(editor.view.state.tr.split(4));
    type(editor, 'New');
    expect(html(editor)).toBe('<p>One</p><p><ins>New</ins></p><p>Two</p>');
    editor.view.dispatch(resolveSuggestions(editor.view.state, 'reject'));
    expect(editor.getHTML()).toBe('<p>One</p><p>Two</p>');
  });

  it('приняли удаление всего текста блока — блок уходит; где он обязателен — остаётся пустым', () => {
    const editor = mount('<p>One</p><p>Two</p>');
    editor.view.dispatch(editor.view.state.tr.delete(6, 9));
    expect(html(editor)).toBe('<p>One</p><p><del>Two</del></p>');
    editor.view.dispatch(resolveSuggestions(editor.view.state, 'accept'));
    expect(editor.getHTML()).toBe('<p>One</p>');

    // Пункт списка без текста — целиком.
    const list = mount('<ul><li><p>A</p></li><li><p>B</p></li></ul>');
    list.view.dispatch(list.view.state.tr.delete(8, 9));
    list.view.dispatch(resolveSuggestions(list.view.state, 'accept'));
    expect(list.getHTML()).toBe('<ul><li><p>A</p></li></ul>');

    // Единственный абзац документа и абзац пункта перед вложенным списком — обязательны.
    const only = mount('<p>Only</p>');
    only.view.dispatch(only.view.state.tr.delete(1, 5));
    only.view.dispatch(resolveSuggestions(only.view.state, 'accept'));
    expect(only.getHTML()).toBe('<p></p>');
    const nested = mount('<ul><li><p>A</p><ul><li><p>B</p></li></ul></li></ul>');
    nested.view.dispatch(nested.view.state.tr.delete(3, 4));
    nested.view.dispatch(resolveSuggestions(nested.view.state, 'accept'));
    expect(() => nested.view.state.doc.check()).not.toThrow();
    expect(nested.getHTML()).toBe('<ul><li><p></p><ul><li><p>B</p></li></ul></li></ul>');
  });
});
