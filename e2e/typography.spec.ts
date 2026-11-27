import { expect, test, type Page } from '@playwright/test';

/** The typography plugin in real browsers (?typography=1). */

type Win = {
  editor: {
    ready: Promise<void>;
    setContent(h: string, o?: object): void;
    getHTML(): string;
    focus(): void;
  };
};
const html = (page: Page) => page.evaluate(() => (window as unknown as Win).editor.getHTML());

async function open(page: Page, initial: string) {
  await page.goto('/?lang=en&typography=1');
  await page.evaluate(async (value) => {
    const { editor } = window as unknown as Win;
    await editor.ready;
    editor.setContent(value, { addToHistory: false });
  }, initial);
}

async function clickControl(page: Page, name: string) {
  const control = page.locator(`.nova-toolbar [data-control="${name}"]`).first();
  if (await control.isVisible()) return control.click();
  const overflow = page.locator('.nova-tb-overflow-popover');
  if (!(await overflow.isVisible())) await page.locator('.nova-tb-more').click();
  await overflow.locator(`[data-control="${name}"]`).click();
}

test('the button enhances the text; the menu switches the language and applies it', async ({
  page,
}) => {
  await open(page, `<p>"Hello" -- it's (c) 2026...</p>`);
  await clickControl(page, 'typography');
  await expect.poll(() => html(page)).toBe('<p>“Hello”—it’s © 2026…</p>');
  await expect(page.getByRole('status').filter({ hasText: 'Typography: 6 changes' })).toBeVisible();
  // Ctrl+Z takes it all back at once.
  if (await page.locator('.nova-tb-overflow-popover').isVisible())
    await page.locator('.nova-tb-more').click();
  await page.evaluate(() => (window as unknown as Win).editor.focus());
  await page.keyboard.press('ControlOrMeta+z');
  await expect.poll(() => html(page)).toBe(`<p>"Hello" -- it's (c) 2026...</p>`);
  await clickControl(page, 'typography-options');
  await page.getByRole('menuitemradio', { name: 'German' }).click();
  await expect.poll(() => html(page)).toBe('<p>„Hello“ – it’s © 2026…</p>');
});
