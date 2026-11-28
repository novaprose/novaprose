import { expect, test, type Page } from '@playwright/test';

/** Parity plugins in real browsers: keyboard input, panels, autocomplete. */

const html = (page: Page) =>
  page.evaluate(() => (window as unknown as { editor: { getHTML(): string } }).editor.getHTML());

async function open(page: Page) {
  await page.goto('/?lang=en&parity=1');
  await page.evaluate(async () => {
    const editor = (
      window as unknown as {
        editor: { ready: Promise<void>; setContent(h: string, o: object): void };
      }
    ).editor;
    await editor.ready;
    editor.setContent('<p></p>', { addToHistory: false });
  });
  await page.locator('.nova-prosemirror').click();
}

/** The toolbar button: on the panel or in "⋯". */
async function clickControl(page: Page, name: string) {
  const control = page.locator(`.nova-toolbar [data-control="${name}"]`).first();
  if (await control.isVisible()) return control.click();
  await page.locator('.nova-tb-more').click();
  await page.locator(`.nova-tb-overflow-popover [data-control="${name}"]`).click();
}

test("autolink: an address becomes a link while typing, the period doesn't", async ({ page }) => {
  await open(page);
  await page.keyboard.type('See https://novaprose.com. Thanks');
  expect(await html(page)).toBe(
    '<p>See <a href="https://novaprose.com">https://novaprose.com</a>. Thanks</p>',
  );
});

test('charmap: search, arrows and Enter insert a character', async ({ page }) => {
  await open(page);
  await page.keyboard.type('Price 5');
  await clickControl(page, 'charmap');
  await page.keyboard.type('euro');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  expect(await html(page)).toBe('<p>Price 5€</p>');
});

test('emoticons: ":smi" and Enter insert an emoji', async ({ page }) => {
  await open(page);
  await page.keyboard.type('Hi :smi');
  await expect(page.getByRole('listbox')).toBeVisible();
  await page.keyboard.press('Enter');
  expect(await html(page)).toMatch(/^<p>Hi (😄|😀|😃|😁|😅|🙂)<\/p>$/u);
});

test('nonbreaking: Ctrl/Cmd+Shift+Space', async ({ page }) => {
  await open(page);
  await page.keyboard.type('100');
  await page.keyboard.press('ControlOrMeta+Shift+Space');
  await page.keyboard.type('kg');
  expect(await html(page)).toBe('<p>100&nbsp;kg</p>');
});

test('media: a video from a YouTube link, a click on the player selects the block', async ({
  page,
}) => {
  await open(page);
  await clickControl(page, 'media');
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Video URL').fill('https://youtu.be/dQw4w9WgXcQ');
  await dialog.getByLabel('Title (for screen readers)').fill('Launch');
  await dialog.getByRole('button', { name: 'Insert' }).click();
  expect(await html(page)).toContain(
    '<iframe src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ" width="560" height="315" title="Launch"',
  );
  await page.locator('.nova-media-overlay').click();
  await expect(page.locator('.nova-media.ProseMirror-selectednode')).toBeVisible();
  // Delete removes the selected video.
  await page.keyboard.press('Delete');
  expect(await html(page)).not.toContain('<iframe');
});

test('pageembed: a page at full width, a click selects it, the dialog changes its size', async ({
  page,
}) => {
  await open(page);
  await clickControl(page, 'pageembed');
  const dialog = page.getByRole('dialog');
  const address = new URL('/embed-demo.html', page.url()).href;
  await dialog.getByLabel('Page address').fill(address);
  await dialog.getByLabel('Title (for screen readers)').fill('Demo page');
  await dialog.getByRole('button', { name: 'Insert' }).click();
  await expect(dialog).toBeHidden();
  expect(await html(page)).toContain(`<iframe src="${address}" title="Demo page" sandbox=`);
  // The page shows in its frame, which fills the width at 16:9.
  const frame = page.locator('.nova-pageembed-view iframe');
  await expect(
    page
      .frameLocator('.nova-pageembed-view iframe')
      .getByRole('heading', { name: 'An embedded page' }),
  ).toBeVisible();
  const box = (await frame.boundingBox())!;
  expect(Math.round((box.width / box.height) * 9)).toBe(16);
  // A click on it selects the block (a layer covers the frame); the button edits it.
  await page.locator('.nova-pageembed-view .nova-media-overlay').click();
  await expect(page.locator('.nova-pageembed-view.ProseMirror-selectednode')).toBeVisible();
  await clickControl(page, 'pageembed');
  await expect(dialog.getByLabel('Page address')).toHaveValue(address);
  await dialog.getByLabel('Size').selectOption({ label: 'Fixed size' });
  await dialog.getByLabel('Width, px').fill('300');
  await dialog.getByLabel('Height, px').fill('200');
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(dialog).toBeHidden();
  expect(await html(page)).toContain('width="300" height="200"');
  // Delete removes the selected page.
  await page.locator('.nova-pageembed-view .nova-media-overlay').click();
  await page.keyboard.press('Delete');
  expect(await html(page)).not.toContain('<iframe');
});

test('anchor and pagebreak are inserted from the toolbar', async ({ page }) => {
  await open(page);
  await page.keyboard.type('Intro');
  await page.keyboard.press('Home');
  await clickControl(page, 'anchor');
  await page.getByRole('dialog').getByLabel('ID').fill('intro');
  await page.keyboard.press('Enter');
  await page.keyboard.press('End');
  await clickControl(page, 'pagebreak');
  expect(await html(page)).toBe(
    '<p><a id="intro"></a>Intro</p><div class="nova-pagebreak" style="break-after: page;"></div>',
  );
});

test('a narrow screen: a dialog opened from "⋯" closes the "⋯" panel', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await open(page);
  await page.locator('.nova-tb-more').click();
  await page.locator('.nova-tb-overflow-popover [data-control="media"]').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.locator('.nova-tb-overflow-popover')).toHaveCount(0);
});

test('advlist: the arrow by the list opens the styles, the main part toggles', async ({ page }) => {
  await open(page);
  await page.keyboard.type('step');
  await clickControl(page, 'numlist-options');
  await page.locator('.nova-popover-menu [role^="menuitem"]', { hasText: 'Lower alpha' }).click();
  expect(await html(page)).toBe(
    '<ol style="list-style-type: lower-alpha;"><li><p>step</p></li></ol>',
  );
  await clickControl(page, 'numlist');
  expect(await html(page)).toBe('<p>step</p>');
});

test('directionality: RTL for a paragraph', async ({ page }) => {
  await open(page);
  await page.keyboard.type('שלום');
  await clickControl(page, 'rtl');
  expect(await html(page)).toBe('<p dir="rtl">שלום</p>');
});
