import { TextSelection } from 'prosemirror-state';
import { afterEach, describe, expect, it } from 'vitest';
import { createEditor, type Editor, type EditorOptions } from '../src';
import { toMarkdown } from '../src/markdown';
import {
  insertAccordion,
  removeAccordion,
  toggleAccordion,
  toggleAllAccordions,
} from '../src/plugins/accordion-ui';

/**
 * Раскрывающиеся блоки (плагин accordion): HTML <details><summary> (своё, TinyMCE, Tiptap),
 * сворачивание, вставка, клавиши, правила контента, Markdown.
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
  editor = createEditor({ element, content, plugins: ['accordion'], ...options });
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
  if (pos < 0) throw new Error(`нет текста ${text}`);
  return pos;
}

function cursorAt(e: Editor, pos: number): void {
  e.view.dispatch(e.view.state.tr.setSelection(TextSelection.create(e.view.state.doc, pos)));
}

function key(e: Editor, k: string, mod = false): void {
  e.view.dom.dispatchEvent(
    new KeyboardEvent('keydown', { key: k, ctrlKey: mod, metaKey: false, bubbles: true }),
  );
}

const OPEN = '<details open=""><summary>Title</summary><p>Body</p></details>';
const CLOSED = '<details><summary>Title</summary><p>Body</p></details>';

describe('HTML раскрывающегося блока', () => {
  it('туда и обратно: раскрытый и свёрнутый', async () => {
    expect((await mount(OPEN)).getHTML()).toBe(OPEN);
    editor!.setContent(CLOSED);
    expect(editor!.getHTML()).toBe(CLOSED);
  });

  it('формат Tiptap (обёртка содержимого), без содержимого, <summary> вне блока', async () => {
    const e = await mount(
      '<details><summary>T</summary><div data-type="detailsContent"><p>a</p><p>b</p></div></details>',
    );
    expect(e.getHTML()).toBe('<details><summary>T</summary><p>a</p><p>b</p></details>');
    e.setContent('<details open><summary>T</summary></details>');
    expect(e.getHTML()).toBe('<details open=""><summary>T</summary><p></p></details>');
    e.setContent('<p>x</p><summary>stray</summary>');
    expect(e.getHTML()).not.toContain('<details');
    expect(e.getText()).toContain('stray');
  });

  it('initialState и serializedState (как details_initial_state / details_serialized_state)', async () => {
    const e = await mount(OPEN, { pluginOptions: { accordion: { initialState: 'collapsed' } } });
    expect(e.getHTML()).toBe(CLOSED);
    e.destroy();
    const f = await mount(CLOSED, {
      pluginOptions: { accordion: { serializedState: 'expanded' } },
    });
    expect(f.getHTML()).toBe(OPEN);
    // В редакторе блок по-прежнему свёрнут — меняется только HTML на выходе.
    expect(f.root.querySelector('.nova-details')!.classList.contains('nova-details-open')).toBe(
      false,
    );
  });
});

describe('сворачивание', () => {
  it('стрелка сворачивает и раскрывает; не попадает в историю отмены', async () => {
    const e = await mount(`<p>before</p>${OPEN}`);
    const toggle = e.root.querySelector<HTMLButtonElement>('.nova-details-toggle')!;
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(toggle.getAttribute('aria-label')).toBe('Collapse');
    expect(toggle.tabIndex).toBe(-1);
    // Сначала правка, потом сворачивание: отмена убирает правку, а блок остаётся свёрнутым.
    cursorAt(e, posAfter(e, 'before'));
    e.view.dispatch(e.view.state.tr.insertText('!'));
    toggle.click();
    expect(e.getHTML()).toBe(`<p>before!</p>${CLOSED}`);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(toggle.getAttribute('aria-label')).toBe('Expand');
    e.exec('undo');
    expect(e.getHTML()).toBe(`<p>before</p>${CLOSED}`);
  });

  it('Ctrl/Cmd+Enter в заголовке; курсор из скрытого — в заголовок', async () => {
    const e = await mount(OPEN);
    cursorAt(e, posAfter(e, 'Body'));
    e.exec(toggleAccordion);
    expect(e.getHTML()).toBe(CLOSED);
    expect(e.view.state.selection.from).toBe(posAfter(e, 'Title'));
    key(e, 'Enter', true);
    expect(e.getHTML()).toBe(OPEN);
  });

  it('курсор попал в свёрнутое содержимое (поиск, отмена) — блок раскрывается', async () => {
    const e = await mount(CLOSED);
    cursorAt(e, posAfter(e, 'Bo'));
    expect(e.getHTML()).toBe(OPEN);
  });

  it('свернуть или раскрыть все', async () => {
    const e = await mount(`${OPEN}${CLOSED}`);
    e.exec(toggleAllAccordions(false));
    expect(e.getHTML()).toBe(`${CLOSED}${CLOSED}`);
    e.exec(toggleAllAccordions());
    expect(e.getHTML()).toBe(`${OPEN}${OPEN}`);
  });
});

describe('вставка и правка', () => {
  it('кнопка: абзац становится содержимым, курсор — в пустой заголовок; повторно — рамка снимается', async () => {
    const e = await mount('<p>text</p>');
    const button = e.root.querySelector<HTMLButtonElement>('[data-control="accordion"]')!;
    expect(button).not.toBeNull();
    cursorAt(e, posAfter(e, 'te'));
    button.click();
    expect(e.getHTML()).toBe('<details open=""><summary></summary><p>text</p></details>');
    expect(e.view.state.selection.$from.parent.type.name).toBe('details_summary');
    expect(button.getAttribute('aria-pressed')).toBe('true');
    // Пустой заголовок — с приглашением (CSS-переменная на языке интерфейса).
    expect(e.root.style.getPropertyValue('--nova-summary-placeholder')).toBe('"Summary"');
    e.view.dispatch(e.view.state.tr.insertText('Head'));
    button.click();
    expect(e.getHTML()).toBe('<p>Head</p><p>text</p>');
  });

  it('несколько выделенных абзацев — в один блок', async () => {
    const e = await mount('<p>a</p><p>b</p><p>c</p>');
    const { doc } = e.view.state;
    e.view.dispatch(
      e.view.state.tr.setSelection(TextSelection.create(doc, posAfter(e, 'a'), posAfter(e, 'b'))),
    );
    e.exec(insertAccordion);
    expect(e.getHTML()).toBe(
      '<details open=""><summary></summary><p>a</p><p>b</p></details><p>c</p>',
    );
  });

  it('Enter в заголовке: в конце — в первый пустой абзац или новый; в середине — делит текст', async () => {
    const e = await mount('<details><summary>Title</summary><p></p></details><p>after</p>');
    cursorAt(e, posAfter(e, 'Title'));
    key(e, 'Enter');
    // Свёрнутый блок раскрылся, курсор — в имеющемся пустом абзаце.
    expect(e.getHTML()).toBe(
      '<details open=""><summary>Title</summary><p></p></details><p>after</p>',
    );
    expect(e.view.state.selection.$from.parent.type.name).toBe('paragraph');
    cursorAt(e, posAfter(e, 'Ti'));
    key(e, 'Enter');
    expect(e.getHTML()).toBe(
      '<details open=""><summary>Ti</summary><p>tle</p><p></p></details><p>after</p>',
    );
  });

  it('Backspace в начале заголовка — рамка снимается, текст остаётся', async () => {
    const e = await mount(OPEN);
    cursorAt(e, posAfter(e, 'Title') - 'Title'.length);
    key(e, 'Backspace');
    expect(e.getHTML()).toBe('<p>Title</p><p>Body</p>');
    // Курсор остался перед тем же текстом.
    expect(e.view.state.doc.textBetween(e.view.state.selection.from, posAfter(e, 'Title'))).toBe(
      'Title',
    );
  });

  it('снять рамку с пустым заголовком — только содержимое', async () => {
    const e = await mount('<details><summary></summary><p>Body</p></details>');
    cursorAt(e, posAfter(e, 'Bo'));
    e.exec(removeAccordion);
    expect(e.getHTML()).toBe('<p>Body</p>');
  });
});

describe('ограничения и экспорт', () => {
  it('правила контента без <details>: заголовок — абзацем, кнопки нет', async () => {
    const e = await mount(OPEN, { validElements: 'p,summary' });
    expect(e.getHTML()).toBe('<p>Title</p><p>Body</p>');
    expect(e.isAllowed('accordion')).toBe(false);
  });

  it('Markdown: заголовок абзацем, содержимое как есть', async () => {
    const e = await mount(
      '<details open><summary>Title</summary><ul><li><p>x</p></li></ul></details>',
    );
    expect(toMarkdown(e)).toBe('Title\n\n* x');
  });
});
