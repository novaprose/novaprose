// @vitest-environment node
/**
 * HTML on a server: createRenderer({ document }) reads HTML with the editor's parse rules through a
 * DOM you pass (jsdom here). This file runs in plain Node: no global document, no DOMParser, so
 * nothing may quietly fall back to a browser global.
 */
import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';
import { createRenderer } from '../src';

const dom = () => new JSDOM('').window.document;

describe('HTML on the server', () => {
  it('runs where there is no browser', () => {
    expect(typeof document).toBe('undefined');
    expect(typeof globalThis.DOMParser).toBe('undefined');
  });

  it('reads HTML into the document the editor would make, and writes it back', async () => {
    const renderer = createRenderer({ document: dom() });
    const json = await renderer.fromHTML(
      '<h2 style="text-align: center">Title</h2><p>Some <b>bold</b> and <a href="https://example.com" title="t">a link</a>.</p>' +
        '<ul><li>one</li><li>two</li></ul>',
    );
    expect((json.content as { type: string }[]).map((node) => node.type)).toEqual([
      'heading',
      'paragraph',
      'bullet_list',
    ]);
    expect(renderer.html(json)).toBe(
      '<h2 style="text-align: center;">Title</h2><p>Some <strong>bold</strong> and <a href="https://example.com" title="t">a link</a>.</p>' +
        '<ul><li><p>one</p></li><li><p>two</p></li></ul>',
    );
  });

  it('sanitize keeps the content and drops everything that could run or load', async () => {
    const renderer = createRenderer({ document: dom() });
    const out = await renderer.sanitize(
      '<p onclick="alert(1)">Hello <img src="x.png" onerror="alert(2)" alt="pic"> ' +
        '<a href="javascript:alert(3)">link</a> <a href="https://ok.example">ok</a></p>' +
        '<script>alert(4)</script><iframe src="https://evil.example"></iframe>' +
        '<p style="color: red; background-image: url(javascript:alert(5))"><span style="color: #c00">red</span></p>' +
        '<form action="https://evil.example"><input name="q"><button>go</button></form>' +
        '<svg><script>alert(6)</script></svg><math><mi xlink:href="javascript:alert(7)">x</mi></math>',
    );
    expect(out).not.toMatch(/alert|onerror|onclick|<script|<iframe|<form|<input|<svg|javascript:/i);
    expect(out).toContain('Hello <img src="x.png" alt="pic">');
    expect(out).toContain('<a href="https://ok.example">ok</a>');
    expect(out).toContain('<span style="color: #cc0000;">red</span>');
  });

  it('repairs broken tables as the editor does', async () => {
    const renderer = createRenderer({ document: dom() });
    expect(await renderer.sanitize('<p>a</p><table></table><p>b</p>')).toBe('<p>a</p><p>b</p>');
    expect(
      await renderer.sanitize('<table><tr><td>1</td><td>2</td></tr><tr><td>3</td></tr></table>'),
    ).toBe(
      '<table><tbody><tr><td><p>1</p></td><td><p>2</p></td></tr><tr><td><p>3</p></td><td><p></p></td></tr></tbody></table>',
    );
  });

  it('applies the content rules and plugins of its options', async () => {
    const strict = createRenderer({ document: dom(), invalidElements: 'strong,em' });
    expect(await strict.sanitize('<p><strong>bold</strong> and <em>italic</em></p>')).toBe(
      '<p>bold and italic</p>',
    );
    const withMentions = createRenderer({ document: dom(), plugins: ['mentions'] });
    const mention = await withMentions.sanitize(
      '<p>Hi <span data-mention="ann" onclick="alert(1)">@Ann</span></p>',
    );
    expect(mention).toMatch(/^<p>Hi <span data-mention="ann"[^>]*>@Ann<\/span><\/p>$/);
    expect(mention).not.toContain('alert');
  });

  it('reads a whole page with fullpagehtml, without its scripts', async () => {
    const renderer = createRenderer({ document: dom(), plugins: ['fullpagehtml'] });
    const out = await renderer.sanitize(
      '<!DOCTYPE html><html lang="en"><head><title>Report</title><script>alert(1)</script></head>' +
        '<body><p>Body text</p></body></html>',
    );
    expect(out).toContain('<title>Report</title>');
    expect(out).toContain('<p>Body text</p>');
    expect(out).not.toMatch(/alert|<script/);
    expect(await renderer.sanitize('<p>only</p>', { fullPage: false })).toBe('<p>only</p>');
  });

  it('says what it needs when there is no DOM', async () => {
    const renderer = createRenderer();
    expect(renderer.html({ type: 'doc', content: [{ type: 'paragraph' }] })).toBe('<p></p>');
    await expect(renderer.sanitize('<p>x</p>')).rejects.toThrow(/needs a DOM/);
  });

  it('takes any value without crashing', async () => {
    const renderer = createRenderer({ document: dom() });
    for (const value of [undefined, null, 42, {}, '', '<', '<p', '</p>', '<!-->', '\u0000']) {
      await expect(renderer.sanitize(value as unknown as string)).resolves.toBeTypeOf('string');
    }
  });
});
