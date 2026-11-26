import { NodeSelection, TextSelection } from 'prosemirror-state';
import { afterEach, describe, expect, it } from 'vitest';
import { createEditor, type Editor } from '../src';
import { getSelectedImage, setImageAttrs, toggleImageCaption } from '../src/image';
import { markdownToHTML, toMarkdown } from '../src/markdown';

/** An image with a caption: <figure><img><figcaption>. */

const editors: Editor[] = [];
afterEach(() => {
  editors.splice(0).forEach((e) => e.destroy());
  document.body.innerHTML = '';
});

function mount(content: string, options: Partial<Parameters<typeof createEditor>[0]> = {}) {
  const element = document.createElement('div');
  document.body.appendChild(element);
  const editor = createEditor({ element, content, ...options });
  editors.push(editor);
  return editor;
}

const SRC = 'https://example.com/cat.png';
const FIG = `<figure style="width: 320px;"><img src="${SRC}" alt="Cat" width="320" height="240"><figcaption>A <strong>cat</strong></figcaption></figure>`;

/** Selects the first image (as a node). */
function selectImage(e: Editor) {
  let pos = -1;
  e.view.state.doc.descendants((node, p) => {
    if (pos < 0 && (node.type.name === 'image' || node.type.name === 'figure')) pos = p;
  });
  e.view.dispatch(e.view.state.tr.setSelection(NodeSelection.create(e.view.state.doc, pos)));
}

describe('HTML', () => {
  it.each([
    FIG,
    `<figure><img src="${SRC}"><figcaption></figcaption></figure>`,
    `<figure style="float: left; margin: 0 1em 1em 0; width: 200px;"><img src="${SRC}" width="200"><figcaption>left</figcaption></figure>`,
    `<figure style="display: block; margin-left: auto; margin-right: auto;"><img src="${SRC}"><figcaption>center</figcaption></figure>`,
  ])('round trip without changes: %s', (html) => {
    expect(mount(html).getHTML()).toBe(html);
  });

  it('a figure without a caption gets an empty caption', () => {
    expect(mount(`<figure><img src="${SRC}"></figure>`).getHTML()).toBe(
      `<figure><img src="${SRC}"><figcaption></figcaption></figure>`,
    );
  });

  it("a figure with an unsafe image isn't created, the caption text is kept", () => {
    const html = mount(
      '<figure><img src="javascript:alert(1)"><figcaption>text</figcaption></figure>',
    ).getHTML();
    expect(html).not.toContain('javascript');
    expect(html).not.toContain('<figure');
    expect(html).toContain('text');
  });

  it('a figure without an image (with a quote) is parsed as regular content', () => {
    expect(mount('<figure><blockquote><p>quote</p></blockquote></figure>').getHTML()).toBe(
      '<blockquote><p>quote</p></blockquote>',
    );
  });
});

describe('turning the caption on and off', () => {
  it('an image alone in a paragraph → a figure, the cursor in the caption', () => {
    const e = mount(`<p><img src="${SRC}" alt="Cat"></p>`);
    selectImage(e);
    expect(e.exec(toggleImageCaption)).toBe(true);
    expect(e.getHTML()).toBe(
      `<figure><img src="${SRC}" alt="Cat"><figcaption></figcaption></figure>`,
    );
    expect(e.view.state.selection.$from.parent.type.name).toBe('figcaption');
    e.view.dispatch(e.view.state.tr.insertText('Hello'));
    expect(e.getHTML()).toContain('<figcaption>Hello</figcaption>');
  });

  it('an image inside text → a figure after the paragraph, the text stays', () => {
    const e = mount(`<p>before <img src="${SRC}"> after</p>`);
    selectImage(e);
    e.exec(toggleImageCaption);
    expect(e.getHTML()).toBe(
      `<p>before &nbsp;after</p><figure><img src="${SRC}"><figcaption></figcaption></figure>`,
    );
  });

  it('removing the caption: the image in a paragraph, the caption text as a paragraph below (not lost)', () => {
    const e = mount(FIG);
    selectImage(e);
    e.exec(toggleImageCaption);
    expect(e.getHTML()).toBe(
      `<p><img src="${SRC}" alt="Cat" width="320" height="240"></p><p>A <strong>cat</strong></p>`,
    );
  });

  it('an empty caption is removed without an extra paragraph', () => {
    const e = mount(`<figure><img src="${SRC}"><figcaption></figcaption></figure>`);
    selectImage(e);
    e.exec(toggleImageCaption);
    expect(e.getHTML()).toBe(`<p><img src="${SRC}"></p>`);
  });
});

describe('editing', () => {
  /** The cursor at the end of the caption. */
  const cursorInCaption = (e: Editor) => {
    let pos = 0;
    e.view.state.doc.descendants((node, p) => {
      if (node.type.name === 'figcaption') pos = p + node.nodeSize - 1;
    });
    e.view.dispatch(e.view.state.tr.setSelection(TextSelection.create(e.view.state.doc, pos)));
  };

  it('the cursor in the caption: the image toolbar knows about it; alignment applies to the figure', () => {
    const e = mount(FIG);
    cursorInCaption(e);
    expect(getSelectedImage(e.view.state)?.node.type.name).toBe('figure');
    e.exec(setImageAttrs({ align: 'right' }));
    expect(e.getHTML()).toContain(
      '<figure style="float: right; margin: 0 0 1em 1em; width: 320px;">',
    );
  });

  it('Enter in the caption makes a new paragraph after the image', () => {
    const e = mount(FIG);
    cursorInCaption(e);
    e.view.dom.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
    );
    e.view.dispatch(e.view.state.tr.insertText('next'));
    expect(e.getHTML()).toBe(`${FIG}<p>next</p>`);
  });

  it('deleting from the toolbar works with the cursor in the caption too', () => {
    const e = mount(`<p>a</p>${FIG}`, { toolbar: false });
    cursorInCaption(e);
    const image = getSelectedImage(e.view.state)!;
    e.view.dispatch(e.view.state.tr.delete(image.pos, image.pos + image.node.nodeSize));
    expect(e.getHTML()).toBe('<p>a</p>');
  });
});

describe('content restrictions and Markdown', () => {
  it('validElements without figure: the image and the caption become paragraphs', () => {
    const e = mount(FIG, { validElements: 'p,img,strong' });
    expect(e.getHTML()).toBe(
      `<p><img src="${SRC}" alt="Cat" width="320" height="240"></p><p>A <strong>cat</strong></p>`,
    );
  });

  it('images forbidden: only the caption text remains of the figure', () => {
    expect(mount(FIG, { validElements: 'p,strong' }).getHTML()).toBe(
      '<p>A <strong>cat</strong></p>',
    );
  });

  it('Markdown: the image and the caption as a paragraph', () => {
    const e = mount(FIG);
    expect(toMarkdown(e)).toBe(`![Cat](${SRC})\n\nA **cat**`);
    e.setContent(markdownToHTML(toMarkdown(e)));
    expect(e.getHTML()).toContain('A <strong>cat</strong>');
  });

  it("JSON with garbage in figure attributes doesn't crash the editor", () => {
    const e = mount('<p>a</p>');
    e.setContent({
      type: 'doc',
      content: [
        {
          type: 'figure',
          attrs: { src: null, width: 'x', align: 7 },
          content: [{ type: 'figcaption' }],
        },
      ],
    });
    expect(() => e.getHTML()).not.toThrow();
    expect(e.getHTML()).not.toContain('src="null"');
  });
});
