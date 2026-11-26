import { expect, test, type Page } from '@playwright/test';

/**
 * The block drag handle (the draghandle plugin) and Alt+Shift+↑/↓ in real browsers.
 * The handle is for the mouse only: touch screens don't have it (they have no HTML drag and drop).
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

const handle = (page: Page) => page.locator('.nova-drag-handle');
const block = (page: Page, selector: string, text: string) =>
  page.locator(`.nova-prosemirror ${selector}`, { hasText: new RegExp(`^${text}$`) });

/** Hover over a block: the handle appears to its left, level with the first line. */
async function hover(page: Page, selector: string, text: string) {
  const target = block(page, selector, text).first();
  await target.hover();
  await expect(handle(page)).toBeVisible();
  const h = (await handle(page).boundingBox())!;
  const b = (await target.boundingBox())!;
  expect(h.x + h.width).toBeLessThanOrEqual(b.x + 1);
  expect(Math.abs(h.y + h.height / 2 - (b.y + Math.min(b.height, 26) / 2))).toBeLessThan(14);
}

/** Drag the handle with the mouse and drop it at the top (or bottom) edge of block `to`. */
async function dragHandleTo(page: Page, to: string, edge: 'top' | 'bottom') {
  const from = (await handle(page).boundingBox())!;
  const target = (await block(page, 'p', to).boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  const y = edge === 'top' ? target.y + 2 : target.y + target.height - 2;
  await page.mouse.move(target.x + 20, y, { steps: 8 });
  await page.mouse.up();
}

test.describe('the drag handle', () => {
  test.skip(({ isMobile }) => isMobile, 'the handle is for the mouse only');

  test('dragging a paragraph down and up', async ({ page }) => {
    await open(page, '<p>one</p><p>two</p><p>three</p>');
    await hover(page, 'p', 'one');
    await dragHandleTo(page, 'three', 'bottom');
    await expect.poll(() => html(page)).toBe('<p>two</p><p>three</p><p>one</p>');
    await hover(page, 'p', 'three');
    await dragHandleTo(page, 'two', 'top');
    await expect.poll(() => html(page)).toBe('<p>three</p><p>two</p><p>one</p>');
  });

  test('a list item: the handle left of the marker, a move inside the list', async ({ page }) => {
    await open(page, '<ul><li><p>apple</p></li><li><p>pear</p></li></ul><p>after</p>');
    await hover(page, 'li p', 'pear');
    const h = (await handle(page).boundingBox())!;
    const list = (await page.locator('.nova-prosemirror ul').boundingBox())!;
    expect(h.x + h.width).toBeLessThanOrEqual(list.x + 1);
    const from = h;
    const first = (await block(page, 'li p', 'apple').boundingBox())!;
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(first.x + 20, first.y + 2, { steps: 8 });
    await page.mouse.up();
    await expect
      .poll(() => html(page))
      .toBe('<ul><li><p>pear</p></li><li><p>apple</p></li></ul><p>after</p>');
  });

  test('a click on the handle: the block is selected, the menu offers up, down, duplicate, delete', async ({
    page,
  }) => {
    await open(page, '<p>one</p><p>two</p>');
    await hover(page, 'p', 'one');
    await handle(page).click();
    const menu = page.locator('.nova-popover-menu [role="menu"]');
    await expect(menu).toBeVisible();
    await expect(block(page, 'p', 'one')).toHaveClass(/ProseMirror-selectednode/);
    await expect(menu.getByRole('menuitem', { name: /Move block up/ })).toBeDisabled();
    await menu.getByRole('menuitem', { name: /Move block down/ }).click();
    await expect.poll(() => html(page)).toBe('<p>two</p><p>one</p>');
    await hover(page, 'p', 'one');
    await handle(page).click();
    await menu.getByRole('menuitem', { name: 'Duplicate' }).click();
    await expect.poll(() => html(page)).toBe('<p>two</p><p>one</p><p>one</p>');
    await hover(page, 'p', 'two');
    await handle(page).click();
    await menu.getByRole('menuitem', { name: 'Delete' }).click();
    await expect.poll(() => html(page)).toBe('<p>one</p><p>one</p>');
  });

  test('typing hides the handle', async ({ page }) => {
    await open(page, '<p>one</p><p>two</p>');
    await hover(page, 'p', 'two');
    await block(page, 'p', 'two').click();
    await page.keyboard.type('!');
    await expect(handle(page)).toBeHidden();
  });
});

test('Alt+Shift+↑/↓ moves a paragraph', async ({ page, isMobile }) => {
  test.skip(isMobile, 'the keyboard shortcut is for desktops');
  await open(page, '<p>one</p><p>two</p><p>three</p>');
  await block(page, 'p', 'two').click();
  await page.keyboard.press('Alt+Shift+ArrowUp');
  await expect.poll(() => html(page)).toBe('<p>two</p><p>one</p><p>three</p>');
  await page.keyboard.press('Alt+Shift+ArrowDown');
  await page.keyboard.press('Alt+Shift+ArrowDown');
  await expect.poll(() => html(page)).toBe('<p>one</p><p>three</p><p>two</p>');
});
