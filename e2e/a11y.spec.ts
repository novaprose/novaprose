import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/**
 * Автоматическая проверка доступности (axe-core, правила WCAG 2.1 A/AA): роли ARIA, подписи,
 * контраст, фокус, имена кнопок. Проверяем редактор и все его оверлеи (меню, диалоги, панели)
 * в светлой и тёмной теме, в типовых состояниях. Обвязка playground не проверяется.
 * Правила axe не зависят от движка браузера — достаточно Chromium.
 */

declare global {
  interface Window {
    editor: { ready: Promise<void>; setContent(html: string): void };
  }
}

test.skip(
  ({ browserName, isMobile }) => browserName !== 'chromium' || isMobile,
  'axe — только Chromium',
);

const CONTENT =
  '<h2>Заголовок</h2><p>Текст <strong>жирный</strong> и <a href="https://example.com">ссылка</a>.</p>' +
  '<ul><li><p>пункт</p></li></ul><table><tbody><tr><td><p>a</p></td><td><p>b</p></td></tr></tbody></table>';

async function open(page: Page, theme: 'light' | 'dark', query = '') {
  await page.goto(`/?lang=ru${query}`);
  await page.evaluate(
    async ([html, t]) => {
      await window.editor.ready;
      window.editor.setContent(html!);
      document.documentElement.dataset.theme = t!;
    },
    [CONTENT, theme] as const,
  );
  await page.locator('.nova-prosemirror').click();
}

async function audit(page: Page, label: string) {
  const result = await new AxeBuilder({ page })
    .include('.nova-editor')
    // Оверлеи редактора монтируются в body: меню, диалоги, подсказки, панели.
    .include('body > [class*="nova-"]')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  const violations = result.violations.map((v) => ({
    rule: v.id,
    impact: v.impact,
    help: v.help,
    nodes: v.nodes
      .slice(0, 3)
      .map((n) => `${n.target.join(' ')} — ${n.failureSummary?.split('\n')[1]?.trim()}`),
  }));
  expect(violations, `${label}: нарушения доступности`).toEqual([]);
}

async function control(page: Page, name: string) {
  const el = page.locator(`.nova-toolbar [data-control="${name}"]`).first();
  if (await el.isVisible()) return el.click();
  await page.locator('.nova-tb-more').click();
  await page.locator(`.nova-tb-overflow-popover [data-control="${name}"]`).click();
}

for (const theme of ['light', 'dark'] as const) {
  test.describe(`тема: ${theme}`, () => {
    test('редактор в покое', async ({ page }) => {
      await open(page, theme);
      await audit(page, 'редактор');
    });

    test('меню «Блоки» открыто', async ({ page }) => {
      await open(page, theme);
      await control(page, 'blocks');
      await expect(
        page.locator('[role="menu"]:visible, [role="listbox"]:visible').first(),
      ).toBeVisible();
      await audit(page, 'меню блоков');
    });

    test('палитра цвета текста открыта', async ({ page }) => {
      await open(page, theme);
      await control(page, 'forecolor');
      await audit(page, 'палитра');
    });

    test('диалог ссылки открыт', async ({ page }) => {
      await open(page, theme);
      await control(page, 'link');
      await expect(page.locator('[role="dialog"]')).toBeVisible();
      await audit(page, 'диалог ссылки');
    });

    test('диалог картинки открыт', async ({ page }) => {
      await open(page, theme);
      await control(page, 'image');
      await expect(page.locator('[role="dialog"]')).toBeVisible();
      await audit(page, 'диалог картинки');
    });

    test('меню из строки меню открыто', async ({ page }) => {
      await open(page, theme, '&menubar=1');
      const menubar = page.locator('.nova-menubar [role="menuitem"]').first();
      await menubar.click();
      await expect(page.locator('[role="menu"]:visible').first()).toBeVisible();
      await audit(page, 'меню из строки меню');
    });
  });
}
