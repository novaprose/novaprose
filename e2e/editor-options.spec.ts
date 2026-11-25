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

test('стили содержимого: файл с @import и строка действуют только на текст редактора', async ({
  page,
}) => {
  await page.goto('/?lang=en&contentcss=1');
  await page.evaluate(async () => {
    const editor = (
      window as unknown as {
        editor: { ready: Promise<void>; setContent(h: string, o: object): void };
      }
    ).editor;
    await editor.ready;
    editor.setContent('<h1>A</h1><h2>B</h2><p>C</p>', { addToHistory: false });
  });
  const text = page.locator('.nova-prosemirror');
  await expect(text).toHaveCSS('font-family', /Georgia/);
  await expect(text.locator('h1')).toHaveCSS('color', 'rgb(0, 0, 128)');
  await expect(text.locator('h2')).toHaveCSS('color', 'rgb(0, 128, 0)');
  await expect(text.locator('p')).toHaveCSS('color', 'rgb(200, 0, 0)');
  // Страница вокруг редактора не задета.
  const outside = await page.evaluate(() => {
    const p = document.createElement('p');
    p.textContent = 'outside';
    document.body.append(p);
    const style = getComputedStyle(p);
    return { color: style.color, font: getComputedStyle(document.body).fontFamily };
  });
  expect(outside.color).not.toBe('rgb(200, 0, 0)');
  expect(outside.font).not.toMatch(/Georgia/);
});
