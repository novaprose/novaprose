import { expect, test } from '@playwright/test';

/** The resize handle and the disabled editor in real browsers (jsdom doesn't compute layout). */

test('the resize handle: dragging changes the height, and so does an arrow key', async ({
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
  // The statusbar text isn't selected while dragging.
  expect(await page.evaluate(() => String(window.getSelection()).includes('words'))).toBe(false);
});

test("a disabled editor doesn't take input and is skipped by Tab", async ({ page }) => {
  await page.goto('/?lang=en&disabled=1');
  const text = page.locator('.nova-prosemirror');
  const before = await text.textContent();
  await text.click({ force: true });
  await page.keyboard.type('xyz');
  expect(await text.textContent()).toBe(before);
  await expect(page.locator('.nova-editor').first()).toHaveAttribute('aria-disabled', 'true');
  await expect(text).toHaveAttribute('tabindex', '-1');
});

test('content styles: a file with @import and a string apply only to the editor text', async ({
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
  // The page around the editor isn't affected.
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

test('the "Styles" menu: a custom format applies, the class is in the HTML, the content style shows', async ({
  page,
}) => {
  await page.goto('/?lang=en&styles=1');
  await page.evaluate(async () => {
    const editor = (
      window as unknown as {
        editor: { ready: Promise<void>; setContent(h: string, o: object): void };
      }
    ).editor;
    await editor.ready;
    editor.setContent('<p>first</p><p>second</p>', { addToHistory: false });
  });
  // A click on the word itself (as a person would), not into the middle of a wide paragraph.
  await page
    .locator('.nova-prosemirror p', { hasText: 'second' })
    .click({ position: { x: 8, y: 8 } });
  const styles = page.locator('[data-control="styles"]');
  await styles.click();
  // No image selected: the format for images is unavailable.
  await expect(page.locator('.nova-menu-item', { hasText: 'Image left' })).toBeDisabled();
  await page.locator('.nova-menu-item', { hasText: 'Note' }).click();
  await expect(styles).toContainText('Note');
  const html = await page.evaluate(() =>
    (window as unknown as { editor: { getHTML(): string } }).editor.getHTML(),
  );
  expect(html).toBe('<p>first</p><p class="note">second</p>');
  await expect(page.locator('.nova-prosemirror p.note')).toHaveCSS('border-left-style', 'solid');
});

test('variables: inserting from the menu, a "chip" is deleted whole with one key', async ({
  page,
}) => {
  await page.goto('/?lang=en&mergetags=1');
  const html = () =>
    page.evaluate(() => (window as unknown as { editor: { getHTML(): string } }).editor.getHTML());
  await page.evaluate(async () => {
    const editor = (
      window as unknown as {
        editor: { ready: Promise<void>; setContent(h: string, o: object): void };
      }
    ).editor;
    await editor.ready;
    editor.setContent('<p>Order</p>', { addToHistory: false });
  });
  await page.locator('.nova-prosemirror p').click({ position: { x: 4, y: 8 } });
  await page.keyboard.press('End');
  await page.keyboard.type(' ');
  await page.locator('[data-control="mergetags"]').click();
  await page.locator('.nova-menu-item', { hasText: 'Order number' }).click();
  expect(await html()).toBe(
    '<p>Order <span data-mergetag="orderId" contenteditable="false">Order number</span></p>',
  );
  await expect(page.locator('.nova-mergetag')).toHaveText('Order number');
  await page.keyboard.press('Backspace');
  expect(await html()).toBe('<p>Order&nbsp;</p>');
});

test("a variable at the end of a paragraph doesn't add an empty line, even with img { display: block } on the site", async ({
  page,
}) => {
  await page.goto('/?lang=en&mergetags=1');
  await page.addStyleTag({ content: 'img, svg, canvas { display: block; max-width: 100%; }' });
  await page.evaluate(async () => {
    const editor = (
      window as unknown as {
        editor: { ready: Promise<void>; setContent(h: string, o: object): void };
      }
    ).editor;
    await editor.ready;
    editor.setContent('<p>a</p><p>Order <span data-mergetag="orderId">x</span></p>', {
      addToHistory: false,
    });
  });
  const [plain, withTag] = await page
    .locator('.nova-prosemirror p')
    .evaluateAll((ps) => ps.map((p) => p.getBoundingClientRect().height));
  expect(withTag).toBeLessThan(plain! * 1.5);
});
