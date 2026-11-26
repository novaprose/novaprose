import { TextSelection } from 'prosemirror-state';
import { afterEach, describe, expect, it } from 'vitest';
import { createEditor, type Editor, type EditorOptions } from '../src';
import { ContentRules } from '../src/content-rules';

let editor: Editor | null = null;

function mount(content: string, options: Partial<EditorOptions> = {}) {
  const element = document.createElement('div');
  document.body.append(element);
  editor = createEditor({ element, content, language: 'en', ...options });
  return editor;
}

afterEach(() => {
  editor?.destroy();
  editor = null;
  document.body.innerHTML = '';
});

describe('ContentRules: разбор опций', () => {
  it('validElements: синонимы через /, модификаторы и атрибуты отбрасываются', () => {
    const rules = new ContentRules({ validElements: '-p,strong/b,#em/i,a[href|target=_blank],ul' });
    expect(rules.isTagAllowed('strong')).toBe(true);
    expect(rules.isTagAllowed('b')).toBe(true);
    expect(rules.isTagAllowed('em')).toBe(true);
    expect(rules.isTagAllowed('a')).toBe(true);
    expect(rules.isTagAllowed('li')).toBe(true); // ul тянет li
    expect(rules.isTagAllowed('img')).toBe(false);
    expect(rules.isTagAllowed('p')).toBe(true); // абзац всегда
  });

  it('invalidElements поверх всего разрешённого', () => {
    const rules = new ContentRules({ invalidElements: 'img, table ,h1' });
    expect(rules.isTagAllowed('img')).toBe(false);
    expect(rules.isTagAllowed('table')).toBe(false);
    expect(rules.isTagAllowed('h1')).toBe(false);
    expect(rules.isTagAllowed('h2')).toBe(true);
  });

  it('validStyles: строкой и объектом', () => {
    expect(new ContentRules({ validStyles: 'color, text-align' }).isStyleAllowed('font-size')).toBe(
      false,
    );
    const rules = new ContentRules({ validStyles: { '*': 'color', img: 'float' } });
    expect(rules.isStyleAllowed('float')).toBe(true);
    expect(rules.isStyleAllowed('color')).toBe(true);
    expect(rules.isStyleAllowed('line-height')).toBe(false);
  });

  it('isAllowed по именам контролов', () => {
    const rules = new ContentRules({ invalidElements: 'a,span', validStyles: 'text-align' });
    expect(rules.isAllowed('link')).toBe(false);
    expect(rules.isAllowed('forecolor')).toBe(false);
    expect(rules.isAllowed('aligncenter')).toBe(true);
    expect(rules.isAllowed('lineheight')).toBe(false);
    expect(rules.isAllowed('bold')).toBe(true);
    expect(rules.isAllowed('my-custom-button')).toBe(true); // неизвестное — не ограничиваем
  });
});

describe('нормализация контента', () => {
  it('запрещённые марки снимаются, текст остаётся', () => {
    const e = mount('<p><strong>a</strong><em>b</em><a href="https://x.io">c</a></p>', {
      invalidElements: 'strong,a',
    });
    expect(e.getHTML()).toBe('<p>a<em>b</em>c</p>');
  });

  it('запрещённый уровень заголовка → абзац, выравнивание сохраняется', () => {
    const e = mount('<h1 style="text-align: center;">T</h1><h2>S</h2>', { invalidElements: 'h1' });
    expect(e.getHTML()).toBe('<p style="text-align: center;">T</p><h2>S</h2>');
  });

  it('списки, цитата, блок кода, таблица, hr, картинка, br', () => {
    const e = mount(
      '<ul><li><p>one</p></li><li><p>two</p></li></ul>' +
        '<blockquote><p>quote</p></blockquote>' +
        '<pre><code>line1\nline2</code></pre>' +
        '<table><tr><td><p>c1</p></td><td><p>c2</p></td></tr></table>' +
        '<hr><p>a<img src="https://x.io/i.png">b<br>c</p>',
      { invalidElements: 'ul,blockquote,pre,table,hr,img,br' },
    );
    expect(e.getHTML()).toBe(
      '<p>one</p><p>two</p><p>quote</p><p>line1</p><p>line2</p><p>c1</p><p>c2</p><p>ab c</p>',
    );
  });

  it('th запрещён — ячейки заголовка становятся обычными', () => {
    const e = mount('<table><tr><th><p>h</p></th></tr><tr><td><p>d</p></td></tr></table>', {
      invalidElements: 'th',
    });
    expect(e.getHTML()).toBe(
      '<table><tbody><tr><td><p>h</p></td></tr><tr><td><p>d</p></td></tr></tbody></table>',
    );
  });

  it('validStyles: недопустимые стили убираются, допустимые остаются', () => {
    const e = mount(
      '<p style="text-align: right; line-height: 2;"><span style="color: #ff0000;">r</span><span style="font-size: 18pt;">s</span></p>',
      { validStyles: 'color,text-align' },
    );
    expect(e.getHTML()).toBe(
      '<p style="text-align: right;"><span style="color: #ff0000;">r</span>s</p>',
    );
  });

  it('validElements: разрешён только белый список', () => {
    const e = mount('<h1>T</h1><p><strong>b</strong> <u>u</u> <img src="https://x.io/i.png"></p>', {
      validElements: 'p,strong/b',
    });
    expect(e.getHTML()).toBe('<p>T</p><p><strong>b</strong> u&nbsp;</p>');
  });
});

describe('ограничения на всех путях изменения', () => {
  it('setContent', () => {
    const e = mount('<p>a</p>', { invalidElements: 'em' });
    e.setContent('<p><em>x</em></p>');
    expect(e.getHTML()).toBe('<p>x</p>');
  });

  it('вставка из буфера', () => {
    const e = mount('<p></p>', { invalidElements: 'table,h2' });
    e.view.pasteHTML('<h2>Title</h2><table><tr><td>cell</td></tr></table>');
    expect(e.getHTML()).not.toContain('<h2');
    expect(e.getHTML()).not.toContain('<table');
    expect(e.getText()).toContain('Title');
    expect(e.getText()).toContain('cell');
  });

  it('команда и горячая клавиша: запрещённый жирный не применяется', () => {
    const e = mount('<p>text</p>', { invalidElements: 'strong' });
    e.view.dispatch(e.view.state.tr.setSelection(TextSelection.create(e.view.state.doc, 1, 5)));
    e.exec('bold');
    expect(e.getHTML()).toBe('<p>text</p>');
  });

  it('Markdown-шорткат запрещённого уровня не срабатывает, разрешённый — да', () => {
    const e = mount('<p></p>', { invalidElements: 'h1' });
    const typeAndTrigger = (text: string) => {
      const { state } = e.view;
      const pos = state.selection.from;
      // Эмулируем ввод: input rules срабатывают через handleTextInput.
      const handled = e.view.someProp('handleTextInput', (f) =>
        f(e.view, pos, pos, text, () => state.tr.insertText(text, pos)),
      );
      if (!handled) e.view.dispatch(e.view.state.tr.insertText(text, pos));
    };
    typeAndTrigger('#');
    typeAndTrigger(' ');
    expect(e.getHTML()).toBe('<p>#&nbsp;</p>');
    e.setContent('<p></p>');
    e.view.dispatch(e.view.state.tr.setSelection(TextSelection.create(e.view.state.doc, 1)));
    typeAndTrigger('#');
    typeAndTrigger('#');
    typeAndTrigger(' ');
    expect(e.getHTML()).toBe('<h2></h2>');
  });
});

describe('UI учитывает ограничения', () => {
  it('тулбар не показывает запрещённые кнопки', () => {
    const e = mount('<p>a</p>', {
      toolbar: 'bold italic link image table forecolor',
      invalidElements: 'a,img,table,span',
    });
    const names = [...e.root.querySelectorAll('[data-control]')].map((b) =>
      b.getAttribute('data-control'),
    );
    expect(names).toEqual(['bold', 'italic']);
  });

  it('меню «Стиль текста» и слэш-команды без запрещённого', () => {
    const e = mount('<p>a</p>', { toolbar: 'blocks', invalidElements: 'h1,h2,pre,table' });
    e.root.querySelector<HTMLButtonElement>('[data-control="blocks"]')!.click();
    const ids = [...e.root.querySelectorAll('.nova-menu [data-id]')].map((b) =>
      b.getAttribute('data-id'),
    );
    expect(ids).toEqual(['paragraph', 'h3', 'h4', 'h5', 'h6']);
    const slash = e.ui.registry.getAutocompleters()[0]![1];
    const names = (slash.fetch('', e) as { value: string }[]).map((i) => i.value);
    expect(names).not.toContain('h1');
    expect(names).not.toContain('codeblock');
    expect(names).not.toContain('table');
    expect(names).toContain('h3');
  });

  it('без ограничений всё разрешено и плагин не подключается', () => {
    const e = mount('<p>a</p>');
    expect(e.contentRules).toBeNull();
    expect(e.isAllowed('table')).toBe(true);
  });
});
