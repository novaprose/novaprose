import { NodeSelection, TextSelection } from 'prosemirror-state';
import { CellSelection } from 'prosemirror-tables';
import { afterEach, describe, expect, it } from 'vitest';
import { createEditor, type Editor, type EditorOptions } from '../src';
import { hasTextSelection, isOnEmptyLine } from '../src/plugins/quickbars';

let editor: Editor | null = null;

async function mount(content: string, options: Partial<EditorOptions> = {}) {
  const element = document.createElement('div');
  document.body.append(element);
  editor = createEditor({ element, content, plugins: ['quickbars'], ...options });
  await editor.ready;
  return editor;
}

const select = (e: Editor, from: number, to = from) =>
  e.view.dispatch(e.view.state.tr.setSelection(TextSelection.create(e.view.state.doc, from, to)));

afterEach(() => {
  editor?.destroy();
  editor = null;
  document.body.innerHTML = '';
});

describe('quickbars: when to show', () => {
  it('the selection toolbar only for a non-empty text selection outside code', async () => {
    const e = await mount('<p>hello world</p><pre><code>code</code></pre>');
    select(e, 1, 6);
    expect(hasTextSelection(e)).toBe(true);
    select(e, 3);
    expect(hasTextSelection(e)).toBe(false);
    select(e, 15, 18); // inside the code block
    expect(hasTextSelection(e)).toBe(false);
  });

  it("the selection toolbar doesn't react to selecting an image or cells", async () => {
    const e = await mount(
      '<p><img src="https://a.io/x.png"></p><table><tr><td><p>a</p></td><td><p>b</p></td></tr></table>',
    );
    e.view.dispatch(e.view.state.tr.setSelection(NodeSelection.create(e.view.state.doc, 1)));
    expect(hasTextSelection(e)).toBe(false);
    let cells: number[] = [];
    e.view.state.doc.descendants((n, pos) => {
      if (n.type.name === 'table_cell') cells.push(pos);
    });
    e.view.dispatch(
      e.view.state.tr.setSelection(CellSelection.create(e.view.state.doc, cells[0]!, cells[1]!)),
    );
    expect(hasTextSelection(e)).toBe(false);
    cells = [];
  });

  it('the insert toolbar on an empty top-level line, not in a list or a table', async () => {
    const e = await mount('<p>text</p><p></p><ul><li><p></p></li></ul>');
    select(e, 7); // an empty paragraph
    expect(isOnEmptyLine(e)).toBe(true);
    select(e, 3);
    expect(isOnEmptyLine(e)).toBe(false);
    select(e, 11); // an empty list item
    expect(isOnEmptyLine(e)).toBe(false);
  });
});

describe('quickbars: registration and settings', () => {
  it('registers both toolbars; a selection matters more than a table', async () => {
    const e = await mount('<p>a</p>');
    const names = e.ui.registry.getContextToolbars().map(([n]) => n);
    expect(names[0]).toBe('quickbars-selection');
    expect(names).toContain('quickbars-insert');
    expect(names.indexOf('quickbars-selection')).toBeLessThan(names.indexOf('table'));
    for (const button of ['quicklink', 'quickimage', 'quicktable', 'h2', 'h3']) {
      expect(e.ui.registry.has(button)).toBe(true);
    }
  });

  it('pluginOptions: a custom set and turning a toolbar off', async () => {
    const e = await mount('<p>a</p>', {
      pluginOptions: { quickbars: { selection: 'bold', insert: false } },
    });
    const toolbars = e.ui.registry.getContextToolbars();
    expect(toolbars.find(([n]) => n === 'quickbars-insert')).toBeUndefined();
    expect(toolbars.find(([n]) => n === 'quickbars-selection')![1].items).toBe('bold');
  });
});

describe('heading buttons', () => {
  it('h2 turns the heading on and off again', async () => {
    const e = await mount('<p>title</p>', { toolbar: 'h2' });
    select(e, 2);
    const h2 = e.root.querySelector<HTMLButtonElement>('[data-control="h2"]')!;
    h2.click();
    expect(e.getHTML()).toBe('<h2>title</h2>');
    expect(h2.getAttribute('aria-pressed')).toBe('true');
    h2.click();
    expect(e.getHTML()).toBe('<p>title</p>');
  });
});
