import { TextSelection } from 'prosemirror-state';
import { afterEach, describe, expect, it } from 'vitest';
import { createEditor, tableCommands, type Editor } from '../src';

/**
 * Table mechanics (prosemirror-tables) load lazily: the first load has only the schema and
 * insertion, the commands are stand-ins. This checks the behavior before and after loading, and that
 * rebuilding the plugin set doesn't lose edits, the selection or the undo history.
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

describe('lazy table mechanics', () => {
  it('before loading the commands are unavailable (false), after editor.ready they work', async () => {
    const e = mount(TABLE);
    // The cursor in the first cell: table(0) > row(1) > cell(2) > p(3) > "a".
    e.view.dispatch(e.view.state.tr.setSelection(TextSelection.create(e.view.state.doc, 4)));
    expect(tableCommands.addRowAfter(e.view.state)).toBe(false);
    // A table from the content shows right away, before the mechanics load.
    expect(e.view.dom.querySelectorAll('td')).toHaveLength(2);
    await e.ready;
    expect(tableCommands.addRowAfter(e.view.state, e.view.dispatch)).toBe(true);
    expect(e.view.dom.querySelectorAll('tr')).toHaveLength(2);
  });

  it('an edit before loading is kept together with the selection and can be undone afterwards', async () => {
    const e = mount('<p>start</p>');
    const end = TextSelection.atEnd(e.view.state.doc);
    e.view.dispatch(e.view.state.tr.setSelection(end).insertText(' typed'));
    await e.ready;
    expect(e.getHTML()).toBe('<p>start typed</p>');
    expect(e.view.state.selection.from).toBe(end.from + ' typed'.length);
    expect(e.exec('undo')).toBe(true);
    expect(e.getHTML()).toBe('<p>start</p>');
  });

  it('after loading the mechanics plugins are attached (column resizing)', async () => {
    const e = mount(TABLE);
    await e.ready;
    const keys = e.view.state.plugins.map((p) => (p as unknown as { key: string }).key);
    expect(keys.some((k) => k.startsWith('tableColumnResizing'))).toBe(true);
    expect(keys.some((k) => k.startsWith('selectingCells'))).toBe(true);
  });

  it("destroying before loading doesn't crash and doesn't touch the closed editor", async () => {
    const e = mount(TABLE);
    const ready = e.ready;
    e.destroy();
    editor = null;
    await expect(ready).resolves.toBeUndefined();
  });
});
