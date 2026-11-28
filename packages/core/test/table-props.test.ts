import { TextSelection } from 'prosemirror-state';
import { CellSelection } from 'prosemirror-tables';
import { afterEach, describe, expect, it } from 'vitest';
import { createEditor, type Editor } from '../src';
import { setCellProps, setTableProps, sortTable } from '../src/table';

/** Table sorting, table and cell properties. */

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

/** The cursor into the cell with the text text. */
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

describe('sorting', () => {
  it('numbers as numbers, the header stays on top, both directions', () => {
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

  it('text alphabetically by the language; empty cells last', () => {
    const editor = mount(table(row('Zebra'), row(''), row('apple'), row('Éclair'), row('banana')));
    cursorIn(editor, 'banana');
    editor.exec(sortTable('asc', 'ru'));
    expect(column(editor, 0)).toEqual(['apple', 'banana', 'Éclair', 'Zebra', '']);
  });

  it("a table with merged cells isn't sorted", () => {
    const editor = mount(
      '<table><tbody><tr><td colspan="2"><p>merged</p></td></tr>' +
        row('b', '2') +
        row('a', '1') +
        '</tbody></table>',
    );
    cursorIn(editor, 'a');
    expect(editor.can(sortTable('asc'))).toBe(false);
  });

  it('sorting is undone with one undo', () => {
    const editor = mount(table(row('b'), row('a')));
    cursorIn(editor, 'a');
    editor.exec(sortTable('asc'));
    editor.exec('undo');
    expect(column(editor, 0)).toEqual(['b', 'a']);
  });
});

describe('table properties', () => {
  it('width and alignment: HTML round trip', () => {
    const html =
      '<table style="width: 100%;"><tbody><tr><td><p>a</p></td></tr></tbody></table><table style="width: 600px; margin-left: auto; margin-right: auto;"><tbody><tr><td><p>b</p></td></tr></tbody></table><table style="margin-left: auto;"><tbody><tr><td><p>c</p></td></tr></tbody></table>';
    expect(mount(html).getHTML()).toBe(html);
  });

  it('the old align attribute and an invalid width', () => {
    const editor = mount(
      '<table align="center" style="width: calc(100% - 1px)"><tbody><tr><td><p>a</p></td></tr></tbody></table>',
    );
    expect(editor.getHTML()).toBe(
      '<table style="margin-left: auto; margin-right: auto;"><tbody><tr><td><p>a</p></td></tr></tbody></table>',
    );
  });

  it('the command sets the width and alignment; the editor shows the same', () => {
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

describe('cell properties', () => {
  it('vertical alignment and cell type for a selection', () => {
    const editor = mount(table(row('a', 'b'), row('c', 'd')));
    const { state } = editor.view;
    // Select the whole first row.
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

  it('a column width is set on all of its cells', () => {
    const editor = mount(table(row('a', 'b'), row('c', 'd')));
    cursorIn(editor, 'b');
    expect(editor.exec(setCellProps({ width: 200 }))).toBe(true);
    const html = editor.getHTML();
    // Both cells of the column get the width, for the editor (data-colwidth) and for the site (style).
    expect(html.match(/style="width: 200px;"/g)?.length).toBe(2);
    expect(html.match(/data-colwidth="200"/g)?.length).toBe(2);
    expect(editor.exec(setCellProps({ width: 5 }))).toBe(false);
  });

  it('valign from the old attribute and dangerous values', () => {
    const editor = mount(
      '<table><tbody><tr><td valign="bottom"><p>a</p></td><td style="vertical-align: expression(1)"><p>b</p></td></tr></tbody></table>',
    );
    expect(editor.getHTML()).toBe(
      '<table><tbody><tr><td style="vertical-align: bottom;"><p>a</p></td><td><p>b</p></td></tr></tbody></table>',
    );
  });
});

describe('interface', () => {
  it('the sort, row numbers and properties buttons are in the table context toolbar', () => {
    const editor = mount(table(row('a')));
    const items = editor.ui.registry.getContextToolbars().find(([name]) => name === 'table')![1]
      .items;
    // Row numbers come with advanced tables (advtable): without the plugin the name is skipped.
    expect(String(items)).toContain('advtablesort advtablerownumbering tablecellprops tableprops');
  });
});
