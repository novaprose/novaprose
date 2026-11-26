import { expect, test, type Page } from '@playwright/test';

/**
 * Режим страниц (плагин pagelayout) в настоящих браузерах, песочница pages.html (A5, поля 15 мм):
 * лист точного размера, границы страниц там, где их сделает печать (в Chromium сверяем с PDF),
 * пересчёт при смене листа, телефон — без границ.
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

test.describe('на компьютере', () => {
  test.skip(({ isMobile }) => isMobile, 'на телефоне лист — обычное поле ввода');

  test('лист A5 точного размера; границы страниц с номерами', async ({ page }) => {
    await expect.poll(async () => (await state(page)).pages).toBeGreaterThanOrEqual(3);
    const s = await state(page);
    expect(Math.abs(s.width - 148 * PX_PER_MM)).toBeLessThan(1);
    expect(s.breaks).toHaveLength(s.pages! - 1);
    expect(s.breaks.map((b) => b.label)).toEqual(s.breaks.map((_, i) => `Page ${i + 2}`));
    await expect(page.locator('#count')).toHaveText(`Pages: ${s.pages}`);
  });

  test('разрыв страницы начинает новую страницу', async ({ page }) => {
    await expect.poll(async () => (await state(page)).pages).toBeGreaterThanOrEqual(3);
    const s = await state(page);
    // Граница — у заголовка после разрыва (его верхнее поле после разрыва сохраняется).
    const expected = s.pagebreakNext - s.marginTop;
    expect(s.breaks.some((b) => Math.abs(b.top - expected) < 2)).toBe(true);
  });

  test('смена листа и полей пересчитывает страницы', async ({ page }) => {
    await expect.poll(async () => (await state(page)).pages).toBeGreaterThanOrEqual(3);
    const a5 = (await state(page)).pages!;
    const portrait = (await state(page)).breaks.map((b) => Math.round(b.top)).join();
    await page.locator('#size').selectOption('A4');
    await expect.poll(async () => (await state(page)).width).toBeCloseTo(210 * PX_PER_MM, 0);
    await expect.poll(async () => (await state(page)).pages).toBeLessThan(a5);
    // A5 альбомный (210 мм) помещается в колонку песочницы — лист точный, страницы считаются.
    await page.locator('#size').selectOption('A5');
    await page.locator('#orientation').selectOption('landscape');
    await expect.poll(async () => (await state(page)).width).toBeCloseTo(210 * PX_PER_MM, 0);
    // Другая ширина строк — другие границы (сколько страниц — зависит от шрифтов системы).
    await expect
      .poll(async () => {
        const s = await state(page);
        return s.pages !== null && s.breaks.map((b) => Math.round(b.top)).join() !== portrait;
      })
      .toBe(true);
    // A4 альбомный (297 мм) шире колонки: лист сужается, строки переносятся не как при печати —
    // границ не рисуем, число страниц неизвестно.
    await page.locator('#size').selectOption('A4');
    await expect.poll(async () => (await state(page)).pages).toBeNull();
    expect((await state(page)).breaks).toHaveLength(0);
  });

  test('печать делит страницы там же, где редактор (PDF)', async ({
    page,
    browserName,
    context,
  }) => {
    test.skip(browserName !== 'chromium', 'PDF умеет делать только Chromium');
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

test('телефон: лист — обычное поле, границ страниц нет', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'только на телефоне');
  await page.waitForTimeout(300);
  const s = await state(page);
  expect(s.breaks).toHaveLength(0);
  expect(s.pages).toBeNull();
});
