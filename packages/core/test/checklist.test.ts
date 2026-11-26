import { TextSelection } from 'prosemirror-state';
import { afterEach, describe, expect, it } from 'vitest';
import { createEditor, type Editor, type EditorOptions } from '../src';
import { markdownToHTML, toMarkdown } from '../src/markdown';
import { toggleChecklist, toggleChecklistItem } from '../src/plugins/checklist';

/**
 * Чек-листы: маркированный список с флагом checklist и пункты с checked. HTML — как у Tiptap
 * (data-type="taskList"/"taskItem", data-checked); разбираем и TinyMCE (tox-checklist), и GitHub.
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
  // Плагин грузится лениво: галочки, кнопка и ввод «[ ]» — после editor.ready.
  await editor.ready;
  return editor;
}

/** Курсор в конец текста `text`. */
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

describe('HTML чек-листов', () => {
  it('туда и обратно без изменений (формат Tiptap)', async () => {
    expect((await mount(TASKS)).getHTML()).toBe(TASKS);
  });

  it('чек-лист TinyMCE и задачи GitHub становятся чек-листом', async () => {
    const tiny =
      '<ul class="tox-checklist"><li class="tox-checklist--checked">Buy milk</li><li>Call Anna</li></ul>';
    expect((await mount(tiny)).getHTML()).toBe(TASKS);
    editor!.destroy();
    const github =
      '<ul class="contains-task-list"><li class="task-list-item"><input type="checkbox" checked disabled> Buy milk</li>' +
      '<li class="task-list-item"><input type="checkbox" disabled> Call Anna</li></ul>';
    expect((await mount(github)).getHTML()).toBe(TASKS);
  });

  it('data-checked в обычном списке не делает его чек-листом', async () => {
    expect((await mount('<ul><li data-checked="true"><p>a</p></li></ul>')).getHTML()).toBe(
      '<ul><li><p>a</p></li></ul>',
    );
  });

  it('без плагина содержимое не теряется (схема ядра)', async () => {
    const element = document.createElement('div');
    document.body.append(element);
    editor = createEditor({ element, content: TASKS });
    expect(editor.getHTML()).toBe(TASKS);
  });
});

describe('редактирование', () => {
  it('Enter в отмеченном пункте — новый неотмеченный пункт', async () => {
    const e = await mount(TASKS);
    cursorAfter(e, 'Buy milk');
    e.view.dom.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    e.view.dispatch(e.view.state.tr.insertText('Bread'));
    expect(e.getHTML()).toContain(
      '<li data-type="taskItem" data-checked="true"><p>Buy milk</p></li>' +
        '<li data-type="taskItem" data-checked="false"><p>Bread</p></li>',
    );
  });

  it('Ctrl/Cmd+Enter и нажатие на галочку отмечают пункт', async () => {
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

  it('только для чтения — галочки не переключаются', async () => {
    const e = await mount(TASKS, { editable: false });
    e.root
      .querySelector<HTMLElement>('.nova-check')!
      .dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(e.getHTML()).toBe(TASKS);
  });
});

describe('кнопка «Чек-лист» и смена вида списка', () => {
  it('абзац → чек-лист; повторно — снимает список', async () => {
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

  it('маркированный и нумерованный список становятся чек-листом и обратно', async () => {
    const e = await mount('<ol><li><p>a</p></li><li><p>b</p></li></ol>');
    cursorAfter(e, 'a');
    e.exec(toggleChecklist);
    expect(e.getHTML()).toBe(
      '<ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p>a</p></li>' +
        '<li data-type="taskItem" data-checked="false"><p>b</p></li></ul>',
    );
    // Кнопка маркированного списка внутри чек-листа делает его обычным списком.
    e.exec('bulletList');
    expect(e.getHTML()).toBe('<ul><li><p>a</p></li><li><p>b</p></li></ul>');
  });

  it('маркированный → нумерованный меняет вид списка (раньше кнопка не делала ничего)', async () => {
    const e = await mount('<ul><li><p>a</p></li></ul>');
    cursorAfter(e, 'a');
    expect(e.exec('orderedList')).toBe(true);
    expect(e.getHTML()).toBe('<ol><li><p>a</p></li></ol>');
    expect(e.exec('bulletList')).toBe(true);
    expect(e.getHTML()).toBe('<ul><li><p>a</p></li></ul>');
  });

  it('правила контента без ul: кнопка недоступна, чек-лист — абзацы', async () => {
    const e = await mount(TASKS, { validElements: 'p' });
    expect(e.getHTML()).toBe('<p>Buy milk</p><p>Call Anna</p>');
    expect(e.isAllowed('checklist')).toBe(false);
  });
});

describe('ввод «[ ]» и «[x]»', () => {
  const type = (e: Editor, text: string) => {
    for (const ch of text) {
      const { from, to } = e.view.state.selection;
      const handled = e.view.someProp('handleTextInput', (f) =>
        f(e.view, from, to, ch, () => e.view.state.tr.insertText(ch, from, to)),
      );
      if (!handled) e.view.dispatch(e.view.state.tr.insertText(ch, from, to));
    }
  };

  it('в начале абзаца — пункт чек-листа; [x] — отмеченный; продолжает предыдущий чек-лист', async () => {
    const e = await mount('<p></p>');
    type(e, '[ ] Milk');
    expect(e.getHTML()).toBe(
      '<ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p>Milk</p></li></ul>',
    );
  });

  it('в первом пункте обычного списка — весь список становится чек-листом', async () => {
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
  it('экспорт и импорт задач GFM', async () => {
    const e = await mount(TASKS);
    const md = toMarkdown(e);
    expect(md).toBe('* [x] Buy milk\n* [ ] Call Anna');
    e.setContent(markdownToHTML(md));
    expect(e.getHTML()).toBe(TASKS);
  });

  it('обычный пункт, начинающийся с «[x]», не становится задачей', async () => {
    const e = await mount('<ul><li><p>[x] literally</p></li></ul>');
    const md = toMarkdown(e);
    e.setContent(markdownToHTML(md));
    expect(e.getHTML()).toBe('<ul><li><p>[x] literally</p></li></ul>');
  });

  it('нумерованные «задачи» остаются текстом (нумерованных чек-листов нет)', async () => {
    expect(markdownToHTML('1. [ ] a')).toBe('<ol>\n<li>[ ] a</li>\n</ol>\n');
  });
});
