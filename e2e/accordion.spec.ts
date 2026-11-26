import { expect, test, type Page } from '@playwright/test';

/**
 * Раскрывающиеся блоки (плагин accordion) в настоящих браузерах: стрелка, ввод заголовка (без
 * встроенного переключения <summary>), Enter, Ctrl/Cmd+Enter, Backspace, кнопка тулбара.
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

async function clickControl(page: Page, name: string) {
  const control = page.locator(`.nova-toolbar [data-control="${name}"]`).first();
  if (await control.isVisible()) return control.click();
  await page.locator('.nova-tb-more').click();
  await page.locator(`.nova-tb-overflow-popover [data-control="${name}"]`).click();
}

const OPEN = '<details open=""><summary>Question</summary><p>Answer</p></details>';

test('стрелка сворачивает и раскрывает, содержимое скрывается', async ({ page }) => {
  await open(page, `${OPEN}<p>after</p>`);
  const answer = page.locator('.nova-prosemirror p', { hasText: 'Answer' });
  await expect(answer).toBeVisible();
  await page.locator('.nova-details-toggle').click();
  await expect(answer).toBeHidden();
  await expect
    .poll(() => html(page))
    .toBe('<details><summary>Question</summary><p>Answer</p></details><p>after</p>');
  await page.locator('.nova-details-toggle').click();
  await expect(answer).toBeVisible();
});

test('щелчок в заголовок ставит курсор, ввод — в заголовок; блок не сворачивается', async ({
  page,
}) => {
  await open(page, OPEN);
  await page.locator('.nova-prosemirror summary').click();
  await page.keyboard.press('End');
  await page.keyboard.type(' 2');
  await expect.poll(() => html(page)).toBe(OPEN.replace('Question', 'Question 2'));
  await expect(page.locator('.nova-prosemirror p', { hasText: 'Answer' })).toBeVisible();
});

test('кнопка тулбара: абзац — в блок, ввод заголовка, Enter — в содержимое', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'Enter из эмуляции Android');
  await open(page, '<p>Body text</p>');
  await page.locator('.nova-prosemirror p').click();
  await clickControl(page, 'accordion');
  await page.keyboard.type('Title');
  await page.keyboard.press('Enter');
  await page.keyboard.type('First');
  await expect
    .poll(() => html(page))
    .toBe('<details open=""><summary>Title</summary><p>First</p><p>Body text</p></details>');
});

test('Ctrl/Cmd+Enter в заголовке сворачивает; Backspace в начале снимает рамку', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'сочетания клавиш — для настольных');
  await open(page, OPEN);
  await page.locator('.nova-prosemirror summary').click();
  await page.keyboard.press('ControlOrMeta+Enter');
  await expect.poll(() => html(page)).toBe(OPEN.replace(' open=""', ''));
  await page.keyboard.press('ControlOrMeta+Enter');
  await expect.poll(() => html(page)).toBe(OPEN);
  await page.keyboard.press('Home');
  await page.keyboard.press('Backspace');
  await expect.poll(() => html(page)).toBe('<p>Question</p><p>Answer</p>');
});
