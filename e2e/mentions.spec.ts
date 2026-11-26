import { expect, test, type Page } from '@playwright/test';

/** "@" mentions in real browsers: in the text (a list under the cursor) and in the comment field. */

type Win = {
  editor: { ready: Promise<void>; setContent(h: string, o: object): void; getHTML(): string };
};
const html = (page: Page) => page.evaluate(() => (window as unknown as Win).editor.getHTML());
const content = (page: Page) => page.locator('.nova-prosemirror');

async function open(page: Page, initial: string) {
  await page.goto('/?lang=en&comments=1');
  await page.evaluate(async (value) => {
    const { editor } = window as unknown as Win;
    await editor.ready;
    editor.setContent(value, { addToHistory: false });
  }, initial);
}

test('"@" in the text: the list of people, an arrow and Enter insert a mention', async ({
  page,
}) => {
  await open(page, '<p></p>');
  await content(page).click();
  await page.keyboard.type('Ask @d');
  const list = page.getByRole('listbox', { name: 'People' });
  await expect(list.getByRole('option')).toHaveText([/Dmitry Orlov/]);
  await page.keyboard.press('Enter');
  await page.keyboard.type('today');
  expect(await html(page)).toBe(
    '<p>Ask <span data-mention="u-dmitry">@Dmitry Orlov</span> today</p>',
  );
  // A mention is one unit: Backspace deletes it whole.
  await page.keyboard.press('ControlOrMeta+End');
  for (let i = 0; i < 'today'.length + 1; i += 1) await page.keyboard.press('Backspace');
  await page.keyboard.press('Backspace');
  expect(await html(page)).toBe('<p>Ask&nbsp;</p>');
});

test('"@" in a comment: picking from the list, the name highlighted in the thread', async ({
  page,
}) => {
  await open(page, '<p>Pricing page</p>');
  await content(page)
    .locator('p')
    .dblclick({ position: { x: 6, y: 8 } });
  await page.keyboard.press('ControlOrMeta+Alt+m');
  const box = page.locator('.nova-comments').getByRole('combobox');
  await expect(box).toBeFocused();
  await page.keyboard.type('Can @ca');
  await expect(page.locator('.nova-mention-option')).toHaveText([/Carla Mendes/]);
  await page.keyboard.press('Enter');
  await expect(box).toHaveValue('Can @Carla Mendes ');
  await page.keyboard.type('review?');
  await page.keyboard.press('ControlOrMeta+Enter');
  await expect(page.locator('.nova-thread .nova-comment-mention')).toHaveText('@Carla Mendes');
});
