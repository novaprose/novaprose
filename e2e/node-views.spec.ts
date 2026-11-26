import { expect, test, type Page } from '@playwright/test';

/**
 * Виды узлов на React и Vue в настоящих браузерах (песочницы react.html, vue.html; узел —
 * apps/playground/src/callout.ts). Проверяем то, чего не видит jsdom: ввод с клавиатуры в
 * содержимое, свои поля вида (их ввод не попадает в документ), отмену правки атрибута.
 */

const html = (page: Page) => page.getByTestId('nv-html');
const editor = (page: Page) => page.locator('.pg-node-views .ProseMirror');

for (const sandbox of ['react', 'vue']) {
  test.describe(`виды узлов: ${sandbox}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(`/${sandbox}.html`);
      await expect(editor(page).locator('.pg-callout')).toBeVisible();
    });

    test('компонент рисует узел и видит контекст приложения', async ({ page }) => {
      const callout = editor(page).locator('[data-node-view="callout"]');
      await expect(callout.getByTestId('nv-theme')).toHaveText('тёмная');
      await expect(callout.locator('[data-node-view-content] p')).toHaveText(
        'Текст внутри выноски',
      );
    });

    test('ввод с клавиатуры в содержимое узла попадает в документ', async ({ page }) => {
      await editor(page).getByText('Текст внутри выноски').click();
      await page.keyboard.press('End');
      await page.keyboard.type(' и ещё');
      await expect(html(page)).toContainText('<p>Текст внутри выноски и ещё</p></div>');
      await expect(editor(page).locator('.pg-callout')).toHaveCount(1);
    });

    test('свои поля вида меняют атрибуты узла, а не текст; Ctrl+Z отменяет', async ({ page }) => {
      const callout = editor(page).locator('[data-node-view="callout"]');
      await callout.getByLabel('Тон выноски').selectOption('warning');
      await expect(html(page)).toContainText('data-tone="warning"');
      await expect(callout.locator('.pg-callout')).toHaveAttribute('data-tone', 'warning');

      const title = callout.getByLabel('Заголовок выноски');
      await title.click();
      await page.keyboard.type('Важно');
      await expect(title).toHaveValue('Важно');
      await expect(html(page)).toContainText('data-title="Важно"');
      // Буквы из поля не попали в текст документа.
      await expect(editor(page).locator('[data-node-view-content]')).toHaveText(
        'Текст внутри выноски',
      );

      await editor(page).getByText('Текст внутри выноски').click();
      for (let i = 0; i < 10 && (await html(page).textContent())?.includes('warning'); i++)
        await page.keyboard.press('ControlOrMeta+z');
      await expect(html(page)).toContainText('data-tone="info"');
      await expect(callout.locator('.pg-callout')).toHaveAttribute('data-tone', 'info');
    });
  });
}
