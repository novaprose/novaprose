import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEditor, setLink, type Editor } from '../src';
import { isSafeImageUrl, isSafeLinkUrl } from '../src/url';
import { TextSelection } from 'prosemirror-state';

let editor: Editor | null = null;
/**
 * Every editor a test made: all are destroyed after it. A test that mounts twice would otherwise
 * leave the first one alive, and its parts that load in the background (tables, the find bar)
 * would draw after the test environment is gone.
 */
const editors: Editor[] = [];

function mount(content = '', options: Partial<Parameters<typeof createEditor>[0]> = {}) {
  const element = document.createElement('div');
  document.body.appendChild(element);
  editor = createEditor({ element, content, ...options });
  editors.push(editor);
  return editor;
}

function selectAll(e: Editor) {
  const { doc } = e.view.state;
  e.view.dispatch(e.view.state.tr.setSelection(TextSelection.create(doc, 1, doc.content.size - 1)));
}

afterEach(() => {
  for (const e of editors.splice(0)) e.destroy();
  editor = null;
  document.body.innerHTML = '';
});

describe('HTML in and out', () => {
  it.each([
    '<p>A simple paragraph</p>',
    '<h2>Heading</h2><p>Text</p>',
    '<p><strong>bold</strong> <em>italic</em> <u>underlined</u> <s>struck</s></p>',
    '<p>H<sub>2</sub>O and E=mc<sup>2</sup></p>',
    '<ul><li><p>one</p></li><li><p>two</p></li></ul>',
    '<ol start="3"><li><p>three</p></li></ol>',
    '<blockquote><p>quote</p></blockquote>',
    '<pre><code class="language-ts">const a = 1;</code></pre>',
    '<p style="text-align: center;">centered</p>',
    '<p><a href="https://example.com">link</a></p>',
    '<p><img src="https://example.com/a.png" alt="image"></p>',
    '<hr>',
  ])('keeps %s unchanged', (html) => {
    expect(mount(html).getHTML()).toBe(html);
  });

  it('normalizes tag synonyms', () => {
    expect(mount('<p><b>a</b><i>b</i><strike>c</strike></p>').getHTML()).toBe(
      '<p><strong>a</strong><em>b</em><s>c</s></p>',
    );
  });

  it('treats <b style="font-weight:normal"> from Google Docs as not bold', () => {
    expect(mount('<b style="font-weight:normal"><p>text</p></b>').getHTML()).toBe('<p>text</p>');
  });

  it('setContent replaces the document and emits change', () => {
    const e = mount('<p>old</p>');
    const onChange = vi.fn();
    e.on('change', onChange);
    e.setContent('<p>new</p>');
    expect(e.getHTML()).toBe('<p>new</p>');
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('JSON round trip', () => {
    const e = mount('<h1>Hello</h1><p>world</p>');
    const json = e.getJSON();
    const e2 = mount();
    e2.setContent(json);
    expect(e2.getHTML()).toBe('<h1>Hello</h1><p>world</p>');
  });

  it('a decorative image keeps alt="" (screen readers skip it); without alt, none is written', () => {
    const decorative = '<p><img src="https://example.com/line.png" alt=""></p>';
    expect(mount(decorative).getHTML()).toBe(decorative);
    expect(mount('<p><img src="https://example.com/cat.png"></p>').getHTML()).toBe(
      '<p><img src="https://example.com/cat.png"></p>',
    );
  });
});

describe('security', () => {
  // Found by a property-based test (security.property.test.ts): MathML/SVG elements
  // may have no .style, and parsing must not crash.
  it("doesn't crash on cells inside MathML and SVG", () => {
    const e = mount('<p>a</p>');
    expect(() =>
      e.setContent('<math><td style="background-color: red">x</td></math>'),
    ).not.toThrow();
    expect(() => e.setContent('<svg><th>y</th></svg><p>z</p>')).not.toThrow();
    expect(e.getHTML()).toContain('z');
    // The formula text is kept, the SVG markup isn't.
    e.setContent('<p>E = <math><mi>m</mi><msup><mi>c</mi><mn>2</mn></msup></math></p>');
    expect(e.getHTML()).toBe('<p>E = mc2</p>');
    e.setContent('<p>a<svg><text>icon</text></svg>b</p>');
    expect(e.getHTML()).toBe('<p>ab</p>');
  });

  it('drops javascript: links when parsing HTML', () => {
    expect(mount('<p><a href="javascript:alert(1)">x</a></p>').getHTML()).toBe('<p>x</p>');
    expect(mount('<p><a href=" java\tscript:alert(1)">x</a></p>').getHTML()).toBe('<p>x</p>');
  });

  it('drops dangerous image src values', () => {
    expect(mount('<p><img src="javascript:alert(1)"></p>').getHTML()).toBe('<p></p>');
  });

  it("doesn't run scripts and handlers while parsing", () => {
    const html = mount('<p onclick="alert(1)">a</p><script>alert(1)</script>').getHTML();
    expect(html).toBe('<p>a</p>');
  });

  it("doesn't output a dangerous href that came through JSON", () => {
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

  it('setLink refuses a dangerous URL', () => {
    const e = mount('<p>text</p>');
    selectAll(e);
    expect(e.exec(setLink('javascript:alert(1)'))).toBe(false);
    expect(e.getHTML()).toBe('<p>text</p>');
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

  it('isSafeImageUrl allows data:image but not data:text', () => {
    expect(isSafeImageUrl('data:image/png;base64,AAAA')).toBe(true);
    expect(isSafeImageUrl('data:text/html;base64,AAAA')).toBe(false);
    expect(isSafeImageUrl('data:image/svg+xml;base64,AAAA')).toBe(false);
  });
});

describe('commands', () => {
  it('bold toggles the mark on the selection', () => {
    const e = mount('<p>text</p>');
    selectAll(e);
    expect(e.exec('bold')).toBe(true);
    expect(e.getHTML()).toBe('<p><strong>text</strong></p>');
    e.exec('bold');
    expect(e.getHTML()).toBe('<p>text</p>');
  });

  it('heading, alignment and lists', () => {
    const e = mount('<p>text</p>');
    selectAll(e);
    e.exec('h2');
    e.exec('alignCenter');
    expect(e.getHTML()).toBe('<h2 style="text-align: center;">text</h2>');
    e.exec('paragraph');
    e.exec('bulletList');
    expect(e.getHTML()).toBe('<ul><li><p style="text-align: center;">text</p></li></ul>');
    e.exec('bulletList');
    expect(e.getHTML()).toBe('<p style="text-align: center;">text</p>');
  });

  it('undo/redo', () => {
    const e = mount('<p>text</p>');
    selectAll(e);
    e.exec('italic');
    expect(e.can('undo')).toBe(true);
    e.exec('undo');
    expect(e.getHTML()).toBe('<p>text</p>');
    e.exec('redo');
    expect(e.getHTML()).toBe('<p><em>text</em></p>');
  });

  it("setContent without history can't be undone", () => {
    const e = mount('<p>a</p>');
    e.setContent('<p>b</p>', { addToHistory: false });
    expect(e.can('undo')).toBe(false);
  });

  it("a command that throws can't run: can() says false instead of breaking the buttons", () => {
    const e = mount('<p>a</p>');
    const broken = () => {
      throw new Error('Called contentMatchAt on a node with invalid content');
    };
    expect(e.can(broken)).toBe(false);
  });
});

describe('lifecycle', () => {
  it('exposes the placeholder to screen readers as aria-placeholder, not as text', () => {
    const e = mount('', { placeholder: 'Start typing…' });
    const textbox = e.root.querySelector('[role="textbox"]')!;
    expect(textbox.getAttribute('aria-placeholder')).toBe('Start typing…');
    // The visible copy comes from data-placeholder through CSS with empty alternative text.
    expect(textbox.getAttribute('data-placeholder')).toBe('Start typing…');
    e.destroy();
    expect(mount('<p>a</p>').root.querySelector('[aria-placeholder]')).toBeNull();
  });

  it('renders the toolbar by default and removes it with toolbar: false', () => {
    const e = mount('<p>a</p>');
    expect(e.root.querySelector('.nova-toolbar')).not.toBeNull();
    e.destroy();
    const headless = mount('<p>a</p>', { toolbar: false });
    expect(headless.root.querySelector('.nova-toolbar')).toBeNull();
  });

  it('isEmpty for an empty document', () => {
    expect(mount('').isEmpty()).toBe(true);
    expect(mount('<p>a</p>').isEmpty()).toBe(false);
  });

  it('read-only disables editing and buttons', () => {
    const e = mount('<p>a</p>', { editable: false });
    expect(e.view.dom.getAttribute('contenteditable')).toBe('false');
    const bold = e.root.querySelector<HTMLButtonElement>('[data-control="bold"]');
    expect(bold?.disabled).toBe(true);
    e.setEditable(true);
    expect(e.view.dom.getAttribute('contenteditable')).toBe('true');
  });

  it('destroy removes the DOM and the listeners', () => {
    const e = mount('<p>a</p>');
    const onDestroy = vi.fn();
    e.on('destroy', onDestroy);
    const root = e.root;
    e.destroy();
    expect(root.isConnected).toBe(false);
    expect(onDestroy).toHaveBeenCalledOnce();
    e.destroy(); // calling it again is safe
  });
});

describe('isActive and editableChange (for a headless UI)', () => {
  it('isActive reflects marks, blocks, lists and alignment', () => {
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

  it('setEditable sends editableChange only on a real change', () => {
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
