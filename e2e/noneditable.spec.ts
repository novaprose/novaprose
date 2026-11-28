import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/**
 * Locked content in a real browser (the noneditable plugin, ?noneditable=1): a click or an arrow
 * key selects a locked piece, typing doesn't change it, Delete removes it whole; the parts opened
 * in it can be typed in.
 */

declare global {
  interface Window {
    editor: { ready: Promise<void>; setContent(html: string): void; getHTML(): string };
  }
}

async function open(page: Page, html: string) {
  await page.goto('/?lang=en&noneditable=1');
  await page.evaluate(async (content) => {
    await window.editor.ready;
    window.editor.setContent(content);
  }, html);
}

const html = (page: Page) => page.evaluate(() => window.editor.getHTML());

test('a click selects a locked block; typing leaves it, Delete removes it', async ({ page }) => {
  await open(page, '<p>Before</p><p class="mceNonEditable">Terms and conditions</p><p>After</p>');
  const locked = page.locator('.nova-prosemirror p.nova-locked');
  await locked.click();
  await expect(locked).toHaveClass(/ProseMirror-selectednode/);
  await page.keyboard.type('xyz');
  expect(await html(page)).toBe(
    '<p>Before</p><p class="mceNonEditable">Terms and conditions</p><p>After</p>',
  );
  // Elsewhere in it: the same spot again so soon would be a double click (it selects a word,
  // which may be copied but not deleted).
  await locked.click({ position: { x: 4, y: 4 } });
  await expect(locked).toHaveClass(/ProseMirror-selectednode/);
  await page.keyboard.press('Delete');
  expect(await html(page)).toBe('<p>Before</p><p>After</p>');
});

test.describe('with a keyboard', () => {
  // A phone without a keyboard has no arrow keys, and Android's Enter goes through the text,
  // which a selected block doesn't have.
  test.skip(({ isMobile }) => isMobile, 'keyboard navigation');

  test('Enter with a locked block selected starts a new paragraph after it', async ({ page }) => {
    await open(page, '<p>Before</p><p class="mceNonEditable">Terms</p><p>After</p>');
    await page.locator('.nova-prosemirror p.nova-locked').click();
    await page.keyboard.press('Enter');
    await page.keyboard.type('q');
    expect(await html(page)).toBe(
      '<p>Before</p><p class="mceNonEditable">Terms</p><p>q</p><p>After</p>',
    );
  });

  test('arrow keys and Backspace reach a locked block and select it', async ({ page }) => {
    await open(page, '<p>Above</p><p class="mceNonEditable">Locked</p><p>Below</p>');
    const locked = page.locator('.nova-prosemirror p.nova-locked');
    await page.locator('.nova-prosemirror p', { hasText: 'Above' }).click();
    await page.keyboard.press('End');
    await page.keyboard.press('ArrowDown');
    await expect(locked).toHaveClass(/ProseMirror-selectednode/);
    await page.locator('.nova-prosemirror p', { hasText: 'Below' }).click();
    await page.keyboard.press('Home');
    await expect(locked).not.toHaveClass(/ProseMirror-selectednode/);
    await page.keyboard.press('Backspace');
    await expect(locked).toHaveClass(/ProseMirror-selectednode/);
    // The text below didn't join the locked block.
    expect(await html(page)).toBe('<p>Above</p><p class="mceNonEditable">Locked</p><p>Below</p>');
  });
});

test('a word double-clicked in locked content can be copied, not deleted', async ({ page }) => {
  await open(page, '<p class="mceNonEditable">Terms and conditions</p><p>After</p>');
  await page.locator('.nova-prosemirror p.nova-locked').dblclick();
  await page.keyboard.press('Delete');
  await page.keyboard.press('Backspace');
  await page.keyboard.type('x');
  expect(await html(page)).toBe('<p class="mceNonEditable">Terms and conditions</p><p>After</p>');
});

test('a part opened inside locked content can be typed in, the rest stays', async ({ page }) => {
  await open(
    page,
    '<div class="mceNonEditable"><p>Dear customer,</p><div class="mceEditable"><p>Write here</p></div><p>Regards</p></div>',
  );
  const island = page.locator('.nova-prosemirror .nova-unlocked p');
  await island.click();
  await page.keyboard.press('End');
  await page.keyboard.type(': hello');
  await page.keyboard.press('Home');
  await page.keyboard.press('Backspace');
  expect(await html(page)).toBe(
    '<div class="mceNonEditable"><p>Dear customer,</p><div class="mceEditable"><p>Write here: hello</p></div><p>Regards</p></div>',
  );
});

test('a locked piece of text: typing around it works, it stays whole', async ({ page }) => {
  await open(page, '<p>Hello <span class="mceNonEditable">{{name}}</span> and welcome</p>');
  await page.locator('.nova-prosemirror p').click();
  await page.keyboard.press('End');
  await page.keyboard.type('!');
  await page.keyboard.press('Home');
  await page.keyboard.type('Oh, ');
  expect(await html(page)).toBe(
    '<p>Oh, Hello <span class="mceNonEditable">{{name}}</span> and welcome!</p>',
  );
  await page.locator('.nova-prosemirror span.nova-locked').click();
  await page.keyboard.type('x');
  expect(await html(page)).toContain('<span class="mceNonEditable">{{name}}</span>');
});

test.describe('axe', () => {
  test.skip(
    ({ browserName, isMobile }) => browserName !== 'chromium' || isMobile,
    'axe runs in Chromium only',
  );
  for (const theme of ['light', 'dark'] as const) {
    test(`locked content, selected and not (${theme})`, async ({ page }) => {
      await open(
        page,
        '<p>Text</p><div class="mceNonEditable"><p>Locked</p><div class="mceEditable"><p>Open</p></div></div><p>Hi <span class="mceNonEditable">{{x}}</span></p>',
      );
      await page.evaluate((t) => (document.documentElement.dataset.theme = t), theme);
      await page.locator('.nova-prosemirror div.nova-locked > p').first().click();
      const result = await new AxeBuilder({ page })
        .include('.nova-editor')
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .analyze();
      expect(result.violations.map((v) => `${v.id}: ${v.nodes[0]?.target.join(' ')}`)).toEqual([]);
    });
  }
});
