import { existsSync, readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

/**
 * CDN-сборки на странице «как у клиента», без сборщика:
 *  - замена tinymce.min.js (init в <head>, стили подключаются сами);
 *  - глобальный NovaProse из скрипта, вставленного кодом (так подключает CRM).
 * Ленивые части (механика таблиц, плагины, диалоги) подгружаются с того же CDN-адреса,
 * что и основной файл, — проверяем, что они действительно пришли оттуда и работают.
 */

/** Раздать файлы сборки с https://cdn.example.com/… (с подпапками частей); список запросов. */
async function serveCdn(page: Page, dist: string): Promise<string[]> {
  const requested: string[] = [];
  await page.route('https://cdn.example.com/**', (route) => {
    const file = new URL(route.request().url()).pathname.slice(1);
    requested.push(file);
    if (!existsSync(dist + file)) return route.fulfill({ status: 404, body: 'not found' });
    route.fulfill({
      body: readFileSync(dist + file),
      contentType: file.endsWith('.css') ? 'text/css' : 'text/javascript',
      headers: { 'access-control-allow-origin': '*' },
    });
  });
  return requested;
}

function site(page: Page, html: string) {
  return page.route('https://site.example.com/', (route) =>
    route.fulfill({ contentType: 'text/html', body: html }),
  );
}

test('CDN: замена tinymce.min.js без других правок страницы', async ({ page }) => {
  test.skip(
    !existsSync('packages/tinymce-compat/dist/tinymce.global.js'),
    'нужна сборка: pnpm --filter "@novaprose/tinymce-compat..." build',
  );
  const requested = await serveCdn(page, 'packages/tinymce-compat/dist/');
  await site(
    page,
    `<!doctype html><html><head>
<script src="https://cdn.example.com/tinymce.global.js" referrerpolicy="origin"></script>
<script>
  tinymce.init({
    selector: 'textarea#default',
    plugins: 'lists link image table code help wordcount charmap',
    toolbar: 'undo redo | blocks | bold italic | alignleft aligncenter | bullist numlist | link image | code charmap',
    menubar: 'file edit insert format',
    setup: (editor) => { editor.on('init', () => { document.body.dataset.ready = '1'; }); },
  });
</script></head><body>
<form method="post"><textarea id="default"><p>Existing <em>content</em></p></textarea><button>Save</button></form>
</body></html>`,
  );
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('https://site.example.com/');
  await expect(page.locator('body')).toHaveAttribute('data-ready', '1');
  // Стили подключились сами.
  await expect(page.locator('link[data-novaprose-css]')).toHaveAttribute(
    'href',
    'https://cdn.example.com/novaprose.css',
  );
  const content = page.locator('.nova-prosemirror');
  await expect(content).toContainText('Existing content');
  await content.click();
  await page.keyboard.press('ControlOrMeta+End');
  await page.keyboard.type(' and more');
  expect(
    await page.evaluate(() =>
      (
        window as unknown as { tinymce: { activeEditor: { getContent(): string } } }
      ).tinymce.activeEditor.getContent(),
    ),
  ).toBe('<p>Existing <em>content and more</em></p>');
  expect(
    await page.evaluate(
      () => getComputedStyle(document.querySelector('.nova-editor')!).borderTopStyle,
    ),
  ).toBe('solid');
  // Ленивые части пришли с CDN: механика таблиц (в фоне) и плагин charmap (по имени).
  await expect
    .poll(() => requested.some((f) => /^tinymce-chunks\/table-\w+\.js$/.test(f)))
    .toBe(true);
  expect(requested.some((f) => /^tinymce-chunks\/charmap-\w+\.js$/.test(f))).toBe(true);
  await expect(page.locator('[data-control="charmap"]').first()).toBeAttached();
  expect(errors).toEqual([]);
});

test('CDN: глобальный NovaProse из вставленного скрипта; таблицы и плагины из частей', async ({
  page,
}) => {
  test.skip(
    !existsSync('packages/web-component/dist/novaprose.global.js'),
    'нужна сборка: pnpm --filter "@novaprose/web-component..." build',
  );
  const requested = await serveCdn(page, 'packages/web-component/dist/');
  // Как в CRM: скрипт добавляется кодом, редактор создаётся в onload.
  await site(
    page,
    `<!doctype html><html><head>
<link rel="stylesheet" href="https://cdn.example.com/novaprose.css">
</head><body><div id="editor"></div><script>
  const script = document.createElement('script');
  script.src = 'https://cdn.example.com/novaprose.global.js';
  script.onload = () => {
    window.editor = NovaProse.createEditor({
      element: document.getElementById('editor'),
      language: 'ru',
      plugins: ['insertdatetime'],
      content: '<table><tbody><tr><td><p>a</p></td><td><p>b</p></td></tr></tbody></table>',
    });
    document.body.dataset.ready = '1';
  };
  document.head.append(script);
</script></body></html>`,
  );
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('https://site.example.com/');
  await expect(page.locator('body')).toHaveAttribute('data-ready', '1');
  await page.evaluate(
    () => (window as unknown as { editor: { ready: Promise<void> } }).editor.ready,
  );
  // Механика таблиц из части: Tab переходит в следующую ячейку и выделяет её текст
  // (без механики Tab ушёл бы из редактора, а «X» никуда бы не попал).
  await page.locator('.nova-prosemirror td').first().click();
  await page.keyboard.press('Tab');
  await page.keyboard.type('X');
  expect(
    await page.evaluate(() =>
      (window as unknown as { editor: { getHTML(): string } }).editor.getHTML(),
    ),
  ).toBe('<table><tbody><tr><td><p>a</p></td><td><p>X</p></td></tr></tbody></table>');
  expect(requested.some((f) => /^novaprose-chunks\/table-\w+\.js$/.test(f))).toBe(true);
  expect(requested.some((f) => /^novaprose-chunks\/insertdatetime-\w+\.js$/.test(f))).toBe(true);
  // Русский встроен в CDN-сборку.
  await expect(page.locator('[data-control="bold"]').first()).toHaveAttribute(
    'aria-label',
    /Жирный/,
  );
  // Диалог по описанию полей — тоже из части.
  const result = page.evaluate(() =>
    (
      window as unknown as { editor: { ui: { dialog(spec: object): Promise<unknown> } } }
    ).editor.ui.dialog({
      title: 'Test',
      fields: [{ type: 'text', name: 'a', label: 'A', required: true }],
    }),
  );
  await page.locator('[role="dialog"] input').fill('ok');
  await page.locator('[role="dialog"] button[type="submit"]').click();
  expect(await result).toEqual({ a: 'ok' });
  expect(requested.some((f) => /^novaprose-chunks\/form-dialog-\w+\.js$/.test(f))).toBe(true);
  expect(errors).toEqual([]);
});
