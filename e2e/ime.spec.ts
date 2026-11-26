import { expect, test, type CDPSession, type Page } from '@playwright/test';

/**
 * IME input (Chinese, Japanese, Korean): text is typed by "composition":
 * intermediate candidates replace each other until the user confirms the choice.
 * Input.imeSetComposition (the Chromium protocol) gives the same composition events and the same DOM
 * as a real IME. Firefox and WebKit have no such tool: there it is checked by hand.
 */

test.skip(
  ({ browserName }) => browserName !== 'chromium',
  'IME through CDP exists only in Chromium',
);

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

/** Composes text step by step (each step replaces the previous one) and confirms it. */
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

/** Puts the cursor at the end of the element's text. */
async function caretAtEnd(page: Page, selector: string) {
  await page.locator(selector).first().click();
  await page.keyboard.press('End');
}

test("Japanese: intermediate candidates don't stay in the text, undo removes the whole word", async ({
  page,
}) => {
  const cdp = await open(page, '<p>Text</p>');
  await caretAtEnd(page, '.nova-prosemirror p');
  await compose(cdp, ['に', 'にほ', 'にほん', 'にほんご', '日本語'], '日本語');
  await expect.poll(() => html(page)).toBe('<p>Text日本語</p>');
  await page.keyboard.press('ControlOrMeta+z');
  await expect.poll(() => html(page)).toBe('<p>Text</p>');
});

test('Korean: syllables are assembled from letters', async ({ page }) => {
  const cdp = await open(page, '<p></p>');
  await page.locator('.nova-prosemirror').click();
  await compose(cdp, ['ㅎ', '하', '한'], '한');
  await compose(cdp, ['ㄱ', '그', '글'], '글');
  await expect.poll(() => html(page)).toBe('<p>한글</p>');
});

test('Chinese inside bold, in a list item and in a table cell', async ({ page }) => {
  const cdp = await open(
    page,
    '<p><strong>ab</strong></p><ul><li><p>x</p></li></ul>' +
      '<table><tbody><tr><td><p>c</p></td></tr></tbody></table>',
  );
  // Between "a" and "b" in bold.
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

test("Enter during composition belongs to the IME: it doesn't pick a slash command", async ({
  page,
}) => {
  const cdp = await open(page, '<p></p>');
  await page.locator('.nova-prosemirror').click();
  await page.keyboard.type('/');
  await expect(page.locator('.nova-ac')).toBeVisible();
  await cdp.send('Input.imeSetComposition', { text: 'ひ', selectionStart: 1, selectionEnd: 1 });
  // Confirming a candidate in an IME is an Enter with isComposing (keyCode 229).
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

test('the word counter: every ideograph and kana character is a word', async ({ page }) => {
  const cdp = await open(page, '<p></p>');
  await page.locator('.nova-prosemirror').click();
  await compose(cdp, ['にほんご', '日本語'], '日本語');
  await expect(page.locator('.nova-wordcount')).toContainText('3');
});
