import type { Node as PMNode } from 'prosemirror-model';
import { TextSelection } from 'prosemirror-state';
import { CellSelection } from 'prosemirror-tables';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEditor, type AdvTableOptions, type Editor } from '../src';
import { sortProblem, sortTableBy } from '../src/table';
import { tableCommands } from '../src/tables';

/** Advanced tables: a column of row numbers that stays in order, and sorting by any column or row. */

const editors: Editor[] = [];
afterEach(() => {
  editors.splice(0).forEach((e) => e.destroy());
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

async function mount(content: string, advtable?: AdvTableOptions) {
  const element = document.createElement('div');
  document.body.appendChild(element);
  const editor = createEditor({
    element,
    content,
    plugins: ['advtable'],
    ...(advtable ? { pluginOptions: { advtable } } : {}),
  });
  editors.push(editor);
  await editor.ready;
  return editor;
}

const FRUIT =
  '<table><tbody><tr><th><p>Fruit</p></th><th><p>Price</p></th></tr>' +
  '<tr><td><p>Pear</p></td><td><p>3</p></td></tr>' +
  '<tr><td><p>Apple</p></td><td><p>12</p></td></tr>' +
  '<tr><td><p>Fig</p></td><td><p>7</p></td></tr></tbody></table>';

/** The texts of the table, row by row. */
const grid = (e: Editor) => {
  const rows: string[][] = [];
  e.view.state.doc.descendants((node) => {
    if (node.type.name === 'table_row') {
      const cells: string[] = [];
      node.forEach((cell) => cells.push(cell.textContent));
      rows.push(cells);
      return false;
    }
    return true;
  });
  return rows;
};

/** The cursor into the cell (row, col), counted from 0. */
function cursorAt(e: Editor, row: number, col: number) {
  let found = -1;
  let r = -1;
  e.view.state.doc.descendants((node, pos) => {
    if (found >= 0) return false;
    if (node.type.name === 'table_row') {
      r++;
      if (r === row) {
        let offset = pos + 1;
        for (let c = 0; c < col; c++) offset += node.child(c).nodeSize;
        found = offset + 2;
      }
      return false;
    }
    return true;
  });
  e.view.dispatch(e.view.state.tr.setSelection(TextSelection.create(e.view.state.doc, found)));
}

const menuItem = (e: Editor, name: string) => e.ui.registry.getMenuItem(name)!;

describe('advtable: the numbers column', () => {
  it('adds a first column: no number in the header row, then 1, 2, 3; the HTML reads back the same', async () => {
    const e = await mount(FRUIT);
    cursorAt(e, 1, 0);
    menuItem(e, 'advtablerownumbering').onAction(e);
    expect(grid(e)).toEqual([
      ['', 'Fruit', 'Price'],
      ['1', 'Pear', '3'],
      ['2', 'Apple', '12'],
      ['3', 'Fig', '7'],
    ]);
    const html = e.getHTML();
    // A narrow column (48px, it can be widened), on the site too.
    expect(html).toContain(
      '<th data-colwidth="48" style="width: 48px;" data-series="numeric"><p></p></th>',
    );
    expect(html).toContain(
      '<td data-colwidth="48" style="width: 48px;" data-series="numeric"><p>1</p></td>',
    );
    e.setContent(html);
    expect(e.getHTML()).toBe(html);
    expect(menuItem(e, 'advtablerownumbering').isActive!(e)).toBe(true);
  });

  it('numbers stay in order as rows are added, deleted and sorted', async () => {
    const e = await mount(FRUIT);
    cursorAt(e, 1, 0);
    menuItem(e, 'advtablerownumbering').onAction(e);
    cursorAt(e, 1, 1);
    e.exec(tableCommands.addRowAfter);
    expect(grid(e).map((row) => row[0])).toEqual(['', '1', '2', '3', '4']);
    cursorAt(e, 2, 1);
    e.exec(tableCommands.deleteRow);
    expect(grid(e)).toEqual([
      ['', 'Fruit', 'Price'],
      ['1', 'Pear', '3'],
      ['2', 'Apple', '12'],
      ['3', 'Fig', '7'],
    ]);
    // By price, descending: the rows move, the numbers stay 1, 2, 3.
    cursorAt(e, 1, 2);
    e.exec(sortTableBy({ by: 'column', direction: 'desc' }));
    expect(grid(e)).toEqual([
      ['', 'Fruit', 'Price'],
      ['1', 'Apple', '12'],
      ['2', 'Fig', '7'],
      ['3', 'Pear', '3'],
    ]);
    // One step back gives the table before the sort, numbers included.
    e.exec('undo');
    expect(grid(e)[1]).toEqual(['1', 'Pear', '3']);
  });

  it('never writes over your text: a column added before it, a cell you typed in', async () => {
    const e = await mount(FRUIT);
    cursorAt(e, 1, 0);
    menuItem(e, 'advtablerownumbering').onAction(e);
    cursorAt(e, 1, 0);
    e.exec(tableCommands.addColumnBefore);
    cursorAt(e, 1, 0);
    e.view.dispatch(e.view.state.tr.insertText('note'));
    cursorAt(e, 3, 2);
    e.exec(tableCommands.addRowAfter);
    expect(grid(e)).toEqual([
      ['', '', 'Fruit', 'Price'],
      ['note', '1', 'Pear', '3'],
      ['', '2', 'Apple', '12'],
      ['', '3', 'Fig', '7'],
      ['', '4', '', ''],
    ]);
  });

  it('letters and your own series; the same button takes the column away', async () => {
    const e = await mount(FRUIT, {
      series: { roman: { title: 'Roman', value: (i) => ['i', 'ii', 'iii', 'iv'][i] } },
    });
    cursorAt(e, 1, 0);
    const button = e.ui.registry.get('advtablerownumbering');
    if (button?.type !== 'split') throw new Error('no split button');
    const items = button.items(e);
    expect(items.map((item) => ('label' in item ? item.label : '|'))).toEqual([
      'Numbers',
      'Letters',
      'Roman',
      '|',
      'No row numbers',
    ]);
    const pick = (label: string) =>
      (
        button.items(e).find((item) => 'label' in item && item.label === label) as {
          onSelect(): void;
        }
      ).onSelect();
    pick('Letters');
    expect(grid(e).map((row) => row[0])).toEqual(['', 'A', 'B', 'C']);
    pick('Roman');
    expect(grid(e).map((row) => row[0])).toEqual(['', 'i', 'ii', 'iii']);
    button.onAction(e);
    expect(grid(e)[0]).toEqual(['Fruit', 'Price']);
    expect(e.getHTML()).not.toContain('data-series');
  });

  it('without the plugin the column is ordinary cells; a series that throws keeps the text', async () => {
    const element = document.createElement('div');
    document.body.appendChild(element);
    const plain = createEditor({
      element,
      content:
        '<table><tbody><tr><td data-series="numeric"><p>1</p></td><td><p>a</p></td></tr></tbody></table>',
    });
    editors.push(plain);
    expect(plain.getHTML()).not.toContain('data-series');
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const e = await mount(
      '<table><tbody><tr><td data-series="broken"><p>7</p></td><td><p>a</p></td></tr>' +
        '<tr><td data-series="broken"><p>8</p></td><td><p>b</p></td></tr></tbody></table>',
      {
        series: {
          broken: {
            title: 'Broken',
            value: () => {
              throw new Error('no');
            },
          },
        },
      },
    );
    cursorAt(e, 1, 1);
    e.view.dispatch(e.view.state.tr.insertText('!'));
    expect(grid(e).map((row) => row[0])).toEqual(['7', '8']);
  });
});

describe('advtable: sorting', () => {
  it('columns by a row; the header column stays at the left', async () => {
    const e = await mount(
      '<table><tbody><tr><th><p></p></th><th><p>Pear</p></th><th><p>Apple</p></th><th><p>Fig</p></th></tr>' +
        '<tr><th><p>Price</p></th><td><p>3</p></td><td><p>12</p></td><td><p>7</p></td></tr></tbody></table>',
    );
    cursorAt(e, 0, 1);
    e.exec(sortTableBy({ by: 'row', index: 0, direction: 'asc' }));
    expect(grid(e)).toEqual([
      ['', 'Apple', 'Fig', 'Pear'],
      ['Price', '12', '7', '3'],
    ]);
    e.exec(sortTableBy({ by: 'row', index: 1, direction: 'asc' }));
    expect(grid(e)[0]).toEqual(['', 'Pear', 'Fig', 'Apple']);
  });

  it('only the selected rows; rows move whole; merged cells and a single row are refused', async () => {
    const e = await mount(FRUIT);
    const rowsBefore: PMNode[] = [];
    e.view.state.doc.firstChild!.forEach((row) => rowsBefore.push(row));
    // The cells of rows 2 and 3 (Apple, Fig), by fruit descending.
    let from = -1;
    let to = -1;
    let r = -1;
    e.view.state.doc.descendants((node, pos) => {
      if (node.type.name === 'table_row') {
        r++;
        if (r === 2) from = pos + 1;
        if (r === 3) to = pos + 1 + node.firstChild!.nodeSize;
        return false;
      }
      return true;
    });
    e.view.dispatch(e.view.state.tr.setSelection(CellSelection.create(e.view.state.doc, from, to)));
    e.exec(sortTableBy({ by: 'column', index: 0, direction: 'desc', scope: 'selection' }));
    expect(grid(e).map((row) => row[0])).toEqual(['Fruit', 'Pear', 'Fig', 'Apple']);
    const table = e.view.state.doc.firstChild!;
    expect(table.child(2)).toBe(rowsBefore[3]);
    expect(table.child(3)).toBe(rowsBefore[2]);

    const merged = await mount(
      '<table><tbody><tr><td colspan="2"><p>a</p></td></tr><tr><td><p>b</p></td><td><p>c</p></td></tr>' +
        '<tr><td><p>d</p></td><td><p>e</p></td></tr></tbody></table>',
    );
    cursorAt(merged, 1, 0);
    expect(sortProblem(merged.view.state, { by: 'column', direction: 'asc' })).toBe('merged');
    const single = await mount(
      '<table><tbody><tr><th><p>h</p></th></tr><tr><td><p>x</p></td></tr></tbody></table>',
    );
    cursorAt(single, 1, 0);
    expect(sortProblem(single.view.state, { by: 'column', direction: 'asc' })).toBe('few');
  });

  it('the Sort dialog: by a chosen column, descending; a reason when it can’t', async () => {
    const e = await mount(FRUIT);
    cursorAt(e, 1, 0);
    menuItem(e, 'advtablesort').onAction(e);
    const dialog = () => e.root.querySelector<HTMLFormElement>('.nova-dialog');
    await vi.waitFor(() => expect(dialog()).not.toBeNull());
    const field = (name: string) => dialog()!.querySelector<HTMLSelectElement>(`[name="${name}"]`)!;
    expect([...field('column').options].map((o) => o.text)).toEqual([
      'Column 1: Fruit',
      'Column 2: Price',
    ]);
    expect(field('row').disabled).toBe(true);
    field('column').value = '1';
    field('direction').value = 'desc';
    dialog()!.requestSubmit();
    await vi.waitFor(() => expect(dialog()).toBeNull());
    expect(grid(e).map((row) => row[1])).toEqual(['Price', '12', '7', '3']);

    const merged = await mount(
      '<table><tbody><tr><td colspan="2"><p>a</p></td></tr><tr><td><p>b</p></td><td><p>c</p></td></tr>' +
        '<tr><td><p>d</p></td><td><p>e</p></td></tr></tbody></table>',
    );
    cursorAt(merged, 1, 0);
    menuItem(merged, 'advtablesort').onAction(merged);
    const second = () => merged.root.querySelector<HTMLFormElement>('.nova-dialog');
    await vi.waitFor(() => expect(second()).not.toBeNull());
    second()!.requestSubmit();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(second()!.textContent).toContain('A table with merged cells can’t be sorted.');
  });

  it('the sort button of the table toolbar offers the dialog too', async () => {
    const e = await mount(FRUIT);
    cursorAt(e, 1, 0);
    const button = e.ui.registry.get('advtablesort');
    if (button?.type !== 'menu') throw new Error('no menu button');
    const labels = button.items(e).map((item) => ('label' in item ? item.label : ''));
    expect(labels).toHaveLength(3);
    expect(labels[2]).toBe('Sort…');
  });
});
