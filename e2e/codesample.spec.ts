import { expect, test, type Page } from '@playwright/test';

/**
 * Блоки кода с подсветкой (плагин codesample) в настоящих браузерах: подсветка при наборе,
 * забор «```ts» + Enter, выбор языка в контекстной панели, диалог «Пример кода».
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

/** Курсор в конец документа программно (щелчок по пустой строке в WebKit ненадёжен). */
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

test('подсветка при наборе; HTML на выходе — без оформления', async ({ page }) => {
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

test('«```ts» и Enter — блок кода на TypeScript', async ({ page, isMobile }) => {
  // Enter на экранной клавиатуре Android в эмуляции идёт другим путём — проверяем на настольных.
  test.skip(isMobile, 'Enter из эмуляции Android');
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

test('язык — в контекстной панели блока кода', async ({ page }) => {
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

test('диалог «Пример кода» вставляет блок с языком', async ({ page }) => {
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
