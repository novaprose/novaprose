import fc from 'fast-check';
import { afterEach, describe, expect, it } from 'vitest';
import { createEditor, createRenderer, prettyHTML, type Editor } from '../src';
import { emailHTML } from '../src/email';
import { setSourceHTML, sourceHTML } from '../src/page';
import { setSuggesting } from '../src/plugins/suggestions';
import type { FullPageHtmlOptions } from '../src/plugins/fullpagehtml';

/** Whole HTML documents (fullpagehtml): the head, the doctype and the body's attributes are kept. */

const RUNS = Number(process.env.FC_RUNS) || 300;

const editors: Editor[] = [];
afterEach(() => {
  editors.splice(0).forEach((e) => e.destroy());
  document.body.innerHTML = '';
});

async function mount(content: string, fullpagehtml: FullPageHtmlOptions = {}, extra = {}) {
  const element = document.createElement('div');
  document.body.appendChild(element);
  const editor = createEditor({
    element,
    content,
    plugins: ['fullpagehtml'],
    pluginOptions: { fullpagehtml },
    ...extra,
  });
  editors.push(editor);
  await editor.ready;
  return editor;
}

const PAGE = [
  '<!DOCTYPE html>',
  '<html lang="en" dir="ltr">',
  '<head>',
  '<meta charset="utf-8">',
  '<title>Spring newsletter</title>',
  '<meta name="description" content="What is new this spring">',
  '<meta property="og:title" content="Spring">',
  '<link rel="stylesheet" href="https://example.com/site.css">',
  '<style>h1 { color: #333333; }</style>',
  '</head>',
  '<body style="background-color: #fafafa; color: #222222" class="letter">',
  '<h1>Hello</h1><p>Text</p>',
  '</body>',
  '</html>',
].join('\n');

describe('fullpagehtml: the whole page', () => {
  it('a whole page comes back as it was; the content alone with fullPage: false', async () => {
    const e = await mount(PAGE);
    expect(e.getHTML()).toBe(PAGE);
    expect(e.getHTML({ fullPage: false })).toBe('<h1>Hello</h1><p>Text</p>');
    // Read again, the same page: stable.
    e.setContent(e.getHTML());
    expect(e.getHTML()).toBe(PAGE);
  });

  it('content alone (or fullPage: false) keeps the page; JSON brings its page along', async () => {
    const e = await mount(PAGE);
    e.setContent('<p>New text</p>');
    expect(e.getHTML()).toBe(PAGE.replace('<h1>Hello</h1><p>Text</p>', '<p>New text</p>'));
    e.setContent('<html><head><title>Other</title></head><body><p>x</p></body></html>', {
      fullPage: false,
    });
    expect(e.getHTML()).toContain('<title>Spring newsletter</title>');
    expect(e.getHTML({ fullPage: false })).toBe('<p>x</p>');
    const json = e.getJSON();
    const other = await mount('<p>y</p>');
    other.setContent(json);
    expect(other.getHTML()).toBe(e.getHTML());
  });

  it('a page changed in its JSON is written as it is now (nothing stale is kept)', async () => {
    const e = await mount(PAGE);
    expect(e.getHTML()).toBe(PAGE);
    const json = e.getJSON() as { attrs: { page: { head: unknown[] } } };
    json.attrs.page.head.push({ tag: 'meta', attrs: { name: 'robots', content: 'noindex' } });
    e.setContent(json as unknown as Record<string, unknown>);
    expect(e.getHTML()).toContain('<meta name="robots" content="noindex">\n</head>');
  });

  it('undo brings the previous page back', async () => {
    const e = await mount(PAGE);
    e.setContent(
      '<!DOCTYPE html><html><head><title>Second</title></head><body><p>2</p></body></html>',
    );
    expect(e.getHTML()).toContain('<title>Second</title>');
    e.exec('undo');
    expect(e.getHTML()).toBe(PAGE);
  });

  it('older pages: an XHTML doctype, xmlns, and body colors from attributes become its style', async () => {
    const e = await mount(
      '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">' +
        '<html xmlns="http://www.w3.org/1999/xhtml"><head>' +
        '<meta http-equiv="Content-Type" content="text/html; charset=ISO-8859-1"></head>' +
        '<body bgcolor="#ffffff" text="#000000"><p>Old</p></body></html>',
    );
    expect(e.getHTML()).toBe(
      [
        '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">',
        '<html xmlns="http://www.w3.org/1999/xhtml">',
        '<head>',
        '<meta http-equiv="Content-Type" content="text/html; charset=ISO-8859-1">',
        '</head>',
        '<body style="background-color: #ffffff; color: #000000">',
        '<p>Old</p>',
        '</body>',
        '</html>',
      ].join('\n'),
    );
  });

  it('the settings fill in what a page doesn’t say', async () => {
    const e = await mount('<p>Body</p>', {
      title: 'Untitled',
      encoding: 'UTF-8',
      bodyStyle: 'font-family: Georgia, serif; color: #111111; position: fixed',
    });
    expect(e.getHTML()).toBe(
      [
        '<!DOCTYPE html>',
        '<html>',
        '<head>',
        '<meta charset="UTF-8">',
        '<title>Untitled</title>',
        '</head>',
        '<body style="font-family: Georgia, serif; color: #111111">',
        '<p>Body</p>',
        '</body>',
        '</html>',
      ].join('\n'),
    );
  });

  it('the source code view: the whole page, or only the content (hideInSourceView)', async () => {
    const e = await mount(PAGE);
    expect(sourceHTML(e)).toBe(PAGE);
    setSourceHTML(e, PAGE.replace('Spring newsletter', 'Summer'));
    expect(e.getHTML()).toContain('<title>Summer</title>');
    const hidden = await mount(PAGE, { hideInSourceView: true });
    expect(sourceHTML(hidden)).toBe('<h1>Hello</h1><p>Text</p>');
    setSourceHTML(hidden, '<p>Edited</p>');
    expect(hidden.getHTML()).toBe(PAGE.replace('<h1>Hello</h1><p>Text</p>', '<p>Edited</p>'));
  });

  it('laid out for reading (the code editor), a page reads back the same', async () => {
    const e = await mount(
      PAGE.replace(
        '<h1>Hello</h1><p>Text</p>',
        '<h1>Hello</h1><ul><li><p>a</p><ul><li><p>b</p></li></ul></li></ul><p>Text</p>',
      ),
    );
    const before = e.getHTML();
    const laidOut = prettyHTML(before);
    expect(laidOut).toContain('<title>Spring newsletter</title>\n');
    e.setContent(laidOut);
    expect(e.getHTML()).toBe(before);
  });

  it('the server renders the same page from JSON; markup rules keep it', async () => {
    const e = await mount(PAGE);
    const renderer = createRenderer({ plugins: ['fullpagehtml'] });
    expect(renderer.html(e.getJSON())).toBe(PAGE);
    expect(renderer.html(e.getJSON(), { fullPage: false })).toBe('<h1>Hello</h1><p>Text</p>');
    const ruled = await mount(PAGE, {}, { validElements: 'p,h1' });
    expect(ruled.getHTML()).toBe(PAGE);
    expect(
      createRenderer({ plugins: ['fullpagehtml'], validElements: 'p,h1' }).html(e.getJSON()),
    ).toBe(PAGE);
  });

  it('an email is built from the content, not around the page', async () => {
    const e = await mount(PAGE);
    const content = await emailHTML(e);
    expect(content).toContain('Hello');
    expect(content).not.toMatch(/<!DOCTYPE|<title>|<html/);
    const whole = await emailHTML(e, { document: true });
    expect(whole.match(/<html/g)).toHaveLength(1);
  });
});

describe('fullpagehtml: nothing dangerous is kept', () => {
  it('scripts, <base>, a refresh, handlers and unsafe addresses are dropped', async () => {
    const e = await mount(
      // (The title comes first: <img> in <noscript> ends the head when the parser reads it.)
      '<!DOCTYPE html><html onload="alert(1)" lang="en"><head><title>Safe</title>' +
        '<script>alert(1)</script><base href="https://evil.example/">' +
        '<meta http-equiv="refresh" content="0;url=javascript:alert(1)">' +
        '<meta http-equiv="set-cookie" content="a=b">' +
        '<link rel="stylesheet" href="javascript:alert(1)">' +
        '<link rel="import" href="https://evil.example/x.html">' +
        '<link rel="stylesheet" href="  java\tscript:alert(1)">' +
        '<noscript><img src=x onerror=alert(1)></noscript>' +
        '</head>' +
        '<body onload="alert(1)" style="background: url(javascript:alert(1)); color: red; behavior: url(x.htc)">' +
        '<p>Text</p><script>alert(2)</script></body></html>',
    );
    const html = e.getHTML();
    expect(html).not.toMatch(/script|alert|evil|onload|refresh|cookie|import|base|noscript/i);
    expect(html).toContain('<html lang="en">');
    expect(html).toContain('<title>Safe</title>');
    expect(html).toContain('<body style="color: red">');
  });

  it('a style sheet or title can’t close its element; JSON can’t bring anything else in', async () => {
    const e = await mount('<p></p>');
    e.setContent({
      type: 'doc',
      attrs: {
        page: {
          doctype: '<!DOCTYPE html><script>alert(1)</script>',
          html: { lang: 'en" onload="alert(1)', dir: 'rtl' },
          head: [
            { tag: 'title', text: '</title><script>alert(1)</script>' },
            { tag: 'style', attrs: {}, text: 'p{}</style><script>alert(1)</script>' },
            { tag: 'script', attrs: {}, text: 'alert(1)' },
            { tag: 'meta', attrs: { name: 'x" onload="y', content: 'z' } },
            { tag: 'meta', attrs: { name: 'author', content: '"><script>alert(1)</script>' } },
            { tag: 'link', attrs: { rel: 'stylesheet', href: 'data:text/css,p{}' } },
            null,
            42,
            'text',
          ],
          body: { style: 42, onclick: 'alert(1)', class: 'a b' },
        },
      },
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'x' }] }],
    });
    const html = e.getHTML();
    expect(html.startsWith('<!DOCTYPE html>\n<html dir="rtl">\n<head>\n')).toBe(true);
    expect(html).toContain('<title>&lt;/title&gt;&lt;script&gt;alert(1)&lt;/script&gt;</title>');
    expect(html).toContain('<style>p{}<\\/style><script>alert(1)</script></style>');
    expect(html).toContain(
      '<meta name="author" content="&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;">',
    );
    expect(html).not.toContain('onload');
    expect(html).not.toContain('onclick');
    expect(html).not.toContain('data:text');
    expect(html).toContain('<body class="a b">');
    // The only <script> text is inside the style sheet and the escaped title and meta.
    const parsed = new DOMParser().parseFromString(html, 'text/html');
    expect(parsed.querySelectorAll('script')).toHaveLength(0);
    expect(parsed.querySelectorAll('[onload], [onclick]')).toHaveLength(0);
    expect(parsed.title).toBe('</title><script>alert(1)</script>');
  });

  it('any page from JSON: no script or handler gets out, the server agrees, it reads back the same (property)', async () => {
    const e = await mount('<p></p>');
    const renderer = createRenderer({ plugins: ['fullpagehtml'] });
    const hostile = fc.constantFrom(
      '<script>alert(1)</script>',
      '"><img src=x onerror=alert(1)>',
      'javascript:alert(1)',
      ' java\tscript:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      '</style><script>alert(1)</script>',
      '</title><script>alert(1)</script>',
      'color: red; background: url(javascript:alert(1))',
      'expression(alert(1))',
      'refresh',
      'stylesheet',
      'https://example.com/a.css',
      'en',
      'rtl',
      'utf-8',
      'description',
      'a\r\nb',
      '<!DOCTYPE html>',
      '<!DOCTYPE html PUBLIC "-//W3C//DTD HTML 4.01//EN">',
    );
    const value = fc.oneof(hostile, fc.string({ maxLength: 20 }), fc.integer(), fc.constant(null));
    const names = fc.constantFrom(
      ...['name', 'content', 'charset', 'http-equiv', 'property', 'rel', 'href', 'type'],
      ...['media', 'sizes', 'hreflang', 'title', 'style', 'class', 'dir', 'lang', 'onload'],
      ...['xmlns', 'xml:lang', 'src', 'bgcolor'],
    );
    const attrs = fc.dictionary(names, value, { maxKeys: 5 });
    const element = fc.record(
      {
        tag: fc.oneof(fc.constantFrom('title', 'meta', 'link', 'style', 'script', 'base'), value),
        attrs: fc.oneof(attrs, value),
        text: value,
      },
      { requiredKeys: [] },
    );
    const page = fc.oneof(
      value,
      fc.record(
        {
          doctype: value,
          html: fc.oneof(attrs, value),
          head: fc.oneof(fc.array(element, { maxLength: 6 }), value),
          body: fc.oneof(attrs, value),
        },
        { requiredKeys: [] },
      ),
    );
    fc.assert(
      fc.property(page, (p) => {
        const json = { type: 'doc', attrs: { page: p }, content: [{ type: 'paragraph' }] };
        e.setContent(json);
        const html = e.getHTML();
        expect(renderer.html(json)).toBe(html);
        const dom = new DOMParser().parseFromString(html, 'text/html');
        expect(dom.querySelectorAll('script, base, iframe, object, embed, img')).toHaveLength(0);
        for (const el of dom.querySelectorAll('*')) {
          for (const attr of el.attributes) {
            expect(attr.name.startsWith('on'), attr.name).toBe(false);
            if (attr.name === 'href') expect(attr.value).toMatch(/^(https?:|[^:]*$)/i);
          }
        }
        e.setContent(html);
        expect(e.getHTML()).toBe(html);
      }),
      { numRuns: RUNS },
    );
  });

  it('a page attribute of any shape never breaks the editor or the renderer', async () => {
    const e = await mount('<p></p>');
    const renderer = createRenderer({ plugins: ['fullpagehtml'] });
    for (const page of [
      null,
      42,
      'x',
      [],
      { head: 'x' },
      { head: [{}] },
      { html: [] },
      { doctype: 7 },
    ]) {
      const json = { type: 'doc', attrs: { page }, content: [{ type: 'paragraph' }] };
      e.setContent(json);
      expect(e.getHTML()).toBe(
        '<!DOCTYPE html>\n<html>\n<head>\n</head>\n<body>\n<p></p>\n</body>\n</html>',
      );
      expect(renderer.html(json)).toBe(e.getHTML());
    }
  });
});

describe('fullpagehtml: Document properties', () => {
  it('the dialog edits the title, description, keywords, author, language, search engines', async () => {
    const e = await mount(PAGE);
    const button = e.ui.registry.get('fullpagehtml');
    if (button?.type !== 'button') throw new Error('no button');
    button.onAction(e);
    const dialog = await new Promise<HTMLFormElement>((resolve) => {
      const find = () => {
        const found = e.root.querySelector<HTMLFormElement>('.nova-dialog');
        if (found) resolve(found);
        else setTimeout(find, 5);
      };
      find();
    });
    const field = (name: string) =>
      dialog.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
        `[name="${name}"]`,
      )!;
    expect(field('title').value).toBe('Spring newsletter');
    expect(field('description').value).toBe('What is new this spring');
    expect(field('lang').value).toBe('en');
    expect(field('robots').value).toBe('all');
    expect(field('encoding').value).toBe('utf-8');
    field('title').value = 'Summer newsletter';
    field('keywords').value = 'summer, news';
    field('author').value = 'Ann Lee';
    field('description').value = '';
    field('lang').value = 'de-CH';
    field('robots').value = 'noindex';
    dialog.requestSubmit();
    await new Promise((r) => setTimeout(r, 20));
    const html = e.getHTML();
    expect(html).toContain('<html lang="de-CH" dir="ltr">');
    expect(html).toContain('<title>Summer newsletter</title>');
    expect(html).not.toContain('name="description"');
    expect(html).toContain('<meta name="keywords" content="summer, news">');
    expect(html).toContain('<meta name="author" content="Ann Lee">');
    expect(html).toContain('<meta name="robots" content="noindex">');
    // The rest of the head stays where it was.
    expect(html).toContain('<meta charset="utf-8">\n<title>Summer newsletter</title>');
    expect(html).toContain('<style>h1 { color: #333333; }</style>');
    // One undo step.
    e.exec('undo');
    expect(e.getHTML()).toBe(PAGE);
  });

  it('in suggesting mode the page can’t change (it can’t be a suggestion); nothing breaks', async () => {
    const element = document.createElement('div');
    document.body.appendChild(element);
    const e = createEditor({ element, content: PAGE, plugins: ['fullpagehtml', 'suggestions'] });
    editors.push(e);
    await e.ready;
    setSuggesting(e, true);
    const next = { head: [{ tag: 'title', text: 'Changed' }] };
    expect(() => e.view.dispatch(e.view.state.tr.setDocAttribute('page', next))).not.toThrow();
    expect(e.getHTML()).toBe(PAGE);
    setSuggesting(e, false);
    e.view.dispatch(e.view.state.tr.setDocAttribute('page', next));
    expect(e.getHTML()).toContain('<title>Changed</title>');
    // Loading a whole page is not an edit to suggest.
    setSuggesting(e, true);
    e.setContent(PAGE);
    expect(e.getHTML()).toBe(PAGE);
  });

  it('a wrong language code is refused', async () => {
    const e = await mount('<p></p>');
    const button = e.ui.registry.get('fullpagehtml');
    if (button?.type !== 'button') throw new Error('no button');
    button.onAction(e);
    await new Promise((r) => setTimeout(r, 10));
    const dialog = e.root.querySelector<HTMLFormElement>('.nova-dialog')!;
    dialog.querySelector<HTMLInputElement>('[name="lang"]')!.value = 'not a code';
    dialog.requestSubmit();
    await new Promise((r) => setTimeout(r, 10));
    expect(dialog.textContent).toContain('Enter a language code');
    expect(e.getHTML()).not.toContain('lang=');
  });
});
