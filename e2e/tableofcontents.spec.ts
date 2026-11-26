import { expect, test, type Page } from '@playwright/test';

/**
 * The table of contents (the tableofcontents plugin) in real browsers: inserting with the button, a new heading
 * "## " shows up in the table of contents right away, following an item doesn't change the page address.
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

test('inserting a table of contents; a new heading shows up in it right away', async ({
  page,
  isMobile,
}) => {
  await open(page, '<p>Start</p><h2>First</h2><p>text</p>');
  await page.locator('.nova-prosemirror p', { hasText: 'Start' }).click();
  await clickControl(page, 'tableofcontents');
  await expect(toc(page).getByRole('link', { name: 'First' })).toBeVisible();
  test.skip(isMobile, 'Enter from Android emulation');
  await page.locator('.nova-prosemirror p', { hasText: 'text' }).click();
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  await page.keyboard.type('## Second');
  await expect(toc(page).getByRole('link', { name: 'Second' })).toBeVisible();
  await expect.poll(() => html(page)).toMatch(/<h2 id="toc-[a-z0-9]+">Second<\/h2>/);
});

test('a table of contents item goes to the heading, the page address stays the same', async ({
  page,
}) => {
  const filler = '<p>filler</p>'.repeat(40);
  await open(page, `<p>top</p><h2>Far away</h2>${filler}`);
  await page.locator('.nova-prosemirror p', { hasText: 'top' }).click();
  await clickControl(page, 'tableofcontents');
  // On a narrow screen the "⋯" panel stays open, and the sticky toolbar covers the top of the page.
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
