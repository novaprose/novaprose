import { expect, test } from '@playwright/test';

/** Ручка размера и отключённый редактор в настоящих браузерах (jsdom не считает вёрстку). */

test('ручка размера: перетаскивание меняет высоту, стрелка с клавиатуры — тоже', async ({
  page,
}) => {
  await page.goto('/?lang=en&resize=1');
  const root = page.locator('.nova-editor').first();
  const handle = page.getByRole('separator', { name: 'Resize editor' });
  await handle.scrollIntoViewIfNeeded();
  const before = (await root.boundingBox())!.height;
  const box = (await handle.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 - 120, { steps: 4 });
  await page.mouse.up();
  const dragged = (await root.boundingBox())!.height;
  expect(dragged).toBeLessThan(before - 100);
  await handle.focus();
  await page.keyboard.press('ArrowDown');
  expect((await root.boundingBox())!.height).toBeCloseTo(dragged + 20, 0);
  // Текст статусбара при перетаскивании не выделяется.
  expect(await page.evaluate(() => String(window.getSelection()).includes('words'))).toBe(false);
});

test('отключённый редактор: не принимает ввод и пропускается по Tab', async ({ page }) => {
  await page.goto('/?lang=en&disabled=1');
  const text = page.locator('.nova-prosemirror');
  const before = await text.textContent();
  await text.click({ force: true });
  await page.keyboard.type('xyz');
  expect(await text.textContent()).toBe(before);
  await expect(page.locator('.nova-editor').first()).toHaveAttribute('aria-disabled', 'true');
  await expect(text).toHaveAttribute('tabindex', '-1');
});
