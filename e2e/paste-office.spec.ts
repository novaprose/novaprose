import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';

/**
 * Paste fixtures from Word, Google Docs, Excel and the like, in real browsers.
 * The cleanup relies on CSS parsing, which in Chrome, Firefox and Safari differs from jsdom,
 * so the same fixtures as in the unit tests (packages/core/test/fixtures/paste) run here.
 */

const FIXTURES = join(process.cwd(), 'packages', 'core', 'test', 'fixtures', 'paste');
const fixtures = readdirSync(FIXTURES).filter(
  (f) => f.endsWith('.html') && !f.endsWith('.expected.html'),
);

for (const file of fixtures) {
  test(`paste: ${file}`, async ({ page }) => {
    const input = readFileSync(join(FIXTURES, file), 'utf8');
    const expected = readFileSync(join(FIXTURES, file.replace('.html', '.expected.html')), 'utf8');
    await page.goto('/?lang=en');
    // Office paste cleanup is a lazy chunk: a programmatic paste waits until the editor is ready.
    await page.evaluate(
      () => (window as unknown as { editor: { ready: Promise<void> } }).editor.ready,
    );
    const result = await page.evaluate((html) => {
      const editor = (
        window as unknown as {
          editor: {
            setContent(h: string, o: object): void;
            getHTML(): string;
            focus(): void;
            view: { pasteHTML(h: string): boolean };
          };
        }
      ).editor;
      editor.setContent('<p></p>', { addToHistory: false });
      editor.focus();
      // The same pipeline as a real paste (Firefox ignores a synthetic ClipboardEvent).
      editor.view.pasteHTML(html);
      return editor.getHTML();
    }, input);
    expect(result).toBe(expected.trim());
  });
}

// A 1×1 PNG: in Word's RTF the image is hexadecimal data in a {\pict … \pngblip …} group.
const PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

test('paste from Word: images come from the RTF instead of unreachable file: links', async ({
  page,
  browserName,
}) => {
  test.skip(browserName === 'firefox', 'Firefox ignores clipboardData in a synthetic paste');
  const hex = Buffer.from(PNG_BASE64, 'base64').toString('hex');
  const rtf = String.raw`{\rtf1{\*\shppict{\pict\picw26\pich26\pngblip\bliptag1 ${hex}}}{\nonshppict{\pict\wmetafile8 0100}}}`;
  const html =
    '<meta name=Generator content="Microsoft Word 15"><p class=MsoNormal>Logo: <![if !vml]><img width=26 height=26 src="file:///C:/Temp/clip_image001.png"><![endif]><o:p></o:p></p>';
  await page.goto('/?lang=en');
  // Office paste cleanup is a lazy chunk: a programmatic paste waits until the editor is ready.
  await page.evaluate(
    () => (window as unknown as { editor: { ready: Promise<void> } }).editor.ready,
  );
  const result = await page.evaluate(
    ({ html, rtf }) => {
      const editor = (
        window as unknown as {
          editor: {
            setContent(h: string, o: object): void;
            getHTML(): string;
            focus(): void;
            view: { dom: HTMLElement };
          };
        }
      ).editor;
      editor.setContent('<p></p>', { addToHistory: false });
      editor.focus();
      const data = new DataTransfer();
      data.setData('text/html', html);
      data.setData('text/rtf', rtf);
      data.setData('text/plain', 'Logo:');
      editor.view.dom.dispatchEvent(
        new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }),
      );
      return editor.getHTML();
    },
    { html, rtf },
  );
  expect(result).toBe(
    `<p>Logo: <img src="data:image/png;base64,${PNG_BASE64}" width="26" height="26"></p>`,
  );
});
