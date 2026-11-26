import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createEditor,
  createRenderer,
  definePlugin,
  renderHTML,
  type DocumentOptions,
  type Editor,
  type EditorOptions,
} from '../src';

/**
 * HTML документа без редактора (createRenderer / renderHTML) — тот же, что getHTML() редактора с
 * теми же настройками: сравниваем на документах со всеми видами узлов. На любых случайных документах
 * то же свойство проверяет security.property.test.ts; без DOM — render-server.test.ts.
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
  editor = createEditor({ element, content, ...options });
  await editor.ready;
  return editor;
}

/** JSON из редактора → отрисовщик с теми же настройками: HTML и текст совпадают с редактором. */
async function expectSame(content: string, options: DocumentOptions = {}): Promise<Editor> {
  const e = await mount(content, options as Partial<EditorOptions>);
  const json = e.getJSON();
  const renderer = createRenderer(options);
  expect(renderer.html(json)).toBe(e.getHTML());
  expect(renderer.text(json)).toBe(e.getText());
  expect(renderHTML(json, options)).toBe(e.getHTML());
  return e;
}

function nodeTypes(json: unknown, out = new Set<string>()): Set<string> {
  if (json && typeof json === 'object') {
    const node = json as { type?: string; content?: unknown[] };
    if (node.type) out.add(node.type);
    node.content?.forEach((child) => nodeTypes(child, out));
  }
  return out;
}

const RICH = [
  '<h2 style="text-align: center">Intro</h2>',
  '<p style="margin-left: 40px">Indented <strong>bold</strong> <em>it</em> <u>u</u> <s>s</s> ',
  '<code>x</code> <sub>2</sub> <sup>3</sup> <span style="color: #e03e2d">red</span> ',
  '<a href="https://example.com" target="_blank">link</a> <a href="javascript:alert(1)">bad</a></p>',
  '<blockquote><p>Quote</p></blockquote>',
  '<ul><li><p>one</p></li><li><p>two</p><ol><li><p>nested</p></li></ol></li></ul>',
  '<ul data-type="checklist"><li data-checked="true"><p>done</p></li></ul>',
  '<table><tbody><tr><th><p>H</p></th><td colspan="2" style="background-color: #fbeeb8"><p>cell</p></td></tr></tbody></table>',
  '<p><img src="https://example.com/a.png" alt="A" width="10" height="20"></p>',
  '<figure class="image"><img src="https://example.com/b.png" alt="B"><figcaption>Caption</figcaption></figure>',
  '<pre data-language="javascript"><code>const a = 1 &lt; 2;</code></pre>',
  '<hr><p>end<br>line</p>',
].join('');

describe('HTML без редактора — как getHTML()', () => {
  it('документ со всеми встроенными узлами и марками', async () => {
    const e = await expectSame(RICH);
    expect(e.getHTML()).not.toContain('javascript:');
  });

  it('плагины со своими узлами (и их настройки)', async () => {
    const content = [
      '<nav class="nova-toc" data-toc=""></nav>',
      '<h2>First</h2><h3>Second</h3>',
      '<details open=""><summary>Title</summary><p>Body</p></details>',
      '<p>Ask <span data-mention="u1">@Anna</span>, <span data-var="client" contenteditable="false">Client</span>',
      ' <span data-type="inline-math" data-latex="x^2"></span> <a id="top"></a></p>',
      '<div data-type="block-math" data-latex="\\frac{a}{b}"></div>',
      '<div class="nova-pagebreak" style="break-after: page;"></div>',
      '<iframe src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ" width="640" height="360"></iframe>',
    ].join('');
    const options: DocumentOptions = {
      plugins: [
        'tableofcontents',
        'accordion',
        'mentions',
        'mergetags',
        'math',
        'anchor',
        'pagebreak',
        'media',
        'codesample',
      ],
      pluginOptions: {
        accordion: { serializedState: 'collapsed' },
        mergetags: { attribute: 'data-var' },
        tableofcontents: { depth: 2, titleTag: 'h2' },
      },
    };
    const e = await expectSame(content, options);
    const types = nodeTypes(e.getJSON());
    for (const type of [
      'toc',
      'details',
      'mention',
      'mergetag',
      'math_inline',
      'math_block',
      'anchor',
      'pagebreak',
      'media',
    ])
      expect(types, type).toContain(type);
    // Настройки плагинов влияют на HTML и у отрисовщика: блок сохраняется свёрнутым,
    // в оглавлении — только h2 (depth: 2).
    expect(e.getHTML()).toContain('<details><summary>Title</summary>');
    expect(e.getHTML()).toMatch(/<ul><li><a href="#[^"]+">First<\/a><\/li><\/ul>/);
    expect(e.getHTML()).toContain('<span data-var="client" contenteditable="false">');
  });

  it('направление письма и классы из форматов', async () => {
    await expectSame('<p style="margin-right: 40px">שלום</p>', { language: 'he' });
    await expectSame('<p class="lead other">x</p>', {
      styleFormats: [{ title: 'Lead', block: 'p', classes: 'lead' }],
    });
  });

  it('правила разметки (invalidElements, validStyles) применяются и к JSON', async () => {
    const options: DocumentOptions = { invalidElements: 'em', validStyles: { '*': 'color' } };
    const e = await mount('<p></p>', options as Partial<EditorOptions>);
    const json = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'a', marks: [{ type: 'italic' }] },
            {
              type: 'text',
              text: 'b',
              marks: [
                { type: 'color', attrs: { value: '#ff0000' } },
                { type: 'font_size', attrs: { value: '20px' } },
              ],
            },
          ],
        },
      ],
    };
    e.setContent(json);
    expect(createRenderer(options).html(json)).toBe(e.getHTML());
    expect(e.getHTML()).toBe('<p>a<span style="color: #ff0000;">b</span></p>');
  });
});

describe('устойчивость', () => {
  it('атрибуты не того типа из JSON — умолчания, а не исключение', () => {
    const html = renderHTML({
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 'x', align: 42 },
          content: [{ type: 'text', text: 'H' }],
        },
        {
          type: 'table',
          content: [
            {
              type: 'table_row',
              content: [
                {
                  type: 'table_cell',
                  attrs: { colspan: null, rowspan: 'two' },
                  content: [{ type: 'paragraph' }],
                },
              ],
            },
          ],
        },
      ],
    });
    expect(html).toContain('<h1>H</h1>');
    expect(html).toContain('<td><p></p></td>');
  });

  it('плагин, чьи узлы падают, — без узлов, но редактор и отрисовщик работают', async () => {
    const broken = definePlugin({
      name: 'broken-nodes',
      nodes: () => {
        throw new Error('boom');
      },
    });
    const errors: unknown[] = [];
    const spy = vi.spyOn(console, 'error').mockImplementation((...args) => errors.push(args[0]));
    const e = await mount('<p>x</p>', { plugins: [broken] });
    expect(e.getHTML()).toBe('<p>x</p>');
    expect(renderHTML(e.getJSON(), { plugins: [broken] })).toBe('<p>x</p>');
    spy.mockRestore();
    expect(errors).toContain('[nova] Plugin "broken-nodes" failed to define its nodes');
  });

  it('один отрисовщик — много документов; схема доступна', () => {
    const renderer = createRenderer({ plugins: ['mentions'] });
    expect(renderer.schema.nodes.mention).toBeDefined();
    const doc = (text: string) => ({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
    });
    expect(['a', 'b'].map((text) => renderer.html(doc(text)))).toEqual(['<p>a</p>', '<p>b</p>']);
    expect(renderer.doc(doc('c')).textContent).toBe('c');
  });
});
