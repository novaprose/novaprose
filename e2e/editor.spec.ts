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

/** Нажать контрол тулбара, где бы он ни был: на панели или в «⋯» (узкий экран). */
async function clickControl(page: Page, name: string) {
  if (await control(page, name).isVisible()) return control(page, name).click();
  await page.locator('.nova-tb-more').click();
  await page.locator(`.nova-tb-overflow-popover [data-control="${name}"]`).click();
}

/** Открыть playground с заданным содержимым и курсором в конце документа. */
async function open(page: Page, initial = '<p></p>', query = '?lang=en') {
  await page.goto(`/${query}`);
  // Ленивые плагины (quickbars, insertdatetime) должны успеть подключиться — иначе под нагрузкой
  // тест начинает нажимать клавиши раньше, чем появятся их панели.
  await page.evaluate(async (value) => {
    await window.editor.ready;
    window.editor.setContent(value, { addToHistory: false });
  }, initial);
  await content(page).click();
  await page.keyboard.press('ControlOrMeta+End');
}

test('набор текста и Ctrl/Cmd+B', async ({ page, isMobile }) => {
  await open(page);
  await page.keyboard.type('Hello ');
  await page.keyboard.press('ControlOrMeta+b');
  await page.keyboard.type('bold');
  expect(await html(page)).toBe('<p>Hello <strong>bold</strong></p>');
  if (!isMobile) await expect(control(page, 'bold')).toHaveAttribute('aria-pressed', 'true');
});

test('markdown-шорткаты: заголовок, список, цитата', async ({ page }) => {
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

test('меню стиля блока меняет абзац на заголовок', async ({ page }) => {
  await open(page, '<p>text</p>');
  await clickControl(page, 'blocks');
  await page.getByRole('menuitemradio', { name: 'Heading 2' }).click();
  expect(await html(page)).toBe('<h2>text</h2>');
  await page.locator('.nova-statusbar').waitFor();
  await expect(page.locator('.nova-path')).toHaveText('h2');
});

test('цвет текста сохраняется в hex', async ({ page }) => {
  await open(page, '<p>text</p>');
  await page.keyboard.press('ControlOrMeta+a');
  await clickControl(page, 'forecolor');
  await page.getByRole('gridcell', { name: '#3b82f6' }).click();
  expect(await html(page)).toBe('<p><span style="color: #3b82f6;">text</span></p>');
});

test('ссылка: Ctrl/Cmd+K → диалог → панель ссылки → удаление', async ({ page }) => {
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

  // Курсор внутри ссылки → появляется панель.
  await content(page).locator('a').click();
  const bubble = page.getByRole('toolbar', { name: 'Link', exact: true });
  await expect(bubble).toBeVisible();
  await expect(bubble.locator('a')).toHaveText('https://example.com');
  await bubble.getByRole('button', { name: 'Remove link' }).click();
  expect(await html(page)).toBe('<p>site</p>');
  await expect(bubble).toBeHidden();
});

test('диалог: Escape закрывает и возвращает фокус в редактор', async ({ page }) => {
  await open(page, '<p>text</p>');
  await page.keyboard.press('ControlOrMeta+k');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(content(page)).toBeFocused();
});

test('доступность тулбара: Alt+F10, стрелки, Escape', async ({ page, isMobile }) => {
  test.skip(isMobile, 'клавиатурная навигация по тулбару — сценарий десктопа');
  await open(page, '<p>text</p>');
  await page.keyboard.press('Alt+F10');
  const toolbarButtons = page.locator('.nova-toolbar > .nova-tb-group button');
  // undo/redo неактивны (история пуста) — фокус на первом доступном контроле.
  const focusedName = await page.evaluate(() =>
    document.activeElement?.getAttribute('data-control'),
  );
  expect(focusedName).toBe('blocks');
  await page.keyboard.press('ArrowRight');
  expect(await page.evaluate(() => document.activeElement?.getAttribute('data-control'))).toBe(
    'bold',
  );
  await page.keyboard.press('Escape');
  await expect(content(page)).toBeFocused();
  expect(await toolbarButtons.count()).toBeGreaterThan(5);
});

test('узкий экран: лишние группы уходят в «⋯»', async ({ page }) => {
  await page.setViewportSize({ width: 420, height: 800 });
  await open(page, '<p>text</p>');
  const more = page.locator('.nova-tb-more');
  await expect(more).toBeVisible();
  // Тулбар не переполнен.
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

test('вставка HTML из Google Docs: обёртка <b style="font-weight:normal"> не делает текст жирным', async ({
  page,
}) => {
  await open(page);
  // view.pasteHTML прогоняет тот же конвейер, что и настоящая вставка, и одинаково работает во всех браузерах
  // (Firefox игнорирует clipboardData в синтетическом ClipboardEvent).
  await page.evaluate(
    (h) => window.editor.view.pasteHTML(h),
    '<meta charset="utf-8"><b style="font-weight:normal;" id="docs-internal-guid-1"><p dir="ltr"><span style="font-weight:700;">Bold</span><span> plain</span></p></b>',
  );
  expect(await html(page)).toBe('<p><strong>Bold</strong> plain</p>');
});

test('вставка небезопасной ссылки из буфера очищается', async ({ page }) => {
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

test('загрузка картинки через диалог', async ({ page }) => {
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

test('тёмная тема переключается', async ({ page }) => {
  await open(page, '<p>text</p>');
  const bg = () =>
    page.locator('.nova-editor').evaluate((el) => getComputedStyle(el).backgroundColor);
  await page.selectOption('#theme', 'light');
  const light = await bg();
  await page.selectOption('#theme', 'dark');
  expect(await bg()).not.toBe(light);
});

/** PNG 200×100, нарисованный в браузере (настоящие размеры для ресайза). */
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

test('картинка: контекстный тулбар и выравнивание', async ({ page }) => {
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
  // Клик в текст — тулбар прячется.
  await content(page).getByText('after').click();
  await expect(toolbar).toBeHidden();
});

test('картинка: ресайз за угол сохраняет пропорции', async ({ page }) => {
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

test('картинка: удаление из контекстного тулбара', async ({ page }) => {
  await openWithImage(page);
  await page
    .getByRole('toolbar', { name: 'Image options' })
    .getByRole('button', { name: 'Remove image' })
    .click();
  expect(await html(page)).toBe('<p>before</p><p></p><p>after</p>');
});

test('слэш-команды: набор, стрелки, Enter', async ({ page }) => {
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

test('слэш-команды: выбор мышью и Escape', async ({ page }) => {
  await open(page);
  await page.keyboard.type('/');
  const listbox = page.getByRole('listbox', { name: 'Commands' });
  await listbox.getByRole('option', { name: 'Bulleted list' }).click();
  await page.keyboard.type('item');
  expect(await html(page)).toBe('<ul><li><p>item</p></li></ul>');

  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter'); // выход из списка
  await page.keyboard.type('/quo');
  await expect(listbox).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(listbox).toBeHidden();
  expect(await html(page)).toBe('<ul><li><p>item</p></li></ul><p>/quo</p>');
});

test('буфер обмена: Ctrl+V с форматированием, Ctrl+Shift+V — без', async ({
  page,
  context,
  browserName,
  isMobile,
}) => {
  test.skip(
    browserName !== 'chromium' || isMobile,
    'доступ к системному буферу из теста есть только в десктопном Chromium',
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

test('режим «вставлять как текст» из меню «Ещё формат»', async ({ page }) => {
  await open(page);
  await clickControl(page, 'moreformats');
  const item = page.getByRole('menuitemcheckbox', { name: 'Paste as text' });
  await expect(item).toHaveAttribute('aria-checked', 'false');
  await item.click();
  await page.evaluate(() => window.editor.view.pasteHTML('<h2>Big <em>title</em></h2>'));
  expect(await html(page)).toBe('<p>Big title</p>');
});

test('таблица: вставка сеткой, Tab по ячейкам и новая строка', async ({ page }) => {
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
  await page.keyboard.press('Tab'); // в последней ячейке — новая строка
  await page.keyboard.type('E');
  expect(await html(page)).toBe(
    '<table><tbody><tr><th><p>A</p></th><th><p>B</p></th></tr><tr><td><p>C</p></td><td><p>D</p></td></tr><tr><td><p>E</p></td><td><p></p></td></tr></tbody></table>',
  );
});

test('таблица: контекстный тулбар — строка ниже и удаление таблицы', async ({ page }) => {
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

test('таблица: ресайз колонки перетаскиванием границы', async ({ page, isMobile }) => {
  test.skip(isMobile, 'ресайз колонок — сценарий мыши');
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

test('поиск и замена: Ctrl/Cmd+F, Enter по совпадениям, заменить все', async ({ page }) => {
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

test('полноэкранный режим и справка', async ({ page, isMobile }) => {
  test.skip(isMobile, 'горячие клавиши — сценарий клавиатуры');
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

  test('выделение мышью: панель после отпускания кнопки, затем «Жирный»', async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'выделение протягиванием — сценарий мыши');
    await open(page, '<p>hello brave world</p>');
    const box = (await content(page).locator('p').boundingBox())!;
    const y = box.y + box.height / 2;
    await page.mouse.move(box.x + 2, y);
    await page.mouse.down();
    await page.mouse.move(box.x + 60, y, { steps: 4 });
    // Во время протягивания панели нет.
    await expect(selectionBar(page)).toBeHidden();
    await page.mouse.up();
    await expect(selectionBar(page)).toBeVisible();
    await selectionBar(page).getByRole('button', { name: 'Bold' }).click();
    expect(await html(page)).toMatch(/^<p><strong>[^<]+<\/strong>/);
  });

  test('выделение с клавиатуры и заголовок H2', async ({ page }) => {
    await open(page, '<p>title</p>');
    await page.keyboard.press('Home');
    await page.keyboard.press('Shift+End');
    await expect(selectionBar(page)).toBeVisible();
    await selectionBar(page).getByRole('button', { name: 'Heading 2' }).click();
    expect(await html(page)).toBe('<h2>title</h2>');
  });

  test('пустая строка: панель вставки → таблица', async ({ page }) => {
    await open(page, '<p>text</p><p></p>');
    await expect(insertBar(page)).toBeVisible();
    await insertBar(page).getByRole('button', { name: 'Insert table' }).click();
    expect(await html(page)).toContain('<table>');
    await expect(insertBar(page)).toBeHidden();
  });

  test('выделение текста в таблице — панель форматирования, а не таблицы', async ({ page }) => {
    await open(page, '<table><tbody><tr><td><p>cell text</p></td></tr></tbody></table>');
    await content(page).getByText('cell text').dblclick();
    await expect(selectionBar(page)).toBeVisible();
    await expect(page.getByRole('toolbar', { name: 'Table options' })).toBeHidden();
  });
});

test('ограничения контента: запрещённое не появляется ни из тулбара, ни из шортката, ни из вставки', async ({
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

test.describe('менюбар и режимы', () => {
  test('менюбар: мышь и клавиатура (Alt+F9, стрелки, Enter)', async ({ page, isMobile }) => {
    test.skip(isMobile, 'клавиатурная навигация — десктоп');
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
    // ← / → при открытом меню — соседние меню.
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('menu', { name: 'View' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menu', { name: 'View' })).toBeHidden();
  });

  test('inline: панель появляется только при фокусе', async ({ page }) => {
    await page.goto('/?lang=en&mode=inline');
    const header = page.locator('.nova-header');
    await expect(header).toBeHidden();
    await content(page).click();
    await expect(header).toBeVisible();
    // Регрессия: шапка всплывает НАД текстом, а не накрывает его.
    const h = (await header.boundingBox())!;
    const c = (await page.locator('.nova-content').boundingBox())!;
    expect(h.y + h.height).toBeLessThanOrEqual(c.y);
    await page.locator('#output').click();
    await expect(header).toBeHidden();
  });

  test('distraction-free: без панелей, форматирование через quickbars', async ({ page }) => {
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

test('пробелы, набранные пользователем, переживают сохранение и загрузку', async ({
  page,
  isMobile,
}) => {
  await open(page);
  // Отступ в начале, двойной пробел, пробел после Shift+Enter и в конце абзаца.
  await page.keyboard.type('  a  b');
  // В эмуляции Android синтетический Shift+Enter не даёт событий, как настоящая клавиатура
  // (ProseMirror на Android ждёт beforeinput) — проверить на реальном устройстве.
  if (!isMobile) await page.keyboard.press('Shift+Enter');
  await page.keyboard.type(' c ');
  // Текст документа (не DOM: там служебные узлы ProseMirror); перенос строки — «|»,
  // неразрывный пробел считаем обычным — визуально они одинаковы.
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
  // «Сохранить» и «открыть заново».
  await page.evaluate(() => window.editor.setContent(window.editor.getHTML()));
  expect(await text()).toBe(typed);
});

test('отступ абзаца кнопкой; Tab в абзаце уводит фокус, а не отступает', async ({
  page,
  isMobile,
}) => {
  await open(page, '<p>Text</p>');
  await clickControl(page, 'indent');
  expect(await html(page)).toBe('<p style="margin-left: 40px;">Text</p>');
  await clickControl(page, 'outdent');
  expect(await html(page)).toBe('<p>Text</p>');
  test.skip(isMobile, 'Tab — сценарий клавиатуры');
  await content(page).click();
  await page.keyboard.press('Tab');
  expect(await html(page)).toBe('<p>Text</p>');
  const focusedInEditor = await page.evaluate(() =>
    document.activeElement?.classList.contains('nova-prosemirror'),
  );
  expect(focusedInEditor).toBe(false);
});

test('подпись к картинке: кнопка в панели картинки, набор подписи, Enter — дальше текст', async ({
  page,
}) => {
  // Картинка 1×1 PNG — без сети.
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
  // Убрать подпись: текст подписи не теряется.
  await page.locator('.nova-prosemirror figcaption').click();
  await imageToolbar.locator('[data-control="imagecaption"]').click();
  expect(await html(page)).toBe(
    `<p><img src="${png}" width="120" height="80"></p><p>Sunset</p><p>Next</p>`,
  );
});

test('первый щелчок в редактор без фокуса — туда, куда щёлкнули, а не в начало документа', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'на телефоне — касание, не щелчок мышью справа от строки');
  // Было в Chromium и WebKit: щелчок справа от ПОСЛЕДНЕЙ строки (не по тексту) при первом фокусе
  // ставил курсор в начало документа — содержимое загружено через setContent, как у приложений.
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

  // Ниже последней строки (поле области текста), снова без фокуса — в последнюю строку.
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
