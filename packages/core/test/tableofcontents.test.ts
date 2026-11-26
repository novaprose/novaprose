import { TextSelection } from 'prosemirror-state';
import { afterEach, describe, expect, it } from 'vitest';
import { createEditor, type Editor, type EditorOptions } from '../src';

/**
 * Table of contents (the tableofcontents plugin): items from headings, stable ids, updating in the same
 * edit, depth, the TinyMCE format, following a link inside the editor, escaping.
 */

let editor: Editor | null = null;
afterEach(() => {
  editor?.destroy();
  editor = null;
  document.body.innerHTML = '';
});

async function mount(content: string, options: Partial<EditorOptions> = {}): Promise<Editor> {
  const element = document.createElement('div');
  document.body.append(element);
  editor = createEditor({ element, content, plugins: ['tableofcontents'], ...options });
  editor.focus();
  await editor.ready;
  return editor;
}

function posAfter(e: Editor, text: string): number {
  let pos = -1;
  e.view.state.doc.descendants((node, at) => {
    if (pos < 0 && node.isText && node.text!.includes(text)) {
      pos = at + node.text!.indexOf(text) + text.length;
    }
  });
  if (pos < 0) throw new Error(`no text ${text}`);
  return pos;
}

/** Heading ids in order. */
function headingIds(e: Editor): (string | null)[] {
  const ids: (string | null)[] = [];
  e.view.state.doc.descendants((node) => {
    if (node.type.name === 'heading') ids.push(node.attrs.id as string | null);
  });
  return ids;
}

function insertToc(e: Editor): void {
  const button = e.root.querySelector<HTMLButtonElement>('[data-control="tableofcontents"]')!;
  button.click();
}

const DOC = '<p></p><h1>Intro</h1><p>text</p><h2>Setup</h2><h3>Details</h3><h4>Deep</h4>';

describe('a table of contents from headings', () => {
  it("inserting: items by level, ids for headings; deeper than depth (3) isn't included", async () => {
    const e = await mount(DOC);
    e.view.dispatch(e.view.state.tr.setSelection(TextSelection.create(e.view.state.doc, 1)));
    insertToc(e);
    const [intro, setup, details, deep] = headingIds(e);
    for (const id of [intro, setup, details]) expect(id).toMatch(/^toc-[a-z0-9]{1,6}$/);
    expect(deep).toBeNull();
    expect(new Set([intro, setup, details]).size).toBe(3);
    expect(e.getHTML()).toBe(
      '<nav class="nova-toc" data-toc=""><p>Contents</p><ul>' +
        `<li><a href="#${intro}">Intro</a><ul>` +
        `<li><a href="#${setup}">Setup</a><ul><li><a href="#${details}">Details</a></li></ul></li>` +
        '</ul></li></ul></nav>' +
        `<h1 id="${intro}">Intro</h1><p>text</p><h2 id="${setup}">Setup</h2>` +
        `<h3 id="${details}">Details</h3><h4>Deep</h4>`,
    );
  });

  it('editing a heading updates the item in the same edit; undo rolls both back', async () => {
    const e = await mount(DOC);
    e.view.dispatch(e.view.state.tr.setSelection(TextSelection.create(e.view.state.doc, 1)));
    insertToc(e);
    e.view.dispatch(e.view.state.tr.insertText(' and more', posAfter(e, 'Setup')));
    expect(e.getHTML()).toContain('>Setup and more</a>');
    e.exec('undo');
    expect(e.getHTML()).toContain('>Setup</a>');
    expect(e.getHTML()).not.toContain('and more');
    // A new heading gets a new item with an id; a deleted one disappears.
    const end = e.view.state.doc.content.size;
    e.view.dispatch(
      e.view.state.tr.insert(
        end,
        e.view.state.schema.nodes.heading!.create({ level: 2 }, e.view.state.schema.text('Outro')),
      ),
    );
    expect(e.getHTML()).toMatch(/<a href="#toc-[a-z0-9]+">Outro<\/a>/);
    expect(e.getHTML()).toMatch(/<h2 id="toc-[a-z0-9]+">Outro<\/h2>/);
  });

  it('without a table of contents headings get no ids; their own ids are kept, duplicates replaced', async () => {
    const e = await mount('<h2>A</h2><h2 id="keep">B</h2><h2 id="keep">C</h2>');
    expect(headingIds(e)).toEqual([null, 'keep', 'keep']);
    e.view.dispatch(e.view.state.tr.setSelection(TextSelection.create(e.view.state.doc, 1)));
    insertToc(e);
    const [a, b, c] = headingIds(e);
    expect(b).toBe('keep');
    expect(a).toMatch(/^toc-/);
    expect(c).toMatch(/^toc-/);
    expect(c).not.toBe('keep');
  });

  it("changing a heading's level keeps the id (links don't break)", async () => {
    const e = await mount('<h2 id="s1">Section</h2>');
    e.view.dispatch(e.view.state.tr.setSelection(TextSelection.create(e.view.state.doc, 2)));
    e.exec('h3');
    expect(e.getHTML()).toBe('<h3 id="s1">Section</h3>');
  });

  it('the heading text is escaped, garbage items from JSON are dropped', async () => {
    const e = await mount('<h2>a &lt;/a&gt;&lt;script&gt;x()&lt;/script&gt;</h2>');
    e.view.dispatch(e.view.state.tr.setSelection(TextSelection.create(e.view.state.doc, 1)));
    insertToc(e);
    expect(e.getHTML()).not.toContain('<script');
    expect(e.getHTML()).toContain('&lt;/a&gt;&lt;script&gt;');
    e.setContent({
      type: 'doc',
      content: [
        {
          type: 'toc',
          attrs: {
            title: { x: 1 },
            entries: [
              { level: 2, id: 'ok', text: 'Fine' },
              { level: 9, id: 'x', text: 'bad level' },
              { level: 1, id: '"><img onerror=1>', text: 'bad id' },
              'junk',
            ],
          },
        },
      ],
    });
    // The items are reconciled with the document (there are no headings), the garbage isn't output.
    expect(e.getHTML()).toBe('<nav class="nova-toc" data-toc=""></nav>');
  });
});

describe('settings and the TinyMCE format', () => {
  it('div.mce-toc with an h2 and mcetoc_ links is read and output the same way', async () => {
    const tiny =
      '<div class="mce-toc" data-toc=""><h2>Table of Contents</h2><ul><li><a href="#mcetoc_1">One</a></li></ul></div>' +
      '<h2 id="mcetoc_1">One</h2>';
    const e = await mount(tiny, {
      pluginOptions: { tableofcontents: { className: 'mce-toc', titleTag: 'h2', depth: 2 } },
    });
    expect(e.getHTML()).toBe(tiny.replace('<div', '<nav').replace('</div>', '</nav>'));
  });

  it('depth: 1 and a numbered list; title: "" means no title', async () => {
    const e = await mount('<p></p><h1>A</h1><h2>B</h2>', {
      pluginOptions: { tableofcontents: { depth: 1, orderedList: true, title: '' } },
    });
    e.view.dispatch(e.view.state.tr.setSelection(TextSelection.create(e.view.state.doc, 1)));
    insertToc(e);
    const [a] = headingIds(e);
    expect(e.getHTML()).toMatch(
      new RegExp(
        `^<nav class="nova-toc" data-toc=""><ol><li><a href="#${a}">A</a></li></ol></nav>`,
      ),
    );
  });

  it("a table of contents link in the editor goes to the heading, the page address doesn't change", async () => {
    const e = await mount('<p></p><h2>Target</h2><p>after</p>');
    e.view.dispatch(e.view.state.tr.setSelection(TextSelection.create(e.view.state.doc, 1)));
    insertToc(e);
    const before = location.href;
    const link = e.root.querySelector<HTMLAnchorElement>('nav[data-toc] a')!;
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    link.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(location.href).toBe(before);
    expect(e.view.state.selection.$from.parent.textContent).toBe('Target');
  });
});
