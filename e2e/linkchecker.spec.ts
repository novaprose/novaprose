import { expect, test, type Page } from '@playwright/test';

/** The link checker in real browsers (?linkcheck=1: addresses with "broken" in them don't answer). */

type Win = {
  editor: {
    ready: Promise<void>;
    setContent(h: string, o?: object): void;
    getHTML(): string;
  };
};

const CONTENT =
  '<p>See <a href="https://example.com/broken">the old page</a> and ' +
  '<a href="https://example.com/fine">the new one</a>.</p>';

async function open(page: Page, initial = CONTENT) {
  await page.goto('/?lang=en&linkcheck=1');
  await page.evaluate(async (value) => {
    const { editor } = window as unknown as Win;
    await editor.ready;
    editor.setContent(value, { addToHistory: false });
  }, initial);
}

async function clickControl(page: Page, name: string) {
  const control = page.locator(`.nova-toolbar [data-control="${name}"]`).first();
  if (await control.isVisible()) return control.click();
  const overflow = page.locator('.nova-tb-overflow-popover');
  if (!(await overflow.isVisible())) await page.locator('.nova-tb-more').click();
  await overflow.locator(`[data-control="${name}"]`).click();
}

test('a broken link gets a wavy underline; its bubble says so, and Ignore takes it away', async ({
  page,
}) => {
  await open(page);
  const broken = page.locator('.nova-link-broken');
  await expect(broken).toHaveText('the old page');
  await expect(broken).toHaveAttribute('aria-invalid', 'true');
  // The underline is the danger color's wavy line, not the link's own straight one.
  expect(await broken.evaluate((el) => getComputedStyle(el).textDecorationStyle)).toBe('wavy');
  expect(await broken.evaluate((el) => getComputedStyle(el.closest('a')!).textDecorationLine)).toBe(
    'none',
  );
  await broken.click();
  const note = page.locator('.nova-bubble-note');
  await expect(note).toBeVisible();
  await expect(note).toContainText('This link seems broken');
  await note.getByRole('button', { name: 'Ignore' }).click();
  await expect(broken).toHaveCount(0);
  await expect(note).toBeHidden();
  // The working link never had a note, and the document itself is unchanged.
  await page.locator('.nova-prosemirror').getByText('the new one').click();
  await expect(page.locator('.nova-bubble:has(.nova-bubble-link)')).toBeVisible();
  await expect(note).toBeHidden();
  expect(await page.evaluate(() => (window as unknown as Win).editor.getHTML())).toBe(CONTENT);
});

test('the button turns checking off and on; a new link is checked after a change', async ({
  page,
}) => {
  await open(page);
  await expect(page.locator('.nova-link-broken')).toHaveCount(1);
  await clickControl(page, 'linkchecker');
  await expect(page.locator('.nova-link-broken')).toHaveCount(0);
  await clickControl(page, 'linkchecker');
  await expect(page.locator('.nova-link-broken')).toHaveCount(1);
  await page.evaluate(() =>
    (window as unknown as Win).editor.setContent(
      '<p><a href="https://example.com/broken-too">another</a></p>',
    ),
  );
  await expect(page.locator('.nova-link-broken')).toHaveText('another');
});
