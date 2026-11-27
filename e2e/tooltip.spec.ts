import { expect, test } from '@playwright/test';

/** Tooltips as WCAG 1.4.13 asks: the pointer can rest on one, Escape dismisses it. */

test.skip(
  ({ isMobile }) => isMobile,
  'no hover on touch screens (there the name is in aria-label)',
);

test('a tooltip stays while the pointer is on it; Escape dismisses it, focus stays', async ({
  page,
}) => {
  await page.goto('/?lang=en');
  await page.evaluate(
    () => (window as unknown as { editor: { ready: Promise<void> } }).editor.ready,
  );
  await page.locator('.nova-prosemirror').click();
  const bold = page.locator('.nova-toolbar [data-control="bold"]').first();
  await bold.hover();
  const tip = page.locator('.nova-tooltip');
  await expect(tip).toBeVisible();
  await expect(tip).toContainText('Bold');
  const box = (await tip.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 4 });
  await page.waitForTimeout(500);
  await expect(tip).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(tip).toBeHidden();
  await expect(page.locator('.nova-prosemirror')).toBeFocused();
});
