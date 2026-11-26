import { expect, test, type Page } from '@playwright/test';

/**
 * Code blocks with highlighting (the codesample plugin) in real browsers: highlighting while typing,
 * the "```ts" fence + Enter, choosing the language in the context toolbar, the "Code sample" dialog.
 */

type W = {
  editor: { getHTML(): string; setContent(h: string, o?: object): void; ready: Promise<void> };
};
const html = (page: Page) => page.evaluate(() => (window as unknown as W).editor.getHTML());

async function open(page: Page, content: string) {
  await page.goto('/?lang=en&parity=1');
  await page.evaluate(async (c) => {
    const { editor } = window as unknown as W;
    await editor.ready;
    editor.setContent(c, { addToHistory: false });
  }, content);
}

/** The cursor to the end of the document programmatically (a click on an empty line is unreliable in WebKit). */
async function cursorAtEnd(page: Page) {
  await page.evaluate(() => {
    type Sel = { constructor: { atEnd(doc: unknown): unknown } };
    const { view } = (
      window as unknown as {
        editor: {
          view: {
            focus(): void;
            dispatch(tr: unknown): void;
            state: { doc: unknown; selection: Sel; tr: { setSelection(s: unknown): unknown } };
          };
        };
      }
    ).editor;
    view.focus();
    const { state } = view;
    view.dispatch(state.tr.setSelection(state.selection.constructor.atEnd(state.doc)));
  });
}

async function clickControl(page: Page, name: string) {
  const control = page.locator(`.nova-toolbar [data-control="${name}"]`).first();
  if (await control.isVisible()) return control.click();
  await page.locator('.nova-tb-more').click();
  await page.locator(`.nova-tb-overflow-popover [data-control="${name}"]`).click();
}

const keyword = (page: Page, text: string) =>
  page.locator('.nova-prosemirror pre .hljs-keyword', { hasText: new RegExp(`^${text}$`) });

test('highlighting while typing; the output HTML has no decorations', async ({ page }) => {
  await open(page, '<pre><code class="language-javascript">let a = 1;</code></pre><p>after</p>');
  await expect(keyword(page, 'let')).toBeVisible();
  await expect(page.locator('.nova-prosemirror pre')).toHaveAttribute(
    'data-language',
    'JavaScript',
  );
  await page.locator('.nova-prosemirror pre').click();
  await page.keyboard.press('ControlOrMeta+End');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('End');
  await page.keyboard.type(' return');
  await expect(keyword(page, 'return')).toBeVisible();
  await expect
    .poll(() => html(page))
    .toBe('<pre><code class="language-javascript">let a = 1; return</code></pre><p>after</p>');
});

test('"```ts" and Enter make a TypeScript code block', async ({ page, isMobile }) => {
  // Enter on the Android on-screen keyboard takes another path in emulation: checked on desktops.
  test.skip(isMobile, 'Enter from Android emulation');
  await open(page, '<p>Intro</p><p></p>');
  await cursorAtEnd(page);
  await page.keyboard.type('```ts');
  await page.keyboard.press('Enter');
  await page.keyboard.type('const x: number = 1');
  await expect(keyword(page, 'const')).toBeVisible();
  await expect
    .poll(() => html(page))
    .toBe('<p>Intro</p><pre><code class="language-ts">const x: number = 1</code></pre>');
});

test("the language in the code block's context toolbar", async ({ page }) => {
  await open(page, '<pre><code>def f(): pass</code></pre>');
  await page.locator('.nova-prosemirror pre').click();
  const language = page.locator('.nova-context-toolbar [data-control="codelanguage"]');
  await expect(language).toContainText('Plain text');
  await language.click();
  await page.locator('.nova-menu [role="menuitemradio"]', { hasText: /^Python$/ }).click();
  await expect(keyword(page, 'def')).toBeVisible();
  await expect(language).toContainText('Python');
  await expect
    .poll(() => html(page))
    .toBe('<pre><code class="language-python">def f(): pass</code></pre>');
});

test('the "Code sample" dialog inserts a block with a language', async ({ page }) => {
  await open(page, '<p>Intro</p><p></p>');
  await cursorAtEnd(page);
  await clickControl(page, 'codesample');
  const dialog = page.locator('.nova-dialog');
  await dialog.locator('select[name="language"]').selectOption('sql');
  await dialog.locator('textarea[name="code"]').fill('SELECT 1;\nSELECT 2;');
  await dialog.getByRole('button', { name: 'Insert' }).click();
  await expect(dialog).toBeHidden();
  await expect(keyword(page, 'SELECT').first()).toBeVisible();
  await expect
    .poll(() => html(page))
    .toBe('<p>Intro</p><pre><code class="language-sql">SELECT 1;\nSELECT 2;</code></pre>');
});
