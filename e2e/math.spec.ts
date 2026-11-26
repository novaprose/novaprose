import { expect, test, type Page } from '@playwright/test';

/**
 * Формулы (плагин math) в настоящих браузерах: MathML в строке и отдельной строкой, ввод «$…$»,
 * нажатие на формулу открывает правку.
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

test('формула в строке и отдельной строкой — MathML браузера', async ({ page }) => {
  await open(
    page,
    '<p>Energy <span data-type="inline-math" data-latex="E=mc^2"></span></p>' +
      '<div data-type="block-math" data-latex="\\int_0^1 x^2\\,dx = \\frac{1}{3}"></div>',
  );
  await expect(page.locator('.nova-math-inline math')).toBeVisible();
  await expect(page.locator('.nova-math-block math[display="block"]')).toBeVisible();
  // Формула отдельной строкой выше строчной: дробь и интеграл.
  const inline = (await page.locator('.nova-math-inline').boundingBox())!;
  const block = (await page.locator('.nova-math-block math').boundingBox())!;
  expect(block.height).toBeGreaterThan(inline.height);
});

test('ввод «$a^2$» — формула; нажатие — правка', async ({ page, isMobile }) => {
  await open(page, '<p>Area</p>');
  await page.locator('.nova-prosemirror p').click();
  await page.keyboard.press('End');
  await page.keyboard.type(' $a^2$ ok');
  await expect(page.locator('.nova-math-inline math')).toBeVisible();
  await expect
    .poll(() => html(page))
    .toBe('<p>Area <span data-type="inline-math" data-latex="a^2">\\(a^2\\)</span> ok</p>');
  test.skip(isMobile, 'диалог на узком экране проверяют другие тесты');
  await page.locator('.nova-math-inline').click();
  const dialog = page.locator('.nova-dialog');
  await expect(dialog.locator('textarea[name="latex"]')).toHaveValue('a^2');
  await dialog.locator('textarea[name="latex"]').fill('a^2 + b^2');
  await expect(dialog.locator('.nova-math-preview math')).toBeVisible();
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect.poll(() => html(page)).toContain('data-latex="a^2 + b^2"');
});
