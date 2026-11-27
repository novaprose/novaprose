import { expect, test, type Page } from '@playwright/test';

/**
 * Email preview in real browsers (the /?email=1 playground): the content as an email client shows it,
 * styles inline in a sandboxed frame, on a desktop or a phone screen, with its size.
 */

async function clickControl(page: Page, name: string) {
  const control = page.locator(`.nova-toolbar [data-control="${name}"]`).first();
  if (await control.isVisible()) return control.click();
  await page.locator('.nova-tb-more').click();
  await page.locator(`.nova-tb-overflow-popover [data-control="${name}"]`).click();
}

test('the content as an email: styles inline, a phone view, the size', async ({ page }) => {
  await page.goto('/?email=1&lang=en');
  await page.evaluate(async () => {
    await window.editor.ready;
    window.editor.setContent(
      '<h2>News</h2><p>Hello <a href="/pricing">prices</a></p>' +
        '<table><tbody><tr><th><p>Plan</p></th><td><p>Free</p></td></tr></tbody></table>',
    );
  });
  await clickControl(page, 'emailpreview');
  const dialog = page.getByRole('dialog', { name: 'Email preview' });
  await expect(dialog.getByRole('status')).toHaveText(/^Size: \d+\.\d KB$/);
  const email = page.frameLocator('iframe.nova-email-frame');
  // Each element carries its styles: email clients ignore style sheets.
  await expect(email.locator('h2')).toHaveAttribute('style', /font-size: 24px/);
  await expect(email.locator('td').filter({ hasText: /^Free$/ })).toHaveAttribute(
    'style',
    /border: 1px solid #afb8c1/,
  );
  // Links become absolute: the email is read away from this page.
  await expect(email.locator('a')).toHaveAttribute('href', /^http.*\/pricing$/);
  const frame = dialog.locator('iframe.nova-email-frame');
  const desktop = (await frame.boundingBox())!.width;
  await dialog.getByRole('radio', { name: 'Phone' }).check();
  // On a phone the window is narrower than a phone screen already.
  if (desktop > 400)
    await expect.poll(async () => (await frame.boundingBox())!.width).toBeLessThan(desktop);
  await expect.poll(async () => (await frame.boundingBox())!.width).toBeLessThanOrEqual(375);
  // Escape closes the window after a click in it, in Safari too (it doesn't focus a clicked radio).
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
});
