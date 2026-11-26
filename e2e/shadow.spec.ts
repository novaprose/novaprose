import { expect, test, type Page } from '@playwright/test';

/**
 * An editor inside a shadow root (a customer's own web component): focus, selection, menus, dialogs.
 * Inside the root document.activeElement is the host, and the target of events on document is retargeted: without
 * handling this, menus closed on clicks on their own items, and Tab in a dialog threw focus to the start.
 * Playwright locators pierce an open root; the closed one is checked with the mouse and the keyboard.
 */

type W = { editor: { getHTML(): string; ready: Promise<void> }; shadow: ShadowRoot };

const html = (page: Page) => page.evaluate(() => (window as unknown as W).editor.getHTML());

async function open(page: Page, mode: 'open' | 'closed' = 'open') {
  await page.goto(`/shadow.html?mode=${mode}`);
  await page.evaluate(() => (window as unknown as W).editor.ready);
}

/** The center of an element inside the root (locators don't work for a closed root). */
async function center(page: Page, selector: string) {
  const box = await page.evaluate((sel) => {
    const el = (window as unknown as W).shadow.querySelector(sel);
    const r = el!.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }, selector);
  return box;
}

/** The toolbar button: on the panel or in "⋯" (the layout depends on the screen width). */
async function clickControl(page: Page, name: string) {
  const control = page.locator(`my-app .nova-toolbar [data-control="${name}"]`).first();
  if (await control.isVisible()) return control.click();
  await page.locator('my-app .nova-tb-more').click();
  await page.locator(`my-app .nova-tb-overflow-popover [data-control="${name}"]`).click();
}

/** The focused element inside the root (a data-control selector or a class). */
const focused = (page: Page) =>
  page.evaluate(() => {
    const el = (window as unknown as W).shadow.activeElement as HTMLElement | null;
    return el?.getAttribute('data-control') ?? el?.className ?? null;
  });

test('typing, selecting from the keyboard and formatting with a button', async ({ page }) => {
  await open(page);
  const text = page.locator('my-app .nova-prosemirror');
  await text.click();
  await page.keyboard.press('End');
  await page.keyboard.type(' again');
  for (let i = 0; i < 5; i++) await page.keyboard.press('Shift+ArrowLeft');
  await clickControl(page, 'bold');
  await expect.poll(() => html(page)).toBe('<p>Hello shadow world <strong>again</strong></p>');
});

test('a menu: a click on an item applies it instead of closing the menu as a "click outside"', async ({
  page,
}) => {
  await open(page);
  await page.locator('my-app .nova-prosemirror').click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.locator('my-app .nova-menubar button', { hasText: 'Format' }).click();
  const menu = page.locator('my-app .nova-popover .nova-menu').first();
  await expect(menu).toBeVisible();
  await menu.locator('button', { hasText: 'Bold' }).first().click();
  await expect(menu).toBeHidden();
  await expect.poll(() => html(page)).toBe('<p><strong>Hello shadow world</strong></p>');
  // A click outside the root closes the open menu.
  await page.locator('my-app .nova-menubar button', { hasText: 'Format' }).click();
  await expect(menu).toBeVisible();
  await page.locator('#outside').click();
  await expect(menu).toBeHidden();
});

test('the toolbar: arrows move focus across buttons', async ({ page }) => {
  await open(page);
  // The first visible available button: on a narrow screen some buttons move into "⋯".
  const first = page.locator('my-app .nova-toolbar button:not(:disabled):visible').first();
  await first.focus();
  const start = await focused(page);
  await page.keyboard.press('ArrowRight');
  const next = await focused(page);
  expect(next).not.toBeNull();
  expect(next).not.toBe(start);
  await page.keyboard.press('ArrowLeft');
  expect(await focused(page)).toBe(start);
});

test('the link dialog: Tab stays inside, Enter inserts the link', async ({ page }) => {
  await open(page);
  await page.locator('my-app .nova-prosemirror').click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.press('ControlOrMeta+k');
  const dialog = page.locator('my-app .nova-dialog');
  await expect(dialog).toBeVisible();
  await page.keyboard.type('https://example.com');
  // Go around all the fields: focus must not leave the dialog or jump to the start.
  const names: string[] = [];
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press('Tab');
    names.push(
      await page.evaluate(() => {
        const el = (window as unknown as W).shadow.activeElement;
        const dialog = el?.closest('.nova-dialog');
        return dialog ? String([...dialog.querySelectorAll('*')].indexOf(el!)) : 'OUTSIDE';
      }),
    );
  }
  expect(names).not.toContain('OUTSIDE');
  expect(new Set(names).size).toBeGreaterThan(2);
  // Shift+Tab from the first element of the dialog (the "×" button) goes to the last one (around), not outside.
  const index = () =>
    page.evaluate(() => {
      const el = (window as unknown as W).shadow.activeElement!;
      return [...el.closest('.nova-dialog')!.querySelectorAll('button, input')].indexOf(el);
    });
  await page.locator('my-app .nova-dialog').locator('button, input').first().focus();
  expect(await index()).toBe(0);
  await page.keyboard.press('Shift+Tab');
  expect(await index()).toBeGreaterThan(0);
  // Focus that left the dialog for another element of the same root comes back to the dialog.
  await page.evaluate(() =>
    (window as unknown as W).shadow.querySelector<HTMLElement>('.nova-prosemirror')!.focus(),
  );
  await expect
    .poll(() =>
      page.evaluate(() => !!(window as unknown as W).shadow.activeElement?.closest('.nova-dialog')),
    )
    .toBe(true);
  await page.locator('my-app .nova-dialog input').first().focus();
  await page.keyboard.press('Enter');
  await expect(dialog).toBeHidden();
  await expect.poll(() => html(page)).toContain('href="https://example.com"');
});

test('a closed root: the menu works with the mouse', async ({ page }) => {
  await open(page, 'closed');
  const text = await center(page, '.nova-prosemirror');
  await page.mouse.click(text.x, text.y);
  await page.keyboard.press('ControlOrMeta+a');
  const blocks = await center(page, '.nova-toolbar [data-control="blocks"]');
  await page.mouse.click(blocks.x, blocks.y);
  const isOpen = () =>
    page.evaluate(() => !!(window as unknown as W).shadow.querySelector('.nova-popover-menu'));
  await expect.poll(isOpen).toBe(true);
  const item = await page.evaluate(() => {
    const items = [...(window as unknown as W).shadow.querySelectorAll('.nova-popover button')];
    const h2 = items.find((b) => b.textContent?.includes('Heading 2'))!;
    const r = h2.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  await page.mouse.click(item.x, item.y);
  await expect.poll(() => html(page)).toBe('<h2>Hello shadow world</h2>');
  await expect.poll(isOpen).toBe(false);
});
