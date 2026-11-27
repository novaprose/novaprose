import { expect, test, type Page } from '@playwright/test';

/** The accessibility checker in real browsers: find the problems and fix them from the panel. */

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

const IMG = 'https://example.com/cat.png';
const PROBLEMS =
  `<h2>Report</h2><h4>Numbers</h4><p><img src="${IMG}"></p>` + '<p>• one</p><p>• two</p>';

test('the panel lists the problems; each is fixed from its card', async ({ page }) => {
  await page.goto('/?lang=en&a11y=1');
  await page.evaluate(async (value) => {
    const { editor } = window as unknown as Win;
    await editor.ready;
    editor.setContent(value, { addToHistory: false });
  }, PROBLEMS);
  await clickControl(page, 'a11ycheck');
  const panel = page.getByRole('complementary', { name: 'Accessibility' });
  await expect(panel.getByRole('status')).toHaveText('Errors: 3. Warnings: 0.');

  await panel.getByRole('button', { name: 'Change to Heading 3' }).click();
  await panel.getByLabel('Alternative text').fill('A grey cat');
  await panel.getByRole('button', { name: 'Save' }).click();
  await panel.getByRole('button', { name: 'Make it a list' }).click();

  await expect(panel.getByRole('status')).toHaveText('No accessibility problems found.');
  expect(await html(page)).toBe(
    `<h2>Report</h2><h3>Numbers</h3><p><img src="${IMG}" alt="A grey cat"></p>` +
      '<ul><li><p>one</p></li><li><p>two</p></li></ul>',
  );
});

test('Show in the text selects the problem; new problems appear as you edit', async ({ page }) => {
  await page.goto('/?lang=en&a11y=1');
  await page.evaluate(async () => {
    const { editor } = window as unknown as Win;
    await editor.ready;
    editor.setContent('<h2>A</h2><p>Fine.</p>', { addToHistory: false });
  });
  await clickControl(page, 'a11ycheck');
  const panel = page.getByRole('complementary', { name: 'Accessibility' });
  await expect(panel.getByRole('status')).toHaveText('No accessibility problems found.');
  await page.evaluate(() =>
    (window as unknown as Win).editor.setContent('<h2>A</h2><h5>Deep</h5>'),
  );
  await expect(panel.getByRole('status')).toHaveText('Errors: 1. Warnings: 0.');
  await panel.getByRole('button', { name: 'Show in the text' }).click();
  await expect(page.locator('.nova-prosemirror .nova-a11y-target')).toHaveText('Deep');
});
