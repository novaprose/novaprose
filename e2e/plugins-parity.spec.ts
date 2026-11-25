import { expect, test, type Page } from '@playwright/test';

/** Плагины паритета в настоящих браузерах: ввод с клавиатуры, панели, автодополнение. */

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

/** Кнопка тулбара — на панели или в «⋯». */
async function clickControl(page: Page, name: string) {
  const control = page.locator(`.nova-toolbar [data-control="${name}"]`).first();
  if (await control.isVisible()) return control.click();
  await page.locator('.nova-tb-more').click();
  await page.locator(`.nova-tb-overflow-popover [data-control="${name}"]`).click();
}

test('autolink: адрес становится ссылкой при наборе, точка — нет', async ({ page }) => {
  await open(page);
  await page.keyboard.type('See https://novaprose.com. Thanks');
  expect(await html(page)).toBe(
    '<p>See <a href="https://novaprose.com">https://novaprose.com</a>. Thanks</p>',
  );
});

test('charmap: поиск, стрелки и Enter вставляют символ', async ({ page }) => {
  await open(page);
  await page.keyboard.type('Price 5');
  await clickControl(page, 'charmap');
  await page.keyboard.type('euro');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  expect(await html(page)).toBe('<p>Price 5€</p>');
});

test('emoticons: «:smi» и Enter вставляют эмодзи', async ({ page }) => {
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

test('media: видео по ссылке YouTube, клик по плееру выделяет блок', async ({ page }) => {
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
  // Delete удаляет выделенное видео.
  await page.keyboard.press('Delete');
  expect(await html(page)).not.toContain('<iframe');
});

test('anchor и pagebreak вставляются из тулбара', async ({ page }) => {
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

test('узкий экран: диалог, открытый из «⋯», закрывает панель «⋯»', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await open(page);
  await page.locator('.nova-tb-more').click();
  await page.locator('.nova-tb-overflow-popover [data-control="media"]').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.locator('.nova-tb-overflow-popover')).toHaveCount(0);
});

test('advlist: стрелка у списка открывает стили, основная часть — переключает', async ({
  page,
}) => {
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

test('directionality: RTL для абзаца', async ({ page }) => {
  await open(page);
  await page.keyboard.type('שלום');
  await clickControl(page, 'rtl');
  expect(await html(page)).toBe('<p dir="rtl">שלום</p>');
});
