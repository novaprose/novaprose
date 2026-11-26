import { expect, test, type Page } from '@playwright/test';

/**
 * <novaprose-editor> as a native form field, in real browsers (jsdom has no
 * ElementInternals.setFormValue and no form validation).
 */

const editable = (page: Page) => page.locator('#body .ProseMirror');

async function typeAtEnd(page: Page, text: string) {
  await editable(page).click();
  await page.keyboard.press('ControlOrMeta+End');
  await page.keyboard.type(text);
}

async function submitted(page: Page): Promise<Record<string, string>> {
  await page.getByRole('button', { name: 'Submit' }).click();
  return JSON.parse((await page.locator('#submitted').textContent()) || '{}');
}

test.beforeEach(async ({ page }) => {
  await page.goto('/element.html');
  await expect(editable(page)).toBeVisible();
});

test('the markup inside the tag became the content and goes into FormData', async ({ page }) => {
  await expect(page.locator('#body strong')).toHaveText('initial content');
  const data = await submitted(page);
  expect(data.title).toBe('Draft');
  expect(data.body).toBe(
    '<p>The markup inside the tag is the <strong>initial content</strong>.</p>',
  );
});

test('typing: the input event right away, change when focus leaves, FormData is current', async ({
  page,
}) => {
  await typeAtEnd(page, ' More');
  await expect(page.locator('#inputs')).not.toHaveText('0');
  await expect(page.locator('#changes')).toHaveText('0');
  await page.locator('#title').click();
  await expect(page.locator('#changes')).toHaveText('1');
  expect((await submitted(page)).body).toContain('More');
});

test('the reset button brings back the original content', async ({ page }) => {
  await typeAtEnd(page, ' junk');
  await page.getByRole('button', { name: 'Reset' }).click();
  await expect(editable(page)).not.toContainText('junk');
  expect((await submitted(page)).body).not.toContain('junk');
});

test("required: an empty editor doesn't let the form submit", async ({ page }) => {
  await editable(page).click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.press('Delete');
  await page.getByRole('button', { name: 'Submit' }).click();
  await expect(page.locator('#submitted')).toHaveText('');
  const valid = await page
    .locator('#body')
    .evaluate((el) => (el as HTMLFormElement & { checkValidity(): boolean }).checkValidity());
  expect(valid).toBe(false);
  // The browser moves focus to the invalid field: into the editor text (the anchor in setValidity).
  await expect(editable(page)).toBeFocused();
  // A WebKit regression: the hint bubble anchored to contenteditable swallowed input after the first letter.
  await page.waitForTimeout(300);
  await page.keyboard.type('Text');
  await expect(editable(page)).toHaveText('Text');
  // A Firefox hint may still hang over the button: submit the form directly.
  await page.locator('#form').evaluate((form) => (form as HTMLFormElement).requestSubmit());
  expect(JSON.parse((await page.locator('#submitted').textContent()) || '{}').body).toBe(
    '<p>Text</p>',
  );
});

test('fieldset disabled turns the editor off and removes the field from FormData', async ({
  page,
}) => {
  await page.locator('#disable').check();
  await expect(editable(page)).toHaveAttribute('contenteditable', 'false');
  const data = await submitted(page);
  expect(data.body).toBeUndefined();
  await page.locator('#disable').uncheck();
  await expect(editable(page)).toHaveAttribute('contenteditable', 'true');
});
