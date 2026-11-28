import { expect, test, type Page } from '@playwright/test';

/** A whole HTML page (fullpagehtml): its head is kept, Document properties edits it, the source shows it. */

const PAGE = [
  '<!DOCTYPE html>',
  '<html lang="en">',
  '<head>',
  '<meta charset="utf-8">',
  '<title>Spring newsletter</title>',
  '<meta name="description" content="What is new this spring">',
  '<style>h1 { color: #333333; }</style>',
  '</head>',
  '<body style="color: #222222">',
  '<h1>Hello</h1><p>Text</p>',
  '</body>',
  '</html>',
].join('\n');

type EditorHandle = {
  ready: Promise<void>;
  setContent(content: string, options: object): void;
  getHTML(options?: object): string;
};

const html = (page: Page) =>
  page.evaluate(() => (window as unknown as { editor: EditorHandle }).editor.getHTML());

async function open(page: Page) {
  await page.goto('/?lang=en&fullpage=1');
  await page.evaluate(async (content) => {
    const editor = (window as unknown as { editor: EditorHandle }).editor;
    await editor.ready;
    editor.setContent(content, { addToHistory: false });
  }, PAGE);
  await page.locator('.nova-prosemirror').click();
}

/** The toolbar button: on the panel or in "⋯". */
async function clickControl(page: Page, name: string) {
  const control = page.locator(`.nova-toolbar [data-control="${name}"]`).first();
  if (await control.isVisible()) return control.click();
  await page.locator('.nova-tb-more').click();
  await page.locator(`.nova-tb-overflow-popover [data-control="${name}"]`).click();
}

test('Document properties: the title, search engines and language change; one undo brings them back', async ({
  page,
}) => {
  await open(page);
  await clickControl(page, 'fullpagehtml');
  const dialog = page.getByRole('dialog', { name: 'Document properties' });
  await expect(dialog.getByLabel('Title', { exact: true })).toHaveValue('Spring newsletter');
  await expect(dialog.getByLabel('Description')).toHaveValue('What is new this spring');
  await dialog.getByLabel('Title', { exact: true }).fill('Summer newsletter');
  await dialog.getByRole('tab', { name: 'Language and search' }).click();
  await dialog.getByLabel('Language', { exact: true }).fill('de');
  await dialog
    .getByLabel('Search engines')
    .selectOption({ label: 'Don’t show the page, follow its links' });
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(dialog).toBeHidden();
  const after = await html(page);
  expect(after).toContain('<html lang="de">');
  expect(after).toContain('<meta charset="utf-8">\n<title>Summer newsletter</title>');
  expect(after).toContain('<meta name="robots" content="noindex">');
  expect(after).toContain('<style>h1 { color: #333333; }</style>');
  // The text is untouched and the page is one undo step.
  await page.keyboard.press('ControlOrMeta+z');
  expect(await html(page)).toBe(PAGE);
});

test('the File menu opens Document properties; the source code view shows and takes the whole page', async ({
  page,
}) => {
  await open(page);
  await page.getByRole('menuitem', { name: 'File' }).click();
  await page.getByRole('menuitem', { name: 'Document properties' }).click();
  const dialog = page.getByRole('dialog', { name: 'Document properties' });
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();

  await clickControl(page, 'code');
  const source = page.getByRole('dialog').locator('textarea');
  await expect(source).toHaveValue(/^<!DOCTYPE html>\n<html lang="en">\n<head>/);
  const value = await source.inputValue();
  await source.fill(value.replace('<title>Spring newsletter</title>', '<title>Edited</title>'));
  await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click();
  expect(await html(page)).toBe(PAGE.replace('Spring newsletter', 'Edited'));
});
