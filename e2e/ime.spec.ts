import { expect, test, type CDPSession, type Page } from '@playwright/test';

/**
 * Ввод через IME (китайский, японский, корейский): текст набирается «составлением» —
 * промежуточные варианты заменяют друг друга, пока пользователь не подтвердит выбор.
 * Input.imeSetComposition (протокол Chromium) даёт те же события composition и тот же DOM,
 * что настоящий IME. В Firefox и WebKit такого средства нет — там проверяется руками.
 */

test.skip(({ browserName }) => browserName !== 'chromium', 'IME через CDP есть только в Chromium');

type W = {
  editor: {
    getHTML(): string;
    setContent(html: string, options?: object): void;
    exec(name: string): boolean;
    ready: Promise<void>;
  };
};

const html = (page: Page) => page.evaluate(() => (window as unknown as W).editor.getHTML());

async function open(page: Page, content: string): Promise<CDPSession> {
  await page.goto('/?lang=en');
  await page.evaluate(async (c) => {
    const { editor } = window as unknown as W;
    await editor.ready;
    editor.setContent(c, { addToHistory: false });
  }, content);
  return page.context().newCDPSession(page);
}

/** Составить текст по шагам (каждый шаг заменяет предыдущий) и подтвердить. */
async function compose(cdp: CDPSession, steps: string[], commit: string) {
  for (const text of steps) {
    await cdp.send('Input.imeSetComposition', {
      text,
      selectionStart: text.length,
      selectionEnd: text.length,
    });
  }
  await cdp.send('Input.insertText', { text: commit });
}

/** Поставить курсор в конец текста элемента. */
async function caretAtEnd(page: Page, selector: string) {
  await page.locator(selector).first().click();
  await page.keyboard.press('End');
}

test('японский: промежуточные варианты не остаются в тексте, отмена убирает слово целиком', async ({
  page,
}) => {
  const cdp = await open(page, '<p>Text</p>');
  await caretAtEnd(page, '.nova-prosemirror p');
  await compose(cdp, ['に', 'にほ', 'にほん', 'にほんご', '日本語'], '日本語');
  await expect.poll(() => html(page)).toBe('<p>Text日本語</p>');
  await page.keyboard.press('ControlOrMeta+z');
  await expect.poll(() => html(page)).toBe('<p>Text</p>');
});

test('корейский: слоги собираются из букв', async ({ page }) => {
  const cdp = await open(page, '<p></p>');
  await page.locator('.nova-prosemirror').click();
  await compose(cdp, ['ㅎ', '하', '한'], '한');
  await compose(cdp, ['ㄱ', '그', '글'], '글');
  await expect.poll(() => html(page)).toBe('<p>한글</p>');
});

test('китайский внутри жирного, в пункте списка и в ячейке таблицы', async ({ page }) => {
  const cdp = await open(
    page,
    '<p><strong>ab</strong></p><ul><li><p>x</p></li></ul>' +
      '<table><tbody><tr><td><p>c</p></td></tr></tbody></table>',
  );
  // Между «a» и «b» в жирном.
  await page.locator('.nova-prosemirror strong').click();
  await page.keyboard.press('Home');
  await page.keyboard.press('ArrowRight');
  await compose(cdp, ['z', 'zh', 'zhong', '中'], '中');
  await caretAtEnd(page, '.nova-prosemirror li p');
  await compose(cdp, ['w', 'wen', '文'], '文');
  await caretAtEnd(page, '.nova-prosemirror td p');
  await compose(cdp, ['b', 'biao', '表'], '表');
  await expect
    .poll(() => html(page))
    .toBe(
      '<p><strong>a中b</strong></p><ul><li><p>x文</p></li></ul>' +
        '<table><tbody><tr><td><p>c表</p></td></tr></tbody></table>',
    );
});

test('Enter во время составления принадлежит IME: не выбирает слэш-команду', async ({ page }) => {
  const cdp = await open(page, '<p></p>');
  await page.locator('.nova-prosemirror').click();
  await page.keyboard.type('/');
  await expect(page.locator('.nova-ac')).toBeVisible();
  await cdp.send('Input.imeSetComposition', { text: 'ひ', selectionStart: 1, selectionEnd: 1 });
  // Подтверждение варианта в IME — это Enter с isComposing (keyCode 229).
  await page.evaluate(() => {
    const dom = document.querySelector('.nova-prosemirror')!;
    dom.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Enter',
        keyCode: 229,
        isComposing: true,
        bubbles: true,
        cancelable: true,
      }),
    );
  });
  await cdp.send('Input.insertText', { text: '表' });
  await expect.poll(() => html(page)).toBe('<p>/表</p>');
});

test('счётчик слов: каждый иероглиф и знак каны — слово', async ({ page }) => {
  const cdp = await open(page, '<p></p>');
  await page.locator('.nova-prosemirror').click();
  await compose(cdp, ['にほんご', '日本語'], '日本語');
  await expect(page.locator('.nova-wordcount')).toContainText('3');
});
