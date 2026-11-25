import { TextSelection } from 'prosemirror-state';
import { afterEach, describe, expect, it } from 'vitest';
import { createEditor, type Editor, type EditorOptions } from '../src';
import { htmlToPlainText } from '../src/paste';

let editor: Editor | null = null;

function mount(content = '<p></p>', options: Partial<EditorOptions> = {}) {
  const element = document.createElement('div');
  document.body.append(element);
  editor = createEditor({ element, content, ...options });
  const { state } = editor.view;
  editor.view.dispatch(
    state.tr.setSelection(TextSelection.create(state.doc, state.doc.content.size - 1)),
  );
  return editor;
}

afterEach(() => {
  editor?.destroy();
  editor = null;
  document.body.innerHTML = '';
});

describe('htmlToPlainText', () => {
  it('сохраняет абзацы и переносы, убирает разметку и скрипты', () => {
    expect(
      htmlToPlainText(
        '<h1>Title</h1><p>One <b>bold</b><br>line</p><script>alert(1)</script><ul><li>a</li><li>b</li></ul>',
      ),
    ).toBe('Title\nOne bold\nline\na\nb');
  });

  it('схлопывает пробелы и пустые строки', () => {
    expect(htmlToPlainText('<p>  a   b </p><p></p><p></p><p>c</p>')).toBe('a b\n\nc');
  });
});

describe('вставка', () => {
  it('обычный режим сохраняет форматирование', () => {
    const e = mount();
    e.view.pasteHTML('<p><strong>bold</strong> text</p>');
    expect(e.getHTML()).toBe('<p><strong>bold</strong> text</p>');
  });

  it('режим «как текст» убирает форматирование', () => {
    const e = mount('<p></p>', { pasteAsText: true });
    e.view.pasteHTML('<h1>Big</h1><p><strong>bold</strong> <a href="https://a.io">link</a></p>');
    expect(e.getHTML()).not.toContain('<strong>');
    expect(e.getHTML()).not.toContain('<h1>');
    expect(e.getHTML()).not.toContain('<a ');
    expect(e.getText()).toContain('bold link');
  });

  it('переключатель pastetext меняет режим и состояние кнопки', () => {
    const e = mount('<p></p>', { toolbar: 'pastetext' });
    const button = e.root.querySelector<HTMLButtonElement>('[data-control="pastetext"]')!;
    expect(button.getAttribute('aria-pressed')).toBe('false');
    button.click();
    expect(e.isPasteAsText()).toBe(true);
    expect(button.getAttribute('aria-pressed')).toBe('true');
  });

  it('pastePreprocess и pastePostprocess', () => {
    const e = mount('<p></p>', {
      pastePreprocess: (html) => html.replace(/secret/g, '***'),
      pastePostprocess: (root) =>
        root.querySelectorAll('em').forEach((el) => el.replaceWith(...el.childNodes)),
    });
    e.view.pasteHTML('<p>my <em>secret</em> word</p>');
    expect(e.getHTML()).toBe('<p>my *** word</p>');
  });
});
