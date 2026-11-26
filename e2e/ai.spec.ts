import { expect, test, type Page } from '@playwright/test';

/**
 * Помощник ИИ в настоящих браузерах (песочница /?ai=1, демо-модель без сети): выделение → окно →
 * быстрое действие → ответ потоком → правки предложениями от «AI» → принять все.
 */

async function clickControl(page: Page, name: string) {
  const control = page.locator(`.nova-toolbar [data-control="${name}"]`).first();
  if (await control.isVisible()) return control.click();
  await page.locator('.nova-tb-more').click();
  await page.locator(`.nova-tb-overflow-popover [data-control="${name}"]`).click();
}

async function open(page: Page, html: string) {
  await page.goto('/?ai=1&lang=en');
  await page.evaluate(async (content) => {
    await window.editor.ready;
    window.editor.setContent(content);
  }, html);
}

test('«Короче»: удалённые слова — предложениями ИИ, «принять все» — готовый текст', async ({
  page,
}) => {
  await open(page, '<p>This is a very good text.</p>');
  await page.locator('.nova-prosemirror p').click();
  await page.keyboard.press('ControlOrMeta+a');
  await clickControl(page, 'aidialog');
  const dialog = page.getByRole('dialog', { name: 'AI assistant' });
  await dialog.getByRole('button', { name: 'Make shorter' }).click();
  await expect(dialog).toBeHidden();
  const removed = page.locator('.nova-prosemirror del[data-suggestion]');
  await expect(removed).toHaveText('very ');
  await expect(removed).toHaveAttribute('data-name', 'AI');
  await expect(page.locator('.nova-notification')).toContainText('AI suggested changes');

  await clickControl(page, 'reviewsuggestions');
  await page.getByRole('menuitem', { name: 'Accept all suggestions' }).click();
  await expect
    .poll(() => page.evaluate(() => window.editor.getHTML()))
    .toBe('<p>This is a good text.</p>');
});

test('свой запрос без выделения — продолжение у курсора; Esc отменяет запрос', async ({ page }) => {
  await open(page, '<p>Start.</p>');
  await page.locator('.nova-prosemirror p').click();
  await page.keyboard.press('End');
  await clickControl(page, 'aidialog');
  const dialog = page.getByRole('dialog', { name: 'AI assistant' });
  await expect(dialog.getByRole('button', { name: 'Improve writing' })).toBeDisabled();
  await dialog.getByRole('button', { name: 'Continue writing' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.locator('.nova-prosemirror ins[data-suggestion]')).toHaveText(
    ' This sentence was written by the demo model.',
  );

  // Отмена: Esc во время ответа — ничего не меняется.
  await page.evaluate(() => window.editor.setContent('<p>Keep.</p>'));
  await page.locator('.nova-prosemirror p').click();
  await page.keyboard.press('End');
  await clickControl(page, 'aidialog');
  await dialog.getByRole('textbox').fill('Write a long story');
  await dialog.getByRole('textbox').press('Enter');
  await expect(dialog.locator('.nova-ai-preview')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => window.editor.getHTML())).toBe('<p>Keep.</p>');
});
