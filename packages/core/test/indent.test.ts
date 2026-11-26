import { TextSelection } from 'prosemirror-state';
import { afterEach, describe, expect, it } from 'vitest';
import { createEditor, type Editor } from '../src';

/**
 * Отступ абзацев и заголовков (margin-left шагом 40px, для RTL — margin-right) и списков.
 * Tab отступает только в списках: в абзаце он остаётся переходом фокуса (нет ловушки, WCAG 2.1.2).
 */

const editors: Editor[] = [];
afterEach(() => {
  editors.splice(0).forEach((e) => e.destroy());
  document.body.innerHTML = '';
});

function mount(content: string) {
  const element = document.createElement('div');
  document.body.appendChild(element);
  const editor = createEditor({ element, content });
  editors.push(editor);
  // Курсор в начале первого текстового блока.
  editor.view.dispatch(
    editor.view.state.tr.setSelection(TextSelection.atStart(editor.view.state.doc)),
  );
  return editor;
}

function key(editor: Editor, keyName: string, mods: KeyboardEventInit = {}) {
  const event = new KeyboardEvent('keydown', {
    key: keyName,
    bubbles: true,
    cancelable: true,
    ...mods,
  });
  editor.view.dom.dispatchEvent(event);
  return event;
}

describe('HTML отступов', () => {
  it.each([
    '<p style="margin-left: 40px;">a</p>',
    '<p style="margin-left: 120px;">a</p>',
    '<h2 style="margin-left: 40px;">h</h2>',
    '<p style="text-align: center; margin-left: 80px;">c</p>',
    '<p dir="rtl" style="margin-right: 40px;">ر</p>',
  ])('туда-обратно без изменений: %s', (html) => {
    expect(mount(html).getHTML()).toBe(html);
  });

  it('чужие единицы и padding приводятся к шагу 40px', () => {
    expect(mount('<p style="padding-left: 36pt;">a</p>').getHTML()).toBe(
      '<p style="margin-left: 40px;">a</p>',
    );
    expect(mount('<p style="margin-left: 5em;">a</p>').getHTML()).toBe(
      '<p style="margin-left: 80px;">a</p>',
    );
  });

  it('отступ в пункте списка — не отступ абзаца', () => {
    const html = '<ul><li><p style="margin-left: 40px;">a</p></li></ul>';
    expect(mount(html).getHTML()).toBe('<ul><li><p>a</p></li></ul>');
  });

  it('уровень ограничен (10), мусор из JSON — 0', () => {
    expect(mount('<p style="margin-left: 4000px;">a</p>').getHTML()).toBe(
      '<p style="margin-left: 400px;">a</p>',
    );
    const e = mount('<p>a</p>');
    e.setContent({
      type: 'doc',
      content: [
        { type: 'paragraph', attrs: { indent: 'x' }, content: [{ type: 'text', text: 'a' }] },
      ],
    });
    expect(e.getHTML()).toBe('<p>a</p>');
  });
});

describe('команды отступа', () => {
  it('indent / outdent в абзаце; outdent на нуле недоступен', () => {
    const e = mount('<p>a</p>');
    expect(e.can('outdent')).toBe(false);
    e.exec('indent');
    e.exec('indent');
    expect(e.getHTML()).toBe('<p style="margin-left: 80px;">a</p>');
    e.exec('outdent');
    expect(e.getHTML()).toBe('<p style="margin-left: 40px;">a</p>');
  });

  it('несколько абзацев в выделении — все сразу', () => {
    const e = mount('<p>a</p><p>b</p>');
    const { doc } = e.view.state;
    e.view.dispatch(
      e.view.state.tr.setSelection(TextSelection.create(doc, 1, doc.content.size - 1)),
    );
    e.exec('indent');
    expect(e.getHTML()).toBe(
      '<p style="margin-left: 40px;">a</p><p style="margin-left: 40px;">b</p>',
    );
  });

  it('в списке indent вкладывает пункт, как раньше', () => {
    const e = mount('<ul><li><p>a</p></li><li><p>b</p></li></ul>');
    const pos = e.view.state.doc.content.size - 3;
    e.view.dispatch(e.view.state.tr.setSelection(TextSelection.create(e.view.state.doc, pos)));
    e.exec('indent');
    expect(e.getHTML()).toBe('<ul><li><p>a</p><ul><li><p>b</p></li></ul></li></ul>');
  });

  it('абзац → заголовок сохраняет отступ', () => {
    const e = mount('<p style="margin-left: 40px;">a</p>');
    e.exec('h2');
    expect(e.getHTML()).toBe('<h2 style="margin-left: 40px;">a</h2>');
  });

  it('RTL-абзац отступает справа', () => {
    const e = mount('<p dir="rtl">ر</p>');
    e.exec('indent');
    expect(e.getHTML()).toBe('<p dir="rtl" style="margin-right: 40px;">ر</p>');
  });
});

describe('клавиатура', () => {
  it('Tab в абзаце не перехватывается — фокус уходит дальше (нет ловушки)', () => {
    const e = mount('<p>a</p>');
    const event = key(e, 'Tab');
    expect(event.defaultPrevented).toBe(false);
    expect(e.getHTML()).toBe('<p>a</p>');
  });

  it('Mod-] / Mod-[ — отступ абзаца', () => {
    const e = mount('<p>a</p>');
    key(e, ']', { ctrlKey: true });
    expect(e.getHTML()).toBe('<p style="margin-left: 40px;">a</p>');
    key(e, '[', { ctrlKey: true });
    expect(e.getHTML()).toBe('<p>a</p>');
  });
});
