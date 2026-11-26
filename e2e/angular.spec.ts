import { expect, test, type Page } from '@playwright/test';

/** The Angular wrapper in a real browser: Reactive Forms and ngModel (the angular.html page, zoneless). */

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

test('Reactive Forms: typing changes the value, dirty; leaving the field, touched', async ({
  page,
}) => {
  await expect(page.getByTestId('dirty')).toHaveText('false');
  await typeAtEnd(page, 'form', ' More text');
  await expect(page.getByTestId('value')).toContainText('More text');
  await expect(page.getByTestId('dirty')).toHaveText('true');
  await expect(page.getByTestId('touched')).toHaveText('false');
  await page.getByRole('button', { name: 'Submit' }).focus();
  await expect(page.getByTestId('touched')).toHaveText('true');
  await page.getByRole('button', { name: 'Submit' }).click();
  await expect(page.getByTestId('submitted')).toContainText('More text');
});

test('Reactive Forms: the validator blocks submitting empty text', async ({ page }) => {
  await formEditor(page).click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.press('Delete');
  await expect(page.getByTestId('valid')).toHaveText('false');
  await expect(page.getByRole('button', { name: 'Submit' })).toBeDisabled();
  await page.keyboard.type('Text');
  await expect(page.getByTestId('valid')).toHaveText('true');
});

test('Reactive Forms: reset() brings back the text without dirty and without undo', async ({
  page,
}) => {
  await typeAtEnd(page, 'form', ' marker');
  await page.getByRole('button', { name: 'Reset' }).click();
  await expect(formEditor(page)).not.toContainText('marker');
  await expect(page.getByTestId('dirty')).toHaveText('false');
  await formEditor(page).click();
  await page.keyboard.press('ControlOrMeta+z');
  await expect(formEditor(page)).not.toContainText('marker');
});

test('Reactive Forms: disable() turns the editor off', async ({ page }) => {
  await page.getByRole('button', { name: 'Disable' }).click();
  await expect(formEditor(page)).toHaveAttribute('contenteditable', 'false');
  await page.getByRole('button', { name: 'Enable' }).click();
  await expect(formEditor(page)).toHaveAttribute('contenteditable', 'true');
});

test('ngModel: typing updates the model', async ({ page }) => {
  await typeAtEnd(page, '[data-testid="ngmodel"]', ' and typing');
  await expect(page.getByTestId('ngmodel-value')).toContainText('and typing');
});
