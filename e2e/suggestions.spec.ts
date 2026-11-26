import { expect, test, type Page } from '@playwright/test';

/** Suggesting mode in real browsers: real keyboard input, accepting and rejecting. */

type Win = {
  editor: { ready: Promise<void>; setContent(h: string, o?: object): void; getHTML(): string };
};
/** HTML without random ids/times/authors. */
const html = (page: Page) =>
  page.evaluate(() =>
    (window as unknown as Win).editor
      .getHTML()
      .replace(/ data-(suggestion|time|author|name)="[^"]*"/g, ''),
  );
const content = (page: Page) => page.locator('.nova-prosemirror');

async function clickControl(page: Page, name: string) {
  const control = page.locator(`.nova-toolbar [data-control="${name}"]`).first();
  if (await control.isVisible()) return control.click();
  await page.locator('.nova-tb-more').click();
  await page.locator(`.nova-tb-overflow-popover [data-control="${name}"]`).click();
}

async function open(page: Page, initial: string) {
  await page.goto('/?lang=en&comments=1');
  await page.evaluate(async (value) => {
    const { editor } = window as unknown as Win;
    await editor.ready;
    editor.setContent(value, { addToHistory: false });
  }, initial);
  await content(page).click();
  await page.keyboard.press('ControlOrMeta+End');
}

test('typing, Backspace and Delete in suggesting mode; Ctrl+Alt+Shift+E toggles the mode', async ({
  page,
}) => {
  await open(page, '<p>Ship in May</p>');
  await page.keyboard.press('ControlOrMeta+Alt+Shift+e');
  await expect(content(page)).toHaveClass(/nova-suggesting/);
  for (let i = 0; i < 3; i += 1) await page.keyboard.press('Backspace');
  await page.keyboard.type('June');
  await expect.poll(() => html(page)).toBe('<p>Ship in <del>May</del><ins>June</ins></p>');
  await page.keyboard.press('Home');
  await page.keyboard.press('Delete');
  await expect
    .poll(() => html(page))
    .toBe('<p><del>S</del>hip in <del>May</del><ins>June</ins></p>');

  await page.keyboard.press('ControlOrMeta+Alt+Shift+e');
  await expect(content(page)).not.toHaveClass(/nova-suggesting/);
  await page.keyboard.press('ControlOrMeta+End');
  await page.keyboard.type('!');
  await expect
    .poll(() => html(page))
    .toBe('<p><del>S</del>hip in <del>May</del><ins>June</ins>!</p>');
});

test('accept and reject: the buttons at a suggestion and "accept all" in the menu', async ({
  page,
}) => {
  await open(page, '<p>The quick fox</p>');
  await clickControl(page, 'suggestions');
  await page.keyboard.press('Escape');
  await content(page).click();
  await page.keyboard.press('ControlOrMeta+End');
  await page.keyboard.type(' jumps');
  // The cursor in a suggestion shows the "Accept / Reject" toolbar.
  await page.keyboard.press('ArrowLeft');
  const bar = page.getByRole('toolbar', { name: 'Suggestion' });
  await expect(bar).toBeVisible();
  await bar.getByRole('button', { name: 'Reject' }).click();
  await expect.poll(() => html(page)).toBe('<p>The quick fox</p>');

  await content(page).click();
  await page.keyboard.press('ControlOrMeta+End');
  await page.keyboard.type(' runs');
  await clickControl(page, 'reviewsuggestions');
  await page.getByRole('menuitem', { name: 'Accept all suggestions' }).click();
  await expect.poll(() => html(page)).toBe('<p>The quick fox runs</p>');
});
