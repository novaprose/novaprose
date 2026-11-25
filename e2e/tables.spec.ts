import { expect, test, type Page } from '@playwright/test';

/** Таблицы в настоящих браузерах: сортировка, свойства таблицы и ячейки, узкий экран. */

const html = (page: Page) =>
  page.evaluate(() => (window as unknown as { editor: { getHTML(): string } }).editor.getHTML());

async function open(page: Page, content: string) {
  await page.goto('/?lang=en');
  await page.evaluate(async (value) => {
    const editor = (
      window as unknown as {
        editor: { ready: Promise<void>; setContent(h: string, o: object): void };
      }
    ).editor;
    await editor.ready;
    editor.setContent(value, { addToHistory: false });
  }, content);
}

/** Кнопка контекстного тулбара таблицы. */
const contextButton = (page: Page, name: string) =>
  page.getByRole('toolbar', { name: 'Table options' }).locator(`[data-control="${name}"]`);

const TABLE =
  '<table><tbody><tr><th><p>Item</p></th><th><p>Cost</p></th></tr><tr><td><p>Hosting</p></td><td><p>$1,200</p></td></tr><tr><td><p>Domains</p></td><td><p>$45</p></td></tr></tbody></table>';

test('сортировка по столбцу через меню', async ({ page }) => {
  await open(page, TABLE);
  await page.locator('.nova-prosemirror').getByText('$45', { exact: true }).click();
  await contextButton(page, 'advtablesort').click();
  await page.locator('.nova-popover-menu [role^="menuitem"]', { hasText: 'A → Z' }).click();
  const costs = await page.locator('.nova-prosemirror td:nth-child(2)').allTextContents();
  expect(costs).toEqual(['$45', '$1,200']);
});

test('свойства таблицы: ширина 100% и по центру', async ({ page }) => {
  await open(page, TABLE);
  await page.locator('.nova-prosemirror').getByText('Domains', { exact: true }).click();
  await contextButton(page, 'tableprops').click();
  const dialog = page.getByRole('dialog', { name: 'Table properties' });
  await dialog.getByLabel('Width').fill('100%');
  await dialog.getByLabel('Alignment on the page').selectOption('center');
  await dialog.getByRole('button', { name: 'Save' }).click();
  expect(await html(page)).toContain(
    '<table style="width: 100%; margin-left: auto; margin-right: auto;">',
  );
});

test('свойства ячейки: заголовок и вертикальное выравнивание', async ({ page }) => {
  await open(page, TABLE);
  await page.locator('.nova-prosemirror').getByText('Hosting', { exact: true }).click();
  await contextButton(page, 'tablecellprops').click();
  const dialog = page.getByRole('dialog', { name: 'Cell properties' });
  await dialog.getByLabel('Vertical alignment').selectOption('middle');
  await dialog.getByLabel('Cell type').selectOption('th');
  await dialog.getByRole('button', { name: 'Save' }).click();
  expect(await html(page)).toContain('<th style="vertical-align: middle;"><p>Hosting</p></th>');
});

test('узкий экран: широкая таблица прокручивается внутри редактора, страница — нет', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 700 });
  const wide = `<table><tbody><tr>${Array.from({ length: 8 }, (_, i) => `<td><p>Column number ${i + 1}</p></td>`).join('')}</tr></tbody></table>`;
  await open(page, wide);
  const pageScrolls = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  );
  expect(pageScrolls).toBe(false);
  const wrapperScrolls = await page
    .locator('.nova-prosemirror .tableWrapper')
    .evaluate((el) => el.scrollWidth > el.clientWidth);
  expect(wrapperScrolls).toBe(true);
});
