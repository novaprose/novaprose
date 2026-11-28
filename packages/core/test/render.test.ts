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
 * Document HTML without an editor (createRenderer / renderHTML) is the same as the editor's getHTML() with
 * the same settings: compared on documents with every kind of node. On any random documents
 * security.property.test.ts checks the same property; render-server.test.ts checks it without a DOM.
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

/** JSON from the editor → a renderer with the same settings: the HTML and text match the editor's. */
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

describe('HTML without an editor, like getHTML()', () => {
  it('a document with every built-in node and mark', async () => {
    const e = await expectSame(RICH);
    expect(e.getHTML()).not.toContain('javascript:');
  });

  it('plugins with their own nodes (and their settings)', async () => {
    const content = [
      '<nav class="nova-toc" data-toc=""></nav>',
      '<h2>First</h2><h3>Second</h3>',
      '<details open=""><summary>Title</summary><p>Body</p></details>',
      '<p>Ask <span data-mention="u1">@Anna</span>, <span data-var="client" contenteditable="false">Client</span>',
      ' <span data-type="inline-math" data-latex="x^2"></span> <a id="top"></a></p>',
      '<div data-type="block-math" data-latex="\\frac{a}{b}"></div>',
      '<div class="nova-pagebreak" style="break-after: page;"></div>',
      '<iframe src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ" width="640" height="360"></iframe>',
      '<div class="embed embed--4by3"><iframe src="https://example.com/map" title="Map"></iframe></div>',
      '<a class="card" href="https://example.com/post"><img class="card-thumbnail" src="https://example.com/c.jpg">' +
        '<span class="card-title">Post</span><span class="card-author">Ann</span></a>',
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
        'pageembed',
        'mediaembed',
        'codesample',
      ],
      pluginOptions: {
        accordion: { serializedState: 'collapsed' },
        mergetags: { attribute: 'data-var' },
        tableofcontents: { depth: 2, titleTag: 'h2' },
        pageembed: { className: 'embed', sizes: [{ value: 'embed--4by3' }], inlineStyles: false },
        mediaembed: { className: 'card', maxWidth: 500 },
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
      'pageembed',
      'link_card',
    ])
      expect(types, type).toContain(type);
    // The card's settings reach the renderer: your class, the width.
    expect(e.getHTML()).toContain('<a class="card" href="https://example.com/post"');
    expect(e.getHTML()).toContain('max-width: 500px');
    // Plugin settings affect the renderer's HTML too: the block is saved collapsed,
    // the table of contents has only h2 (depth: 2).
    expect(e.getHTML()).toContain('<details><summary>Title</summary>');
    expect(e.getHTML()).toMatch(/<ul><li><a href="#[^"]+">First<\/a><\/li><\/ul>/);
    expect(e.getHTML()).toContain('<span data-var="client" contenteditable="false">');
  });

  it('writing direction and classes from formats', async () => {
    await expectSame('<p style="margin-right: 40px">שלום</p>', { language: 'he' });
    await expectSame('<p class="lead other">x</p>', {
      styleFormats: [{ title: 'Lead', block: 'p', classes: 'lead' }],
    });
  });

  it('markup rules (invalidElements, validStyles) apply to JSON too', async () => {
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

describe('robustness', () => {
  it('attributes of the wrong type from JSON get the defaults, not an exception', () => {
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

  it('a plugin whose nodes crash goes without nodes, but the editor and the renderer work', async () => {
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

  it('one renderer, many documents; the schema is available', () => {
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
