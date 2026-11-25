import { expect, test, type Page } from '@playwright/test';

/**
 * React-обёртка в настоящем браузере (страница react.html работает в StrictMode).
 * Проверяем то, чего не видит jsdom: ввод с клавиатуры, фокус при нажатии своих кнопок, отправку формы.
 */

async function typeAtEnd(page: Page, root: string, text: string) {
  const editable = page.locator(`${root} .ProseMirror`);
  await editable.click();
  await page.keyboard.press('ControlOrMeta+End');
  await page.keyboard.type(text);
}

test.beforeEach(async ({ page }) => {
  await page.goto('/react.html');
  await expect(page.locator('[data-testid="headless"] .ProseMirror')).toBeVisible();
});

test('StrictMode не создаёт лишних редакторов', async ({ page }) => {
  await expect(page.locator('.nova-editor')).toHaveCount(2);
});

test('форма: ввод доходит до controlled value и FormData', async ({ page }) => {
  await typeAtEnd(page, 'form', ' Ещё текст');
  await expect(page.getByTestId('value')).toContainText('Ещё текст');
  await page.getByRole('button', { name: 'Отправить' }).click();
  await expect(page.getByTestId('submitted')).toContainText('Ещё текст');
});

test('форма: сброс value снаружи не вызывает onChange', async ({ page }) => {
  await typeAtEnd(page, 'form', ' маркер');
  const changes = Number(await page.getByTestId('changes').textContent());
  expect(changes).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Сбросить' }).click();
  await expect(page.locator('form .ProseMirror')).not.toContainText('маркер');
  await expect(page.getByTestId('changes')).toHaveText(String(changes));
  // Undo после сброса не возвращает старый текст: сброс не попадает в историю.
  await page.locator('form .ProseMirror').click();
  await page.keyboard.press('ControlOrMeta+z');
  await expect(page.locator('form .ProseMirror')).not.toContainText('маркер');
});

test('headless: свои кнопки на useCommand отражают и меняют формат', async ({ page }) => {
  const root = '[data-testid="headless"]';
  const bold = page.locator('[data-command="bold"]');
  await expect(bold).toHaveAttribute('aria-pressed', 'false');

  await typeAtEnd(page, root, ' жирный');
  await page.keyboard.press('Shift+ControlOrMeta+ArrowLeft');
  await bold.click();
  await expect(page.locator(`${root} strong`)).toHaveText('жирный');
  await expect(bold).toHaveAttribute('aria-pressed', 'true');

  // Фокус остался в редакторе — ввод продолжается.
  await page.keyboard.press('End');
  await page.keyboard.type('!');
  await expect(page.locator(`${root} .ProseMirror`)).toContainText('жирный!');

  await page.locator('[data-command="h2"]').click();
  await expect(page.locator(`${root} h2`)).toBeVisible();
  await expect(page.locator('[data-command="h2"]')).toHaveAttribute('aria-pressed', 'true');
});

test('headless: useEditorState пересчитывает слова и доступность undo', async ({ page }) => {
  const undo = page.getByRole('button', { name: 'Отменить' });
  await expect(undo).toBeDisabled();
  const before = Number(await page.getByTestId('words').textContent());
  await typeAtEnd(page, '[data-testid="headless"]', ' раз два');
  await expect(page.getByTestId('words')).toHaveText(String(before + 2));
  await expect(undo).toBeEnabled();
});
