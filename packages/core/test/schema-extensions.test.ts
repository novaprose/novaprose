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

/** An example plugin: a "callout" block <div class="callout">…</div>. */
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

describe('An editor schema with plugin nodes and marks', () => {
  it("a plugin's node and mark: HTML round trip without changes", () => {
    const html = '<div class="callout" data-tone="warn"><p>Press <kbd>Ctrl</kbd></p></div>';
    const editor = mount(html, { plugins: [callout] });
    expect(editor.getHTML()).toBe(html);
    expect(editor.schema.nodes.callout).toBeDefined();
    expect(editor.schema).not.toBe(baseSchema);
  });

  it("editors with their own schemas don't affect each other", () => {
    const html = '<div class="callout"><p>text</p></div>';
    const withPlugin = mount(html, { plugins: [callout] });
    const plain = mount(html);
    expect(withPlugin.getHTML()).toBe('<div class="callout" data-tone="info"><p>text</p></div>');
    // Without the plugin there is no node: the content stays.
    expect(plain.getHTML()).toBe('<p>text</p>');
    // Each editor has its own schema (the class filter), but the set of nodes is the base one.
    expect(plain.schema.nodes.callout).toBeUndefined();
    expect(Object.keys(plain.schema.nodes)).toEqual(Object.keys(baseSchema.nodes));
  });

  it('built-in commands, input rules and tables work on the extended schema', () => {
    const editor = mount('<p>hello</p>', { plugins: [callout] });
    const { state } = editor.view;
    editor.view.dispatch(state.tr.setSelection(TextSelection.create(state.doc, 1, 6)));
    expect(editor.exec('bold')).toBe(true);
    expect(editor.isActive('bold')).toBe(true);
    expect(editor.exec('bulletList')).toBe(true);
    expect(editor.isActive('bulletList')).toBe(true);
    expect(editor.getHTML()).toBe('<ul><li><p><strong>hello</strong></p></li></ul>');
    expect(editor.exec('bulletList')).toBe(true); // again, to remove the list
    expect(editor.exec('h2')).toBe(true);
    expect(editor.isActive('h2')).toBe(true);
    expect(editor.getHTML()).toBe('<h2><strong>hello</strong></h2>');
    // The table is created from the editor schema's types (otherwise ProseMirror would reject foreign nodes).
    expect(editor.exec(insertTable(2, 2))).toBe(true);
    expect(editor.getHTML()).toContain('<table>');
  });

  it("setContent and JSON use the editor's schema", () => {
    const editor = mount('<p>a</p>', { plugins: [callout] });
    editor.setContent('<div class="callout" data-tone="tip"><p>b</p></div>');
    const json = editor.getJSON();
    editor.setContent('<p>c</p>');
    editor.setContent(json);
    expect(editor.getHTML()).toBe('<div class="callout" data-tone="tip"><p>b</p></div>');
  });

  it('content restrictions work on nodes of the extended schema too', () => {
    const editor = mount('<div class="callout"><h1>Heading</h1></div>', {
      plugins: [callout],
      invalidElements: 'h1',
    });
    expect(editor.getHTML()).toBe('<div class="callout" data-tone="info"><p>Heading</p></div>');
  });

  it("a lazy plugin with nodes isn't attached and reports an error", async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const editor = mount('<p>a</p>', { plugins: [() => Promise.resolve({ default: callout })] });
    await editor.ready;
    expect(editor.hasPlugin('callout')).toBe(false);
    expect(error.mock.calls.flat().join(' ')).toContain('cannot be loaded lazily');
  });

  it('a name clash with the base schema is an error, the editor works on the base schema', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const broken = definePlugin({
      name: 'broken',
      nodes: { paragraph: { content: 'text*', toDOM: () => ['p', 0] } },
    });
    const editor = mount('<p>a</p>', { plugins: [broken] });
    // The plugin's nodes aren't attached: paragraph is the base one, not the plugin's.
    expect(Object.keys(editor.schema.nodes)).toEqual(Object.keys(baseSchema.nodes));
    expect(editor.schema.nodes.paragraph.spec.content).toBe('inline*');
    expect(editor.getHTML()).toBe('<p>a</p>');
    expect(error).toHaveBeenCalled();
  });
});

describe("Serializer: protection from a plugin's unsafe toDOM", () => {
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

  it('removes on* handlers, dangerous URLs and dangerous CSS', () => {
    const html = render({ url: 'javascript:alert(1)' });
    expect(html).toBe('<div data-ok="yes"></div>');
  });

  it('lets safe URLs through', () => {
    expect(render({ url: 'https://example.com/a.png' })).toBe(
      '<div href="https://example.com/a.png" src="https://example.com/a.png" data-ok="yes"></div>',
    );
  });

  it("doesn't output dangerous elements (script, style, object…) and reports it", () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(render({ tag: 'script' })).toBe('');
    expect(render({ tag: 'object' })).toBe('');
    expect(error.mock.calls.flat().join(' ')).toContain('not allowed');
  });

  it('a forbidden wrapper keeps the document content but not its static text', () => {
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
      wrap.nodes.wrapper!.create(null, wrap.nodes.paragraph.create(null, wrap.text('text'))),
    );
    expect(new HTMLSerializer().serializeFragment(doc.content)).toBe('<div><p>text</p></div>');
  });
});
