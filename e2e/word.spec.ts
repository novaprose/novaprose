import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { unzip } from '../packages/core/src/docx/zip';

/**
 * Word in real browsers (the pages.html playground, the exportword and importword plugins): the button
 * downloads a .docx, the import button opens a file picker and brings the document back, with the A5 sheet.
 */

async function clickControl(page: Page, name: string) {
  const control = page.locator(`.nova-toolbar [data-control="${name}"]`).first();
  if (await control.isVisible()) return control.click();
  await page.locator('.nova-tb-more').click();
  await page.locator(`.nova-tb-overflow-popover [data-control="${name}"]`).click();
}

test('exporting to Word downloads a .docx; importing brings back the document and the sheet', async ({
  page,
}) => {
  await page.goto('/pages.html');
  await expect(page.locator('.nova-pages .ProseMirror')).toBeVisible();
  // The buttons of lazy plugins appear after their part loads (editor.ready).
  await page.evaluate(() => window.pagesDemo.editor.ready);

  const downloading = page.waitForEvent('download');
  await clickControl(page, 'exportword');
  const download = await downloading;
  expect(download.suggestedFilename()).toBe('document.docx');
  const file = await download.path();
  const parts = await unzip(new Uint8Array(readFileSync(file)));
  const xml = new TextDecoder().decode(parts.get('word/document.xml'));
  expect(xml).toContain('Pages and printing');
  // The playground sheet is A5 with 15 mm margins.
  expect(xml).toContain('<w:pgSz w:w="8391" w:h="11906"/>');

  await page.evaluate(() => {
    window.pagesDemo.editor.setContent('<p>Something else</p>');
    window.pagesDemo.controller.set({ size: 'A4' });
  });
  const choosing = page.waitForEvent('filechooser');
  await clickControl(page, 'importword');
  await (await choosing).setFiles(file);
  await expect(page.locator('.nova-pages .ProseMirror h1')).toHaveText('Pages and printing');
  await expect(page.locator('.nova-pages .ProseMirror table')).toHaveCount(1);
  await expect.poll(() => page.evaluate(() => window.pagesDemo.controller.layout.size)).toBe('A5');
});
