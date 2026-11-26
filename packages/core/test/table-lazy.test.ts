import { TextSelection } from 'prosemirror-state';
import { afterEach, describe, expect, it } from 'vitest';
import { createEditor, tableCommands, type Editor } from '../src';

/**
 * Механика таблиц (prosemirror-tables) грузится лениво: в первой загрузке — только схема и
 * вставка, команды — «заместители». Проверяем поведение до и после догрузки и то, что
 * перестройка набора плагинов не теряет правки, выделение и историю отмены.
 */

let editor: Editor | null = null;

afterEach(() => {
  editor?.destroy();
  editor = null;
  document.body.innerHTML = '';
});

function mount(content: string): Editor {
  const element = document.createElement('div');
  document.body.append(element);
  editor = createEditor({ element, content });
  return editor;
}

const TABLE = '<table><tbody><tr><td><p>a</p></td><td><p>b</p></td></tr></tbody></table>';

describe('ленивая механика таблиц', () => {
  it('до загрузки команды недоступны (false), после editor.ready — работают', async () => {
    const e = mount(TABLE);
    // Курсор в первой ячейке: table(0) > row(1) > cell(2) > p(3) > «a».
    e.view.dispatch(e.view.state.tr.setSelection(TextSelection.create(e.view.state.doc, 4)));
    expect(tableCommands.addRowAfter(e.view.state)).toBe(false);
    // Таблица из контента отображается сразу, ещё до загрузки механики.
    expect(e.view.dom.querySelectorAll('td')).toHaveLength(2);
    await e.ready;
    expect(tableCommands.addRowAfter(e.view.state, e.view.dispatch)).toBe(true);
    expect(e.view.dom.querySelectorAll('tr')).toHaveLength(2);
  });

  it('правка до загрузки сохраняется вместе с выделением и отменяется после неё', async () => {
    const e = mount('<p>start</p>');
    const end = TextSelection.atEnd(e.view.state.doc);
    e.view.dispatch(e.view.state.tr.setSelection(end).insertText(' typed'));
    await e.ready;
    expect(e.getHTML()).toBe('<p>start typed</p>');
    expect(e.view.state.selection.from).toBe(end.from + ' typed'.length);
    expect(e.exec('undo')).toBe(true);
    expect(e.getHTML()).toBe('<p>start</p>');
  });

  it('после загрузки подключены плагины механики (изменение ширины колонок)', async () => {
    const e = mount(TABLE);
    await e.ready;
    const keys = e.view.state.plugins.map((p) => (p as unknown as { key: string }).key);
    expect(keys.some((k) => k.startsWith('tableColumnResizing'))).toBe(true);
    expect(keys.some((k) => k.startsWith('selectingCells'))).toBe(true);
  });

  it('уничтожение до загрузки не падает и не трогает закрытый редактор', async () => {
    const e = mount(TABLE);
    const ready = e.ready;
    e.destroy();
    editor = null;
    await expect(ready).resolves.toBeUndefined();
  });
});
