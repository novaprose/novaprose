import { expect, test, type Page } from '@playwright/test';

/**
 * Real-time collaboration through the real sync server (apps/sync-server, --dev mode):
 * two editors on the page and a second tab as the third participant.
 */

declare global {
  interface Window {
    editors: Record<'anna' | 'boris', { getHTML(): string }>;
  }
}

const editorOf = (page: Page, id: 'anna' | 'boris') => page.locator(`#${id} .nova-prosemirror`);

async function open(page: Page, room: string) {
  await page.goto(`/collab.html?lang=en&room=${room}`);
  // Type only after both editors have done their first sync with the server.
  await expect(page.locator('#synced')).toHaveText('2');
}

/** The editor's document (without the other participants' cursors, which are in the DOM too). */
const doc = (page: Page, id: 'anna' | 'boris') =>
  page.evaluate((key) => window.editors[key].getHTML(), id);

const newRoom = () => `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

test("one participant's text shows up for the other", async ({ page }) => {
  await open(page, newRoom());
  await editorOf(page, 'anna').click();
  await page.keyboard.type('Hello from Anna');
  await expect.poll(() => doc(page, 'boris')).toBe('<p>Hello from Anna</p>');

  await editorOf(page, 'boris').click();
  await page.keyboard.press('ControlOrMeta+End');
  await page.keyboard.type(' and Boris');
  await expect.poll(() => doc(page, 'anna')).toBe('<p>Hello from Anna and Boris</p>');
});

test("another participant's cursor shows with a label", async ({ page }) => {
  await open(page, newRoom());
  await editorOf(page, 'boris').click();
  await page.keyboard.type('Boris is here');
  await expect(page.locator('#anna .nova-collab-label')).toHaveText('Boris');
});

test('a second tab gets the document and the edits', async ({ page, context }) => {
  const room = newRoom();
  await open(page, room);
  await editorOf(page, 'anna').click();
  await page.keyboard.type('Shared draft');

  const second = await context.newPage();
  await open(second, room);
  await expect.poll(() => doc(second, 'anna')).toBe('<p>Shared draft</p>');
  await editorOf(second, 'boris').click();
  await second.keyboard.press('ControlOrMeta+End');
  await second.keyboard.type('!');
  await expect.poll(() => doc(page, 'anna')).toBe('<p>Shared draft!</p>');
});

test('Ctrl+Z undoes only your own edits', async ({ page }) => {
  await open(page, newRoom());
  await editorOf(page, 'anna').click();
  await page.keyboard.type('Anna.');
  await expect.poll(() => doc(page, 'boris')).toBe('<p>Anna.</p>');
  await editorOf(page, 'boris').click();
  await page.keyboard.press('ControlOrMeta+End');
  await page.keyboard.type(' Boris.');
  await expect.poll(() => doc(page, 'anna')).toBe('<p>Anna. Boris.</p>');

  await editorOf(page, 'anna').click();
  await page.keyboard.press('ControlOrMeta+z');
  await expect.poll(() => doc(page, 'boris')).toBe('<p>&nbsp;Boris.</p>');
});

test("one participant's comment shows to the other with the highlight and the thread", async ({
  page,
}) => {
  await open(page, newRoom());
  await editorOf(page, 'anna').click();
  await page.keyboard.type('Launch date');
  await expect.poll(() => doc(page, 'boris')).toBe('<p>Launch date</p>');
  await editorOf(page, 'anna')
    .locator('p')
    .dblclick({ position: { x: 6, y: 8 } });
  await page.keyboard.press('ControlOrMeta+Alt+m');
  const composer = page.locator('#anna .nova-comments').getByPlaceholder('Add a comment…');
  await composer.fill('Confirm with sales');
  await composer.press('ControlOrMeta+Enter');

  const highlight = page.locator('#boris .nova-comment');
  await expect(highlight).toHaveText('Launch');
  await highlight.click();
  await expect(page.locator('#boris .nova-thread.is-active')).toContainText('Confirm with sales');
});

/** The toolbar button of the scope editor: on the panel or in its "⋯". */
async function clickIn(page: Page, scope: string, name: string) {
  const control = page.locator(`${scope} .nova-toolbar [data-control="${name}"]`).first();
  if (await control.isVisible()) return control.click();
  await page.locator(`${scope} .nova-tb-more`).click();
  await page.locator(`.nova-tb-overflow-popover [data-control="${name}"]`).click();
}

test('version history: save, compare, restore, for every participant', async ({ page }) => {
  await open(page, newRoom());
  await editorOf(page, 'anna').click();
  await page.keyboard.type('Launch in May');
  await expect.poll(() => doc(page, 'boris')).toBe('<p>Launch in May</p>');

  await clickIn(page, '#anna', 'revisionhistory');
  const history = page.locator('#anna .nova-history');
  await history.getByRole('button', { name: 'Save version' }).click();
  await expect(history.locator('.nova-history-item')).toHaveCount(2);
  await history.getByRole('button', { name: 'Close' }).click();

  await editorOf(page, 'anna').click();
  await page.keyboard.press('ControlOrMeta+End');
  for (let i = 0; i < 3; i += 1) await page.keyboard.press('Backspace');
  await page.keyboard.type('June');
  await expect.poll(() => doc(page, 'boris')).toBe('<p>Launch in June</p>');

  await clickIn(page, '#anna', 'revisionhistory');
  await history.locator('.nova-history-item').nth(1).click();
  await expect(history.locator('.nova-diff-added')).toHaveText('May');
  await expect(history.locator('.nova-diff-removed')).toHaveText('June');
  await history.getByRole('button', { name: 'Restore this version' }).click();
  await expect(history).toBeHidden();
  await expect.poll(() => doc(page, 'boris')).toBe('<p>Launch in May</p>');
});
