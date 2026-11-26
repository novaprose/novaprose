import { TextSelection } from 'prosemirror-state';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEditor, registerHtmlRules, type Editor, type EditorOptions } from '../src';
import { toMarkdown } from '../src/markdown';
import { htmlRules } from '../src/html-rules';

registerHtmlRules(htmlRules);

/**
 * Element and attribute rules: validElements with attributes, extendedValidElements, customElements.
 * The main property: the customer's HTML allowed by the rules goes through a round trip unchanged,
 * and the rules can't turn security off.
 */

let editor: Editor | null = null;

afterEach(() => {
  editor?.destroy();
  editor = null;
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

function mount(options: Partial<EditorOptions>, content = ''): Editor {
  const element = document.createElement('div');
  document.body.append(element);
  editor = createEditor({ element, content, ...options });
  return editor;
}

/** The HTML after loading and after loading its own output again: they must match. */
function roundTrip(options: Partial<EditorOptions>, html: string): string {
  const e = mount(options, html);
  const first = e.getHTML();
  e.setContent(first);
  expect(e.getHTML()).toBe(first);
  return first;
}

describe('extendedValidElements: attributes of built-in elements', () => {
  it('id on headings (table of contents) is kept', () => {
    const html = '<h2 id="intro">Intro</h2><p>Text</p>';
    expect(roundTrip({ extendedValidElements: 'h2[id]' }, html)).toBe(html);
  });

  it("without a rule the attribute isn't kept, as before", () => {
    // id on a heading is built in (table of contents, #section links), title isn't.
    expect(roundTrip({}, '<h2 title="intro">Intro</h2>')).toBe('<h2>Intro</h2>');
  });

  it("a link's attribute list replaces the built-in one: data-* and rel stay, title goes", () => {
    const out = roundTrip(
      { extendedValidElements: 'a[href|rel|data-*]' },
      '<p><a href="https://a.io" rel="sponsored" data-track="cta" title="T">x</a></p>',
    );
    expect(out).toBe('<p><a href="https://a.io" rel="sponsored" data-track="cta">x</a></p>');
  });

  it('@[...]: attributes for every element', () => {
    const html = '<p id="a">x</p><ul><li id="b"><p>y</p></li></ul>';
    expect(roundTrip({ extendedValidElements: '@[id]' }, html)).toBe(html);
  });

  it("a built-in value isn't duplicated: a changed title doesn't go back to the old one", () => {
    const e = mount(
      { extendedValidElements: 'a[href|title|data-x]' },
      '<p><a href="https://a.io" title="Old" data-x="1">x</a></p>',
    );
    const link = e.view.state.schema.marks.link!;
    const { state } = e.view;
    e.view.dispatch(
      state.tr
        .removeMark(0, state.doc.content.size, link)
        .addMark(1, 2, link.create({ href: 'https://a.io', title: null })),
    );
    expect(e.getHTML()).toBe('<p><a href="https://a.io">x</a></p>');
  });

  it('p[class] without validClasses keeps the classes of built-in elements', () => {
    const html = '<p class="lead">x</p>';
    expect(roundTrip({ extendedValidElements: 'p[class]' }, html)).toBe(html);
  });
});

describe('validElements: the attribute list is the full list', () => {
  it('a[href] removes title and target, href is always kept', () => {
    const out = roundTrip(
      { validElements: 'p,a[href]' },
      '<p><a href="https://a.io" title="T" target="_blank">x</a></p>',
    );
    expect(out).toBe('<p><a href="https://a.io">x</a></p>');
  });

  it('an element without [...] keeps its built-in attributes', () => {
    const html = '<p><a href="https://a.io" title="T">x</a></p>';
    expect(roundTrip({ validElements: 'p,a' }, html)).toBe(html);
  });

  it('img[src|alt]: sizes are removed', () => {
    expect(
      roundTrip(
        { validElements: 'p,img[src|alt]' },
        '<p><img src="/a.png" alt="A" width="40"></p>',
      ),
    ).toBe('<p><img src="/a.png" alt="A"></p>');
  });

  it('extendedValidElements extends validElements', () => {
    expect(
      roundTrip(
        { validElements: 'p', extendedValidElements: 'h2[id]' },
        '<h2 id="x">T</h2><h3>U</h3>',
      ),
    ).toBe('<h2 id="x">T</h2><p>U</p>');
  });
});

describe('attribute values', () => {
  it(':v always, =v by default, <a?b only from the list', () => {
    const out = roundTrip(
      { extendedValidElements: 'a[href|target:_blank],ol[start|type<1?a],img[src|alt=]' },
      '<p><a href="https://a.io">x</a><img src="/a.png"></p><ol type="I"><li><p>y</p></li></ol>',
    );
    expect(out).toBe(
      '<p><a href="https://a.io" target="_blank" rel="noopener noreferrer">x</a>' +
        '<img src="/a.png" alt=""></p><ol><li><p>y</p></li></ol>',
    );
  });

  it("!name: without the required attribute the element isn't recognized, the text stays", () => {
    expect(
      roundTrip(
        { extendedValidElements: 'abbr[!title]' },
        '<p><abbr>A</abbr> <abbr title="B">B</abbr></p>',
      ),
    ).toBe('<p>A <abbr title="B">B</abbr></p>');
  });
});

describe('new elements', () => {
  it('a div with a class: both a text block and a container of blocks', () => {
    const html =
      '<div class="note">Short note</div>' +
      '<div class="callout"><p>Title</p><ul><li><p>a</p></li></ul></div>';
    expect(roundTrip({ extendedValidElements: 'div[class]' }, html)).toBe(html);
  });

  it('nested blocks and semantic elements', () => {
    const html =
      '<section id="s"><h2>T</h2><details><summary>More</summary><p>Hidden</p></details></section>' +
      '<p><abbr title="HyperText Markup Language">HTML</abbr> and <kbd>Ctrl</kbd>+<kbd>K</kbd></p>';
    expect(
      roundTrip({ extendedValidElements: 'section[id],details,summary,abbr[title],kbd' }, html),
    ).toBe(html);
  });

  it('icons: an empty <i class> is kept, a regular <i> is still italic', () => {
    const out = roundTrip(
      { extendedValidElements: 'i[class]' },
      '<p>Rate <i class="fa fa-star"></i> <i>now</i> <i class="hl">this</i></p>',
    );
    expect(out).toBe('<p>Rate <i class="fa fa-star"></i> <em>now</em> <i class="hl">this</i></p>');
  });

  it('a span with a data attribute is separate from color', () => {
    const out = roundTrip(
      { extendedValidElements: 'span[data-id]' },
      '<p><span data-id="7">a</span><span data-id="8" style="color: #ff0000;">b</span></p>',
    );
    expect(out).toContain('<span data-id="7">a</span>');
    expect(out).toContain('data-id="8"');
    expect(out).toContain('color: #ff0000;');
  });

  it('custom elements: block and inline (~)', () => {
    const html = '<my-widget data-id="42"></my-widget><p>Hi <my-chip user="ann">Ann</my-chip>!</p>';
    expect(roundTrip({ customElements: 'my-widget,~my-chip' }, html)).toBe(html);
  });

  it('you can type into a new text block, and Enter splits it', () => {
    const e = mount({ extendedValidElements: 'div[class]' }, '<div class="note">ab</div>');
    const { state } = e.view;
    e.view.dispatch(state.tr.setSelection(TextSelection.create(state.doc, 2)));
    e.view.dispatch(e.view.state.tr.insertText('X'));
    expect(e.getHTML()).toBe('<div class="note">aXb</div>');
  });

  it('Markdown: new elements give their text', () => {
    const e = mount(
      { extendedValidElements: 'div[class],abbr[title],i[class]' },
      '<div class="c"><p>One <abbr title="t">two</abbr><i class="fa"></i></p></div><div>Three</div>',
    );
    expect(toMarkdown(e)).toBe('One two\n\nThree');
  });
});

describe("style isn't doubled (found by a property-based test)", () => {
  it('a colored span with span[*] stays one span', () => {
    const out = roundTrip({ extendedValidElements: 'span[*]' }, '<p style="color: red">!</p>');
    expect(out).toBe('<p><span style="color: red;">!</span></p>');
  });

  it("a new element's style stays on it instead of becoming marks on the content", () => {
    const html =
      '<div style="color: red;">a</div><p><abbr title="t" style="color: blue;">b</abbr></p>';
    expect(roundTrip({ extendedValidElements: 'div[style],abbr[style|title]' }, html)).toBe(html);
  });
});

describe('several editors on a page', () => {
  // A regression: the mark rendering cache was shared by mark name, and the second editor got a link
  // rendered by the first one's rules.
  it("the same link is output by its own editor's rules", () => {
    const html = '<p><a href="https://a.io">x</a></p>';
    const plain = mount({}, html);
    expect(plain.getHTML()).toBe(html);
    const element = document.createElement('div');
    document.body.append(element);
    const forced = createEditor({
      element,
      content: html,
      extendedValidElements: 'a[href|target:_blank]',
    });
    expect(forced.getHTML()).toContain('target="_blank"');
    expect(plain.getHTML()).toBe(html);
    forced.destroy();
  });
});

describe("rules can't turn security off", () => {
  it("script, iframe and forms aren't allowed; a warning in the console", () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const out = roundTrip(
      { extendedValidElements: 'script[src],iframe[src],form[action],div[*]' },
      '<script src="https://evil.io/x.js"></script><form action="/x"><div>in</div></form>',
    );
    expect(out).toBe('<div>in</div>');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('<script>'));
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('media plugin'));
  });

  it("div[*]: handlers, srcdoc, contenteditable, dangerous addresses and CSS aren't kept", () => {
    const out = roundTrip(
      { extendedValidElements: 'div[*],a[*],abbr[*]' },
      '<div onclick="alert(1)" contenteditable="true" data-ok="1" style="background:url(javascript:x)">t</div>' +
        '<p><abbr cite="javascript:alert(1)" title="ok">a</abbr><a href="javascript:alert(1)">b</a></p>',
    );
    expect(out).toBe('<div data-ok="1">t</div><p><abbr title="ok">a</abbr>b</p>');
  });

  it("JSON past the parser: a foreign tag, handlers and garbage in attributes aren't output", () => {
    const e = mount({ extendedValidElements: 'div[data-*],abbr[title]' });
    e.setContent({
      type: 'doc',
      content: [
        {
          type: 'html_textblock',
          attrs: { tag: 'script', htmlAttrs: { onclick: 'x', 'data-a': 5, 'data-b': {}, bad: 1 } },
          content: [{ type: 'text', text: 'x' }],
        },
        { type: 'html_textblock', attrs: { tag: 7, htmlAttrs: 'junk' } },
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'y',
              marks: [{ type: 'html_inline', attrs: { tag: 'img', htmlAttrs: null } }],
            },
          ],
        },
      ],
    });
    expect(e.getHTML()).toBe('<div data-a="5">x</div><div></div><p><abbr>y</abbr></p>');
  });
});
