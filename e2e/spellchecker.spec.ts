import { expect, test, type Page } from '@playwright/test';

/** The spell checker in real browsers, with the playground's offline demo service (?spell=1). */

type Win = {
  editor: { ready: Promise<void>; setContent(h: string, o?: object): void; getHTML(): string };
};
const html = (page: Page) => page.evaluate(() => (window as unknown as Win).editor.getHTML());
const content = (page: Page) => page.locator('.nova-prosemirror');

async function open(page: Page, initial: string) {
  await page.goto('/?lang=en&spell=1');
  await page.evaluate(async (value) => {
    const { editor } = window as unknown as Win;
    await editor.ready;
    editor.setContent(value, { addToHistory: false });
  }, initial);
}

test('problems are underlined; a click on one fixes it from the bubble', async ({ page }) => {
  await open(page, '<p>I recieve teh letter.</p><p>Eat a apple.</p>');
  const problems = content(page).locator('.nova-spell');
  await expect(problems).toHaveCount(3);
  await expect(problems.nth(0)).toHaveAttribute('aria-invalid', 'spelling');
  await expect(problems.nth(2)).toHaveAttribute('aria-invalid', 'grammar');
  await expect(content(page)).toHaveAttribute('spellcheck', 'false');
  await problems.filter({ hasText: 'recieve' }).click();
  const bubble = page.getByRole('dialog', { name: 'Spelling: recieve' });
  await expect(bubble).toContainText('Possible spelling mistake found.');
  await bubble.getByRole('button', { name: 'receive' }).click();
  await expect.poll(() => html(page)).toBe('<p>I receive teh letter.</p><p>Eat a apple.</p>');
  await expect(bubble).toBeHidden();
});

test('Alt+F7 goes from problem to problem; Enter takes the first correction', async ({ page }) => {
  await open(page, '<p>I recieve teh letter.</p><p>Eat a apple.</p>');
  await expect(content(page).locator('.nova-spell')).toHaveCount(3);
  await content(page).click();
  await page.keyboard.press('ControlOrMeta+Home');
  await page.keyboard.press('Alt+F7');
  await expect(page.getByRole('button', { name: 'receive' })).toBeFocused();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Alt+F7');
  await expect(page.getByRole('button', { name: 'the', exact: true })).toBeFocused();
  // Escape leaves this one as it is and goes back to the text; Alt+F7 then goes on to the next.
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.keyboard.press('Alt+F7');
  await expect(page.getByRole('dialog', { name: 'Grammar: a apple' })).toBeVisible();
  await page.keyboard.press('Enter');
  // After the last one, Alt+F7 starts again from the top: the skipped "teh".
  await page.keyboard.press('Alt+F7');
  await expect(page.getByRole('dialog', { name: 'Spelling: teh' })).toBeVisible();
  await page.keyboard.press('Enter');
  await expect.poll(() => html(page)).toBe('<p>I receive the letter.</p><p>Eat an apple.</p>');
});

test('Ignore all: the word is no longer marked anywhere', async ({ page }) => {
  await open(page, '<p>teh one</p><p>teh two</p>');
  await expect(content(page).locator('.nova-spell')).toHaveCount(2);
  await content(page).locator('.nova-spell').first().click();
  await page.getByRole('dialog').getByRole('button', { name: 'Ignore all' }).click();
  await expect(content(page).locator('.nova-spell')).toHaveCount(0);
});
