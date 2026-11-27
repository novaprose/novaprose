import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEditor, type Editor } from '../src';
import { emailHTML, parseDeclarations, specificity, toEmailHTML } from '../src/email';

/**
 * Email HTML: content styles go inline with the browser's cascade (specificity, order, !important,
 * inline styles), document-wide rules style a wrapper, @media stays in the head of a whole email,
 * and what email clients can't show becomes something they can.
 */

let editor: Editor | null = null;
afterEach(() => {
  editor?.destroy();
  editor = null;
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

/** Without the built-in styles, to see exactly what a test's CSS does. */
const inline = (html: string, css: string, options = {}) =>
  toEmailHTML(html, { baseStyles: false, css, ...options });

describe('styles inline', () => {
  it('rules go into style attributes; the cascade decides which wins', () => {
    const css = `
      p { color: red; margin: 0 }
      .lead { color: green }
      p.lead { font-weight: bold }
      #intro { color: blue }
      p { color: gray }
    `;
    expect(inline('<p>a</p><p class="lead">b</p><p class="lead" id="intro">c</p>', css)).toBe(
      '<p style="margin: 0; color: gray">a</p>' +
        '<p class="lead" style="margin: 0; color: green; font-weight: bold">b</p>' +
        '<p class="lead" id="intro" style="margin: 0; font-weight: bold; color: blue">c</p>',
    );
  });

  it('an inline style beats the style sheet, !important beats an inline style', () => {
    const css = 'p { color: red; font-size: 20px !important } span { color: green }';
    expect(inline('<p style="color: black; font-size: 12px">a <span>b</span></p>', css)).toBe(
      '<p style="color: black; font-size: 20px">a <span style="color: green">b</span></p>',
    );
  });

  it('a later shorthand still overrides a longhand: the order of the winning declarations is kept', () => {
    const css = '.box { border-color: red } div.box { border: 1px solid #ccc }';
    expect(inline('<div class="box">a</div>', css)).toBe(
      '<div class="box" style="border-color: red; border: 1px solid #ccc">a</div>',
    );
  });

  it('structural pseudo-classes apply; states and pseudo-elements are skipped', () => {
    const css =
      'li:first-child { color: red } a:hover { color: blue } p::first-line { color: green } p:focus { color: pink }';
    expect(inline('<ul><li>a</li><li>b</li></ul><p><a href="https://x.test/">l</a></p>', css)).toBe(
      '<ul><li style="color: red">a</li><li>b</li></ul><p><a href="https://x.test/">l</a></p>',
    );
  });

  it('body and :root style the wrapper; a rule for div does not match through it', () => {
    const css = 'body { font-family: Georgia; color: #333 } div p { color: red } :root { --x: 1 }';
    expect(inline('<p>a</p>', css)).toBe(
      '<div style="font-family: Georgia; color: #333"><p>a</p></div>',
    );
  });

  it('custom properties are resolved; one without a value or fallback is dropped', () => {
    const css =
      ':root { --brand: #7c3aed; --pad: 8px } p { color: var(--brand); padding: var(--pad) var(--none, 4px); margin: var(--missing) }';
    expect(inline('<p>a</p>', css)).toBe('<p style="color: #7c3aed; padding: 8px 4px">a</p>');
  });

  it('selectorFilter limits the rules; invalid selectors are skipped', () => {
    const css = '.keep { color: red } .skip { color: blue } p:unknown-thing { color: green }';
    expect(
      inline('<p class="keep skip">a</p>', css, { selectorFilter: (s: string) => s !== '.skip' }),
    ).toBe('<p class="keep skip" style="color: red">a</p>');
    expect(inline('<p class="keep skip">a</p>', css, { selectorFilter: /keep/ })).toBe(
      '<p class="keep skip" style="color: red">a</p>',
    );
  });

  it('specificity: ids, then classes, then types; :where counts nothing, :is its argument', () => {
    expect(specificity('p')).toBe(1);
    expect(specificity('ul li.a')).toBe(1002);
    expect(specificity('#x .a p')).toBe(1_001_001);
    expect(specificity('a[href]:first-child')).toBe(2001);
    expect(specificity(':where(#x) p')).toBe(1);
    expect(specificity(':is(#x, .a) p')).toBe(1_000_001);
    expect(specificity('p:not(.a)')).toBe(1001);
  });

  it('declarations are read as written, url() with semicolons included', () => {
    expect(
      parseDeclarations(
        "background: url('data:image/png;base64,AA') no-repeat; MARGIN: 0 !important; --Brand: Red; bad",
      ),
    ).toEqual([
      { name: 'background', value: "url('data:image/png;base64,AA') no-repeat", important: false },
      { name: 'margin', value: '0', important: true },
      { name: '--Brand', value: 'Red', important: false },
    ]);
  });
});

describe('markup email clients understand', () => {
  it('collapsible blocks open, checklists with boxes, formulas as TeX, a page break goes', () => {
    const html =
      '<details><summary>More</summary><p>Inside</p></details>' +
      '<ul data-type="taskList"><li data-type="taskItem" data-checked="true"><p>done</p></li><li data-type="taskItem" data-checked="false"><p>todo</p></li></ul>' +
      '<p>See <span data-type="math-inline" data-latex="x^2">\\(x^2\\)</span></p>' +
      '<div class="nova-pagebreak" style="break-after: page;"></div><p>End</p>';
    expect(inline(html, '')).toBe(
      '<div><p><strong>More</strong></p><p>Inside</p></div>' +
        '<ul data-type="taskList"><li data-type="taskItem" data-checked="true"><p>☑ done</p></li><li data-type="taskItem" data-checked="false"><p>☐ todo</p></li></ul>' +
        '<p>See <span data-type="math-inline" data-latex="x^2">x^2</span></p><p>End</p>',
    );
  });

  it('a player becomes a link to its page; addresses become absolute; template tags stay', () => {
    const html =
      '<iframe src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ" title="Our video"></iframe>' +
      '<p><a href="/pricing">Prices</a> <a href="{{unsubscribe_url}}">Unsubscribe</a> <a href="#top">Top</a></p>' +
      '<p><img src="/img/a.png" alt="A" style="width: 240px"></p>';
    expect(inline(html, '', { baseUrl: 'https://example.com/blog/' })).toBe(
      '<p><a href="https://www.youtube.com/watch?v=dQw4w9WgXcQ">Our video</a></p>' +
        '<p><a href="https://example.com/pricing">Prices</a> <a href="{{unsubscribe_url}}">Unsubscribe</a> <a href="#top">Top</a></p>' +
        '<p><img src="https://example.com/img/a.png" alt="A" style="width: 240px" width="240"></p>',
    );
  });

  it('the built-in styles give the email the editor look', () => {
    const out = toEmailHTML(
      '<table><tbody><tr><th><p>H</p></th><td><p>D</p></td></tr></tbody></table>',
    );
    expect(out).toMatch(
      /^<div style="font-family: [^"]+; font-size: 16px; line-height: 1\.6; color: #1f2328">/,
    );
    expect(out).toContain(
      '<td style="padding: 6px 8px; border: 1px solid #afb8c1; vertical-align: top">',
    );
    expect(out).toContain('<p style="margin: 0 0 12px; margin-bottom: 0">D</p>');
  });
});

// toEmailHTML may get HTML that didn't come from the editor (old content, a database): nothing that
// runs code, submits a form or opens a dangerous address may come out.
describe('unsafe HTML in', () => {
  it('scripts, handlers, forms, SVG, javascript: and unsafe images go', () => {
    const out = toEmailHTML(
      '<p onclick="alert(1)">Hi <script>alert(2)</script><img src="x.png" onerror="alert(3)"></p>' +
        '<p><a href="javascript:alert(4)">bad</a> <a href=" jav&#x09;ascript:alert(5)">bad too</a></p>' +
        '<object data="javascript:alert(6)"></object><embed src="javascript:alert(7)">' +
        '<iframe src="javascript:alert(8)"></iframe><svg onload="alert(9)"><a href="javascript:alert(10)">x</a></svg>' +
        '<form action="https://evil.test/"><input name="card"><button>Pay</button></form>' +
        '<p><img src="data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=" alt="svg"> <img src="data:image/png;base64,AAAA" alt="png"></p>' +
        '<table background="javascript:alert(11)"><tbody><tr><td srcdoc="x" formaction="y">c</td></tr></tbody></table>' +
        '<style>p { color: red }</style>',
      { baseStyles: false, baseUrl: 'https://example.com/' },
    );
    for (const bad of [
      '<script',
      'alert(',
      'onclick',
      'onerror',
      'onload',
      'javascript',
      '<svg',
      '<form',
      '<input',
      '<button',
      '<object',
      '<embed',
      '<style',
      'image/svg',
      'srcdoc',
      'formaction',
      'background=',
    ]) {
      expect(out, bad).not.toContain(bad);
    }
    // What is safe stays: the text, the raster image, the table.
    expect(out).toContain('Hi <img src="https://example.com/x.png">');
    expect(toEmailHTML('<p><img src="cid:logo@acme" alt="Acme"></p>', { baseStyles: false })).toBe(
      '<p><img src="cid:logo@acme" alt="Acme"></p>',
    );
    expect(out).toContain('<img src="data:image/png;base64,AAAA" alt="png">');
    expect(out).toContain('<td>c</td>');
  });

  it('dangerous CSS in a style attribute is dropped, the rest is kept', () => {
    const out = toEmailHTML(
      '<p style="color: red; width: expression(alert(1)); background: url(javascript:alert(2)); behavior: url(x.htc); -moz-binding: url(x.xml#y)">a</p>' +
        '<p style="background-image: url(https://cdn.test/bg.png)">b</p>',
      { baseStyles: false },
    );
    expect(out).toBe(
      '<p style="color: red">a</p><p style="background-image: url(https://cdn.test/bg.png)">b</p>',
    );
  });
});

describe('a whole email', () => {
  it('doctype, title, hidden preview text, a centered column, @media kept in the head', () => {
    const out = toEmailHTML('<p>Hello</p>', {
      css: 'p { color: #222 } @media (max-width: 600px) { p { font-size: 18px } }',
      document: {
        title: 'News & <more>',
        preheader: 'This week',
        width: 640,
        lang: 'de',
        dir: 'ltr',
      },
    });
    expect(out.startsWith('<!DOCTYPE html>\n<html lang="de" dir="ltr">')).toBe(true);
    expect(out).toContain('<title>News &amp; &lt;more&gt;</title>');
    expect(out).toContain('@media (max-width: 600px) { p { font-size: 18px } }');
    expect(out).toContain('mso-hide: all;">This week</div>');
    expect(out).toContain('<table role="presentation" width="640"');
    expect(out).toContain('max-width: 640px');
    expect(out).toMatch(
      /<td dir="ltr" style="padding: 24px; font-family: [^"]+">\n<p style="margin: 0 0 12px; color: #222">Hello<\/p>/,
    );
  });
});

describe('the Email preview window', () => {
  it('the whole email in a sandboxed frame, its size, a phone view; copying both ways', async () => {
    const write = vi.fn(async (_items: unknown[]) => {});
    const writeText = vi.fn(async (_text: string) => {});
    Object.defineProperty(navigator, 'clipboard', {
      value: { write, writeText },
      configurable: true,
    });
    vi.stubGlobal(
      'ClipboardItem',
      class {
        constructor(public items: Record<string, Blob>) {}
      },
    );
    const element = document.createElement('div');
    document.body.append(element);
    editor = createEditor({
      element,
      content: '<p>Hello <strong>you</strong></p>',
      plugins: ['email'],
    });
    await editor.ready;
    const button = editor.ui.registry.get('emailpreview');
    if (button?.type !== 'button') throw new Error('no emailpreview button');
    button.onAction(editor);
    const dialog = editor.root.querySelector<HTMLElement>('.nova-dialog')!;
    const frame = dialog.querySelector<HTMLIFrameElement>('iframe.nova-email-frame')!;
    await vi.waitFor(() => expect(frame.srcdoc).toContain('<!DOCTYPE html>'));
    // No scripts, no forms, no access to the page.
    expect(frame.getAttribute('sandbox')).toBe('');
    expect(frame.srcdoc).toContain('Hello <strong>you</strong>');
    expect(dialog.querySelector('.nova-email-status')!.textContent).toMatch(/^Size: \d+\.\d KB$/);

    const phone = dialog.querySelector<HTMLInputElement>('input[value="phone"]')!;
    phone.checked = true;
    phone.dispatchEvent(new Event('change'));
    expect(dialog.querySelector('.nova-email-stage')!.classList.contains('is-phone')).toBe(true);

    const byText = (text: string) =>
      [...dialog.querySelectorAll<HTMLButtonElement>('button')].find(
        (b) => b.textContent === text,
      )!;
    byText('Copy the email').click();
    await vi.waitFor(() => expect(write).toHaveBeenCalledOnce());
    const item = write.mock.calls[0]![0][0] as { items: Record<string, Blob> };
    expect(await item.items['text/html']!.text()).toMatch(/^<div style="font-family: .*Hello/);
    expect(await item.items['text/plain']!.text()).toBe('Hello you');
    byText('Copy the HTML code').click();
    await vi.waitFor(() => expect(writeText).toHaveBeenCalledOnce());
    expect(writeText.mock.calls[0]![0]).toBe(frame.srcdoc);
    vi.unstubAllGlobals();
  });
});

describe("the editor's content", () => {
  it('emailHTML: content styles of the editor, pluginOptions.email, the direction', async () => {
    const element = document.createElement('div');
    document.body.append(element);
    editor = createEditor({
      element,
      content: '<p class="note">Hi</p>',
      // Classes in the content are kept only when allowed.
      validClasses: true,
      contentStyle: '.note { color: purple }',
      direction: 'rtl',
      pluginOptions: { email: { baseStyles: false, css: 'p { margin: 0 }' } },
    });
    await editor.ready;
    expect(await emailHTML(editor)).toBe(
      '<div dir="rtl"><p class="note" style="margin: 0; color: purple">Hi</p></div>',
    );
    const whole = await emailHTML(editor, { document: { title: 'T' } });
    expect(whole).toContain('<html lang="en" dir="rtl">');
  });

  it('content style files are fetched; fileFilter picks which', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      const css = String(url).includes('brand') ? 'p { color: teal }' : 'p { color: red }';
      return new Response(css, { status: 200 });
    });
    const element = document.createElement('div');
    document.body.append(element);
    editor = createEditor({
      element,
      content: '<p>Hi</p>',
      contentCss: ['https://cdn.test/brand.css', 'https://cdn.test/other.css'],
    });
    await editor.ready;
    expect(await emailHTML(editor, { baseStyles: false, fileFilter: 'brand' })).toBe(
      '<p style="color: teal">Hi</p>',
    );
    expect(fetch.mock.calls.map(([url]) => String(url))).toContain('https://cdn.test/brand.css');
  });
});
