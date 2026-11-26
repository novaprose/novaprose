import { expect, test } from '@playwright/test';

/** tinymce.init() on top of NovaProse in real browsers: typing, buttons, a plugin, a form. */

test('a TinyMCE config works: typing, bold, a custom plugin, submitting the form', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/tinymce.html');
  await expect(page.locator('#events')).toContainText('callback');
  await expect(page.locator('#body')).toBeHidden();

  const content = page.locator('.nova-prosemirror');
  await content.click();
  await page.keyboard.press('ControlOrMeta+End');
  await page.keyboard.press('Enter');
  await page.keyboard.type('Faster ');
  await page.keyboard.press('ControlOrMeta+b');
  await page.keyboard.type('paste');
  await expect(page.locator('#events')).toContainText('input');

  // The button from PluginManager.add: on the panel or in "⋯".
  const signature = page.locator('.nova-toolbar [data-control="signature"]').first();
  if (await signature.isVisible()) await signature.click();
  else {
    await page.locator('.nova-tb-more').click();
    await page.locator('.nova-tb-overflow-popover [data-control="signature"]').click();
  }

  await page.getByRole('button', { name: 'Save' }).click();
  const submitted = page.locator('#submitted');
  await expect(submitted).toContainText('<p>Faster <strong>paste</strong></p>');
  await expect(submitted).toContainText('— The NovaProse team');
  // content_style was applied (nested CSS in the browser).
  expect(await content.evaluate((el) => getComputedStyle(el).fontSize)).toBe('16px');
  expect(errors).toEqual([]);
});

test('the dialog of a custom plugin (windowManager.open): typing, a choice, Enter inserts', async ({
  page,
}) => {
  await page.goto('/tinymce.html');
  await expect(page.locator('#events')).toContainText('callback');
  await page.locator('.nova-prosemirror').click();
  await page.keyboard.press('ControlOrMeta+End');
  const button = page.locator('.nova-toolbar [data-control="callout"]').first();
  if (await button.isVisible()) await button.click();
  else {
    await page.locator('.nova-tb-more').click();
    await page.locator('.nova-tb-overflow-popover [data-control="callout"]').click();
  }
  const dialog = page.getByRole('dialog', { name: 'Insert callout' });
  await expect(dialog.getByLabel('Text')).toBeFocused();
  await page.keyboard.type('Back up first <now>');
  await dialog.getByLabel('Kind').selectOption('Warning');
  await dialog.getByLabel('Text').press('Enter');
  await expect(dialog).toBeHidden();
  const html = await page.evaluate(() =>
    (
      window as unknown as { tinymce: { activeEditor: { getContent(): string } } }
    ).tinymce.activeEditor.getContent(),
  );
  expect(html).toContain(
    '<blockquote><p><strong>Warning:</strong> Back up first &lt;now&gt;</p></blockquote>',
  );
});
