import { expect, test, type Page } from '@playwright/test';

/**
 * Справа налево (иврит, арабский): интерфейс зеркальный, фокус по стрелкам идёт по видимому
 * порядку, выпадающие панели выровнены по правому краю кнопки, отступ абзаца — справа.
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

test('интерфейс зеркальный: первая кнопка тулбара справа, текст прижат вправо', async ({
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
  // Текст начинается у правого края области ввода.
  expect(content!.x + content!.width - (p!.x + p!.width)).toBeLessThan(40);
});

test('стрелки: ← ведёт к следующей кнопке (видимый порядок справа налево)', async ({ page }) => {
  await open(page);
  const buttons = page.locator('.nova-toolbar button:not(:disabled):visible');
  await buttons.first().focus();
  // Положение кнопки в фокусе (у «⋯» нет data-control — берём сам элемент).
  const focusedX = () => page.evaluate(() => document.activeElement!.getBoundingClientRect().x);
  const start = await focusedX();
  await page.keyboard.press('ArrowLeft');
  expect(await focusedX()).toBeLessThan(start);
  await page.keyboard.press('ArrowRight');
  expect(await focusedX()).toBe(start);
});

test('выпадающее меню выровнено по правому краю своей кнопки', async ({ page }) => {
  await open(page);
  await page.locator('.nova-prosemirror').click();
  const button = page.locator('.nova-toolbar [data-control="blocks"]').first();
  test.skip(!(await button.isVisible()), 'на узком экране список форматов в «⋯»');
  await button.click();
  const menu = page
    .locator('.nova-popover')
    .filter({ has: page.locator('.nova-menu') })
    .first();
  await expect(menu).toBeVisible();
  // Замер после анимации появления (масштаб 0.98 → 1 сдвигает края на пару пикселей).
  await menu.evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
  const b = await button.boundingBox();
  const m = await menu.boundingBox();
  expect(Math.abs(b!.x + b!.width - (m!.x + m!.width))).toBeLessThan(1);
});

test('отступ абзаца — справа (margin-right), цитата — с полосой справа', async ({ page }) => {
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

test('язык с письмом справа налево включает направление сам; можно переопределить', async ({
  page,
}) => {
  await page.goto('/?lang=he');
  expect(await page.evaluate(() => (window as unknown as W).editor.direction)).toBe('rtl');
  await page.goto('/?lang=en');
  expect(await page.evaluate(() => (window as unknown as W).editor.direction)).toBe('ltr');
});
