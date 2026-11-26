import { expect, test, type Page } from '@playwright/test';

/** Comments in real browsers: selecting with the mouse, the panel, the keyboard shortcut, a narrow screen. */

type Win = {
  editor: { ready: Promise<void>; setContent(h: string, o: object): void; getHTML(): string };
};
const html = (page: Page) => page.evaluate(() => (window as unknown as Win).editor.getHTML());
const content = (page: Page) => page.locator('.nova-prosemirror');
const panel = (page: Page) => page.locator('.nova-comments');

async function open(page: Page, initial: string) {
  await page.goto('/?lang=en&comments=1');
  await page.evaluate(async (value) => {
    const { editor } = window as unknown as Win;
    await editor.ready;
    editor.setContent(value, { addToHistory: false });
  }, initial);
}

/** A double click on the first word of a paragraph (getByText would find the whole paragraph and click its middle). */
const selectFirstWord = (page: Page) =>
  content(page)
    .locator('p')
    .first()
    .dblclick({ position: { x: 6, y: 8 } });

/** The toolbar button: on the panel or in "⋯". */
async function clickControl(page: Page, name: string) {
  const control = page.locator(`.nova-toolbar [data-control="${name}"]`).first();
  if (await control.isVisible()) return control.click();
  await page.locator('.nova-tb-more').click();
  await page.locator(`.nova-tb-overflow-popover [data-control="${name}"]`).click();
}

test('select a word → "Add comment" → reply → resolved', async ({ page }) => {
  await open(page, '<p>Budget for the next quarter</p>');
  await selectFirstWord(page);
  await clickControl(page, 'addcomment');
  const composer = panel(page).getByPlaceholder('Add a comment…');
  await expect(composer).toBeFocused();
  await composer.fill('Is this final?');
  await panel(page).getByRole('button', { name: 'Comment', exact: true }).click();

  await expect.poll(() => html(page)).toMatch(/^<p><span data-comment="t[a-z0-9]+">Budget<\/span>/);
  await expect(content(page).locator('.nova-comment')).toHaveText('Budget');
  const card = panel(page).locator('.nova-thread');
  await expect(card).toContainText('Is this final?');

  const reply = card.getByPlaceholder('Reply…');
  await reply.fill('Yes');
  await reply.press('ControlOrMeta+Enter');
  await expect(card.locator('.nova-comment-text')).toHaveText(['Is this final?', 'Yes']);

  await card.getByRole('button', { name: 'Resolve' }).click();
  await expect(content(page).locator('.nova-comment')).toHaveCount(0);
  await expect(panel(page).locator('.nova-thread')).toHaveCount(0);
});

test('Ctrl/Cmd+Alt+M comments the selection, Esc cancels and returns to the text', async ({
  page,
}) => {
  await open(page, '<p>Shortcut test</p>');
  await selectFirstWord(page);
  await page.keyboard.press('ControlOrMeta+Alt+m');
  const composer = panel(page).getByPlaceholder('Add a comment…');
  await expect(composer).toBeFocused();
  await expect(content(page).locator('.nova-comment.is-pending')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(content(page).locator('.nova-comment')).toHaveCount(0);
  await expect(content(page)).toBeFocused();
});

test('a click on commented text shows its thread', async ({ page }) => {
  await open(page, '<p>One two three</p>');
  await selectFirstWord(page);
  await clickControl(page, 'addcomment');
  await panel(page).getByPlaceholder('Add a comment…').fill('About this');
  await panel(page).getByPlaceholder('Add a comment…').press('ControlOrMeta+Enter');
  await clickControl(page, 'showcomments');
  // On a narrow screen the button is in "⋯": close the menu so it doesn't cover the text.
  if (await page.locator('.nova-tb-overflow-popover').isVisible())
    await page.keyboard.press('Escape');
  await expect(panel(page)).toBeHidden();

  await content(page).locator('.nova-comment').click();
  await expect(panel(page)).toBeVisible();
  await expect(panel(page).locator('.nova-thread.is-active')).toContainText('About this');
});

test('on a narrow screen the panel goes under the text at full width', async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, 'the phone layout');
  await open(page, '<p>Mobile comment</p>');
  await selectFirstWord(page);
  await clickControl(page, 'addcomment');
  await expect(panel(page)).toBeVisible();
  const text = (await page.locator('.nova-content').boundingBox())!;
  const side = (await panel(page).boundingBox())!;
  expect(side.y).toBeGreaterThanOrEqual(text.y + text.height - 1);
  expect(side.width).toBeGreaterThan(text.width - 2);
});
