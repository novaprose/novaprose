import { expect, test, type Page } from '@playwright/test';

/**
 * Редактор внутри теневого корня (свой веб-компонент клиента): фокус, выделение, меню, диалоги.
 * Внутри корня document.activeElement — это хост, а цель событий на document подменена: без учёта
 * этого меню закрывались от клика по своим же пунктам, а Tab в диалоге выкидывал фокус в начало.
 * Локаторы Playwright проходят в открытый корень; закрытый проверяем мышью и клавиатурой.
 */

type W = { editor: { getHTML(): string; ready: Promise<void> }; shadow: ShadowRoot };

const html = (page: Page) => page.evaluate(() => (window as unknown as W).editor.getHTML());

async function open(page: Page, mode: 'open' | 'closed' = 'open') {
  await page.goto(`/shadow.html?mode=${mode}`);
  await page.evaluate(() => (window as unknown as W).editor.ready);
}

/** Центр элемента внутри корня (для закрытого корня локаторы не работают). */
async function center(page: Page, selector: string) {
  const box = await page.evaluate((sel) => {
    const el = (window as unknown as W).shadow.querySelector(sel);
    const r = el!.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }, selector);
  return box;
}

/** Кнопка тулбара — на панели или в «⋯» (раскладка зависит от ширины экрана). */
async function clickControl(page: Page, name: string) {
  const control = page.locator(`my-app .nova-toolbar [data-control="${name}"]`).first();
  if (await control.isVisible()) return control.click();
  await page.locator('my-app .nova-tb-more').click();
  await page.locator(`my-app .nova-tb-overflow-popover [data-control="${name}"]`).click();
}

/** Элемент в фокусе внутри корня (селектор data-control или класс). */
const focused = (page: Page) =>
  page.evaluate(() => {
    const el = (window as unknown as W).shadow.activeElement as HTMLElement | null;
    return el?.getAttribute('data-control') ?? el?.className ?? null;
  });

test('ввод, выделение с клавиатуры и формат кнопкой', async ({ page }) => {
  await open(page);
  const text = page.locator('my-app .nova-prosemirror');
  await text.click();
  await page.keyboard.press('End');
  await page.keyboard.type(' again');
  for (let i = 0; i < 5; i++) await page.keyboard.press('Shift+ArrowLeft');
  await clickControl(page, 'bold');
  await expect.poll(() => html(page)).toBe('<p>Hello shadow world <strong>again</strong></p>');
});

test('меню: клик по пункту применяет его, а не закрывает меню как «клик снаружи»', async ({
  page,
}) => {
  await open(page);
  await page.locator('my-app .nova-prosemirror').click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.locator('my-app .nova-menubar button', { hasText: 'Format' }).click();
  const menu = page.locator('my-app .nova-popover .nova-menu').first();
  await expect(menu).toBeVisible();
  await menu.locator('button', { hasText: 'Bold' }).first().click();
  await expect(menu).toBeHidden();
  await expect.poll(() => html(page)).toBe('<p><strong>Hello shadow world</strong></p>');
  // Клик за пределами корня закрывает открытое меню.
  await page.locator('my-app .nova-menubar button', { hasText: 'Format' }).click();
  await expect(menu).toBeVisible();
  await page.locator('#outside').click();
  await expect(menu).toBeHidden();
});

test('тулбар: стрелки двигают фокус по кнопкам', async ({ page }) => {
  await open(page);
  // Первая видимая доступная кнопка: на узком экране часть кнопок уходит в «⋯».
  const first = page.locator('my-app .nova-toolbar button:not(:disabled):visible').first();
  await first.focus();
  const start = await focused(page);
  await page.keyboard.press('ArrowRight');
  const next = await focused(page);
  expect(next).not.toBeNull();
  expect(next).not.toBe(start);
  await page.keyboard.press('ArrowLeft');
  expect(await focused(page)).toBe(start);
});

test('диалог ссылки: Tab остаётся внутри, Enter вставляет ссылку', async ({ page }) => {
  await open(page);
  await page.locator('my-app .nova-prosemirror').click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.press('ControlOrMeta+k');
  const dialog = page.locator('my-app .nova-dialog');
  await expect(dialog).toBeVisible();
  await page.keyboard.type('https://example.com');
  // Обходим все поля по кругу: фокус не должен покидать диалог и не должен прыгать в начало.
  const names: string[] = [];
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press('Tab');
    names.push(
      await page.evaluate(() => {
        const el = (window as unknown as W).shadow.activeElement;
        const dialog = el?.closest('.nova-dialog');
        return dialog ? String([...dialog.querySelectorAll('*')].indexOf(el!)) : 'OUTSIDE';
      }),
    );
  }
  expect(names).not.toContain('OUTSIDE');
  expect(new Set(names).size).toBeGreaterThan(2);
  // Shift+Tab с первого элемента диалога (кнопка «×») — на последний (по кругу), а не наружу.
  const index = () =>
    page.evaluate(() => {
      const el = (window as unknown as W).shadow.activeElement!;
      return [...el.closest('.nova-dialog')!.querySelectorAll('button, input')].indexOf(el);
    });
  await page.locator('my-app .nova-dialog').locator('button, input').first().focus();
  expect(await index()).toBe(0);
  await page.keyboard.press('Shift+Tab');
  expect(await index()).toBeGreaterThan(0);
  // Фокус, ушедший из диалога в другой элемент того же корня, возвращается в диалог.
  await page.evaluate(() =>
    (window as unknown as W).shadow.querySelector<HTMLElement>('.nova-prosemirror')!.focus(),
  );
  await expect
    .poll(() =>
      page.evaluate(() => !!(window as unknown as W).shadow.activeElement?.closest('.nova-dialog')),
    )
    .toBe(true);
  await page.locator('my-app .nova-dialog input').first().focus();
  await page.keyboard.press('Enter');
  await expect(dialog).toBeHidden();
  await expect.poll(() => html(page)).toContain('href="https://example.com"');
});

test('закрытый корень: меню работает мышью', async ({ page }) => {
  await open(page, 'closed');
  const text = await center(page, '.nova-prosemirror');
  await page.mouse.click(text.x, text.y);
  await page.keyboard.press('ControlOrMeta+a');
  const blocks = await center(page, '.nova-toolbar [data-control="blocks"]');
  await page.mouse.click(blocks.x, blocks.y);
  const isOpen = () =>
    page.evaluate(() => !!(window as unknown as W).shadow.querySelector('.nova-popover-menu'));
  await expect.poll(isOpen).toBe(true);
  const item = await page.evaluate(() => {
    const items = [...(window as unknown as W).shadow.querySelectorAll('.nova-popover button')];
    const h2 = items.find((b) => b.textContent?.includes('Heading 2'))!;
    const r = h2.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  await page.mouse.click(item.x, item.y);
  await expect.poll(() => html(page)).toBe('<h2>Hello shadow world</h2>');
  await expect.poll(isOpen).toBe(false);
});
