import { expect, test, type Page } from '@playwright/test';

/**
 * Images are prepared in the browser before upload: a phone photo is scaled down, stands the right
 * way up, and loses what the camera wrote into it (the place it was taken). Decoding and encoding
 * are the browser's own, so this runs in every engine.
 */

test.skip(({ isMobile }) => isMobile, 'the same code as desktop Chrome');

/** A 4000×3000 JPEG with EXIF: orientation 6 (turned 90°) and a GPS latitude reference. */
async function cameraPhoto(page: Page): Promise<Buffer> {
  const bytes = await page.evaluate(async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 4000;
    canvas.height = 3000;
    const context = canvas.getContext('2d')!;
    const gradient = context.createLinearGradient(0, 0, 4000, 3000);
    gradient.addColorStop(0, '#1d4ed8');
    gradient.addColorStop(1, '#f59e0b');
    context.fillStyle = gradient;
    context.fillRect(0, 0, 4000, 3000);
    const jpeg = new Uint8Array(
      await (
        await new Promise<Blob>((done) => canvas.toBlob((b) => done(b!), 'image/jpeg', 0.9))
      ).arrayBuffer(),
    );
    // TIFF (little-endian): IFD0 with Orientation = 6 and a pointer to a GPS IFD with GPSLatitudeRef "N".
    const tiff = new Uint8Array(54);
    const view = new DataView(tiff.buffer);
    tiff.set([0x49, 0x49, 0x2a, 0x00]);
    view.setUint32(4, 8, true);
    view.setUint16(8, 2, true);
    view.setUint16(10, 0x0112, true); // Orientation
    view.setUint16(12, 3, true); // SHORT
    view.setUint32(14, 1, true);
    view.setUint16(18, 6, true);
    view.setUint16(22, 0x8825, true); // GPS IFD pointer
    view.setUint16(24, 4, true); // LONG
    view.setUint32(26, 1, true);
    view.setUint32(30, 38, true);
    view.setUint32(34, 0, true);
    view.setUint16(38, 1, true);
    view.setUint16(40, 0x0001, true); // GPSLatitudeRef
    view.setUint16(42, 2, true); // ASCII
    view.setUint32(44, 2, true);
    tiff.set([0x4e, 0x00], 48);
    view.setUint32(50, 0, true);
    const exif = new Uint8Array([0x45, 0x78, 0x69, 0x66, 0, 0, ...tiff]);
    const segment = new Uint8Array([
      0xff,
      0xe1,
      (exif.length + 2) >> 8,
      (exif.length + 2) & 0xff,
      ...exif,
    ]);
    return [...jpeg.subarray(0, 2), ...segment, ...jpeg.subarray(2)];
  });
  return Buffer.from(bytes);
}

/** Inserts a file through the image dialog and returns what the editor uploaded. */
async function upload(page: Page, name: string, mimeType: string, buffer: Buffer) {
  await page.locator('.nova-prosemirror').click();
  const control = page.locator('.nova-toolbar [data-control="image"]').first();
  if (await control.isVisible()) await control.click();
  else {
    await page.locator('.nova-tb-more').click();
    await page.locator('.nova-tb-overflow-popover [data-control="image"]').click();
  }
  const dialog = page.getByRole('dialog', { name: 'Insert image' });
  await dialog.locator('input[type="file"]').setInputFiles({ name, mimeType, buffer });
  await expect
    .poll(() =>
      page.evaluate(() => (window as unknown as { uploads?: File[] }).uploads?.length ?? 0),
    )
    .toBe(1);
  return page.evaluate(async () => {
    const file = (window as unknown as { uploads: File[] }).uploads[0]!;
    const bytes = new Uint8Array(await file.arrayBuffer());
    const bitmap = await createImageBitmap(file);
    const text = String.fromCharCode(...bytes.subarray(0, 4096));
    return {
      name: file.name,
      type: file.type,
      size: file.size,
      width: bitmap.width,
      height: bitmap.height,
      exif: text.includes('Exif'),
    };
  });
}

async function open(page: Page, query: string) {
  await page.goto(`/?lang=en&upload=inspect${query}`);
  await page.evaluate(async () => {
    const editor = (
      window as unknown as {
        editor: { ready: Promise<void>; setContent(h: string, o: object): void };
      }
    ).editor;
    await editor.ready;
    editor.setContent('<p>text</p>', { addToHistory: false });
  });
}

test('a phone photo is scaled to 2560 pixels, stands upright and loses its camera metadata', async ({
  page,
}) => {
  await open(page, '');
  const photo = await cameraPhoto(page);
  const sent = await upload(page, 'IMG_0001.jpg', 'image/jpeg', photo);
  // Stored 4000×3000, turned 90° by the camera: 3000×4000 upright, then fitted within 2560.
  expect(sent).toMatchObject({
    name: 'IMG_0001.jpg',
    type: 'image/jpeg',
    width: 1920,
    height: 2560,
    exif: false,
  });
  expect(sent.size).toBeLessThan(photo.length);
});

test('a small PNG without metadata goes as it is', async ({ page }) => {
  await open(page, '');
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  );
  const sent = await upload(page, 'dot.png', 'image/png', png);
  expect(sent).toMatchObject({
    name: 'dot.png',
    type: 'image/png',
    size: png.length,
    width: 1,
    height: 1,
  });
});

test('imageOptimize: false sends the file as it is', async ({ page }) => {
  await open(page, '&original');
  const photo = await cameraPhoto(page);
  const sent = await upload(page, 'IMG_0002.jpg', 'image/jpeg', photo);
  expect(sent).toMatchObject({ size: photo.length, exif: true });
});
