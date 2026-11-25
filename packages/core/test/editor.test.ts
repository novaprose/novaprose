import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEditor, setLink, type Editor } from '../src';
import { isSafeImageUrl, isSafeLinkUrl } from '../src/url';
import { TextSelection } from 'prosemirror-state';

let editor: Editor | null = null;

function mount(content = '', options: Partial<Parameters<typeof createEditor>[0]> = {}) {
  const element = document.createElement('div');
  document.body.appendChild(element);
  editor = createEditor({ element, content, ...options });
  return editor;
}

function selectAll(e: Editor) {
  const { doc } = e.view.state;
  e.view.dispatch(e.view.state.tr.setSelection(TextSelection.create(doc, 1, doc.content.size - 1)));
}

afterEach(() => {
  editor?.destroy();
  editor = null;
  document.body.innerHTML = '';
});

describe('HTML на входе и выходе', () => {
  it.each([
    '<p>Простой абзац</p>',
    '<h2>Заголовок</h2><p>Текст</p>',
    '<p><strong>жирный</strong> <em>курсив</em> <u>подчёркнутый</u> <s>зачёркнутый</s></p>',
    '<p>H<sub>2</sub>O и E=mc<sup>2</sup></p>',
    '<ul><li><p>один</p></li><li><p>два</p></li></ul>',
    '<ol start="3"><li><p>три</p></li></ol>',
    '<blockquote><p>цитата</p></blockquote>',
    '<pre><code class="language-ts">const a = 1;</code></pre>',
    '<p style="text-align: center;">по центру</p>',
    '<p><a href="https://example.com">ссылка</a></p>',
    '<p><img src="https://example.com/a.png" alt="картинка"></p>',
    '<hr>',
  ])('сохраняет %s без изменений', (html) => {
    expect(mount(html).getHTML()).toBe(html);
  });

  it('нормализует синонимы тегов', () => {
    expect(mount('<p><b>a</b><i>b</i><strike>c</strike></p>').getHTML()).toBe(
      '<p><strong>a</strong><em>b</em><s>c</s></p>',
    );
  });

  it('не считает жирным <b style="font-weight:normal"> из Google Docs', () => {
    expect(mount('<b style="font-weight:normal"><p>текст</p></b>').getHTML()).toBe('<p>текст</p>');
  });

  it('setContent заменяет документ и генерирует change', () => {
    const e = mount('<p>старое</p>');
    const onChange = vi.fn();
    e.on('change', onChange);
    e.setContent('<p>новое</p>');
    expect(e.getHTML()).toBe('<p>новое</p>');
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('JSON туда и обратно', () => {
    const e = mount('<h1>Привет</h1><p>мир</p>');
    const json = e.getJSON();
    const e2 = mount();
    e2.setContent(json);
    expect(e2.getHTML()).toBe('<h1>Привет</h1><p>мир</p>');
  });
});

describe('безопасность', () => {
  it('выбрасывает javascript:-ссылки при разборе HTML', () => {
    expect(mount('<p><a href="javascript:alert(1)">x</a></p>').getHTML()).toBe('<p>x</p>');
    expect(mount('<p><a href=" java\tscript:alert(1)">x</a></p>').getHTML()).toBe('<p>x</p>');
  });

  it('выбрасывает опасные src у картинок', () => {
    expect(mount('<p><img src="javascript:alert(1)"></p>').getHTML()).toBe('<p></p>');
  });

  it('не исполняет скрипты и обработчики при разборе', () => {
    const html = mount('<p onclick="alert(1)">a</p><script>alert(1)</script>').getHTML();
    expect(html).toBe('<p>a</p>');
  });

  it('не выводит опасный href, пришедший через JSON', () => {
    const e = mount();
    e.setContent({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'x',
              marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }],
            },
          ],
        },
      ],
    });
    expect(e.getHTML()).toBe('<p><a href="#">x</a></p>');
  });

  it('setLink отказывается от опасного URL', () => {
    const e = mount('<p>текст</p>');
    selectAll(e);
    expect(e.exec(setLink('javascript:alert(1)'))).toBe(false);
    expect(e.getHTML()).toBe('<p>текст</p>');
  });

  it.each([
    ['https://a.com', true],
    ['/relative', true],
    ['#anchor', true],
    ['mailto:a@b.c', true],
    ['javascript:alert(1)', false],
    ['JaVaScRiPt:alert(1)', false],
    ['vbscript:x', false],
    ['data:text/html,<script>', false],
  ])('isSafeLinkUrl(%s) = %s', (url, safe) => {
    expect(isSafeLinkUrl(url)).toBe(safe);
  });

  it('isSafeImageUrl разрешает data:image, но не data:text', () => {
    expect(isSafeImageUrl('data:image/png;base64,AAAA')).toBe(true);
    expect(isSafeImageUrl('data:text/html;base64,AAAA')).toBe(false);
    expect(isSafeImageUrl('data:image/svg+xml;base64,AAAA')).toBe(false);
  });
});

describe('команды', () => {
  it('bold переключает марку на выделении', () => {
    const e = mount('<p>текст</p>');
    selectAll(e);
    expect(e.exec('bold')).toBe(true);
    expect(e.getHTML()).toBe('<p><strong>текст</strong></p>');
    e.exec('bold');
    expect(e.getHTML()).toBe('<p>текст</p>');
  });

  it('заголовок, выравнивание и списки', () => {
    const e = mount('<p>текст</p>');
    selectAll(e);
    e.exec('h2');
    e.exec('alignCenter');
    expect(e.getHTML()).toBe('<h2 style="text-align: center;">текст</h2>');
    e.exec('paragraph');
    e.exec('bulletList');
    expect(e.getHTML()).toBe('<ul><li><p style="text-align: center;">текст</p></li></ul>');
    e.exec('bulletList');
    expect(e.getHTML()).toBe('<p style="text-align: center;">текст</p>');
  });

  it('undo/redo', () => {
    const e = mount('<p>текст</p>');
    selectAll(e);
    e.exec('italic');
    expect(e.can('undo')).toBe(true);
    e.exec('undo');
    expect(e.getHTML()).toBe('<p>текст</p>');
    e.exec('redo');
    expect(e.getHTML()).toBe('<p><em>текст</em></p>');
  });

  it('setContent без истории нельзя отменить', () => {
    const e = mount('<p>a</p>');
    e.setContent('<p>b</p>', { addToHistory: false });
    expect(e.can('undo')).toBe(false);
  });
});

describe('жизненный цикл', () => {
  it('рендерит тулбар по умолчанию и убирает его при toolbar: false', () => {
    const e = mount('<p>a</p>');
    expect(e.root.querySelector('.nova-toolbar')).not.toBeNull();
    e.destroy();
    const headless = mount('<p>a</p>', { toolbar: false });
    expect(headless.root.querySelector('.nova-toolbar')).toBeNull();
  });

  it('isEmpty для пустого документа', () => {
    expect(mount('').isEmpty()).toBe(true);
    expect(mount('<p>a</p>').isEmpty()).toBe(false);
  });

  it('read-only отключает редактирование и кнопки', () => {
    const e = mount('<p>a</p>', { editable: false });
    expect(e.view.dom.getAttribute('contenteditable')).toBe('false');
    const bold = e.root.querySelector<HTMLButtonElement>('[data-control="bold"]');
    expect(bold?.disabled).toBe(true);
    e.setEditable(true);
    expect(e.view.dom.getAttribute('contenteditable')).toBe('true');
  });

  it('destroy удаляет DOM и снимает слушателей', () => {
    const e = mount('<p>a</p>');
    const onDestroy = vi.fn();
    e.on('destroy', onDestroy);
    const root = e.root;
    e.destroy();
    expect(root.isConnected).toBe(false);
    expect(onDestroy).toHaveBeenCalledOnce();
    e.destroy(); // повторный вызов безопасен
  });
});

describe('isActive и editableChange (для headless UI)', () => {
  it('isActive отражает марки, блоки, списки и выравнивание', () => {
    const e = mount(
      '<h2 style="text-align: center"><strong>a</strong></h2><ul><li><p>b</p></li></ul>',
    );
    e.view.dispatch(e.view.state.tr.setSelection(TextSelection.create(e.view.state.doc, 1, 2)));
    expect(e.isActive('bold')).toBe(true);
    expect(e.isActive('italic')).toBe(false);
    expect(e.isActive('h2')).toBe(true);
    expect(e.isActive('h1')).toBe(false);
    expect(e.isActive('paragraph')).toBe(false);
    expect(e.isActive('alignCenter')).toBe(true);
    expect(e.isActive('alignLeft')).toBe(false);
    expect(e.isActive('bulletList')).toBe(false);
    expect(e.isActive('undo')).toBe(false);
    const inList = e.view.state.doc.content.size - 3;
    e.view.dispatch(e.view.state.tr.setSelection(TextSelection.create(e.view.state.doc, inList)));
    expect(e.isActive('bulletList')).toBe(true);
    expect(e.isActive('paragraph')).toBe(true);
  });

  it('setEditable шлёт editableChange только при реальном изменении', () => {
    const e = mount('<p>a</p>');
    const listener = vi.fn();
    e.on('editableChange', listener);
    e.setEditable(true);
    expect(listener).not.toHaveBeenCalled();
    e.setEditable(false);
    e.setEditable(false);
    expect(listener).toHaveBeenCalledOnce();
  });
});
