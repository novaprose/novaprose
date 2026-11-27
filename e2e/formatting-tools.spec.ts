import { expect, test, type Page } from '@playwright/test';

/** Change case, format painter and permanent pen in real browsers: the mouse, the keyboard, typing. */

declare global {
  interface Window {
    editor: {
      ready: Promise<void>;
      getHTML(): string;
      setContent(html: string, options?: { addToHistory?: boolean }): void;
    };
  }
}

const html = (page: Page) => page.evaluate(() => window.editor.getHTML());
const content = (page: Page) => page.locator('.nova-prosemirror');

async function open(page: Page, initial: string) {
  await page.goto('/?lang=en&tools=1');
  await page.evaluate(async (value) => {
    await window.editor.ready;
    window.editor.setContent(value, { addToHistory: false });
  }, initial);
  await content(page).click();
  // ProseMirror's 20 ms focus timer runs first (see open() in e2e/editor.spec.ts).
  await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 20)));
}

/** A toolbar control wherever it is: on the panel or in "⋯". */
async function clickControl(page: Page, name: string) {
  const control = page.locator(`.nova-toolbar [data-control="${name}"]`).first();
  if (await control.isVisible()) return control.click();
  await page.locator('.nova-tb-more').click();
  await page.locator(`.nova-tb-overflow-popover [data-control="${name}"]`).click();
}

/** Whether a toggle button is on (its state, wherever the button is: on the panel or in "⋯"). */
const pressed = (page: Page, name: string) =>
  page.evaluate((control) => {
    const editor = window.editor as unknown as {
      ui: { registry: { get(name: string): { isActive?(e: unknown): boolean } | undefined } };
    };
    return String(!!editor.ui.registry.get(control)?.isActive?.(editor));
  }, name);

/** Drag over a word with the mouse. */
async function dragOver(page: Page, word: string) {
  // The word is inside a longer text node: its box comes from a DOM range.
  const box = await page.evaluate((w) => {
    const walker = document.createTreeWalker(
      document.querySelector('.nova-prosemirror')!,
      NodeFilter.SHOW_TEXT,
    );
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const index = node.textContent!.indexOf(w);
      if (index < 0) continue;
      const range = document.createRange();
      range.setStart(node, index);
      range.setEnd(node, index + w.length);
      const rect = range.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    }
    throw new Error(`"${w}" not found`);
  }, word);
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + 1, y);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width - 1, y, { steps: 4 });
  await page.mouse.up();
}

test('change case: the arrow menu, then the button repeats the last case', async ({ page }) => {
  await open(page, '<p>the lord of the rings</p>');
  await page.keyboard.press('Home');
  await page.keyboard.press('Shift+End');
  await clickControl(page, 'casechange-options');
  await page.getByRole('menuitemradio', { name: 'Title Case' }).click();
  expect(await html(page)).toBe('<p>The Lord of the Rings</p>');
  await page.keyboard.press('End');
  await page.keyboard.press('ControlOrMeta+Shift+ArrowLeft');
  await clickControl(page, 'casechange');
  expect(await html(page)).toBe('<p>The Lord of the Rings</p>');
  await clickControl(page, 'casechange-options');
  await page.getByRole('menuitemradio', { name: 'UPPERCASE' }).click();
  expect(await html(page)).toBe('<p>The Lord of the RINGS</p>');
});

test('format painter: copy at the cursor, the next mouse selection gets it', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'painting follows a mouse selection');
  await open(page, '<p><strong>bold</strong> one two</p>');
  await content(page).getByText('bold').click();
  await clickControl(page, 'formatpainter');
  expect(await pressed(page, 'formatpainter')).toBe('true');
  await dragOver(page, 'two');
  await expect.poll(() => html(page)).toBe('<p><strong>bold</strong> one <strong>two</strong></p>');
  expect(await pressed(page, 'formatpainter')).toBe('false');
});

test('format painter: Ctrl+Alt+C copies, Ctrl+Alt+V applies to the selection', async ({ page }) => {
  await open(page, '<p><em>source</em> target</p>');
  await page.keyboard.press('Home');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ControlOrMeta+Alt+c');
  await page.keyboard.press('End');
  await page.keyboard.press('Shift+ControlOrMeta+ArrowLeft');
  await page.keyboard.press('ControlOrMeta+Alt+v');
  expect(await html(page)).toBe('<p><em>source</em> <em>target</em></p>');
});

test('permanent pen: everything typed gets the pen, after Enter too; off stops it', async ({
  page,
}) => {
  await open(page, '<p>text</p>');
  await page.keyboard.press('ControlOrMeta+End');
  await clickControl(page, 'permanentpen');
  expect(await pressed(page, 'permanentpen')).toBe('true');
  await page.keyboard.type(' note');
  await page.keyboard.press('Enter');
  await page.keyboard.type('more');
  const pen = (text: string) => `<strong><span style="color: #c0392b;">${text}</span></strong>`;
  expect(await html(page)).toBe(`<p>text${pen(' note')}</p><p>${pen('more')}</p>`);
  await clickControl(page, 'permanentpen');
  await page.keyboard.type(' plain');
  expect(await html(page)).toBe(`<p>text${pen(' note')}</p><p>${pen('more')} plain</p>`);
});
