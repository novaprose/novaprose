import { TextSelection } from 'prosemirror-state';
import { afterEach, describe, expect, it } from 'vitest';
import { createEditor, type Editor, type EditorOptions } from '../src';
import { getCellProps, getTableProps, setCellProps, setTableProps } from '../src/table';

/** Table and cell styles from the list (tableClassList / tableCellClassList). */

let editor: Editor | null = null;
afterEach(() => {
  editor?.destroy();
  editor = null;
  document.body.innerHTML = '';
});

const LISTS: Partial<EditorOptions> = {
  tableClassList: [
    { title: 'With borders', value: 'grid' },
    { title: 'Layout', value: 'layout' },
  ],
  tableCellClassList: [{ title: 'Label', value: 'label-cell' }],
};

function mount(content: string, options: Partial<EditorOptions> = LISTS) {
  const element = document.createElement('div');
  document.body.append(element);
  editor = createEditor({ element, content, ...options });
  return editor;
}

/** The cursor into the first cell. */
function inFirstCell(e: Editor) {
  let pos = -1;
  e.view.state.doc.descendants((node, p) => {
    if (pos < 0 && node.type.name === 'paragraph') pos = p + 1;
  });
  e.view.dispatch(e.view.state.tr.setSelection(TextSelection.create(e.view.state.doc, pos)));
}

const TABLE =
  '<table class="grid"><tbody><tr><td class="label-cell"><p>a</p></td><td><p>b</p></td></tr></tbody></table>';

describe('table and cell classes', () => {
  it('HTML round trip without changes; in the editor the table has the same class', () => {
    const e = mount(TABLE);
    expect(e.getHTML()).toBe(TABLE);
    expect(e.root.querySelector('.nova-prosemirror table')!.classList.contains('grid')).toBe(true);
    expect(e.root.querySelector('.nova-prosemirror td')!.classList.contains('label-cell')).toBe(
      true,
    );
  });

  it('a style of several classes ("pf-grid pf-plain") is kept whole', () => {
    const html =
      '<table class="pf-grid pf-plain"><tbody><tr><td><p>a</p></td></tr></tbody></table>';
    const e = mount(html, {
      tableClassList: [{ title: 'Grid, plain headers', value: 'pf-grid pf-plain' }],
    });
    expect(e.getHTML()).toBe(html);
  });

  it("without the lists classes aren't kept: the output is as before", () => {
    const e = mount(TABLE, {});
    expect(e.getHTML()).toBe(
      '<table><tbody><tr><td><p>a</p></td><td><p>b</p></td></tr></tbody></table>',
    );
  });

  it("commands: the table and cell style change and get removed, the width isn't lost", () => {
    const e = mount(
      '<table style="width: 100%;"><tbody><tr><td><p>a</p></td></tr></tbody></table>',
    );
    inFirstCell(e);
    e.exec(setTableProps({ ...getTableProps(e.view.state)!, class: 'layout' }));
    e.exec(setCellProps({ class: 'label-cell' }));
    expect(e.getHTML()).toBe(
      '<table class="layout" style="width: 100%;"><tbody><tr><td class="label-cell"><p>a</p></td></tr></tbody></table>',
    );
    expect(getCellProps(e.view.state)!.class).toBe('label-cell');
    e.exec(setTableProps({ ...getTableProps(e.view.state)!, class: null }));
    e.exec(setCellProps({ class: null }));
    expect(e.getHTML()).toBe(
      '<table style="width: 100%;"><tbody><tr><td><p>a</p></td></tr></tbody></table>',
    );
  });

  it('the table properties dialog: picking a style from the list', async () => {
    const e = mount('<table><tbody><tr><td><p>a</p></td></tr></tbody></table>', {
      ...LISTS,
      toolbar: 'tableprops',
    });
    inFirstCell(e);
    e.root.querySelector<HTMLButtonElement>('[data-control="tableprops"]')!.click();
    const select = document.querySelector<HTMLSelectElement>('[role="dialog"] select')!;
    expect([...select.options].map((o) => o.textContent)).toEqual([
      'Default',
      'With borders',
      'Layout',
    ]);
    select.value = 'grid';
    document.querySelector<HTMLButtonElement>('.nova-button-primary')!.click();
    await new Promise((r) => setTimeout(r, 0));
    expect(e.getHTML()).toContain('<table class="grid">');
  });
});
