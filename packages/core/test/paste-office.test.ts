import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createEditor, type Editor } from '../src';
import { loadPasteCleaner } from '../src/paste';
import { cleanPastedHTML, detectPasteSource } from '../src/paste-office';

// Office cleanup is a lazy chunk; its logic is checked here, not the moment it loads
// (pasting before it loads is in paste-lazy.test.ts).
beforeAll(() => loadPasteCleaner());

/**
 * Paste from office applications. The fixtures are test/fixtures/paste/*.html (the application's clipboard) and
 * *.expected.html (what getHTML must give). A new real-life example: add the .html, run
 * the test, check the output by eye and save it as .expected.html.
 */

const FIXTURES = join(__dirname, 'fixtures', 'paste');
const editors: Editor[] = [];

function paste(html: string, options: Partial<Parameters<typeof createEditor>[0]> = {}): Editor {
  const element = document.createElement('div');
  document.body.appendChild(element);
  const editor = createEditor({ element, content: '', ...options });
  editors.push(editor);
  editor.view.pasteHTML(html);
  return editor;
}

afterEach(() => {
  editors.splice(0).forEach((e) => e.destroy());
  document.body.innerHTML = '';
});

describe('Paste fixtures', () => {
  const fixtures = readdirSync(FIXTURES).filter(
    (f) => f.endsWith('.html') && !f.endsWith('.expected.html'),
  );

  it('the set of fixtures is not empty and each has an expected result', () => {
    expect(fixtures.length).toBeGreaterThanOrEqual(7);
    for (const file of fixtures) {
      expect(readdirSync(FIXTURES)).toContain(file.replace('.html', '.expected.html'));
    }
  });

  it.each(fixtures)('%s', (file) => {
    const input = readFileSync(join(FIXTURES, file), 'utf8');
    const expected = readFileSync(join(FIXTURES, file.replace('.html', '.expected.html')), 'utf8');
    expect(paste(input).getHTML()).toBe(expected.trim());
  });
});

describe('Detecting the source', () => {
  it.each([
    ['word-desktop-text.html', 'word'],
    ['word-desktop-lists.html', 'word'],
    ['word-online.html', 'word-online'],
    ['google-docs.html', 'google-docs'],
    ['excel.html', 'excel'],
    ['google-sheets.html', 'google-sheets'],
  ])('%s → %s', (file, source) => {
    expect(detectPasteSource(readFileSync(join(FIXTURES, file), 'utf8'))).toBe(source);
  });

  it('LibreOffice, a web page and copying inside the editor', () => {
    expect(detectPasteSource('<meta name="generator" content="LibreOffice 7.6"><p>a</p>')).toBe(
      'libreoffice',
    );
    expect(detectPasteSource('<p>plain</p>')).toBe('web');
    expect(detectPasteSource('<p data-pm-slice="1 1 []">a</p>')).toBe('nova');
  });
});

describe('Modes and behavior', () => {
  it("copying inside the editor isn't cleaned: fonts and sizes are kept", () => {
    const html =
      '<p data-pm-slice="1 1 []"><span style="font-family: Georgia;">serif</span> <span style="font-size: 20px;">big</span></p>';
    expect(cleanPastedHTML(html)).toBe(html);
  });

  it("pasteStyles: 'clean' (the default) removes a web page's font and size, but not the meaning", () => {
    const editor = paste(
      '<p style="font-family: Georgia; line-height: 2"><span style="font-size: 20px; color: #ff0000;">red</span> <b>bold</b></p>',
    );
    expect(editor.getHTML()).toBe(
      '<p><span style="color: #ff0000;">red</span> <strong>bold</strong></p>',
    );
  });

  it("pasteStyles: 'keep' carries over the font, size and spacing", () => {
    const editor = paste(
      '<p style="line-height: 2"><span style="font-family: Georgia; font-size: 20px;">serif</span></p>',
      { pasteStyles: 'keep' },
    );
    expect(editor.getHTML()).toBe(
      '<p style="line-height: 2;"><span style="font-family: Georgia;"><span style="font-size: 20px;">serif</span></span></p>',
    );
  });

  it('pastePreprocess sees the original HTML, pastePostprocess the cleaned one', () => {
    const seen: string[] = [];
    paste('<meta name=Generator content="Microsoft Word 15"><p class=MsoNormal>a<o:p></o:p></p>', {
      pastePreprocess: (html) => (seen.push(html.includes('o:p') ? 'raw' : 'clean'), html),
      pastePostprocess: (root) => void seen.push(root.innerHTML.includes('o:p') ? 'raw' : 'clean'),
    });
    expect(seen).toEqual(['raw', 'clean']);
  });

  it("pasting into an empty paragraph keeps the first paragraph's formatting; into a non-empty one it continues it", () => {
    const html = '<p style="text-align: center">a</p><p>b</p>';
    expect(paste(html).getHTML()).toBe('<p style="text-align: center;">a</p><p>b</p>');

    const element = document.createElement('div');
    document.body.appendChild(element);
    const editor = createEditor({ element, content: '<p>xy</p>' });
    editors.push(editor);
    editor.view.pasteHTML(html);
    // The cursor at the start of "xy": the first paragraph merges with the current one, as in Word.
    expect(editor.getHTML()).toBe('<p>a</p><p>bxy</p>');
  });

  it('dangerous content from Word is still dropped', () => {
    const editor = paste(
      '<meta name=Generator content="Microsoft Word 15"><p class=MsoNormal onclick="alert(1)">a <a href="javascript:alert(1)">x</a><img src="file:///C:/Users/a/img.png"></p><script>alert(1)</script>',
    );
    expect(editor.getHTML()).toBe('<p>a x</p>');
  });
});
