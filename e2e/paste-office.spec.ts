import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';

/**
 * Эталоны вставки из Word, Google Docs, Excel и т.п. — в настоящих браузерах.
 * Очистка опирается на разбор CSS, а он в Chrome, Firefox и Safari отличается от jsdom,
 * поэтому те же эталоны, что и в юнит-тестах (packages/core/test/fixtures/paste), гоняем здесь.
 */

const FIXTURES = join(process.cwd(), 'packages', 'core', 'test', 'fixtures', 'paste');
const fixtures = readdirSync(FIXTURES).filter(
  (f) => f.endsWith('.html') && !f.endsWith('.expected.html'),
);

for (const file of fixtures) {
  test(`вставка: ${file}`, async ({ page }) => {
    const input = readFileSync(join(FIXTURES, file), 'utf8');
    const expected = readFileSync(join(FIXTURES, file.replace('.html', '.expected.html')), 'utf8');
    await page.goto('/?lang=en');
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
      // Тот же конвейер, что и настоящая вставка (синтетический ClipboardEvent Firefox игнорирует).
      editor.view.pasteHTML(html);
      return editor.getHTML();
    }, input);
    expect(result).toBe(expected.trim());
  });
}

// 1×1 PNG: в RTF Word картинка лежит шестнадцатеричными данными в группе {\pict … \pngblip …}.
const PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

test('вставка из Word: картинки берутся из RTF вместо недоступных file:-ссылок', async ({
  page,
  browserName,
}) => {
  test.skip(browserName === 'firefox', 'Firefox игнорирует clipboardData в синтетическом paste');
  const hex = Buffer.from(PNG_BASE64, 'base64').toString('hex');
  const rtf = String.raw`{\rtf1{\*\shppict{\pict\picw26\pich26\pngblip\bliptag1 ${hex}}}{\nonshppict{\pict\wmetafile8 0100}}}`;
  const html =
    '<meta name=Generator content="Microsoft Word 15"><p class=MsoNormal>Logo: <![if !vml]><img width=26 height=26 src="file:///C:/Temp/clip_image001.png"><![endif]><o:p></o:p></p>';
  await page.goto('/?lang=en');
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
