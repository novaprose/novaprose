import { TextSelection } from 'prosemirror-state';
import { CellSelection } from 'prosemirror-tables';
import { afterEach, describe, expect, it } from 'vitest';
import { createEditor, type Editor } from '../src';
import {
  hasHeaderColumn,
  hasHeaderRow,
  insertTable,
  setCellBackground,
  tableCommands,
} from '../src/table';

let editor: Editor | null = null;

function mount(content = '<p></p>') {
  const element = document.createElement('div');
  document.body.append(element);
  editor = createEditor({ element, content });
  return editor;
}

/** Позиция начала содержимого n-й ячейки (по порядку в документе). */
function cellPos(e: Editor, index: number): number {
  let found = -1;
  let i = 0;
  e.view.state.doc.descendants((node, pos) => {
    if (found >= 0) return false;
    if (node.type.name === 'table_cell' || node.type.name === 'table_header') {
      if (i === index) found = pos;
      i++;
    }
    return true;
  });
  return found;
}

function cursorInCell(e: Editor, index: number) {
  const pos = cellPos(e, index) + 2; // cell → paragraph → текст
  e.view.dispatch(e.view.state.tr.setSelection(TextSelection.create(e.view.state.doc, pos)));
}

const T2x2 =
  '<table><tbody><tr><td><p>a</p></td><td><p>b</p></td></tr><tr><td><p>c</p></td><td><p>d</p></td></tr></tbody></table>';

afterEach(() => {
  editor?.destroy();
  editor = null;
  document.body.innerHTML = '';
});

describe('таблицы: HTML', () => {
  it('сохраняет простую таблицу', () => {
    expect(mount(T2x2).getHTML()).toBe(T2x2);
  });

  it('сохраняет th, colspan/rowspan и фон ячейки', () => {
    const html =
      '<table><tbody><tr><th colspan="2"><p>head</p></th></tr><tr><td rowspan="2" style="background-color: #fef08a;"><p>x</p></td><td><p>y</p></td></tr><tr><td><p>z</p></td></tr></tbody></table>';
    expect(mount(html).getHTML()).toBe(html);
  });

  it('ширина колонки дублируется в style', () => {
    const html = '<table><tbody><tr><td data-colwidth="120"><p>a</p></td></tr></tbody></table>';
    expect(mount(html).getHTML()).toBe(
      '<table><tbody><tr><td data-colwidth="120" style="width: 120px;"><p>a</p></td></tr></tbody></table>',
    );
  });

  it('ячейки без <p> (HTML из других редакторов) оборачиваются в абзацы', () => {
    expect(mount('<table><tr><td>a</td></tr></table>').getHTML()).toBe(
      '<table><tbody><tr><td><p>a</p></td></tr></tbody></table>',
    );
  });

  it('огромный colspan из вставки ограничивается', () => {
    const html = mount('<table><tr><td colspan="99999">a</td></tr></table>').getHTML();
    expect(html).toContain('colspan="100"');
  });

  it('вставка таблицы с фоном ячейки: фон на ячейке, без марки на тексте', () => {
    const e = mount('<p></p>');
    e.view.pasteHTML(
      '<table><tr><td style="background-color: rgb(254, 240, 138)">a</td></tr></table>',
    );
    expect(e.getHTML()).toContain('<td style="background-color: #fef08a;"><p>a</p></td>');
    expect(e.getHTML()).not.toContain('<span');
  });

  it('невалидный фон ячейки отбрасывается', () => {
    expect(
      mount(
        '<table><tr><td style="background-color: url(javascript:x)">a</td></tr></table>',
      ).getHTML(),
    ).toBe('<table><tbody><tr><td><p>a</p></td></tr></tbody></table>');
  });
});

describe('таблицы: команды', () => {
  it('insertTable вставляет таблицу с заголовком и ставит курсор в первую ячейку', () => {
    const e = mount('<p>x</p>');
    e.view.dispatch(e.view.state.tr.setSelection(TextSelection.create(e.view.state.doc, 2)));
    expect(e.exec(insertTable(2, 3))).toBe(true);
    const html = e.getHTML();
    expect(html.match(/<th>/g)).toHaveLength(3);
    expect(html.match(/<td>/g)).toHaveLength(3);
    expect(e.view.state.selection.$from.node(-1).type.name).toBe('table_header');
    // Внутри таблицы новую таблицу не вставляем.
    expect(e.can(insertTable(2, 2))).toBe(false);
  });

  it('строки и столбцы', () => {
    const e = mount(T2x2);
    cursorInCell(e, 0);
    e.exec(tableCommands.addRowAfter);
    e.exec(tableCommands.addColumnAfter);
    expect(e.getHTML().match(/<tr>/g)).toHaveLength(3);
    expect(e.getHTML().match(/<td>/g)).toHaveLength(9);
    // Курсор в новую (пустую) ячейку на пересечении добавленных строки и столбца — и удаляем их.
    cursorInCell(e, 4);
    e.exec(tableCommands.deleteRow);
    cursorInCell(e, 1);
    e.exec(tableCommands.deleteColumn);
    expect(e.getHTML()).toBe(T2x2);
  });

  it('заголовки строки и столбца', () => {
    const e = mount(T2x2);
    cursorInCell(e, 0);
    expect(hasHeaderRow(e.view.state)).toBe(false);
    e.exec(tableCommands.toggleHeaderRow);
    expect(hasHeaderRow(e.view.state)).toBe(true);
    expect(e.getHTML()).toContain('<th><p>a</p></th><th><p>b</p></th>');
    e.exec(tableCommands.toggleHeaderColumn);
    expect(hasHeaderColumn(e.view.state)).toBe(true);
  });

  it('объединение и разделение ячеек', () => {
    const e = mount(T2x2);
    const doc = e.view.state.doc;
    e.view.dispatch(
      e.view.state.tr.setSelection(CellSelection.create(doc, cellPos(e, 0), cellPos(e, 1))),
    );
    expect(e.exec(tableCommands.mergeCells)).toBe(true);
    expect(e.getHTML()).toContain('colspan="2"');
    cursorInCell(e, 0);
    expect(e.exec(tableCommands.splitCell)).toBe(true);
    expect(e.getHTML()).not.toContain('colspan');
  });

  it('фон ячейки', () => {
    const e = mount(T2x2);
    cursorInCell(e, 3);
    e.exec(setCellBackground('#bbf7d0'));
    expect(e.getHTML()).toContain('<td style="background-color: #bbf7d0;"><p>d</p></td>');
  });

  it('удаление таблицы', () => {
    const e = mount(`<p>before</p>${T2x2}`);
    cursorInCell(e, 0);
    e.exec(tableCommands.deleteTable);
    expect(e.getHTML()).not.toContain('<table');
  });

  it('контекстный тулбар таблицы и кнопка table зарегистрированы', () => {
    const e = mount();
    expect(e.ui.registry.getContextToolbars().map(([n]) => n)).toContain('table');
    expect(e.root.querySelector('[data-control="table"]')).not.toBeNull();
  });

  it('панель-сетка вставляет таблицу выбранного размера', () => {
    const e = mount();
    e.root.querySelector<HTMLButtonElement>('[data-control="table"]')!.click();
    const cell = e.root.querySelector<HTMLButtonElement>(
      '.nova-grid-cell[data-row="2"][data-col="4"]',
    )!;
    expect(cell.getAttribute('aria-label')).toBe('2 × 4');
    cell.click();
    expect(e.getHTML().match(/<tr>/g)).toHaveLength(2);
    expect(e.getHTML().match(/<th>/g)).toHaveLength(4);
  });
});
