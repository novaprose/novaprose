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

/** The position of the start of the n-th cell's content (in document order). */
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
  const pos = cellPos(e, index) + 2; // cell → paragraph → text
  e.view.dispatch(e.view.state.tr.setSelection(TextSelection.create(e.view.state.doc, pos)));
}

const T2x2 =
  '<table><tbody><tr><td><p>a</p></td><td><p>b</p></td></tr><tr><td><p>c</p></td><td><p>d</p></td></tr></tbody></table>';

afterEach(() => {
  editor?.destroy();
  editor = null;
  document.body.innerHTML = '';
});

describe('tables: HTML', () => {
  it('keeps a simple table', () => {
    expect(mount(T2x2).getHTML()).toBe(T2x2);
  });

  it('keeps th, colspan/rowspan and the cell background', () => {
    const html =
      '<table><tbody><tr><th colspan="2"><p>head</p></th></tr><tr><td rowspan="2" style="background-color: #fef08a;"><p>x</p></td><td><p>y</p></td></tr><tr><td><p>z</p></td></tr></tbody></table>';
    expect(mount(html).getHTML()).toBe(html);
  });

  it('the column width is duplicated in style', () => {
    const html = '<table><tbody><tr><td data-colwidth="120"><p>a</p></td></tr></tbody></table>';
    expect(mount(html).getHTML()).toBe(
      '<table><tbody><tr><td data-colwidth="120" style="width: 120px;"><p>a</p></td></tr></tbody></table>',
    );
  });

  it('cells without <p> (HTML from other editors) are wrapped in paragraphs', () => {
    expect(mount('<table><tr><td>a</td></tr></table>').getHTML()).toBe(
      '<table><tbody><tr><td><p>a</p></td></tr></tbody></table>',
    );
  });

  it('a huge colspan from pasted content is capped', () => {
    const html = mount('<table><tr><td colspan="99999">a</td></tr></table>').getHTML();
    expect(html).toContain('colspan="100"');
  });

  it('pasting a table with a cell background: the background on the cell, no mark on the text', () => {
    const e = mount('<p></p>');
    e.view.pasteHTML(
      '<table><tr><td style="background-color: rgb(254, 240, 138)">a</td></tr></table>',
    );
    expect(e.getHTML()).toContain('<td style="background-color: #fef08a;"><p>a</p></td>');
    expect(e.getHTML()).not.toContain('<span');
  });

  it('an invalid cell background is dropped', () => {
    expect(
      mount(
        '<table><tr><td style="background-color: url(javascript:x)">a</td></tr></table>',
      ).getHTML(),
    ).toBe('<table><tbody><tr><td><p>a</p></td></tr></tbody></table>');
  });
});

describe('tables: commands', () => {
  it('insertTable inserts a table with a header and puts the cursor into the first cell', () => {
    const e = mount('<p>x</p>');
    e.view.dispatch(e.view.state.tr.setSelection(TextSelection.create(e.view.state.doc, 2)));
    expect(e.exec(insertTable(2, 3))).toBe(true);
    const html = e.getHTML();
    expect(html.match(/<th>/g)).toHaveLength(3);
    expect(html.match(/<td>/g)).toHaveLength(3);
    expect(e.view.state.selection.$from.node(-1).type.name).toBe('table_header');
    // A new table isn't inserted inside a table.
    expect(e.can(insertTable(2, 2))).toBe(false);
  });

  it('rows and columns', () => {
    const e = mount(T2x2);
    cursorInCell(e, 0);
    e.exec(tableCommands.addRowAfter);
    e.exec(tableCommands.addColumnAfter);
    expect(e.getHTML().match(/<tr>/g)).toHaveLength(3);
    expect(e.getHTML().match(/<td>/g)).toHaveLength(9);
    // The cursor into the new (empty) cell where the added row and column cross, then delete them.
    cursorInCell(e, 4);
    e.exec(tableCommands.deleteRow);
    cursorInCell(e, 1);
    e.exec(tableCommands.deleteColumn);
    expect(e.getHTML()).toBe(T2x2);
  });

  it('row and column headers', () => {
    const e = mount(T2x2);
    cursorInCell(e, 0);
    expect(hasHeaderRow(e.view.state)).toBe(false);
    e.exec(tableCommands.toggleHeaderRow);
    expect(hasHeaderRow(e.view.state)).toBe(true);
    expect(e.getHTML()).toContain('<th><p>a</p></th><th><p>b</p></th>');
    e.exec(tableCommands.toggleHeaderColumn);
    expect(hasHeaderColumn(e.view.state)).toBe(true);
  });

  it('merging and splitting cells', () => {
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

  it('the cell background', () => {
    const e = mount(T2x2);
    cursorInCell(e, 3);
    e.exec(setCellBackground('#bbf7d0'));
    expect(e.getHTML()).toContain('<td style="background-color: #bbf7d0;"><p>d</p></td>');
  });

  it('deleting the table', () => {
    const e = mount(`<p>before</p>${T2x2}`);
    cursorInCell(e, 0);
    e.exec(tableCommands.deleteTable);
    expect(e.getHTML()).not.toContain('<table');
  });

  it('the table context toolbar and the table button are registered', () => {
    const e = mount();
    expect(e.ui.registry.getContextToolbars().map(([n]) => n)).toContain('table');
    expect(e.root.querySelector('[data-control="table"]')).not.toBeNull();
  });

  it('the grid panel inserts a table of the chosen size', () => {
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
