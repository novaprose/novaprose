import { readFile } from 'node:fs/promises';
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

async function clickControl(page: Page, name: string) {
  const control = page.locator(`.nova-toolbar [data-control="${name}"]`).first();
  if (await control.isVisible()) return control.click();
  await page.locator('.nova-tb-more').click();
  await page.locator(`.nova-tb-overflow-popover [data-control="${name}"]`).click();
}

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

  test('the header and footer on the sheet, with the first and the last page number', async ({
    page,
  }) => {
    await expect.poll(async () => (await state(page)).pages).toBeGreaterThanOrEqual(3);
    const pages = (await state(page)).pages!;
    const bands = await page.evaluate(() => {
      const { editor } = window.pagesDemo;
      const sheet = editor.view.dom.getBoundingClientRect();
      const band = (selector: string) => {
        const el = editor.root.querySelector<HTMLElement>(selector);
        if (!el) return null;
        const rect = el.getBoundingClientRect();
        return {
          parts: [...el.children].map((part) => part.textContent),
          middle: (rect.top + rect.bottom) / 2 - sheet.top,
          sheetHeight: sheet.height,
        };
      };
      return { header: band('.nova-page-header'), footer: band('.nova-page-footer') };
    });
    expect(bands.header?.parts).toEqual(['NovaProse', '', 'Pages playground']);
    expect(bands.footer?.parts).toEqual(['', `Page ${pages} of ${pages}`, '']);
    // In the middle of the 15 mm margins, where printing puts them.
    expect(Math.abs(bands.header!.middle - 7.5 * PX_PER_MM)).toBeLessThan(3);
    expect(
      Math.abs(bands.footer!.sheetHeight - bands.footer!.middle - 7.5 * PX_PER_MM),
    ).toBeLessThan(3);
  });

  test('Export to PDF: the print document goes to the server, the PDF downloads with the same pages', async ({
    page,
    browserName,
    context,
  }) => {
    test.skip(browserName !== 'chromium', 'only Chromium can make a PDF');
    await expect.poll(async () => (await state(page)).pages).toBeGreaterThanOrEqual(3);
    const expected = (await state(page)).pages;
    // The "server": headless Chromium renders the print document, as a real PDF server does.
    let html = '';
    await page.exposeFunction('renderPdf', async (documentHtml: string) => {
      html = documentHtml;
      const printed = await context.newPage();
      await printed.setContent(documentHtml);
      await printed.evaluate(() => document.fonts.ready);
      const pdf = await printed.pdf({ preferCSSPageSize: true, printBackground: true });
      await printed.close();
      return pdf.toString('base64');
    });
    await page.evaluate(() => {
      const server = window as unknown as { renderPdf(html: string): Promise<string> };
      window.pagesDemo.pdf = async (request) =>
        Uint8Array.from(atob(await server.renderPdf(request.html)), (ch) => ch.charCodeAt(0));
    });
    const download = page.waitForEvent('download');
    await clickControl(page, 'exportpdf');
    const file = await download;
    expect(file.suggestedFilename()).toBe('pages.pdf');
    const bytes = await readFile((await file.path())!);
    expect(bytes.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(bytes.toString('latin1').match(/\/Type\s*\/Page[^s]/g)?.length).toBe(expected);
    expect(html).toContain('size: 148mm 210mm');
    expect(html).toContain('@top-left { content: "NovaProse";');
    expect(html).toContain(
      '@bottom-center { content: "Page " counter(page) " of " counter(pages);',
    );
  });
});

test('a phone: the sheet is a regular input area, no page borders', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'phones only');
  await page.waitForTimeout(300);
  const s = await state(page);
  expect(s.breaks).toHaveLength(0);
  expect(s.pages).toBeNull();
});
