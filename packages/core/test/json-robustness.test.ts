import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createEditor, listSuggestions, resolveSuggestions } from '../src';

/**
 * A JSON document comes from outside (a database, an API, old versions) and doesn't have to match the schema's types.
 * No node and no mark with attributes of the wrong type (null, a number, a garbage string) may
 * crash setContent / getHTML / toolbar rendering, otherwise the user can't open their document.
 * Found by a property-based test (security.property.test.ts).
 */
const PLUGINS = [
  'accordion',
  'footnotes',
  'math',
  'tableofcontents',
  'anchor',
  'pagebreak',
  'media',
  'pageembed',
  'advtable',
  'comments',
  'mentions',
  'mergetags',
  'suggestions',
  // Lazy ones: decorations (checkboxes, code highlighting) must not crash on garbage attributes either.
  'checklist',
  'codesample',
];
const element = document.createElement('div');
document.body.appendChild(element);
const editor = createEditor({ element, plugins: PLUGINS });
beforeAll(() => editor.ready);
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
  'checked',
  'checklist',
  'open',
  'entries',
  'latex',
  'number',
  'before',
  'suggestion',
  'size',
  'border',
  'scrolling',
  'series',
];
const VARIANTS: unknown[] = [null, 7, 0, -1, true, 'url(x.htc)', '"><x', 'a b', [], {}];
const attrsWith = (v: unknown) => Object.fromEntries(ATTR_NAMES.map((n) => [n, v]));
const text = { type: 'text', text: 'x' };
const para = (...content: unknown[]) => ({ type: 'paragraph', content });

const NODES: Record<string, (a: Record<string, unknown>) => unknown> = {
  paragraph: (attrs) => ({ type: 'paragraph', attrs, content: [text] }),
  heading: (attrs) => ({ type: 'heading', attrs, content: [text] }),
  code_block: (attrs) => ({ type: 'code_block', attrs, content: [text] }),
  toc: (attrs) => ({ type: 'toc', attrs }),
  math_block: (attrs) => ({ type: 'math_block', attrs }),
  math_inline: (attrs) => para({ type: 'math_inline', attrs }),
  details: (attrs) => ({
    type: 'details',
    attrs,
    content: [{ type: 'details_summary', content: [text] }, para(text)],
  }),
  image: (attrs) => para({ type: 'image', attrs }),
  mention: (attrs) => para({ type: 'mention', attrs }),
  footnote_ref: (attrs) => para({ type: 'footnote_ref', attrs }),
  footnotes: (attrs) => ({
    type: 'footnotes',
    attrs,
    content: [{ type: 'footnote', attrs, content: [text] }],
  }),
  mergetag: (attrs) => para({ type: 'mergetag', attrs }),
  anchor: (attrs) => para({ type: 'anchor', attrs }),
  media: (attrs) => ({ type: 'media', attrs }),
  pageembed: (attrs) => ({ type: 'pageembed', attrs }),
  figure: (attrs) => ({
    type: 'figure',
    attrs,
    content: [
      { type: 'figure_image', attrs },
      { type: 'figcaption', content: [text] },
    ],
  }),
  bullet_list: (attrs) => ({
    type: 'bullet_list',
    attrs,
    content: [{ type: 'list_item', attrs, content: [para(text)] }],
  }),
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

describe('external JSON with attributes of the wrong type', () => {
  for (const [name, make] of Object.entries(NODES)) {
    it(`node ${name}`, () => {
      for (const v of VARIANTS) {
        expect(
          () => {
            editor.setContent({ type: 'doc', content: [make(attrsWith(v))] });
            editor.getHTML();
          },
          `value ${JSON.stringify(v)}`,
        ).not.toThrow();
      }
    });
  }

  it('every mark', () => {
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
          `mark ${mark}, value ${JSON.stringify(v)}`,
        ).not.toThrow();
      }
    }
  });

  it("a heading level outside 1–6 doesn't reach the tag name", () => {
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

  it('an unsafe or non-string link address is replaced with "#"', () => {
    for (const href of [null, 7, 'javascript:alert(1)']) {
      editor.setContent({
        type: 'doc',
        content: [para({ ...text, marks: [{ type: 'link', attrs: { href } }] })],
      });
      expect(editor.getHTML()).toBe('<p><a href="#">x</a></p>');
    }
  });

  it('a suggestion any node carries can be anything: listing, accepting, rejecting and HTML stay safe', () => {
    const hostile: unknown[] = [
      {
        id: 's1',
        change: 'insert',
        author: '"><img src=x onerror=alert(1)>',
        name: '<script>alert(1)</script>',
        time: 'soon',
      },
      { id: 's2', change: 'delete', author: 'bob', name: 'Bob', time: 1 },
      { id: 's3', change: 'wrap', depth: 1e9 },
      { id: 's4', change: 'unwrap', depth: -5 },
      { id: 's5', change: 'block', before: { type: 'heading', attrs: { level: '"><x' } } },
      { id: 's6', change: 'block', before: '{"type":"table_cell","attrs":{"colspan":"x"}}' },
      { id: '<bad id>', change: 'insert' },
      { id: 's7', change: 'teleport' },
    ];
    for (const [name, make] of Object.entries(NODES)) {
      for (const suggestion of hostile) {
        const label = `${name}: ${JSON.stringify(suggestion)}`;
        expect(() => {
          editor.setContent({
            type: 'doc',
            content: [para(text), make({ ...attrsWith(null), suggestion })],
          });
          const html = editor.getHTML();
          expect(html, label).not.toMatch(/<script|<img src=x|onerror=/i);
          listSuggestions(editor.view.state.doc);
          for (const action of ['accept', 'reject'] as const)
            editor.view.state.apply(resolveSuggestions(editor.view.state, action));
        }, label).not.toThrow();
      }
    }
  });

  it("a cell with colspan: null doesn't reject the whole document", () => {
    editor.setContent({
      type: 'doc',
      content: [
        para({ type: 'text', text: 'before the table' }),
        NODES.table!({ colspan: null, rowspan: 'x' }),
      ],
    });
    expect(editor.getHTML()).toContain('before the table');
    expect(editor.getHTML()).toContain('<td>');
  });
});
