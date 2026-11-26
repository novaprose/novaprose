import { afterAll, describe, expect, it } from 'vitest';
import { createEditor } from '../src';

/**
 * JSON-документ приходит снаружи (БД, API, старые версии) и не обязан соответствовать типам схемы.
 * Любой узел и любая марка с атрибутами не того типа (null, число, мусорная строка) не должны
 * ронять setContent / getHTML / отрисовку тулбара — иначе пользователь не откроет свой документ.
 * Найдено property-based тестом (security.property.test.ts).
 */
const PLUGINS = [
  'anchor',
  'pagebreak',
  'media',
  'comments',
  'mentions',
  'mergetags',
  'suggestions',
];
const element = document.createElement('div');
document.body.appendChild(element);
const editor = createEditor({ element, plugins: PLUGINS });
afterAll(() => editor.destroy());

const ATTR_NAMES = [
  'src',
  'href',
  'class',
  'align',
  'dir',
  'lineHeight',
  'language',
  'level',
  'width',
  'height',
  'kind',
  'start',
  'listStyle',
  'background',
  'valign',
  'key',
  'id',
  'name',
  'label',
  'value',
  'title',
  'target',
  'author',
  'time',
  'colwidth',
  'colspan',
  'rowspan',
  'alt',
];
const VARIANTS: unknown[] = [null, 7, 0, -1, true, 'url(x.htc)', '"><x', 'a b', [], {}];
const attrsWith = (v: unknown) => Object.fromEntries(ATTR_NAMES.map((n) => [n, v]));
const text = { type: 'text', text: 'x' };
const para = (...content: unknown[]) => ({ type: 'paragraph', content });

const NODES: Record<string, (a: Record<string, unknown>) => unknown> = {
  paragraph: (attrs) => ({ type: 'paragraph', attrs, content: [text] }),
  heading: (attrs) => ({ type: 'heading', attrs, content: [text] }),
  code_block: (attrs) => ({ type: 'code_block', attrs, content: [text] }),
  image: (attrs) => para({ type: 'image', attrs }),
  mention: (attrs) => para({ type: 'mention', attrs }),
  mergetag: (attrs) => para({ type: 'mergetag', attrs }),
  anchor: (attrs) => para({ type: 'anchor', attrs }),
  media: (attrs) => ({ type: 'media', attrs }),
  ordered_list: (attrs) => ({
    type: 'ordered_list',
    attrs,
    content: [{ type: 'list_item', content: [para(text)] }],
  }),
  table: (attrs) => ({
    type: 'table',
    attrs,
    content: [
      { type: 'table_row', content: [{ type: 'table_cell', attrs, content: [para(text)] }] },
    ],
  }),
};

describe('внешний JSON с атрибутами не того типа', () => {
  for (const [name, make] of Object.entries(NODES)) {
    it(`узел ${name}`, () => {
      for (const v of VARIANTS) {
        expect(
          () => {
            editor.setContent({ type: 'doc', content: [make(attrsWith(v))] });
            editor.getHTML();
          },
          `значение ${JSON.stringify(v)}`,
        ).not.toThrow();
      }
    });
  }

  it('все марки', () => {
    for (const mark of Object.keys(editor.view.state.schema.marks)) {
      for (const v of VARIANTS) {
        expect(
          () => {
            editor.setContent({
              type: 'doc',
              content: [para({ ...text, marks: [{ type: mark, attrs: attrsWith(v) }] })],
            });
            editor.getHTML();
          },
          `марка ${mark}, значение ${JSON.stringify(v)}`,
        ).not.toThrow();
      }
    }
  });

  it('уровень заголовка вне 1–6 не попадает в имя тега', () => {
    for (const level of ['1><script', 7, 0, null, 'eader']) {
      editor.setContent({
        type: 'doc',
        content: [{ type: 'heading', attrs: { level }, content: [text] }],
      });
      expect(editor.getHTML()).toBe('<h1>x</h1>');
    }
    editor.setContent({
      type: 'doc',
      content: [{ type: 'heading', attrs: { level: '3' }, content: [text] }],
    });
    expect(editor.getHTML()).toBe('<h3>x</h3>');
  });

  it('небезопасный или нестроковый адрес ссылки заменяется на «#»', () => {
    for (const href of [null, 7, 'javascript:alert(1)']) {
      editor.setContent({
        type: 'doc',
        content: [para({ ...text, marks: [{ type: 'link', attrs: { href } }] })],
      });
      expect(editor.getHTML()).toBe('<p><a href="#">x</a></p>');
    }
  });

  it('ячейка с colspan: null не отвергает весь документ', () => {
    editor.setContent({
      type: 'doc',
      content: [
        para({ type: 'text', text: 'до таблицы' }),
        NODES.table!({ colspan: null, rowspan: 'x' }),
      ],
    });
    expect(editor.getHTML()).toContain('до таблицы');
    expect(editor.getHTML()).toContain('<td>');
  });
});
