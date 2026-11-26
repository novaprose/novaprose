import { expect, test, type Page } from '@playwright/test';

/**
 * Right to left (Hebrew, Arabic): the interface is mirrored, arrow focus follows the visual
 * order, drop-down panels align with the right edge of their button, the paragraph indent is on the right.
 */

type W = {
  editor: {
    getHTML(): string;
    setContent(html: string, options?: object): void;
    exec(name: string): boolean;
    ready: Promise<void>;
    direction: string;
  };
};

const html = (page: Page) => page.evaluate(() => (window as unknown as W).editor.getHTML());

async function open(page: Page, query = 'lang=en&dir=rtl') {
  await page.goto(`/?${query}`);
  await page.evaluate(async () => {
    const { editor } = window as unknown as W;
    await editor.ready;
    editor.setContent('<p>שלום עולם</p>', { addToHistory: false });
  });
}

async function clickControl(page: Page, name: string) {
  const control = page.locator(`.nova-toolbar [data-control="${name}"]`).first();
  if (await control.isVisible()) return control.click();
  await page.locator('.nova-tb-more').click();
  await page.locator(`.nova-tb-overflow-popover [data-control="${name}"]`).click();
}

test('the interface is mirrored: the first toolbar button on the right, the text aligned right', async ({
  page,
}) => {
  await open(page);
  await expect(page.locator('.nova-editor')).toHaveAttribute('dir', 'rtl');
  const buttons = page.locator('.nova-toolbar button:visible');
  const first = await buttons.first().boundingBox();
  const last = await buttons.last().boundingBox();
  expect(first!.x).toBeGreaterThan(last!.x);
  const p = await page.locator('.nova-prosemirror p').boundingBox();
  const content = await page.locator('.nova-prosemirror').boundingBox();
  // The text starts at the right edge of the input area.
  expect(content!.x + content!.width - (p!.x + p!.width)).toBeLessThan(40);
});

test('arrows: ← goes to the next button (the visual order right to left)', async ({ page }) => {
  await open(page);
  const buttons = page.locator('.nova-toolbar button:not(:disabled):visible');
  await buttons.first().focus();
  // The position of the focused button ("⋯" has no data-control, so the element itself is taken).
  const focusedX = () => page.evaluate(() => document.activeElement!.getBoundingClientRect().x);
  const start = await focusedX();
  await page.keyboard.press('ArrowLeft');
  expect(await focusedX()).toBeLessThan(start);
  await page.keyboard.press('ArrowRight');
  expect(await focusedX()).toBe(start);
});

test('a drop-down menu aligns with the right edge of its button', async ({ page }) => {
  await open(page);
  await page.locator('.nova-prosemirror').click();
  const button = page.locator('.nova-toolbar [data-control="blocks"]').first();
  test.skip(!(await button.isVisible()), 'on a narrow screen the formats list is in "⋯"');
  await button.click();
  const menu = page
    .locator('.nova-popover')
    .filter({ has: page.locator('.nova-menu') })
    .first();
  await expect(menu).toBeVisible();
  // Measured after the appearing animation (scale 0.98 → 1 shifts the edges by a couple of pixels).
  await menu.evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
  const b = await button.boundingBox();
  const m = await menu.boundingBox();
  expect(Math.abs(b!.x + b!.width - (m!.x + m!.width))).toBeLessThan(1);
});

test('the paragraph indent is on the right (margin-right), a quote has its bar on the right', async ({
  page,
}) => {
  await open(page);
  await page.locator('.nova-prosemirror p').click();
  await clickControl(page, 'indent');
  await expect.poll(() => html(page)).toBe('<p style="margin-right: 40px;">שלום עולם</p>');
  await page.evaluate(() => {
    (window as unknown as W).editor.setContent('<blockquote><p>ציטוט</p></blockquote>');
  });
  const border = await page
    .locator('.nova-prosemirror blockquote')
    .evaluate((el) => getComputedStyle(el).borderRightWidth);
  expect(border).toBe('3px');
});

test('a right-to-left language turns the direction on by itself; it can be overridden', async ({
  page,
}) => {
  await page.goto('/?lang=he');
  expect(await page.evaluate(() => (window as unknown as W).editor.direction)).toBe('rtl');
  await page.goto('/?lang=en');
  expect(await page.evaluate(() => (window as unknown as W).editor.direction)).toBe('ltr');
});
