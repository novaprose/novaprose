import { expect, test, type Page } from '@playwright/test';

/**
 * Оглавление (плагин tableofcontents) в настоящих браузерах: вставка кнопкой, новый заголовок
 * «## » сразу появляется в оглавлении, переход по пункту — без смены адреса страницы.
 */

type W = {
  editor: { getHTML(): string; setContent(h: string, o?: object): void; ready: Promise<void> };
};
const html = (page: Page) => page.evaluate(() => (window as unknown as W).editor.getHTML());

async function open(page: Page, content: string) {
  await page.goto('/?lang=en&parity=1');
  await page.evaluate(async (c) => {
    const { editor } = window as unknown as W;
    await editor.ready;
    editor.setContent(c, { addToHistory: false });
  }, content);
}

async function clickControl(page: Page, name: string) {
  const control = page.locator(`.nova-toolbar [data-control="${name}"]`).first();
  if (await control.isVisible()) return control.click();
  await page.locator('.nova-tb-more').click();
  await page.locator(`.nova-tb-overflow-popover [data-control="${name}"]`).click();
}

const toc = (page: Page) => page.locator('.nova-prosemirror nav[data-toc]');

test('вставка оглавления; новый заголовок появляется в нём сразу', async ({ page, isMobile }) => {
  await open(page, '<p>Start</p><h2>First</h2><p>text</p>');
  await page.locator('.nova-prosemirror p', { hasText: 'Start' }).click();
  await clickControl(page, 'tableofcontents');
  await expect(toc(page).getByRole('link', { name: 'First' })).toBeVisible();
  test.skip(isMobile, 'Enter из эмуляции Android');
  await page.locator('.nova-prosemirror p', { hasText: 'text' }).click();
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  await page.keyboard.type('## Second');
  await expect(toc(page).getByRole('link', { name: 'Second' })).toBeVisible();
  await expect.poll(() => html(page)).toMatch(/<h2 id="toc-[a-z0-9]+">Second<\/h2>/);
});

test('пункт оглавления ведёт к заголовку, адрес страницы прежний', async ({ page }) => {
  const filler = '<p>filler</p>'.repeat(40);
  await open(page, `<p>top</p><h2>Far away</h2>${filler}`);
  await page.locator('.nova-prosemirror p', { hasText: 'top' }).click();
  await clickControl(page, 'tableofcontents');
  // На узком экране панель «⋯» остаётся открытой, а липкий тулбар закрывает верх страницы.
  await page.keyboard.press('Escape');
  const link = toc(page).getByRole('link', { name: 'Far away' });
  await link.evaluate((el) => el.scrollIntoView({ block: 'center' }));
  const url = page.url();
  await link.click();
  expect(page.url()).toBe(url);
  await expect
    .poll(() =>
      page.evaluate(() => {
        const sel = window.getSelection();
        return sel?.anchorNode?.parentElement?.closest('h2')?.textContent ?? null;
      }),
    )
    .toBe('Far away');
});
