import { expect, test, type Page } from '@playwright/test';

/** Upload adapters in real browsers: an image goes to signed storage, the document shows it from there. */

// 1×1 PNG
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

const html = (page: Page) =>
  page.evaluate(() => (window as unknown as { editor: { getHTML(): string } }).editor.getHTML());

test('signedUpload: the image is PUT to the signed address and shown from the storage', async ({
  page,
  browserName,
}) => {
  const received: { method: string; type: string | null; url: string; size: number }[] = [];
  await page.route('https://storage.example.test/**', async (route) => {
    const request = route.request();
    if (request.method() === 'OPTIONS') {
      // The browser's CORS check before a PUT with Content-Type.
      return route.fulfill({
        status: 204,
        headers: {
          'access-control-allow-origin': '*',
          'access-control-allow-methods': 'PUT, GET',
          'access-control-allow-headers': 'content-type',
        },
      });
    }
    if (request.method() === 'PUT') {
      received.push({
        method: request.method(),
        type: request.headers()['content-type'] ?? null,
        url: request.url(),
        size: request.postDataBuffer()?.length ?? 0,
      });
      return route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*' } });
    }
    // The uploaded image, shown from the storage.
    return route.fulfill({ status: 200, contentType: 'image/png', body: PNG });
  });

  await page.goto('/?lang=en&upload=s3');
  await page.evaluate(async () => {
    const editor = (
      window as unknown as {
        editor: { ready: Promise<void>; setContent(h: string, o: object): void };
      }
    ).editor;
    await editor.ready;
    editor.setContent('<p>text</p>', { addToHistory: false });
  });
  await page.locator('.nova-prosemirror').click();
  const control = page.locator('.nova-toolbar [data-control="image"]').first();
  if (await control.isVisible()) await control.click();
  else {
    await page.locator('.nova-tb-more').click();
    await page.locator('.nova-tb-overflow-popover [data-control="image"]').click();
  }
  const dialog = page.getByRole('dialog', { name: 'Insert image' });
  await dialog
    .locator('input[type="file"]')
    .setInputFiles({ name: 'dot.png', mimeType: 'image/png', buffer: PNG });
  await expect(dialog).toBeHidden();
  await expect
    .poll(() => html(page))
    .toContain('<img src="https://storage.example.test/images/dot.png"');
  expect(received).toEqual([
    {
      method: 'PUT',
      type: 'image/png',
      url: 'https://storage.example.test/images/dot.png?X-Amz-Signature=demo',
      // Playwright doesn't show WebKit's file bodies to a route: the size is checked elsewhere.
      size: browserName === 'webkit' ? expect.any(Number) : PNG.length,
    },
  ]);
});
