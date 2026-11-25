import { expect, test, type Page } from '@playwright/test';

/** Упоминания «@» в настоящих браузерах: в тексте (список под курсором) и в поле комментария. */

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

test('«@» в тексте: список людей, стрелка и Enter вставляют упоминание', async ({ page }) => {
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
  // Упоминание — единое целое: Backspace удаляет его целиком.
  await page.keyboard.press('ControlOrMeta+End');
  for (let i = 0; i < 'today'.length + 1; i += 1) await page.keyboard.press('Backspace');
  await page.keyboard.press('Backspace');
  expect(await html(page)).toBe('<p>Ask </p>');
});

test('«@» в комментарии: выбор из списка, имя выделено в обсуждении', async ({ page }) => {
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
