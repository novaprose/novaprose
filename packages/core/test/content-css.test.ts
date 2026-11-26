import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEditor, type Editor } from '../src';
import { absolutizeUrls, scopeCss } from '../src/content-css';

/** contentStyle / contentCss: the customer's CSS affects only the text of its own editor. */

const S = '.scope';
const norm = (css: string) => css.replace(/\s+/g, ' ').trim();

describe('scopeCss', () => {
  it('body/html/:root are the text area itself; the rest goes inside it', () => {
    expect(norm(scopeCss('body { color: red } p, h1 > a { margin: 0 }', S))).toBe(
      '.scope{ color: red } .scope p, .scope h1 > a{ margin: 0 }',
    );
    expect(norm(scopeCss('html body p {} :root { --x: 1 }', S))).toBe(
      '.scope p{} .scope{ --x: 1 }',
    );
    expect(norm(scopeCss('body.dark p { color: #fff }', S))).toBe('.scope.dark p{ color: #fff }');
  });

  it("doesn't confuse similar names and doesn't cut commas inside :is() and attributes", () => {
    expect(norm(scopeCss('.body-text, bodyx {} :is(p, li) {} a[title="a,b"] {}', S))).toBe(
      '.scope .body-text, .scope bodyx{} .scope :is(p, li){} .scope a[title="a,b"]{}',
    );
  });

  it('@media/@supports: the rules inside are scoped too; @font-face/@keyframes as they are', () => {
    const out = norm(
      scopeCss(
        '@media print { p { color: black } } @font-face { font-family: X; src: url(x.woff) } @keyframes fade { from { opacity: 0 } }',
        S,
      ),
    );
    expect(out).toBe(
      '@media print{.scope p{ color: black }} @font-face{ font-family: X; src: url(x.woff) } @keyframes fade{ from { opacity: 0 } }',
    );
  });

  it("comments and @charset/@import are dropped, strings with brackets don't break parsing", () => {
    expect(norm(scopeCss('@charset "utf-8"; /* body { } */ p::before { content: "}{;" }', S))).toBe(
      '.scope p::before{ content: "}{;" }',
    );
  });

  it("relative url() resolve against the style file's address", () => {
    expect(
      absolutizeUrls(
        'a { background: url(img/x.png) } b { background: url("data:image/png;base64,AA") }',
        'https://cdn.example.com/css/content.css',
      ),
    ).toBe(
      'a { background: url(https://cdn.example.com/css/img/x.png) } b { background: url("data:image/png;base64,AA") }',
    );
  });
});

describe('editor options', () => {
  let editors: Editor[] = [];
  afterEach(() => {
    editors.forEach((e) => e.destroy());
    editors = [];
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });
  const mount = (options: object) => {
    const element = document.createElement('div');
    document.body.appendChild(element);
    const e = createEditor({ element, content: '<p>x</p>', ...options });
    editors.push(e);
    return e;
  };
  /** All CSS attached to the document: <style> and constructable sheets. */
  const allCss = () =>
    [
      ...[...document.querySelectorAll('style')].map((s) => s.textContent ?? ''),
      ...(document.adoptedStyleSheets ?? []).flatMap((sheet) =>
        [...sheet.cssRules].map((r) => r.cssText),
      ),
    ].join('\n');

  it('contentStyle: each editor has its own scope, destroy removes the styles', () => {
    const a = mount({ contentStyle: 'body { font-family: Georgia }' });
    const b = mount({ contentStyle: 'p { color: red }' });
    const scopeA = [...a.root.classList].find((c) => c.startsWith('nova-cs-'))!;
    const scopeB = [...b.root.classList].find((c) => c.startsWith('nova-cs-'))!;
    expect(scopeA).not.toBe(scopeB);
    expect(allCss()).toContain(`.nova-editor.${scopeA} .nova-prosemirror`);
    expect(allCss()).toContain(`.nova-editor.${scopeB} .nova-prosemirror p`);
    a.destroy();
    expect(allCss()).not.toContain(scopeA);
  });

  it('contentCss loads files, inlines @import, ready waits for loading; contentStyle comes last', async () => {
    const files: Record<string, string> = {
      'https://cdn.example.com/css/content.css': '@import "base.css"; h1 { color: navy }',
      'https://cdn.example.com/css/base.css': 'p { margin: 0 }',
    };
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => ({
        ok: url in files,
        status: url in files ? 200 : 404,
        text: async () => files[url] ?? '',
      })),
    );
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const e = mount({
      contentCss: [
        'https://cdn.example.com/css/content.css',
        'https://cdn.example.com/missing.css',
      ],
      contentStyle: 'h1 { color: red }',
    });
    await e.ready;
    const css = allCss();
    expect(css).toContain('.nova-prosemirror p');
    expect(css.indexOf('color: navy')).toBeLessThan(css.indexOf('color: red'));
    expect(warn.mock.calls.join('\n')).toMatch(/missing\.css/);
    vi.unstubAllGlobals();
  });
});
