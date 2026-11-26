import { expect, test, type Page } from '@playwright/test';

/**
 * Page mode (the pagelayout plugin) in real browsers, the pages.html playground (A5, 15 mm margins):
 * a sheet of exact size, page borders where printing will put them (Chromium compares with a PDF),
 * recounting when the sheet changes, a phone has no borders.
 */

const PX_PER_MM = 96 / 25.4;

interface PagesState {
  pages: number | null;
  width: number;
  breaks: Array<{ top: number; label: string | null }>;
  pagebreakNext: number;
  marginTop: number;
}

function state(page: Page): Promise<PagesState> {
  return page.evaluate(() => {
    const { controller, editor } = window.pagesDemo;
    const sheet = editor.view.dom.getBoundingClientRect();
    const next = editor.root.querySelector('.ProseMirror h2')!;
    return {
      pages: controller.pages,
      width: sheet.width,
      breaks: [...editor.root.querySelectorAll<HTMLElement>('.nova-page-break')].map((el) => ({
        top: el.getBoundingClientRect().top - sheet.top,
        label: el.textContent,
      })),
      pagebreakNext: next.getBoundingClientRect().top - sheet.top,
      marginTop: parseFloat(getComputedStyle(next).marginTop),
    };
  });
}

test.beforeEach(async ({ page }) => {
  await page.goto('/pages.html');
  await expect(page.locator('.nova-pages .ProseMirror')).toBeVisible();
});

test.describe('on a computer', () => {
  test.skip(({ isMobile }) => isMobile, 'on a phone the sheet is a regular input area');

  test('an A5 sheet of exact size; page borders with numbers', async ({ page }) => {
    await expect.poll(async () => (await state(page)).pages).toBeGreaterThanOrEqual(3);
    const s = await state(page);
    expect(Math.abs(s.width - 148 * PX_PER_MM)).toBeLessThan(1);
    expect(s.breaks).toHaveLength(s.pages! - 1);
    expect(s.breaks.map((b) => b.label)).toEqual(s.breaks.map((_, i) => `Page ${i + 2}`));
    await expect(page.locator('#count')).toHaveText(`Pages: ${s.pages}`);
  });

  test('a page break starts a new page', async ({ page }) => {
    await expect.poll(async () => (await state(page)).pages).toBeGreaterThanOrEqual(3);
    const s = await state(page);
    // The border is at the heading after the break (its top margin is kept after the break).
    const expected = s.pagebreakNext - s.marginTop;
    expect(s.breaks.some((b) => Math.abs(b.top - expected) < 2)).toBe(true);
  });

  test('changing the sheet and margins recounts the pages', async ({ page }) => {
    await expect.poll(async () => (await state(page)).pages).toBeGreaterThanOrEqual(3);
    const a5 = (await state(page)).pages!;
    const portrait = (await state(page)).breaks.map((b) => Math.round(b.top)).join();
    await page.locator('#size').selectOption('A4');
    await expect.poll(async () => (await state(page)).width).toBeCloseTo(210 * PX_PER_MM, 0);
    await expect.poll(async () => (await state(page)).pages).toBeLessThan(a5);
    // A5 landscape (210 mm) fits in the playground column: the sheet is exact, the pages are counted.
    await page.locator('#size').selectOption('A5');
    await page.locator('#orientation').selectOption('landscape');
    await expect.poll(async () => (await state(page)).width).toBeCloseTo(210 * PX_PER_MM, 0);
    // A different line width gives different borders (the number of pages depends on the system fonts).
    await expect
      .poll(async () => {
        const s = await state(page);
        return s.pages !== null && s.breaks.map((b) => Math.round(b.top)).join() !== portrait;
      })
      .toBe(true);
    // A4 landscape (297 mm) is wider than the column: the sheet narrows, lines wrap differently from print,
    // so no borders are drawn and the number of pages is unknown.
    await page.locator('#size').selectOption('A4');
    await expect.poll(async () => (await state(page)).pages).toBeNull();
    expect((await state(page)).breaks).toHaveLength(0);
  });

  test('printing breaks pages where the editor does (PDF)', async ({
    page,
    browserName,
    context,
  }) => {
    test.skip(browserName !== 'chromium', 'only Chromium can make a PDF');
    await expect.poll(async () => (await state(page)).pages).toBeGreaterThanOrEqual(3);
    const expected = (await state(page)).pages;
    await page.locator('#print').click();
    const handle = await page.waitForFunction(() => {
      const doc =
        document.querySelector<HTMLIFrameElement>('iframe[title="print"]')?.contentDocument;
      return doc?.querySelector('.nova-print') ? doc.documentElement.outerHTML : null;
    });
    const html = (await handle.jsonValue()) as string;
    expect(html).toContain('size: 148mm 210mm');
    const printed = await context.newPage();
    await printed.setContent(`<!doctype html>${html}`);
    await printed.evaluate(() => document.fonts.ready);
    const pdf = await printed.pdf({ preferCSSPageSize: true });
    const pages = pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g)?.length;
    expect(pages).toBe(expected);
  });
});

test('a phone: the sheet is a regular input area, no page borders', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'phones only');
  await page.waitForTimeout(300);
  const s = await state(page);
  expect(s.breaks).toHaveLength(0);
  expect(s.pages).toBeNull();
});
