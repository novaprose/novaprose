import { expect, test, type Page } from '@playwright/test';

declare global {
  interface Window {
    editor: {
      getHTML(): string;
      setContent(html: string, options?: { addToHistory?: boolean }): void;
      focus(): void;
      view: { pasteHTML(html: string): boolean };
      ready: Promise<void>;
    };
  }
}

const html = (page: Page) => page.evaluate(() => window.editor.getHTML());
const content = (page: Page) => page.locator('.nova-prosemirror');
const control = (page: Page, name: string) =>
  page.locator(`.nova-toolbar [data-control="${name}"]`).first();

/** Press a toolbar control wherever it is: on the panel or in "⋯" (a narrow screen). */
async function clickControl(page: Page, name: string) {
  if (await control(page, name).isVisible()) return control(page, name).click();
  await page.locator('.nova-tb-more').click();
  await page.locator(`.nova-tb-overflow-popover [data-control="${name}"]`).click();
}

/** Open the playground with the given content and the cursor at the end of the document. */
async function open(page: Page, initial = '<p></p>', query = '?lang=en') {
  await page.goto(`/${query}`);
  // Lazy plugins (quickbars, insertdatetime) must have time to attach, otherwise under load
  // the test starts pressing keys before their panels appear.
  await page.evaluate(async (value) => {
    await window.editor.ready;
    window.editor.setContent(value, { addToHistory: false });
  }, initial);
  await content(page).click();
  // On focus ProseMirror starts a 20 ms timer: if the browser's cursor is still where focusing put it
  // (the start of the document), it writes the editor's selection back. A key pressed sooner that lands
  // on the same spot (Home in a one-line document) gets undone. A 20 ms timer started now runs after
  // that one, so once it fires the focus has settled. A person never types within 20 ms of a click.
  await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 20)));
  await page.keyboard.press('ControlOrMeta+End');
}

test('typing and Ctrl/Cmd+B', async ({ page, isMobile }) => {
  await open(page);
  await page.keyboard.type('Hello ');
  await page.keyboard.press('ControlOrMeta+b');
  await page.keyboard.type('bold');
  expect(await html(page)).toBe('<p>Hello <strong>bold</strong></p>');
  if (!isMobile) await expect(control(page, 'bold')).toHaveAttribute('aria-pressed', 'true');
});

test('markdown shortcuts: heading, list, quote', async ({ page }) => {
  await open(page);
  await page.keyboard.type('## Title');
  await page.keyboard.press('Enter');
  await page.keyboard.type('- one');
  await page.keyboard.press('Enter');
  await page.keyboard.type('two');
  expect(await html(page)).toBe('<h2>Title</h2><ul><li><p>one</p></li><li><p>two</p></li></ul>');
});

test('undo/redo', async ({ page }) => {
  await open(page, '<p>text</p>');
  await page.keyboard.type(' more');
  await page.keyboard.press('ControlOrMeta+z');
  expect(await html(page)).toBe('<p>text</p>');
});

test('the block style menu changes a paragraph into a heading', async ({ page }) => {
  await open(page, '<p>text</p>');
  await clickControl(page, 'blocks');
  await page.getByRole('menuitemradio', { name: 'Heading 2' }).click();
  expect(await html(page)).toBe('<h2>text</h2>');
  await page.locator('.nova-statusbar').waitFor();
  await expect(page.locator('.nova-path')).toHaveText('h2');
});

test('text color is saved in hex', async ({ page }) => {
  await open(page, '<p>text</p>');
  await page.keyboard.press('ControlOrMeta+a');
  await clickControl(page, 'forecolor');
  await page.getByRole('gridcell', { name: '#3b82f6' }).click();
  expect(await html(page)).toBe('<p><span style="color: #3b82f6;">text</span></p>');
});

test('a link: Ctrl/Cmd+K → the dialog → the link bubble → removal', async ({ page }) => {
  await open(page, '<p>site</p>');
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.press('ControlOrMeta+k');
  const dialog = page.getByRole('dialog', { name: 'Insert link' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel('URL')).toBeFocused();
  await dialog.getByLabel('URL').fill('example.com');
  await dialog.getByLabel('URL').press('Enter');
  await expect(dialog).toBeHidden();
  expect(await html(page)).toBe('<p><a href="https://example.com">site</a></p>');

  // The cursor inside a link → the bubble appears.
  await content(page).locator('a').click();
  const bubble = page.getByRole('toolbar', { name: 'Link', exact: true });
  await expect(bubble).toBeVisible();
  await expect(bubble.locator('a')).toHaveText('https://example.com');
  await bubble.getByRole('button', { name: 'Remove link' }).click();
  expect(await html(page)).toBe('<p>site</p>');
  await expect(bubble).toBeHidden();
});

test('a dialog: Escape closes it and returns focus to the editor', async ({ page }) => {
  await open(page, '<p>text</p>');
  await page.keyboard.press('ControlOrMeta+k');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(content(page)).toBeFocused();
});

// A click on something that takes no focus (the title; in Safari a button or a radio too) used to
// drop focus out of the dialog to the page, and Escape no longer closed it.
test('a dialog keeps focus after a click inside it: Escape still closes it', async ({ page }) => {
  await open(page, '<p>text</p>');
  await page.keyboard.press('ControlOrMeta+k');
  const dialog = page.getByRole('dialog', { name: 'Insert link' });
  await dialog.getByRole('heading', { name: 'Insert link' }).click();
  await expect
    .poll(() => page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]')))
    .toBe(true);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
});

test('toolbar accessibility: Alt+F10, arrows, Escape', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard navigation of the toolbar is a desktop scenario');
  await open(page, '<p>text</p>');
  await page.keyboard.press('Alt+F10');
  const toolbarButtons = page.locator('.nova-toolbar > .nova-tb-group button');
  // undo/redo are inactive (the history is empty): focus goes to the first available control.
  const focusedName = await page.evaluate(() =>
    document.activeElement?.getAttribute('data-control'),
  );
  expect(focusedName).toBe('blocks');
  await page.keyboard.press('ArrowRight');
  expect(await page.evaluate(() => document.activeElement?.getAttribute('data-control'))).toBe(
    'bold',
  );
  // The focused button shows its tooltip: the first Escape dismisses it and focus stays (WCAG
  // 1.4.13), the next one goes back to the text.
  await expect(page.locator('.nova-tooltip')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.nova-tooltip')).toBeHidden();
  expect(await page.evaluate(() => document.activeElement?.getAttribute('data-control'))).toBe(
    'bold',
  );
  await page.keyboard.press('Escape');
  await expect(content(page)).toBeFocused();
  expect(await toolbarButtons.count()).toBeGreaterThan(5);
});

test('a narrow screen: extra groups move into "⋯"', async ({ page }) => {
  await page.setViewportSize({ width: 420, height: 800 });
  await open(page, '<p>text</p>');
  const more = page.locator('.nova-tb-more');
  await expect(more).toBeVisible();
  // The toolbar doesn't overflow.
  const overflow = await page
    .locator('.nova-toolbar')
    .first()
    .evaluate((el) => el.scrollWidth - el.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await more.click();
  const panel = page.locator('.nova-tb-overflow-popover');
  await expect(panel).toBeVisible();
  await panel.locator('[data-control="bullist"]').click();
  expect(await html(page)).toBe('<ul><li><p>text</p></li></ul>');
});

test('a narrow screen, toolbarMode sliding: "⋯" opens a strip under the toolbar', async ({
  page,
}) => {
  await page.setViewportSize({ width: 420, height: 800 });
  await open(page, '<p>text</p>', '?lang=en&toolbar=sliding');
  const more = page.locator('.nova-tb-more');
  const strip = page.locator('.nova-tb-strip');
  await expect(strip).toBeHidden();
  const textTop = await content(page).evaluate((el) => el.getBoundingClientRect().top);
  await more.click();
  await expect(strip).toBeVisible();
  await expect(more).toHaveAttribute('aria-expanded', 'true');
  // The strip is in the flow: the text moves down, nothing covers it.
  expect(await content(page).evaluate((el) => el.getBoundingClientRect().top)).toBeGreaterThan(
    textTop,
  );
  await strip.locator('[data-control="bullist"]').click();
  expect(await html(page)).toBe('<ul><li><p>text</p></li></ul>');
  await more.click();
  await expect(strip).toBeHidden();
});

test('a narrow screen, toolbarMode scrolling: one row that scrolls, no "⋯"', async ({ page }) => {
  await page.setViewportSize({ width: 420, height: 800 });
  await open(page, '<p>text</p>', '?lang=en&toolbar=scrolling');
  const bar = page.locator('.nova-toolbar[role="toolbar"]');
  await expect(page.locator('.nova-tb-more')).toHaveCount(0);
  expect(await bar.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
  // The last button is reachable from the keyboard: it scrolls into view.
  await page.keyboard.press('Alt+F10');
  await page.keyboard.press('End');
  const last = bar.locator('button').last();
  await expect(last).toBeFocused();
  await expect(last).toBeInViewport();
});

test('HTML pasted from Google Docs: the <b style="font-weight:normal"> wrapper doesn\'t make the text bold', async ({
  page,
}) => {
  await open(page);
  // view.pasteHTML runs the same pipeline as a real paste and works the same in every browser
  // (Firefox ignores clipboardData in a synthetic ClipboardEvent).
  await page.evaluate(
    (h) => window.editor.view.pasteHTML(h),
    '<meta charset="utf-8"><b style="font-weight:normal;" id="docs-internal-guid-1"><p dir="ltr"><span style="font-weight:700;">Bold</span><span> plain</span></p></b>',
  );
  expect(await html(page)).toBe('<p><strong>Bold</strong> plain</p>');
});

test('pasting an unsafe link from the clipboard gets cleaned', async ({ page }) => {
  await open(page);
  await page.evaluate(
    (h) => window.editor.view.pasteHTML(h),
    '<p><a href="javascript:alert(1)" onclick="alert(2)">click</a><img src=x onerror=alert(3)></p>',
  );
  const result = await html(page);
  expect(result).not.toContain('javascript:');
  expect(result).not.toContain('onerror');
  expect(result).not.toContain('onclick');
});

test('uploading an image through the dialog', async ({ page }) => {
  await open(page, '<p>text</p>');
  await clickControl(page, 'image');
  const dialog = page.getByRole('dialog', { name: 'Insert image' });
  // 1×1 PNG
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  );
  await dialog
    .locator('input[type="file"]')
    .setInputFiles({ name: 'dot.png', mimeType: 'image/png', buffer: png });
  await expect(dialog).toBeHidden();
  await expect.poll(() => html(page)).toMatch(/<img src="data:image\/png;base64,/);
});

test('the dark theme switches', async ({ page }) => {
  await open(page, '<p>text</p>');
  const bg = () =>
    page.locator('.nova-editor').evaluate((el) => getComputedStyle(el).backgroundColor);
  await page.selectOption('#theme', 'light');
  const light = await bg();
  await page.selectOption('#theme', 'dark');
  expect(await bg()).not.toBe(light);
});

/** A 200×100 PNG drawn in the browser (real sizes for resizing). */
async function openWithImage(page: Page) {
  await page.goto('/?lang=en');
  await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 100;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#3b82f6';
    ctx.fillRect(0, 0, 200, 100);
    window.editor.setContent(
      `<p>before</p><p><img src="${canvas.toDataURL('image/png')}"></p><p>after</p>`,
      {
        addToHistory: false,
      },
    );
  });
  await page.locator('.nova-image img').click();
}

test('an image: the context toolbar and alignment', async ({ page }) => {
  await openWithImage(page);
  const toolbar = page.getByRole('toolbar', { name: 'Image options' });
  await expect(toolbar).toBeVisible();
  await toolbar.getByRole('button', { name: 'Center' }).click();
  expect(await html(page)).toContain(
    'style="display: block; margin-left: auto; margin-right: auto;"',
  );
  await expect(toolbar.getByRole('button', { name: 'Center' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  // A click into the text hides the toolbar.
  await content(page).getByText('after').click();
  await expect(toolbar).toBeHidden();
});

test('an image: resizing by the corner keeps the proportions', async ({ page }) => {
  await openWithImage(page);
  const handle = page.locator('.nova-image-handle-se');
  await expect(handle).toBeVisible();
  const box = (await handle.boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x - 100, y, { steps: 5 });
  await page.mouse.up();
  expect(await html(page)).toMatch(
    /<img src="data:image\/png;base64,[^"]+" width="100" height="50">/,
  );
});

test('an image: deleting from the context toolbar', async ({ page }) => {
  await openWithImage(page);
  await page
    .getByRole('toolbar', { name: 'Image options' })
    .getByRole('button', { name: 'Remove image' })
    .click();
  expect(await html(page)).toBe('<p>before</p><p></p><p>after</p>');
});

test('slash commands: typing, arrows, Enter', async ({ page }) => {
  await open(page);
  await page.keyboard.type('/hea');
  const listbox = page.getByRole('listbox', { name: 'Commands' });
  await expect(listbox).toBeVisible();
  await expect(listbox.getByRole('option').first()).toHaveText(/Heading 1/);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(listbox).toBeHidden();
  await page.keyboard.type('Title');
  expect(await html(page)).toBe('<h2>Title</h2>');
});

test('slash commands: choosing with the mouse and Escape', async ({ page }) => {
  await open(page);
  await page.keyboard.type('/');
  const listbox = page.getByRole('listbox', { name: 'Commands' });
  await listbox.getByRole('option', { name: 'Bulleted list' }).click();
  await page.keyboard.type('item');
  expect(await html(page)).toBe('<ul><li><p>item</p></li></ul>');

  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter'); // leaving the list
  await page.keyboard.type('/quo');
  await expect(listbox).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(listbox).toBeHidden();
  expect(await html(page)).toBe('<ul><li><p>item</p></li></ul><p>/quo</p>');
});

test('the clipboard: Ctrl+V with formatting, Ctrl+Shift+V without', async ({
  page,
  context,
  browserName,
  isMobile,
}) => {
  test.skip(
    browserName !== 'chromium' || isMobile,
    'a test can reach the system clipboard only in desktop Chromium',
  );
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await open(page);
  const writeClipboard = () =>
    page.evaluate(async () => {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob(['<p><strong>bold</strong> text</p>'], { type: 'text/html' }),
          'text/plain': new Blob(['bold text'], { type: 'text/plain' }),
        }),
      ]);
    });
  await writeClipboard();
  await page.keyboard.press('ControlOrMeta+v');
  expect(await html(page)).toBe('<p><strong>bold</strong> text</p>');

  await page.keyboard.press('Enter');
  await writeClipboard();
  await page.keyboard.press('ControlOrMeta+Shift+v');
  expect(await html(page)).toBe('<p><strong>bold</strong> text</p><p>bold text</p>');
});

test('the "paste as text" mode from the "More formatting" menu', async ({ page }) => {
  await open(page);
  await clickControl(page, 'moreformats');
  const item = page.getByRole('menuitemcheckbox', { name: 'Paste as text' });
  await expect(item).toHaveAttribute('aria-checked', 'false');
  await item.click();
  await page.evaluate(() => window.editor.view.pasteHTML('<h2>Big <em>title</em></h2>'));
  expect(await html(page)).toBe('<p>Big title</p>');
});

test('a table: inserting with the grid, Tab through cells and a new row', async ({ page }) => {
  await open(page);
  await clickControl(page, 'table');
  await page.locator('.nova-grid-cell[data-row="2"][data-col="2"]').click();
  await page.keyboard.type('A');
  await page.keyboard.press('Tab');
  await page.keyboard.type('B');
  await page.keyboard.press('Tab');
  await page.keyboard.type('C');
  await page.keyboard.press('Tab');
  await page.keyboard.type('D');
  await page.keyboard.press('Tab'); // in the last cell, a new row
  await page.keyboard.type('E');
  expect(await html(page)).toBe(
    '<table><tbody><tr><th><p>A</p></th><th><p>B</p></th></tr><tr><td><p>C</p></td><td><p>D</p></td></tr><tr><td><p>E</p></td><td><p></p></td></tr></tbody></table>',
  );
});

test('a table: the context toolbar adds a row below and deletes the table', async ({ page }) => {
  await open(
    page,
    '<table><tbody><tr><td><p>a</p></td><td><p>b</p></td></tr></tbody></table><p>after</p>',
  );
  await content(page).getByText('a', { exact: true }).click();
  const toolbar = page.getByRole('toolbar', { name: 'Table options' });
  await expect(toolbar).toBeVisible();
  await toolbar.getByRole('button', { name: 'Insert row below' }).click();
  expect((await html(page)).match(/<tr>/g)).toHaveLength(2);
  await toolbar.getByRole('button', { name: 'Delete table' }).click();
  expect(await html(page)).toBe('<p>after</p>');
  await expect(toolbar).toBeHidden();
});

test('a table: resizing a column by dragging its border', async ({ page, isMobile }) => {
  test.skip(isMobile, 'column resizing is a mouse scenario');
  await open(page, '<table><tbody><tr><td><p>a</p></td><td><p>b</p></td></tr></tbody></table>');
  const cell = content(page).locator('td').first();
  const box = (await cell.boundingBox())!;
  const edgeX = box.x + box.width - 1;
  const y = box.y + box.height / 2;
  await page.mouse.move(edgeX - 6, y);
  await page.mouse.move(edgeX, y, { steps: 3 });
  await page.mouse.down();
  await page.mouse.move(edgeX - 80, y, { steps: 6 });
  await page.mouse.up();
  expect(await html(page)).toMatch(/<td data-colwidth="\d+" style="width: \d+px;"><p>a<\/p><\/td>/);
});

test('search and replace: Ctrl/Cmd+F, Enter through matches, replace all', async ({ page }) => {
  await open(page, '<p>red green red blue red</p>');
  await page.keyboard.press('ControlOrMeta+f');
  const find = page.getByRole('searchbox', { name: 'Find' });
  await expect(find).toBeFocused();
  await find.fill('red');
  await find.press('Enter');
  const count = page.locator('.nova-search-count');
  await expect(count).toHaveText('1 of 3');
  await find.press('Enter');
  await expect(count).toHaveText('2 of 3');
  await expect(content(page).locator('.nova-search-match')).toHaveCount(3);
  await page.getByRole('textbox', { name: 'Replace with' }).fill('pink');
  await page.getByRole('button', { name: 'Replace all' }).click();
  expect(await html(page)).toBe('<p>pink green pink blue pink</p>');
  await expect(count).toHaveText('No results');
  await page.keyboard.press('Escape');
  await expect(page.locator('.nova-search')).toBeHidden();
  await expect(content(page)).toBeFocused();
});

test('fullscreen and help', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard shortcuts are a keyboard scenario');
  await open(page, '<p>text</p>');
  await page.keyboard.press('ControlOrMeta+Shift+f');
  const editorBox = await page.locator('.nova-editor').boundingBox();
  const viewport = page.viewportSize()!;
  expect(Math.round(editorBox!.width)).toBe(viewport.width);
  expect(Math.round(editorBox!.height)).toBe(viewport.height);
  await page.keyboard.press('ControlOrMeta+Shift+f');
  expect((await page.locator('.nova-editor').boundingBox())!.width).toBeLessThan(viewport.width);

  await page.keyboard.press('Alt+0');
  const help = page.getByRole('dialog', { name: 'Keyboard shortcuts' });
  await expect(help).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(help).toBeHidden();
});

test.describe('quickbars', () => {
  const selectionBar = (page: Page) => page.getByRole('toolbar', { name: 'Quick formatting' });
  const insertBar = (page: Page) => page.getByRole('toolbar', { name: 'Quick insert' });

  test('selecting with the mouse: the toolbar after the button is released, then "Bold"', async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'drag selection is a mouse scenario');
    await open(page, '<p>hello brave world</p>');
    const box = (await content(page).locator('p').boundingBox())!;
    const y = box.y + box.height / 2;
    await page.mouse.move(box.x + 2, y);
    await page.mouse.down();
    await page.mouse.move(box.x + 60, y, { steps: 4 });
    // While dragging there is no toolbar.
    await expect(selectionBar(page)).toBeHidden();
    await page.mouse.up();
    await expect(selectionBar(page)).toBeVisible();
    await selectionBar(page).getByRole('button', { name: 'Bold' }).click();
    expect(await html(page)).toMatch(/^<p><strong>[^<]+<\/strong>/);
  });

  test('selecting from the keyboard and the H2 heading', async ({ page }) => {
    await open(page, '<p>title</p>');
    await page.keyboard.press('Home');
    await page.keyboard.press('Shift+End');
    await expect(selectionBar(page)).toBeVisible();
    await selectionBar(page).getByRole('button', { name: 'Heading 2' }).click();
    expect(await html(page)).toBe('<h2>title</h2>');
  });

  test('an empty line: the insert toolbar → a table', async ({ page, isMobile }) => {
    test.skip(isMobile, 'a phone has no insert toolbar: see the test below');
    await open(page, '<p>text</p><p></p>');
    await expect(insertBar(page)).toBeVisible();
    await insertBar(page).getByRole('button', { name: 'Insert table' }).click();
    expect(await html(page)).toContain('<table>');
    await expect(insertBar(page)).toBeHidden();
  });

  test('a phone: the formatting toolbar above the keyboard at full width, no insert toolbar on an empty line', async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, 'a touch screen');
    // Next to a selection a phone shows its handles and the system menu: the toolbar is pinned to the bottom of the visible
    // part of the window (above the keyboard) and doesn't cover the text.
    await open(page, '<p>title</p><p></p>');
    await expect(insertBar(page)).toBeHidden();
    await content(page).locator('p').first().click();
    await page.keyboard.press('Home');
    await page.keyboard.press('Shift+End');
    const bar = selectionBar(page);
    await expect(bar).toBeVisible();
    const box = (await bar.boundingBox())!;
    const viewport = page.viewportSize()!;
    expect(Math.round(box.x)).toBe(0);
    expect(Math.round(box.width)).toBe(viewport.width);
    expect(Math.round(box.y + box.height)).toBe(viewport.height);
    await bar.getByRole('button', { name: 'Bold' }).click();
    expect(await html(page)).toBe('<p><strong>title</strong></p><p></p>');
  });

  test('selecting text in a table shows the formatting toolbar, not the table one', async ({
    page,
  }) => {
    await open(page, '<table><tbody><tr><td><p>cell text</p></td></tr></tbody></table>');
    await content(page).getByText('cell text').dblclick();
    await expect(selectionBar(page)).toBeVisible();
    await expect(page.getByRole('toolbar', { name: 'Table options' })).toBeHidden();
  });
});

test("content restrictions: what is forbidden doesn't appear from the toolbar, a shortcut or a paste", async ({
  page,
}) => {
  await open(page, '<p></p>', '?lang=en&invalid=h1,table,strong');
  await expect(page.locator('[data-control="table"]')).toHaveCount(0);
  await expect(page.locator('[data-control="bold"]')).toHaveCount(0);
  await page.keyboard.type('# not a heading');
  expect(await html(page)).toBe('<p># not a heading</p>');
  await page.keyboard.press('ControlOrMeta+b');
  await page.keyboard.type('!');
  expect(await html(page)).toBe('<p># not a heading!</p>');
  await page.evaluate(() =>
    window.editor.view.pasteHTML(
      '<h1>Big</h1><table><tr><td><strong>cell</strong></td></tr></table>',
    ),
  );
  const result = await html(page);
  expect(result).not.toMatch(/<h1|<table|<strong/);
  expect(result).toContain('Big');
  expect(result).toContain('cell');
});

test.describe('the menubar and modes', () => {
  test('the menubar: mouse and keyboard (Alt+F9, arrows, Enter)', async ({ page, isMobile }) => {
    test.skip(isMobile, 'keyboard navigation is a desktop scenario');
    await open(page, '<p>text</p>', '?lang=en&menubar=1');
    await page.keyboard.press('ControlOrMeta+a');
    await page.getByRole('menuitem', { name: 'Format' }).click();
    await page.getByRole('menuitemcheckbox', { name: 'Italic' }).click();
    expect(await html(page)).toBe('<p><em>text</em></p>');

    await page.keyboard.press('Alt+F9');
    await expect(page.getByRole('menuitem', { name: 'File' })).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('menuitem', { name: 'Edit' })).toBeFocused();
    await page.keyboard.press('ArrowDown');
    const menu = page.getByRole('menu', { name: 'Edit' });
    await expect(menu).toBeVisible();
    // ← / → with a menu open move to the neighboring menus.
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('menu', { name: 'View' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menu', { name: 'View' })).toBeHidden();
  });

  test('inline: the toolbar appears only on focus', async ({ page }) => {
    await page.goto('/?lang=en&mode=inline');
    const header = page.locator('.nova-header');
    await expect(header).toBeHidden();
    await content(page).click();
    await expect(header).toBeVisible();
    // A regression: the header floats ABOVE the text instead of covering it.
    const h = (await header.boundingBox())!;
    const c = (await page.locator('.nova-content').boundingBox())!;
    expect(h.y + h.height).toBeLessThanOrEqual(c.y);
    await page.locator('#output').click();
    await expect(header).toBeHidden();
  });

  test('distraction-free: no panels, formatting through quickbars', async ({ page }) => {
    await open(page, '<p>focus</p>', '?lang=en&mode=distraction-free');
    await expect(page.locator('.nova-header')).toHaveCount(0);
    await page.keyboard.press('Home');
    await page.keyboard.press('Shift+End');
    const bar = page.getByRole('toolbar', { name: 'Quick formatting' });
    await expect(bar).toBeVisible();
    await bar.getByRole('button', { name: 'Bold' }).click();
    expect(await html(page)).toBe('<p><strong>focus</strong></p>');
  });
});

test('spaces typed by the user survive saving and loading', async ({ page, isMobile }) => {
  await open(page);
  // An indent at the start, a double space, a space after Shift+Enter and at the end of a paragraph.
  await page.keyboard.type('  a  b');
  // In Android emulation a synthetic Shift+Enter gives no events, unlike a real keyboard
  // (ProseMirror on Android waits for beforeinput): check on a real device.
  if (!isMobile) await page.keyboard.press('Shift+Enter');
  await page.keyboard.type(' c ');
  // The document text (not the DOM: it has ProseMirror's service nodes); a line break is "|",
  // a non-breaking space counts as a regular one: they look the same.
  const text = () =>
    page.evaluate(() => {
      type Doc = {
        content: { size: number };
        textBetween(from: number, to: number, block: string, leaf: string): string;
      };
      const { doc } = (window.editor as unknown as { view: { state: { doc: Doc } } }).view.state;
      return doc.textBetween(0, doc.content.size, '\n', '|').replace(/\u00a0/g, ' ');
    });
  const typed = await text();
  expect(typed).toBe(isMobile ? '  a  b c ' : '  a  b| c ');
  // "Save" and "open again".
  await page.evaluate(() => window.editor.setContent(window.editor.getHTML()));
  expect(await text()).toBe(typed);
});

test('a paragraph indent with the button; Tab in a paragraph moves focus away instead of indenting', async ({
  page,
  isMobile,
}) => {
  await open(page, '<p>Text</p>');
  await clickControl(page, 'indent');
  expect(await html(page)).toBe('<p style="margin-left: 40px;">Text</p>');
  await clickControl(page, 'outdent');
  expect(await html(page)).toBe('<p>Text</p>');
  test.skip(isMobile, 'Tab is a keyboard scenario');
  await content(page).click();
  await page.keyboard.press('Tab');
  expect(await html(page)).toBe('<p>Text</p>');
  const focusedInEditor = await page.evaluate(() =>
    document.activeElement?.classList.contains('nova-prosemirror'),
  );
  expect(focusedInEditor).toBe(false);
});

test('an image caption: the button in the image toolbar, typing the caption, Enter continues with text', async ({
  page,
}) => {
  // A 1×1 PNG image: no network.
  const png =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  await open(page, `<p><img src="${png}" width="120" height="80"></p>`);
  await page.locator('.nova-prosemirror img[src^="data:"]').click();
  const imageToolbar = page.getByRole('toolbar', { name: 'Image options' });
  await imageToolbar.locator('[data-control="imagecaption"]').click();
  await page.keyboard.type('Sunset');
  await page.keyboard.press('Enter');
  await page.keyboard.type('Next');
  expect(await html(page)).toBe(
    `<figure style="width: 120px;"><img src="${png}" width="120" height="80"><figcaption>Sunset</figcaption></figure><p>Next</p>`,
  );
  // Removing the caption: its text isn't lost.
  await page.locator('.nova-prosemirror figcaption').click();
  await imageToolbar.locator('[data-control="imagecaption"]').click();
  expect(await html(page)).toBe(
    `<p><img src="${png}" width="120" height="80"></p><p>Sunset</p><p>Next</p>`,
  );
});

test('the first click into an unfocused editor lands where you clicked, not at the start of the document', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'a phone has taps, not mouse clicks to the right of a line');
  // Happened in Chromium and WebKit: a click to the right of the LAST line (away from the text) on the first focus
  // put the cursor at the start of the document; the content was loaded through setContent, as apps do.
  await page.goto('/?lang=en');
  await page.evaluate(async () => {
    await window.editor.ready;
    window.editor.setContent('<p>First line</p><p>Second line</p><p>Third line</p>');
  });
  const lines = content(page).locator(':scope > p');
  const box = (await lines.nth(2).boundingBox())!;
  await page.mouse.click(box.x + box.width - 8, box.y + box.height / 2);
  await page.keyboard.type('!');
  expect(await html(page)).toBe('<p>First line</p><p>Second line</p><p>Third line!</p>');

  // Below the last line (the padding of the text area), unfocused again: into the last line.
  await page.evaluate(() => window.editor.setContent('<p>First line</p><p></p>'));
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  const last = (await lines.nth(1).boundingBox())!;
  const area = (await content(page).boundingBox())!;
  await page.mouse.click(
    last.x + 20,
    Math.min(area.y + area.height - 4, last.y + last.height + 10),
  );
  await page.keyboard.type('?');
  expect(await html(page)).toBe('<p>First line</p><p>?</p>');
});
