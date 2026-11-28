import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/**
 * Icon packs (?icons=tabler|phosphor) and skins (?skin=rounded|square|compact) in a real browser:
 * a pack draws the whole interface at one size, the icons of every toolbar row stand on one line,
 * a skin changes shapes and sizes and nothing else, and axe finds nothing in either theme.
 */

declare global {
  interface Window {
    editor: { ready: Promise<void>; setContent(html: string): void };
  }
}

const CONTENT =
  '<h2>Heading</h2><p>Text <strong>bold</strong> and <a href="https://example.com">a link</a>.</p>' +
  '<ul><li><p>item</p></li></ul>';

async function open(page: Page, query: string) {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`/?lang=en&${query}`);
  // As in a11y.spec.ts: wait for the playground to put its editor on window (until then
  // window.editor is the #editor element), and say what the page reported if it never comes.
  await page
    .waitForFunction(
      () =>
        typeof (window as unknown as { editor?: { setContent?: unknown } }).editor?.setContent ===
        'function',
      null,
      { timeout: 15_000 },
    )
    .catch(() => {
      throw new Error(`the playground has no editor: ${errors.join('; ') || 'no page errors'}`);
    });
  await page.evaluate(async (html) => {
    await window.editor.ready;
    window.editor.setContent(html);
  }, CONTENT);
}

/**
 * The icons of a toolbar (the main one, or the "more" panel), row by row: how far the vertical
 * centers of one row are apart, and every drawn size.
 */
async function iconRows(page: Page, selector: string) {
  return page
    .locator(selector)
    .first()
    .evaluate((toolbar) => {
      const boxes = [
        ...toolbar.querySelectorAll<SVGElement>('.nova-btn > .nova-icon:not(.nova-chevron) svg'),
      ]
        .map((svg) => svg.getBoundingClientRect())
        .filter((box) => box.width > 0 && box.height > 0)
        .sort((a, b) => a.top - b.top);
      const rows: DOMRect[][] = [];
      for (const box of boxes) {
        const row = rows.at(-1);
        if (row && box.top - row[0]!.top < 12) row.push(box);
        else rows.push([box]);
      }
      return {
        count: boxes.length,
        spread: Math.max(
          0,
          ...rows.map((row) => {
            const centers = row.map((box) => box.top + box.height / 2);
            return Math.max(...centers) - Math.min(...centers);
          }),
        ),
        sizes: [
          ...new Set(boxes.map((box) => `${Math.round(box.width)}x${Math.round(box.height)}`)),
        ],
      };
    });
}

const viewBox = (page: Page, selector: string) =>
  page
    .locator(selector)
    .first()
    .evaluate((el) => el.querySelector('svg')?.getAttribute('viewBox'));

for (const icons of ['', 'tabler', 'phosphor']) {
  for (const skin of ['', 'compact']) {
    test(`toolbar icons stand on one line: ${icons || 'built-in'} icons, ${skin || 'base'} skin`, async ({
      page,
      isMobile,
    }) => {
      await open(page, `icons=${icons}&skin=${skin}`);
      const size = skin === 'compact' ? 16 : 18;
      const main = await iconRows(page, '.nova-toolbar');
      expect(main.count).toBeGreaterThanOrEqual(3);
      expect(main.spread).toBeLessThanOrEqual(1);
      expect(main.sizes).toEqual([`${size}x${size}`]);
      const undo = await page.locator('.nova-toolbar [data-control="undo"]').boundingBox();
      expect(Math.round(undo!.height)).toBe(isMobile ? 40 : skin === 'compact' ? 28 : 32);

      // What doesn't fit waits behind "more": its rows line up the same way.
      const more = page.locator('.nova-tb-more');
      if (await more.isVisible()) {
        await more.click();
        const panel = await iconRows(page, '.nova-tb-overflow-popover');
        expect(panel.count).toBeGreaterThan(3);
        expect(panel.spread).toBeLessThanOrEqual(1);
        expect(panel.sizes).toEqual([`${size}x${size}`]);
      }
    });
  }
}

test('a pack draws the whole interface: buttons, arrows, "more", dialogs', async ({ page }) => {
  await open(page, 'icons=phosphor');
  expect(await viewBox(page, '.nova-toolbar [data-control="undo"]')).toBe('0 0 256 256');
  expect(await viewBox(page, '.nova-tb-more')).toBe('0 0 256 256');
  expect(await viewBox(page, '.nova-toolbar .nova-chevron')).toBe('0 0 256 256');
  await page.locator('.nova-prosemirror').click();
  await page.keyboard.press('ControlOrMeta+k');
  await expect(page.locator('.nova-dialog')).toBeVisible();
  expect(await viewBox(page, '.nova-dialog-close')).toBe('0 0 256 256');

  await open(page, '');
  expect(await viewBox(page, '.nova-toolbar [data-control="undo"]')).toBe('0 0 24 24');

  // An icon drawn larger (24 px, as many packs are) takes the editor's icon size.
  await page.evaluate(() => {
    const editor = window.editor as unknown as {
      ui: { registry: { addIcon(name: string, svg: string): void } };
      rebuildToolbar(): void;
    };
    editor.ui.registry.addIcon(
      'undo',
      '<svg width="24" height="24" viewBox="0 0 24 24"><path d="M4 4h16v16H4z"/></svg>',
    );
    editor.rebuildToolbar();
  });
  const box = await page.locator('.nova-toolbar [data-control="undo"] svg').boundingBox();
  expect([Math.round(box!.width), Math.round(box!.height)]).toEqual([18, 18]);
});

test('skins change shapes: square corners, round controls', async ({ page }) => {
  const radius = (selector: string) =>
    page
      .locator(selector)
      .first()
      .evaluate((el) => getComputedStyle(el).borderTopLeftRadius);
  await open(page, 'skin=square');
  expect(await radius('.nova-editor')).toBe('0px');
  expect(await radius('.nova-toolbar [data-control="undo"]')).toBe('0px');
  await open(page, 'skin=rounded');
  expect(await radius('.nova-editor')).toBe('14px');
  expect(parseFloat(await radius('.nova-toolbar [data-control="undo"]'))).toBeGreaterThanOrEqual(
    16,
  );
  await open(page, '');
  expect(await radius('.nova-editor')).toBe('8px');
});

test.describe('axe', () => {
  test.skip(
    ({ browserName, isMobile }) => browserName !== 'chromium' || isMobile,
    'axe runs in Chromium only',
  );
  for (const [icons, skin] of [
    ['phosphor', 'rounded'],
    ['tabler', 'square'],
    ['', 'compact'],
  ] as const) {
    for (const theme of ['light', 'dark'] as const) {
      test(`${icons || 'built-in'} icons, ${skin} skin, ${theme}`, async ({ page }) => {
        await open(page, `icons=${icons}&skin=${skin}`);
        await page.evaluate((t) => (document.documentElement.dataset.theme = t), theme);
        await page.locator('.nova-prosemirror').click();
        const result = await new AxeBuilder({ page })
          .include('.nova-editor')
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
          .analyze();
        expect(result.violations.map((v) => `${v.id}: ${v.nodes[0]?.target.join(' ')}`)).toEqual(
          [],
        );
      });
    }
  }
});
