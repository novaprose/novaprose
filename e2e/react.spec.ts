import { expect, test, type Page } from '@playwright/test';

/**
 * The React wrapper in a real browser (the react.html page runs in StrictMode).
 * Checks what jsdom can't see: keyboard input, focus when pressing custom buttons, submitting the form.
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

test("StrictMode doesn't create extra editors", async ({ page }) => {
  await expect(page.locator('.nova-editor')).toHaveCount(3);
});

test('a form: typing reaches the controlled value and FormData', async ({ page }) => {
  await typeAtEnd(page, 'form', ' More text');
  await expect(page.getByTestId('value')).toContainText('More text');
  await page.getByRole('button', { name: 'Submit' }).click();
  await expect(page.getByTestId('submitted')).toContainText('More text');
});

test("a form: resetting the value from outside doesn't call onChange", async ({ page }) => {
  await typeAtEnd(page, 'form', ' marker');
  const changes = Number(await page.getByTestId('changes').textContent());
  expect(changes).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Reset' }).click();
  await expect(page.locator('form .ProseMirror')).not.toContainText('marker');
  await expect(page.getByTestId('changes')).toHaveText(String(changes));
  // Undo after the reset doesn't bring back the old text: the reset isn't in the history.
  await page.locator('form .ProseMirror').click();
  await page.keyboard.press('ControlOrMeta+z');
  await expect(page.locator('form .ProseMirror')).not.toContainText('marker');
});

test('headless: custom buttons on useCommand reflect and change the format', async ({ page }) => {
  const root = '[data-testid="headless"]';
  const bold = page.locator('[data-command="bold"]');
  await expect(bold).toHaveAttribute('aria-pressed', 'false');

  await typeAtEnd(page, root, ' bold');
  await page.keyboard.press('Shift+ControlOrMeta+ArrowLeft');
  await bold.click();
  await expect(page.locator(`${root} strong`)).toHaveText('bold');
  await expect(bold).toHaveAttribute('aria-pressed', 'true');

  // Focus stayed in the editor: typing continues.
  await page.keyboard.press('End');
  await page.keyboard.type('!');
  await expect(page.locator(`${root} .ProseMirror`)).toContainText('bold!');

  await page.locator('[data-command="h2"]').click();
  await expect(page.locator(`${root} h2`)).toBeVisible();
  await expect(page.locator('[data-command="h2"]')).toHaveAttribute('aria-pressed', 'true');
});

test('headless: useEditorState recounts the words and undo availability', async ({ page }) => {
  const undo = page
    .getByRole('toolbar', { name: 'Custom toolbar' })
    .getByRole('button', { name: 'Undo' });
  await expect(undo).toBeDisabled();
  const before = Number(await page.getByTestId('words').textContent());
  await typeAtEnd(page, '[data-testid="headless"]', ' one two');
  await expect(page.getByTestId('words')).toHaveText(String(before + 2));
  await expect(undo).toBeEnabled();
});
