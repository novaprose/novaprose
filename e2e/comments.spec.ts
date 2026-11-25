import { expect, test, type Page } from '@playwright/test';

/** Комментарии в настоящих браузерах: выделение мышью, панель, горячая клавиша, узкий экран. */

type Win = {
  editor: { ready: Promise<void>; setContent(h: string, o: object): void; getHTML(): string };
};
const html = (page: Page) => page.evaluate(() => (window as unknown as Win).editor.getHTML());
const content = (page: Page) => page.locator('.nova-prosemirror');
const panel = (page: Page) => page.locator('.nova-comments');

async function open(page: Page, initial: string) {
  await page.goto('/?lang=en&comments=1');
  await page.evaluate(async (value) => {
    const { editor } = window as unknown as Win;
    await editor.ready;
    editor.setContent(value, { addToHistory: false });
  }, initial);
}

/** Двойной клик по первому слову абзаца (getByText нашёл бы весь абзац и кликнул в середину). */
const selectFirstWord = (page: Page) =>
  content(page)
    .locator('p')
    .first()
    .dblclick({ position: { x: 6, y: 8 } });

/** Кнопка тулбара — на панели или в «⋯». */
async function clickControl(page: Page, name: string) {
  const control = page.locator(`.nova-toolbar [data-control="${name}"]`).first();
  if (await control.isVisible()) return control.click();
  await page.locator('.nova-tb-more').click();
  await page.locator(`.nova-tb-overflow-popover [data-control="${name}"]`).click();
}

test('выделить слово → «Добавить комментарий» → ответ → решено', async ({ page }) => {
  await open(page, '<p>Budget for the next quarter</p>');
  await selectFirstWord(page);
  await clickControl(page, 'addcomment');
  const composer = panel(page).getByPlaceholder('Add a comment…');
  await expect(composer).toBeFocused();
  await composer.fill('Is this final?');
  await panel(page).getByRole('button', { name: 'Comment', exact: true }).click();

  await expect.poll(() => html(page)).toMatch(/^<p><span data-comment="t[a-z0-9]+">Budget<\/span>/);
  await expect(content(page).locator('.nova-comment')).toHaveText('Budget');
  const card = panel(page).locator('.nova-thread');
  await expect(card).toContainText('Is this final?');

  const reply = card.getByPlaceholder('Reply…');
  await reply.fill('Yes');
  await reply.press('ControlOrMeta+Enter');
  await expect(card.locator('.nova-comment-text')).toHaveText(['Is this final?', 'Yes']);

  await card.getByRole('button', { name: 'Resolve' }).click();
  await expect(content(page).locator('.nova-comment')).toHaveCount(0);
  await expect(panel(page).locator('.nova-thread')).toHaveCount(0);
});

test('Ctrl/Cmd+Alt+M комментирует выделение, Esc отменяет и возвращает в текст', async ({
  page,
}) => {
  await open(page, '<p>Shortcut test</p>');
  await selectFirstWord(page);
  await page.keyboard.press('ControlOrMeta+Alt+m');
  const composer = panel(page).getByPlaceholder('Add a comment…');
  await expect(composer).toBeFocused();
  await expect(content(page).locator('.nova-comment.is-pending')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(content(page).locator('.nova-comment')).toHaveCount(0);
  await expect(content(page)).toBeFocused();
});

test('клик по прокомментированному тексту показывает его обсуждение', async ({ page }) => {
  await open(page, '<p>One two three</p>');
  await selectFirstWord(page);
  await clickControl(page, 'addcomment');
  await panel(page).getByPlaceholder('Add a comment…').fill('About this');
  await panel(page).getByPlaceholder('Add a comment…').press('ControlOrMeta+Enter');
  await clickControl(page, 'showcomments');
  // На узком экране кнопка в «⋯»: закрываем меню, чтобы оно не перекрывало текст.
  if (await page.locator('.nova-tb-overflow-popover').isVisible())
    await page.keyboard.press('Escape');
  await expect(panel(page)).toBeHidden();

  await content(page).locator('.nova-comment').click();
  await expect(panel(page)).toBeVisible();
  await expect(panel(page).locator('.nova-thread.is-active')).toContainText('About this');
});

test('на узком экране панель под текстом во всю ширину', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'раскладка для телефона');
  await open(page, '<p>Mobile comment</p>');
  await selectFirstWord(page);
  await clickControl(page, 'addcomment');
  await expect(panel(page)).toBeVisible();
  const text = (await page.locator('.nova-content').boundingBox())!;
  const side = (await panel(page).boundingBox())!;
  expect(side.y).toBeGreaterThanOrEqual(text.y + text.height - 1);
  expect(side.width).toBeGreaterThan(text.width - 2);
});
