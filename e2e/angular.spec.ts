import { expect, test, type Page } from '@playwright/test';

/** Angular-обёртка в настоящем браузере: Reactive Forms и ngModel (страница angular.html, zoneless). */

const formEditor = (page: Page) => page.locator('form .ProseMirror');

async function typeAtEnd(page: Page, root: string, text: string) {
  await page.locator(`${root} .ProseMirror`).click();
  await page.keyboard.press('ControlOrMeta+End');
  await page.keyboard.type(text);
}

test.beforeEach(async ({ page }) => {
  await page.goto('/angular.html');
  await expect(page.locator('.nova-editor')).toHaveCount(2);
});

test('Reactive Forms: ввод меняет значение, dirty; уход фокуса — touched', async ({ page }) => {
  await expect(page.getByTestId('dirty')).toHaveText('false');
  await typeAtEnd(page, 'form', ' Ещё текст');
  await expect(page.getByTestId('value')).toContainText('Ещё текст');
  await expect(page.getByTestId('dirty')).toHaveText('true');
  await expect(page.getByTestId('touched')).toHaveText('false');
  await page.getByRole('button', { name: 'Отправить' }).focus();
  await expect(page.getByTestId('touched')).toHaveText('true');
  await page.getByRole('button', { name: 'Отправить' }).click();
  await expect(page.getByTestId('submitted')).toContainText('Ещё текст');
});

test('Reactive Forms: валидатор блокирует отправку пустого текста', async ({ page }) => {
  await formEditor(page).click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.press('Delete');
  await expect(page.getByTestId('valid')).toHaveText('false');
  await expect(page.getByRole('button', { name: 'Отправить' })).toBeDisabled();
  await page.keyboard.type('Текст');
  await expect(page.getByTestId('valid')).toHaveText('true');
});

test('Reactive Forms: reset() возвращает текст без dirty и без undo', async ({ page }) => {
  await typeAtEnd(page, 'form', ' маркер');
  await page.getByRole('button', { name: 'Сбросить' }).click();
  await expect(formEditor(page)).not.toContainText('маркер');
  await expect(page.getByTestId('dirty')).toHaveText('false');
  await formEditor(page).click();
  await page.keyboard.press('ControlOrMeta+z');
  await expect(formEditor(page)).not.toContainText('маркер');
});

test('Reactive Forms: disable() выключает редактор', async ({ page }) => {
  await page.getByRole('button', { name: 'Выключить' }).click();
  await expect(formEditor(page)).toHaveAttribute('contenteditable', 'false');
  await page.getByRole('button', { name: 'Включить' }).click();
  await expect(formEditor(page)).toHaveAttribute('contenteditable', 'true');
});

test('ngModel: ввод обновляет модель', async ({ page }) => {
  await typeAtEnd(page, '[data-testid="ngmodel"]', ' и ввод');
  await expect(page.getByTestId('ngmodel-value')).toContainText('и ввод');
});
