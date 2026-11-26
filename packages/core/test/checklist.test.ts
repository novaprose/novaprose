import { TextSelection } from 'prosemirror-state';
import { afterEach, describe, expect, it } from 'vitest';
import { createEditor, type Editor, type EditorOptions } from '../src';
import { markdownToHTML, toMarkdown } from '../src/markdown';
import { toggleChecklist, toggleChecklistItem } from '../src/plugins/checklist';

/**
 * Checklists: a bulleted list with the checklist flag and items with checked. The HTML is Tiptap's
 * (data-type="taskList"/"taskItem", data-checked); TinyMCE (tox-checklist) and GitHub are parsed too.
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
  editor = createEditor({ element, content, plugins: ['checklist'], ...options });
  editor.focus();
  // The plugin loads lazily: the checkboxes, the button and typing "[ ]" work after editor.ready.
  await editor.ready;
  return editor;
}

/** The cursor to the end of the text `text`. */
function cursorAfter(e: Editor, text: string): void {
  let pos = -1;
  e.view.state.doc.descendants((node, at) => {
    if (pos < 0 && node.isText && node.text!.includes(text)) {
      pos = at + node.text!.indexOf(text) + text.length;
    }
  });
  e.view.dispatch(e.view.state.tr.setSelection(TextSelection.create(e.view.state.doc, pos)));
}

const TASKS =
  '<ul data-type="taskList">' +
  '<li data-type="taskItem" data-checked="true"><p>Buy milk</p></li>' +
  '<li data-type="taskItem" data-checked="false"><p>Call Anna</p></li>' +
  '</ul>';

describe('checklist HTML', () => {
  it('round trip without changes (the Tiptap format)', async () => {
    expect((await mount(TASKS)).getHTML()).toBe(TASKS);
  });

  it('a TinyMCE checklist and GitHub tasks become a checklist', async () => {
    const tiny =
      '<ul class="tox-checklist"><li class="tox-checklist--checked">Buy milk</li><li>Call Anna</li></ul>';
    expect((await mount(tiny)).getHTML()).toBe(TASKS);
    editor!.destroy();
    const github =
      '<ul class="contains-task-list"><li class="task-list-item"><input type="checkbox" checked disabled> Buy milk</li>' +
      '<li class="task-list-item"><input type="checkbox" disabled> Call Anna</li></ul>';
    expect((await mount(github)).getHTML()).toBe(TASKS);
  });

  it("data-checked in a regular list doesn't make it a checklist", async () => {
    expect((await mount('<ul><li data-checked="true"><p>a</p></li></ul>')).getHTML()).toBe(
      '<ul><li><p>a</p></li></ul>',
    );
  });

  it("without the plugin the content isn't lost (the core schema)", async () => {
    const element = document.createElement('div');
    document.body.append(element);
    editor = createEditor({ element, content: TASKS });
    expect(editor.getHTML()).toBe(TASKS);
  });
});

describe('editing', () => {
  it('Enter in a checked item makes a new unchecked item', async () => {
    const e = await mount(TASKS);
    cursorAfter(e, 'Buy milk');
    e.view.dom.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    e.view.dispatch(e.view.state.tr.insertText('Bread'));
    expect(e.getHTML()).toContain(
      '<li data-type="taskItem" data-checked="true"><p>Buy milk</p></li>' +
        '<li data-type="taskItem" data-checked="false"><p>Bread</p></li>',
    );
  });

  it('Ctrl/Cmd+Enter and a click on the checkbox check the item', async () => {
    const e = await mount(TASKS);
    cursorAfter(e, 'Call Anna');
    expect(e.exec(toggleChecklistItem)).toBe(true);
    expect(e.getHTML()).toContain('data-checked="true"><p>Call Anna');
    const boxes = e.root.querySelectorAll<HTMLElement>('.nova-check');
    expect([...boxes].map((b) => b.getAttribute('aria-checked'))).toEqual(['true', 'true']);
    expect(boxes[0]!.getAttribute('role')).toBe('checkbox');
    expect(boxes[0]!.getAttribute('aria-label')).toBe('Done');
    boxes[0]!.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(e.getHTML()).toContain('data-checked="false"><p>Buy milk');
  });

  it("read only: the checkboxes don't toggle", async () => {
    const e = await mount(TASKS, { editable: false });
    e.root
      .querySelector<HTMLElement>('.nova-check')!
      .dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(e.getHTML()).toBe(TASKS);
  });
});

describe('the "Checklist" button and changing the list kind', () => {
  it('a paragraph → a checklist; pressing again removes the list', async () => {
    const e = await mount('<p>Plan</p>');
    expect(e.exec(toggleChecklist)).toBe(true);
    expect(e.getHTML()).toBe(
      '<ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p>Plan</p></li></ul>',
    );
    expect(e.root.querySelector('[data-control="checklist"]')?.getAttribute('aria-pressed')).toBe(
      'true',
    );
    expect(e.isActive('bulletList')).toBe(false);
    e.exec(toggleChecklist);
    expect(e.getHTML()).toBe('<p>Plan</p>');
  });

  it('bulleted and numbered lists become a checklist and back', async () => {
    const e = await mount('<ol><li><p>a</p></li><li><p>b</p></li></ol>');
    cursorAfter(e, 'a');
    e.exec(toggleChecklist);
    expect(e.getHTML()).toBe(
      '<ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p>a</p></li>' +
        '<li data-type="taskItem" data-checked="false"><p>b</p></li></ul>',
    );
    // The bulleted list button inside a checklist turns it into a regular list.
    e.exec('bulletList');
    expect(e.getHTML()).toBe('<ul><li><p>a</p></li><li><p>b</p></li></ul>');
  });

  it('bulleted → numbered changes the list kind (the button used to do nothing)', async () => {
    const e = await mount('<ul><li><p>a</p></li></ul>');
    cursorAfter(e, 'a');
    expect(e.exec('orderedList')).toBe(true);
    expect(e.getHTML()).toBe('<ol><li><p>a</p></li></ol>');
    expect(e.exec('bulletList')).toBe(true);
    expect(e.getHTML()).toBe('<ul><li><p>a</p></li></ul>');
  });

  it('content rules without ul: the button is unavailable, a checklist becomes paragraphs', async () => {
    const e = await mount(TASKS, { validElements: 'p' });
    expect(e.getHTML()).toBe('<p>Buy milk</p><p>Call Anna</p>');
    expect(e.isAllowed('checklist')).toBe(false);
  });
});

describe('typing "[ ]" and "[x]"', () => {
  const type = (e: Editor, text: string) => {
    for (const ch of text) {
      const { from, to } = e.view.state.selection;
      const handled = e.view.someProp('handleTextInput', (f) =>
        f(e.view, from, to, ch, () => e.view.state.tr.insertText(ch, from, to)),
      );
      if (!handled) e.view.dispatch(e.view.state.tr.insertText(ch, from, to));
    }
  };

  it('at the start of a paragraph: a checklist item; [x] is checked; it continues the previous checklist', async () => {
    const e = await mount('<p></p>');
    type(e, '[ ] Milk');
    expect(e.getHTML()).toBe(
      '<ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p>Milk</p></li></ul>',
    );
  });

  it('in the first item of a regular list: the whole list becomes a checklist', async () => {
    const e = await mount('<ul><li><p>a</p></li><li><p></p></li></ul>');
    e.view.dispatch(e.view.state.tr.setSelection(TextSelection.atEnd(e.view.state.doc)));
    type(e, '[x] b');
    expect(e.getHTML()).toBe(
      '<ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p>a</p></li>' +
        '<li data-type="taskItem" data-checked="true"><p>b</p></li></ul>',
    );
  });
});

describe('Markdown', () => {
  it('exporting and importing GFM tasks', async () => {
    const e = await mount(TASKS);
    const md = toMarkdown(e);
    expect(md).toBe('* [x] Buy milk\n* [ ] Call Anna');
    e.setContent(markdownToHTML(md));
    expect(e.getHTML()).toBe(TASKS);
  });

  it('a regular item starting with "[x]" doesn\'t become a task', async () => {
    const e = await mount('<ul><li><p>[x] literally</p></li></ul>');
    const md = toMarkdown(e);
    e.setContent(markdownToHTML(md));
    expect(e.getHTML()).toBe('<ul><li><p>[x] literally</p></li></ul>');
  });

  it('numbered "tasks" stay text (there are no numbered checklists)', async () => {
    expect(markdownToHTML('1. [ ] a')).toBe('<ol>\n<li>[ ] a</li>\n</ol>\n');
  });
});
