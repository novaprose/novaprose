import { expect, test, type Page } from '@playwright/test';

/**
 * Node views in React and Vue in real browsers (the react.html, vue.html playgrounds; the node is
 * apps/playground/src/callout.ts). Checks what jsdom can't see: keyboard input into
 * the content, the view's own fields (their input doesn't reach the document), undoing an attribute edit.
 */

const html = (page: Page) => page.getByTestId('nv-html');
const editor = (page: Page) => page.locator('.pg-node-views .ProseMirror');

for (const sandbox of ['react', 'vue']) {
  test.describe(`node views: ${sandbox}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(`/${sandbox}.html`);
      await expect(editor(page).locator('.pg-callout')).toBeVisible();
    });

    test('the component draws the node and sees the app context', async ({ page }) => {
      const callout = editor(page).locator('[data-node-view="callout"]');
      await expect(callout.getByTestId('nv-theme')).toHaveText('dark');
      await expect(callout.locator('[data-node-view-content] p')).toHaveText(
        'Text inside the callout',
      );
    });

    test("keyboard input into the node's content reaches the document", async ({ page }) => {
      await editor(page).getByText('Text inside the callout').click();
      await page.keyboard.press('End');
      await page.keyboard.type(' and more');
      await expect(html(page)).toContainText('<p>Text inside the callout and more</p></div>');
      await expect(editor(page).locator('.pg-callout')).toHaveCount(1);
    });

    test("the view's own fields change the node's attributes, not the text; Ctrl+Z undoes", async ({
      page,
    }) => {
      const callout = editor(page).locator('[data-node-view="callout"]');
      await callout.getByLabel('Callout tone').selectOption('warning');
      await expect(html(page)).toContainText('data-tone="warning"');
      await expect(callout.locator('.pg-callout')).toHaveAttribute('data-tone', 'warning');

      const title = callout.getByLabel('Callout title');
      await title.click();
      await page.keyboard.type('Important');
      await expect(title).toHaveValue('Important');
      await expect(html(page)).toContainText('data-title="Important"');
      // Letters from the field didn't get into the document text.
      await expect(editor(page).locator('[data-node-view-content]')).toHaveText(
        'Text inside the callout',
      );

      await editor(page).getByText('Text inside the callout').click();
      for (let i = 0; i < 10 && (await html(page).textContent())?.includes('warning'); i++)
        await page.keyboard.press('ControlOrMeta+z');
      await expect(html(page)).toContainText('data-tone="info"');
      await expect(callout.locator('.pg-callout')).toHaveAttribute('data-tone', 'info');
    });
  });
}
