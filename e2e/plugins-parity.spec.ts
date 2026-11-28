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

test('mediaembed: a link alone on its line becomes a card on Enter; undo, its toolbar, the dialog', async ({
  page,
}) => {
  await open(page);
  const address = 'https://example.com/blog/hello-world';
  await page.keyboard.type(address);
  await page.keyboard.press('Enter');
  const card = page.locator('.nova-card-view');
  await expect(card).toContainText('Hello world');
  await expect(card).toContainText('example.com');
  await expect(card.locator('img')).toHaveJSProperty('complete', true);
  // Its own undo step: the link comes back, the new line stays; redo brings the card back.
  await page.keyboard.press('ControlOrMeta+z');
  await expect(card).toHaveCount(0);
  expect(await html(page)).toMatch(
    /^<p>(<a href="[^"]+">)?https:\/\/example\.com\/blog\/hello-world(<\/a>)?<\/p><p><\/p>$/,
  );
  await page.keyboard.press('ControlOrMeta+Shift+z');
  await expect(card).toHaveCount(1);
  // The cursor is on the line after the card.
  await page.keyboard.type('After');
  expect(await html(page)).toMatch(
    /^<a class="nova-card" href="https:\/\/example\.com\/blog\/hello-world" rel="noopener noreferrer"[^>]*>.*<\/a><p>After<\/p>$/,
  );
  // A click selects the card; its toolbar turns it back into a link.
  await card.click();
  const toolbar = page.getByRole('toolbar', { name: 'Card' });
  await expect(toolbar).toBeVisible();
  await toolbar.getByRole('button', { name: 'Show as a link' }).click();
  expect(await html(page)).toBe(`<p><a href="${address}">${address}</a></p><p>After</p>`);
  // A page the service knows nothing about stays a link.
  await page.keyboard.press('ControlOrMeta+End');
  await page.keyboard.press('Enter');
  await page.keyboard.type('https://example.com/nothing');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  await expect(card).toHaveCount(0);
  expect(await html(page)).toContain('https://example.com/nothing');
  // The Video dialog takes any page.
  await clickControl(page, 'media');
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('any page');
  await dialog.getByLabel('Video URL').fill('https://example.com/docs/getting-started');
  await dialog.getByRole('button', { name: 'Insert' }).click();
  await expect(dialog).toBeHidden();
  await expect(card).toContainText('Getting started');
});

test('advtable: row numbers follow the rows; the Sort dialog sorts by a chosen column', async ({
  page,
}) => {
  await open(page);
  await page.evaluate(() =>
    (window as unknown as { editor: { setContent(h: string, o: object): void } }).editor.setContent(
      '<table><tbody><tr><th><p>Fruit</p></th><th><p>Price</p></th></tr>' +
        '<tr><td><p>Pear</p></td><td><p>3</p></td></tr>' +
        '<tr><td><p>Apple</p></td><td><p>12</p></td></tr>' +
        '<tr><td><p>Fig</p></td><td><p>7</p></td></tr></tbody></table>',
      { addToHistory: false },
    ),
  );
  const numbers = page.locator('.nova-prosemirror td[data-series]');
  await page.locator('.nova-prosemirror td').first().click();
  const bar = page.locator('.nova-context-toolbar');
  await bar.locator('[data-control="advtablerownumbering"]').click();
  await expect(numbers).toHaveText(['1', '2', '3']);
  // Tab in the last cell adds a row, and it gets its number.
  await page.locator('.nova-prosemirror td').last().click();
  await page.keyboard.press('Tab');
  await expect(numbers).toHaveText(['1', '2', '3', '4']);
  // Tab selects the next cell's text (the formatting bar shows then): a click puts the cursor back.
  await page.locator('.nova-prosemirror td', { hasText: 'Pear' }).click();
  await bar.locator('[data-control="advtablesort"]').click();
  await page.getByRole('menuitem', { name: 'Sort…' }).click();
  const dialog = page.getByRole('dialog', { name: 'Sort the table' });
  await dialog.getByLabel('Column', { exact: true }).selectOption({ label: 'Column 3: Price' });
  await dialog.getByLabel('Order').selectOption('desc');
  await dialog.getByRole('button', { name: 'Sort', exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(page.locator('.nova-prosemirror tr td:nth-child(2)')).toHaveText([
    'Apple',
    'Fig',
    'Pear',
    '',
  ]);
  await expect(numbers).toHaveText(['1', '2', '3', '4']);
});

test('advcode: the code editor colors HTML, finds with Ctrl+F, saves with the button', async ({
  page,
}) => {
  await open(page);
  await page.evaluate(() =>
    (window as unknown as { editor: { setContent(h: string, o: object): void } }).editor.setContent(
      '<h2>Title</h2><p>Text</p>',
      { addToHistory: false },
    ),
  );
  await clickControl(page, 'code');
  const dialog = page.getByRole('dialog', { name: 'Source code' });
  const code = dialog.locator('.cm-content');
  await expect(code).toContainText('<h2>Title</h2>');
  // A tag has a color of its own.
  const colors = await code.evaluate((el) => {
    const span = el.querySelector('.cm-line span')!;
    return [getComputedStyle(span).color, getComputedStyle(el).color];
  });
  expect(colors[0]).not.toBe(colors[1]);
  // Ctrl+F opens the search; Escape closes it, and the dialog stays open.
  await code.click();
  await page.keyboard.press('ControlOrMeta+f');
  const search = dialog.locator('.cm-search');
  await expect(search).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(search).toHaveCount(0);
  await expect(dialog).toBeVisible();
  // Before the end of the paragraph: " more".
  await code.click();
  await page.keyboard.press('ControlOrMeta+End');
  for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowLeft');
  await page.keyboard.type(' more');
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(dialog).toBeHidden();
  expect(await html(page)).toBe('<h2>Title</h2><p>Text more</p>');
});

test('editimage: rotating, flipping and cropping change the pixels; undo brings the image back', async ({
  page,
}) => {
  await open(page);
  await page.evaluate(() =>
    (window as unknown as { editor: { setContent(h: string, o: object): void } }).editor.setContent(
      '<p><img src="/edit-demo.png" alt="Halves"></p>',
      { addToHistory: false },
    ),
  );
  const img = page.locator('.nova-prosemirror img[alt="Halves"]');
  // The image's size and the colors at the top and the bottom of its middle column.
  const pixels = () =>
    page.evaluate(async () => {
      const image = document.querySelector<HTMLImageElement>(
        '.nova-prosemirror img[alt="Halves"]',
      )!;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(image, 0, 0);
      const at = (y: number) =>
        Array.from(ctx.getImageData(Math.floor(canvas.width / 2), y, 1, 1).data.slice(0, 3));
      return { size: [canvas.width, canvas.height], top: at(1), bottom: at(canvas.height - 2) };
    });
  const RED = [211, 47, 47];
  const BLUE = [21, 101, 192];
  const bar = page.locator('.nova-context-toolbar');
  // After an edit the image stays selected with its toolbar; a click on a selected image would
  // select around it instead (ProseMirror), so it is clicked only when its toolbar isn't there.
  const select = async () => {
    if (!(await bar.locator('[data-control="editimage"]').isVisible())) await img.click();
  };
  const act = async (name: string) => {
    const before = await img.getAttribute('src');
    await select();
    await bar.locator(`[data-control="${name}"]`).click();
    await expect(img).not.toHaveAttribute('src', before!);
    await expect(img).toHaveAttribute('src', /^data:image\/png;base64,/);
  };
  // Clockwise: the red left half goes to the top.
  await act('rotateright');
  expect(await pixels()).toEqual({ size: [20, 40], top: RED, bottom: BLUE });
  await act('flipv');
  expect(await pixels()).toEqual({ size: [20, 40], top: BLUE, bottom: RED });
  const flipped = await img.getAttribute('src');
  // The Edit image dialog: the top square only.
  await select();
  await bar.locator('[data-control="editimage"]').click();
  const dialog = page.getByRole('dialog', { name: 'Edit image' });
  const crop = dialog.getByRole('group', { name: 'Crop' });
  await crop.getByLabel('Height, px').fill('20');
  await crop.getByLabel('Height, px').blur();
  await dialog.getByRole('button', { name: 'Apply' }).click();
  await expect(dialog).toBeHidden();
  await expect(img).not.toHaveAttribute('src', flipped!);
  expect(await pixels()).toEqual({ size: [20, 20], top: BLUE, bottom: BLUE });
  // One step back: the image before the crop.
  await page.keyboard.press('ControlOrMeta+z');
  await expect(img).toHaveAttribute('src', flipped!);
});

test('editimage: when the edited image fails to upload, the original comes back', async ({
  page,
}) => {
  await page.goto('/?lang=en&parity=1&upload=fail');
  await page.evaluate(async () => {
    const editor = (
      window as unknown as {
        editor: { ready: Promise<void>; setContent(h: string, o: object): void };
      }
    ).editor;
    await editor.ready;
    editor.setContent('<p><img src="/edit-demo.png" alt="Halves"></p>', { addToHistory: false });
  });
  const img = page.locator('.nova-prosemirror img[alt="Halves"]');
  await img.click();
  await page.locator('.nova-context-toolbar [data-control="rotateright"]').click();
  // Shown at once (a local copy) while it uploads…
  await expect(img).toHaveAttribute('src', /^blob:/);
  // …and the upload fails: the original is back, and the reason is said.
  await expect(page.getByText('The edited image couldn’t be saved.')).toBeVisible();
  await expect(img).toHaveAttribute('src', '/edit-demo.png');
});

test("views: a view takes the editor's place; Escape brings the text back", async ({ page }) => {
  await open(page);
  type Win = {
    editor: { setContent(h: string, o: object): void; ui: { view: { toggle(n: string): void } } };
  };
  await page.evaluate(() => {
    const { editor } = window as unknown as Win;
    editor.setContent('<h2>Plan</h2><p>Three short words</p>', { addToHistory: false });
    editor.ui.view.toggle('report');
  });
  const view = page.getByRole('region', { name: 'Report' });
  await expect(view).toBeVisible();
  await expect(view).toContainText('4 words, 1 headings');
  // The editor's own parts are out of sight while the view is open.
  await expect(page.locator('.nova-prosemirror')).toBeHidden();
  await expect(page.locator('.nova-header')).toBeHidden();
  await expect(view.getByRole('button', { name: 'Back to the text' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(view).toBeHidden();
  await expect(page.locator('.nova-prosemirror')).toBeVisible();
  await expect(page.locator('.nova-prosemirror')).toBeFocused();
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
