import { expect, test, type Page } from '@playwright/test';

/**
 * <novaprose-editor> как поле нативной формы — в настоящих браузерах (jsdom не умеет
 * ElementInternals.setFormValue и валидацию форм).
 */

const editable = (page: Page) => page.locator('#body .ProseMirror');

async function typeAtEnd(page: Page, text: string) {
  await editable(page).click();
  await page.keyboard.press('ControlOrMeta+End');
  await page.keyboard.type(text);
}

async function submitted(page: Page): Promise<Record<string, string>> {
  await page.getByRole('button', { name: 'Отправить' }).click();
  return JSON.parse((await page.locator('#submitted').textContent()) || '{}');
}

test.beforeEach(async ({ page }) => {
  await page.goto('/element.html');
  await expect(editable(page)).toBeVisible();
});

test('разметка внутри тега стала содержимым и уходит в FormData', async ({ page }) => {
  await expect(page.locator('#body strong')).toHaveText('начальное содержимое');
  const data = await submitted(page);
  expect(data.title).toBe('Черновик');
  expect(data.body).toBe('<p>Разметка внутри тега — <strong>начальное содержимое</strong>.</p>');
});

test('ввод: событие input сразу, change — при уходе фокуса, FormData актуальна', async ({
  page,
}) => {
  await typeAtEnd(page, ' Ещё');
  await expect(page.locator('#inputs')).not.toHaveText('0');
  await expect(page.locator('#changes')).toHaveText('0');
  await page.locator('#title').click();
  await expect(page.locator('#changes')).toHaveText('1');
  expect((await submitted(page)).body).toContain('Ещё');
});

test('кнопка reset возвращает исходное содержимое', async ({ page }) => {
  await typeAtEnd(page, ' мусор');
  await page.getByRole('button', { name: 'Сбросить' }).click();
  await expect(editable(page)).not.toContainText('мусор');
  expect((await submitted(page)).body).not.toContain('мусор');
});

test('required: пустой редактор не даёт отправить форму', async ({ page }) => {
  await editable(page).click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.press('Delete');
  await page.getByRole('button', { name: 'Отправить' }).click();
  await expect(page.locator('#submitted')).toHaveText('');
  const valid = await page
    .locator('#body')
    .evaluate((el) => (el as HTMLFormElement & { checkValidity(): boolean }).checkValidity());
  expect(valid).toBe(false);
  // Браузер переводит фокус на невалидное поле — в текст редактора (anchor в setValidity).
  await expect(editable(page)).toBeFocused();
  // Регрессия WebKit: пузырь подсказки, привязанный к contenteditable, съедал ввод после первой буквы.
  await page.waitForTimeout(300);
  await page.keyboard.type('Текст');
  await expect(editable(page)).toHaveText('Текст');
  // Подсказка Firefox может ещё висеть над кнопкой — отправляем форму напрямую.
  await page.locator('#form').evaluate((form) => (form as HTMLFormElement).requestSubmit());
  expect(JSON.parse((await page.locator('#submitted').textContent()) || '{}').body).toBe(
    '<p>Текст</p>',
  );
});

test('fieldset disabled выключает редактор и убирает поле из FormData', async ({ page }) => {
  await page.locator('#disable').check();
  await expect(editable(page)).toHaveAttribute('contenteditable', 'false');
  const data = await submitted(page);
  expect(data.body).toBeUndefined();
  await page.locator('#disable').uncheck();
  await expect(editable(page)).toHaveAttribute('contenteditable', 'true');
});
