import { expect, test, type Page } from '@playwright/test';

/** История версий без совместного режима: версии от приложения (в песочнице — в памяти). */

type Win = {
  editor: { ready: Promise<void>; setContent(h: string, o?: object): void; getHTML(): string };
};
const html = (page: Page) => page.evaluate(() => (window as unknown as Win).editor.getHTML());

async function clickControl(page: Page, name: string) {
  const control = page.locator(`.nova-toolbar [data-control="${name}"]`).first();
  if (await control.isVisible()) return control.click();
  await page.locator('.nova-tb-more').click();
  await page.locator(`.nova-tb-overflow-popover [data-control="${name}"]`).click();
}

test('сохранить версию, изменить текст, восстановить; Ctrl+Z возвращает правку', async ({
  page,
}) => {
  await page.goto('/?lang=en&comments=1');
  await page.evaluate(async () => {
    const { editor } = window as unknown as Win;
    await editor.ready;
    editor.setContent('<h2>Plan</h2><p>Ship in May</p>', { addToHistory: false });
  });
  await clickControl(page, 'revisionhistory');
  const history = page.locator('.nova-history');
  await expect(history.getByRole('button', { name: 'Current version' })).toBeFocused();
  await history.getByRole('button', { name: 'Save version' }).click();
  await expect(history.locator('.nova-history-item')).toHaveCount(2);
  await page.keyboard.press('Escape');
  await expect(history).toBeHidden();

  await page.evaluate(() =>
    (window as unknown as Win).editor.setContent('<h2>Plan</h2><p>Ship in June</p>'),
  );
  await clickControl(page, 'revisionhistory');
  // Стрелка вниз — к сохранённой версии.
  await page.keyboard.press('ArrowDown');
  await expect(history.locator('.nova-diff-added')).toHaveText('May');
  await history.getByRole('button', { name: 'Restore this version' }).click();
  expect(await html(page)).toBe('<h2>Plan</h2><p>Ship in May</p>');
  await page.locator('.nova-prosemirror').click();
  await page.keyboard.press('ControlOrMeta+z');
  expect(await html(page)).toBe('<h2>Plan</h2><p>Ship in June</p>');
});
