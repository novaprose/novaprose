import { expect, test, type Page } from '@playwright/test';

/** Autocorrect in real browsers, typed with the keyboard (?autocorrect=1). */

type Win = {
  editor: {
    ready: Promise<void>;
    setContent(h: string, o?: object): void;
    getHTML(): string;
    focus(): void;
  };
};
const html = (page: Page) => page.evaluate(() => (window as unknown as Win).editor.getHTML());
const content = (page: Page) => page.locator('.nova-prosemirror');

async function open(page: Page, initial = '<p></p>') {
  await page.goto('/?lang=en&autocorrect=1');
  await page.evaluate(async (value) => {
    localStorage.removeItem('novaprose-autocorrect');
    const { editor } = window as unknown as Win;
    await editor.ready;
    editor.setContent(value, { addToHistory: false });
  }, initial);
  await content(page).click();
  await page.keyboard.press('ControlOrMeta+End');
}

/** Back to the end of the text, with the toolbar's ⋯ closed if a control was in it. */
async function backToText(page: Page) {
  if (await page.locator('.nova-tb-overflow-popover').isVisible())
    await page.locator('.nova-tb-more').click();
  await page.evaluate(() => (window as unknown as Win).editor.focus());
  await page.keyboard.press('ControlOrMeta+End');
}

async function clickControl(page: Page, name: string) {
  const control = page.locator(`.nova-toolbar [data-control="${name}"]`).first();
  if (await control.isVisible()) return control.click();
  const overflow = page.locator('.nova-tb-overflow-popover');
  if (!(await overflow.isVisible())) await page.locator('.nova-tb-more').click();
  await overflow.locator(`[data-control="${name}"]`).click();
}

test('a typo is corrected when the word ends; Backspace right after puts it back', async ({
  page,
}) => {
  await open(page);
  await page.keyboard.type('I saw teh cat and i ');
  await expect.poll(() => html(page)).toBe('<p>I saw the cat and I&nbsp;</p>');
  await page.keyboard.type('waht ');
  await expect(content(page).locator('.nova-autocorrected')).toHaveText('what');
  await page.keyboard.press('Backspace');
  await expect.poll(() => html(page)).toBe('<p>I saw the cat and I waht&nbsp;</p>');
  await expect(content(page).locator('.nova-autocorrected')).toHaveCount(0);
  // Taken back once, the word is left alone after that.
  await page.keyboard.type('and waht.');
  await expect.poll(() => html(page)).toBe('<p>I saw the cat and I waht and waht.</p>');
});

test('Ctrl+Z right after a correction undoes only the correction; Enter ends a word', async ({
  page,
}) => {
  await open(page);
  await page.keyboard.type('Thier dog ');
  await expect.poll(() => html(page)).toBe('<p>Their dog&nbsp;</p>');
  await page.keyboard.type('teh');
  await page.keyboard.press('Enter');
  await expect.poll(() => html(page)).toBe('<p>Their dog the</p><p></p>');
  await page.keyboard.press('ControlOrMeta+z');
  await page.keyboard.press('ControlOrMeta+z');
  await expect.poll(() => html(page)).toBe('<p>Their dog teh</p>');
});

test('the button turns it off; its menu turns on capitals at the start of sentences', async ({
  page,
}) => {
  await open(page);
  await clickControl(page, 'autocorrect');
  await backToText(page);
  await page.keyboard.type('teh ');
  await expect.poll(() => html(page)).toBe('<p>teh&nbsp;</p>');
  await clickControl(page, 'autocorrect-options');
  await page.getByRole('menuitemcheckbox', { name: 'Correct typos as you type' }).click();
  await clickControl(page, 'autocorrect-options');
  await page
    .getByRole('menuitemcheckbox', { name: 'Capitalize the first letter of sentences' })
    .click();
  await backToText(page);
  await page.keyboard.type('end. so teh end ');
  await expect.poll(() => html(page)).toBe('<p>teh end. So the end&nbsp;</p>');
  // The choice is remembered for the next time.
  await page.reload();
  await page.evaluate(() => (window as unknown as Win).editor.ready);
  await clickControl(page, 'autocorrect-options');
  await expect(
    page.getByRole('menuitemcheckbox', { name: 'Capitalize the first letter of sentences' }),
  ).toHaveAttribute('aria-checked', 'true');
});

test('code is left as typed: inline code and code blocks', async ({ page }) => {
  await open(page, '<pre><code>x</code></pre>');
  await page.keyboard.type(' teh --help ');
  await expect.poll(() => html(page)).toBe('<pre><code>x teh --help </code></pre>');
});
