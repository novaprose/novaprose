import { TextSelection } from 'prosemirror-state';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEditor, definePlugin, insertTable, schema as baseSchema, type Editor } from '../src';
import { HTMLSerializer } from '../src/serializer';
import { createSchema } from '../src/schema';

const editors: Editor[] = [];
function mount(content: string, options: Partial<Parameters<typeof createEditor>[0]> = {}) {
  const element = document.createElement('div');
  document.body.appendChild(element);
  const editor = createEditor({ element, content, ...options });
  editors.push(editor);
  return editor;
}
afterEach(() => {
  editors.splice(0).forEach((e) => e.destroy());
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

/** Плагин-пример: блок «врезка» <div class="callout">…</div>. */
const callout = definePlugin({
  name: 'callout',
  nodes: {
    callout: {
      group: 'block',
      content: 'block+',
      defining: true,
      attrs: { tone: { default: 'info' } },
      parseDOM: [
        {
          tag: 'div.callout',
          getAttrs: (dom) => ({ tone: (dom as HTMLElement).dataset.tone ?? 'info' }),
        },
      ],
      toDOM: (node) => ['div', { class: 'callout', 'data-tone': node.attrs.tone }, 0],
    },
  },
  marks: {
    kbd: { parseDOM: [{ tag: 'kbd' }], toDOM: () => ['kbd', 0] },
  },
});

describe('Схема редактора с узлами и марками плагинов', () => {
  it('узел и марка плагина: HTML туда-обратно без изменений', () => {
    const html = '<div class="callout" data-tone="warn"><p>Нажмите <kbd>Ctrl</kbd></p></div>';
    const editor = mount(html, { plugins: [callout] });
    expect(editor.getHTML()).toBe(html);
    expect(editor.schema.nodes.callout).toBeDefined();
    expect(editor.schema).not.toBe(baseSchema);
  });

  it('редакторы со своими схемами не влияют друг на друга', () => {
    const html = '<div class="callout"><p>текст</p></div>';
    const withPlugin = mount(html, { plugins: [callout] });
    const plain = mount(html);
    expect(withPlugin.getHTML()).toBe('<div class="callout" data-tone="info"><p>текст</p></div>');
    // Без плагина узла нет — остаётся содержимое.
    expect(plain.getHTML()).toBe('<p>текст</p>');
    expect(plain.schema).toBe(baseSchema);
  });

  it('встроенные команды, правила ввода и таблицы работают на расширенной схеме', () => {
    const editor = mount('<p>hello</p>', { plugins: [callout] });
    const { state } = editor.view;
    editor.view.dispatch(state.tr.setSelection(TextSelection.create(state.doc, 1, 6)));
    expect(editor.exec('bold')).toBe(true);
    expect(editor.isActive('bold')).toBe(true);
    expect(editor.exec('bulletList')).toBe(true);
    expect(editor.isActive('bulletList')).toBe(true);
    expect(editor.getHTML()).toBe('<ul><li><p><strong>hello</strong></p></li></ul>');
    expect(editor.exec('bulletList')).toBe(true); // повторно — снять список
    expect(editor.exec('h2')).toBe(true);
    expect(editor.isActive('h2')).toBe(true);
    expect(editor.getHTML()).toBe('<h2><strong>hello</strong></h2>');
    // Таблица создаётся из типов схемы редактора (иначе ProseMirror отверг бы чужие узлы).
    expect(editor.exec(insertTable(2, 2))).toBe(true);
    expect(editor.getHTML()).toContain('<table>');
  });

  it('setContent и JSON используют схему редактора', () => {
    const editor = mount('<p>a</p>', { plugins: [callout] });
    editor.setContent('<div class="callout" data-tone="tip"><p>b</p></div>');
    const json = editor.getJSON();
    editor.setContent('<p>c</p>');
    editor.setContent(json);
    expect(editor.getHTML()).toBe('<div class="callout" data-tone="tip"><p>b</p></div>');
  });

  it('ограничения контента работают и на узлах расширенной схемы', () => {
    const editor = mount('<div class="callout"><h1>Заголовок</h1></div>', {
      plugins: [callout],
      invalidElements: 'h1',
    });
    expect(editor.getHTML()).toBe('<div class="callout" data-tone="info"><p>Заголовок</p></div>');
  });

  it('ленивый плагин с узлами не подключается и сообщает об ошибке', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const editor = mount('<p>a</p>', { plugins: [() => Promise.resolve({ default: callout })] });
    await editor.ready;
    expect(editor.hasPlugin('callout')).toBe(false);
    expect(error.mock.calls.flat().join(' ')).toContain('cannot be loaded lazily');
  });

  it('конфликт имени с базовой схемой — ошибка, редактор работает на базовой схеме', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const broken = definePlugin({
      name: 'broken',
      nodes: { paragraph: { content: 'text*', toDOM: () => ['p', 0] } },
    });
    const editor = mount('<p>a</p>', { plugins: [broken] });
    expect(editor.schema).toBe(baseSchema);
    expect(editor.getHTML()).toBe('<p>a</p>');
    expect(error).toHaveBeenCalled();
  });
});

describe('Сериализатор: защита от небезопасного toDOM плагина', () => {
  const unsafe = createSchema({
    nodes: {
      widget: {
        group: 'block',
        atom: true,
        attrs: { url: { default: '' }, tag: { default: 'div' } },
        toDOM: (node) => [
          node.attrs.tag as string,
          {
            href: node.attrs.url,
            src: node.attrs.url,
            onclick: 'alert(1)',
            style: 'background: url(javascript:alert(1))',
            'data-ok': 'yes',
          },
        ],
      },
    },
  });
  const serializer = new HTMLSerializer();
  const render = (attrs: Record<string, unknown>) =>
    serializer.serializeFragment(
      unsafe.nodes.doc.create(null, unsafe.nodes.widget!.create(attrs)).content,
    );

  it('убирает on*-обработчики, опасные URL и опасный CSS', () => {
    const html = render({ url: 'javascript:alert(1)' });
    expect(html).toBe('<div data-ok="yes"></div>');
  });

  it('пропускает безопасные URL', () => {
    expect(render({ url: 'https://example.com/a.png' })).toBe(
      '<div href="https://example.com/a.png" src="https://example.com/a.png" data-ok="yes"></div>',
    );
  });

  it('не выводит опасные элементы (script, style, object…), а сообщает об этом', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(render({ tag: 'script' })).toBe('');
    expect(render({ tag: 'object' })).toBe('');
    expect(error.mock.calls.flat().join(' ')).toContain('not allowed');
  });

  it('у запрещённой обёртки сохраняется содержимое документа, но не её статический текст', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const wrap = createSchema({
      nodes: {
        wrapper: {
          group: 'block',
          content: 'paragraph+',
          toDOM: () => ['div', ['style', 'body{display:none}'], ['template', 0]],
        },
      },
    });
    const doc = wrap.nodes.doc.create(
      null,
      wrap.nodes.wrapper!.create(null, wrap.nodes.paragraph.create(null, wrap.text('текст'))),
    );
    expect(new HTMLSerializer().serializeFragment(doc.content)).toBe('<div><p>текст</p></div>');
  });
});
