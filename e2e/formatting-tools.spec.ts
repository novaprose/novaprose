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

async function open(page: Page, initial: string, query = '') {
  await page.goto(`/?lang=en&tools=1${query}`);
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

test('invisible characters: a no-break space shows a mark, the HTML stays the same', async ({
  page,
}) => {
  await open(page, '<p>one two</p>');
  await clickControl(page, 'visualchars');
  await page.evaluate(() => {
    const editor = window.editor as unknown as { insertContent(html: string): void };
    editor.insertContent('&nbsp;');
  });
  await expect(content(page).locator('.nova-visualchar[data-char="nbsp"]')).toHaveCount(1);
  expect(await html(page)).toBe('<p>one two&nbsp;</p>');
  await clickControl(page, 'visualchars');
  await expect(content(page).locator('.nova-visualchar')).toHaveCount(0);
});

test('save: Ctrl/Cmd+S saves (and never opens the browser save dialog)', async ({ page }) => {
  await open(page, '<p>text</p>');
  await page.keyboard.press('ControlOrMeta+End');
  await page.keyboard.type(' more');
  await page.keyboard.press('ControlOrMeta+s');
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { lastSaved?: string }).lastSaved))
    .toBe('<p>text more</p>');
});

test('Markdown pasted as plain text becomes formatting; "Paste as text" undoes it', async ({
  page,
  browserName,
}) => {
  test.skip(browserName === 'firefox', 'Firefox ignores clipboardData in a synthetic paste');
  await open(page, '<p></p>');
  const paste = (text: string) =>
    content(page).evaluate((el, value) => {
      const data = new DataTransfer();
      data.setData('text/plain', value);
      el.dispatchEvent(
        new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }),
      );
    }, text);
  await paste('## Plan\n\n- **first** step\n- second');
  expect(await html(page)).toBe(
    '<h2>Plan</h2><ul><li><p><strong>first</strong> step</p></li><li><p>second</p></li></ul>',
  );
  await page.getByRole('button', { name: 'Paste as text' }).click();
  await expect.poll(() => html(page)).toBe('<p>## Plan</p><p>- **first** step</p><p>- second</p>');
});

test('importcss: a class of the content CSS is a Styles item and styles the paragraph', async ({
  page,
}) => {
  await open(page, '<p>text</p>', '&contentcss=1');
  await clickControl(page, 'styles');
  await page.locator('.nova-menu [role^="menuitem"]', { hasText: 'callout' }).click();
  expect(await html(page)).toBe('<p class="callout">text</p>');
});

test('templates: the dialog shows the description and a preview, Insert puts it at the cursor', async ({
  page,
}) => {
  await open(page, '<p>end</p>');
  await page.keyboard.press('ControlOrMeta+Home');
  await clickControl(page, 'template');
  const dialog = page.getByRole('dialog', { name: 'Insert template' });
  await expect(dialog.getByRole('region', { name: 'Preview' })).toContainText('Meeting notes');
  await dialog.getByLabel('Template').selectOption({ label: 'Letter' });
  await expect(dialog).toContainText('A short letter with a greeting');
  await expect(dialog.getByRole('region', { name: 'Preview' })).toContainText('Dear Ann,');
  await dialog.getByRole('button', { name: 'Insert' }).click();
  await expect(dialog).toBeHidden();
  expect(await html(page)).toBe('<p>Dear Ann,</p><p>Best regards</p><p>end</p>');
});
