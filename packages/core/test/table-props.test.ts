import { TextSelection } from 'prosemirror-state';
import { CellSelection } from 'prosemirror-tables';
import { afterEach, describe, expect, it } from 'vitest';
import { createEditor, type Editor } from '../src';
import { setCellProps, setTableProps, sortTable } from '../src/table';

/** Сортировка таблиц, свойства таблицы и ячеек. */

const editors: Editor[] = [];
function mount(content: string): Editor {
  const element = document.createElement('div');
  document.body.appendChild(element);
  const editor = createEditor({ element, content, language: 'en' });
  editors.push(editor);
  return editor;
}
afterEach(() => {
  editors.splice(0).forEach((e) => e.destroy());
  document.body.innerHTML = '';
});

/** Курсор в ячейку с текстом text. */
function cursorIn(editor: Editor, text: string): void {
  let pos = -1;
  editor.view.state.doc.descendants((node, p) => {
    if (pos < 0 && node.isText && node.text === text) pos = p;
    return pos < 0;
  });
  editor.view.dispatch(
    editor.view.state.tr.setSelection(TextSelection.create(editor.view.state.doc, pos)),
  );
}

const row = (...cells: string[]) => `<tr>${cells.map((c) => `<td><p>${c}</p></td>`).join('')}</tr>`;
const head = (...cells: string[]) =>
  `<tr>${cells.map((c) => `<th><p>${c}</p></th>`).join('')}</tr>`;
const table = (...rows: string[]) => `<table><tbody>${rows.join('')}</tbody></table>`;
const column = (editor: Editor, index: number) =>
  [...editor.root.querySelectorAll('tbody tr')].map((tr) => tr.children[index]?.textContent);

describe('сортировка', () => {
  it('числа — как числа, заголовок остаётся сверху, в обе стороны', () => {
    const editor = mount(
      table(
        head('Item', 'Cost'),
        row('Hosting', '$1,200'),
        row('Domains', '$45'),
        row('Mail', '$310.50'),
      ),
    );
    cursorIn(editor, '$45');
    expect(editor.exec(sortTable('asc'))).toBe(true);
    expect(column(editor, 1)).toEqual(['Cost', '$45', '$310.50', '$1,200']);
    expect(editor.exec(sortTable('desc'))).toBe(true);
    expect(column(editor, 1)).toEqual(['Cost', '$1,200', '$310.50', '$45']);
  });

  it('текст — по алфавиту с учётом языка; пустые ячейки в конце', () => {
    const editor = mount(table(row('Яблоко'), row(''), row('арбуз'), row('Ёжик'), row('банан')));
    cursorIn(editor, 'банан');
    editor.exec(sortTable('asc', 'ru'));
    expect(column(editor, 0)).toEqual(['арбуз', 'банан', 'Ёжик', 'Яблоко', '']);
  });

  it('таблица с объединёнными ячейками не сортируется', () => {
    const editor = mount(
      '<table><tbody><tr><td colspan="2"><p>merged</p></td></tr>' +
        row('b', '2') +
        row('a', '1') +
        '</tbody></table>',
    );
    cursorIn(editor, 'a');
    expect(editor.can(sortTable('asc'))).toBe(false);
  });

  it('сортировка отменяется одним undo', () => {
    const editor = mount(table(row('b'), row('a')));
    cursorIn(editor, 'a');
    editor.exec(sortTable('asc'));
    editor.exec('undo');
    expect(column(editor, 0)).toEqual(['b', 'a']);
  });
});

describe('свойства таблицы', () => {
  it('ширина и выравнивание: HTML туда-обратно', () => {
    const html =
      '<table style="width: 100%;"><tbody><tr><td><p>a</p></td></tr></tbody></table><table style="width: 600px; margin-left: auto; margin-right: auto;"><tbody><tr><td><p>b</p></td></tr></tbody></table><table style="margin-left: auto;"><tbody><tr><td><p>c</p></td></tr></tbody></table>';
    expect(mount(html).getHTML()).toBe(html);
  });

  it('старый атрибут align и недопустимая ширина', () => {
    const editor = mount(
      '<table align="center" style="width: calc(100% - 1px)"><tbody><tr><td><p>a</p></td></tr></tbody></table>',
    );
    expect(editor.getHTML()).toBe(
      '<table style="margin-left: auto; margin-right: auto;"><tbody><tr><td><p>a</p></td></tr></tbody></table>',
    );
  });

  it('команда задаёт ширину и выравнивание; в редакторе видно то же', () => {
    const editor = mount(table(row('a')));
    cursorIn(editor, 'a');
    expect(editor.exec(setTableProps({ width: '80%', align: 'center' }))).toBe(true);
    expect(editor.getHTML()).toContain(
      '<table style="width: 80%; margin-left: auto; margin-right: auto;">',
    );
    const dom = editor.root.querySelector<HTMLTableElement>('.nova-prosemirror table')!;
    expect(dom.style.width).toBe('80%');
    expect(dom.style.marginLeft).toBe('auto');
    expect(editor.exec(setTableProps({ width: 'url(x)', align: null }))).toBe(false);
  });
});

describe('свойства ячеек', () => {
  it('вертикальное выравнивание и тип ячейки для выделения', () => {
    const editor = mount(table(row('a', 'b'), row('c', 'd')));
    const { state } = editor.view;
    // Выделяем первую строку целиком.
    let first = -1;
    let second = -1;
    state.doc.descendants((node, pos) => {
      if (node.type.name === 'table_cell') {
        if (first < 0) first = pos;
        else if (second < 0) second = pos;
      }
      return true;
    });
    editor.view.dispatch(state.tr.setSelection(CellSelection.create(state.doc, first, second)));
    editor.exec(setCellProps({ valign: 'top', header: true }));
    expect(editor.getHTML()).toBe(
      '<table><tbody><tr><th style="vertical-align: top;"><p>a</p></th><th style="vertical-align: top;"><p>b</p></th></tr><tr><td><p>c</p></td><td><p>d</p></td></tr></tbody></table>',
    );
  });

  it('ширина столбца задаётся у всех его ячеек', () => {
    const editor = mount(table(row('a', 'b'), row('c', 'd')));
    cursorIn(editor, 'b');
    expect(editor.exec(setCellProps({ width: 200 }))).toBe(true);
    const html = editor.getHTML();
    // Оба ячейки столбца получают ширину — и для редактора (data-colwidth), и для сайта (style).
    expect(html.match(/style="width: 200px;"/g)?.length).toBe(2);
    expect(html.match(/data-colwidth="200"/g)?.length).toBe(2);
    expect(editor.exec(setCellProps({ width: 5 }))).toBe(false);
  });

  it('valign из старого атрибута и опасные значения', () => {
    const editor = mount(
      '<table><tbody><tr><td valign="bottom"><p>a</p></td><td style="vertical-align: expression(1)"><p>b</p></td></tr></tbody></table>',
    );
    expect(editor.getHTML()).toBe(
      '<table><tbody><tr><td style="vertical-align: bottom;"><p>a</p></td><td><p>b</p></td></tr></tbody></table>',
    );
  });
});

describe('интерфейс', () => {
  it('кнопки сортировки и свойств есть в контекстном тулбаре таблицы', () => {
    const editor = mount(table(row('a')));
    const items = editor.ui.registry.getContextToolbars().find(([name]) => name === 'table')![1]
      .items;
    expect(String(items)).toContain('advtablesort tablecellprops tableprops');
  });
});
