import { existsSync, readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

/**
 * CDN builds on a page "as a customer has it", without a bundler:
 *  - the tinymce.min.js drop-in (init in <head>, the styles attach by themselves);
 *  - the global NovaProse from a script inserted by code (the way the CRM attaches it).
 * Lazy parts (table mechanics, plugins, dialogs) load from the same CDN address
 * as the main file: this checks that they really came from there and work.
 */

/** Serves the build files from https://cdn.example.com/… (with the parts subfolders); the list of requests. */
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

test('CDN: the tinymce.min.js drop-in without other changes to the page', async ({ page }) => {
  test.skip(
    !existsSync('packages/tinymce-compat/dist/tinymce.global.js'),
    'needs a build: pnpm --filter "@novaprose/tinymce-compat..." build',
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
    language: 'de',
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
  // The styles attached by themselves.
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
  // Lazy parts came from the CDN: table mechanics (in the background) and the charmap plugin (by name).
  await expect
    .poll(() => requested.some((f) => /^tinymce-chunks\/table-\w+\.js$/.test(f)))
    .toBe(true);
  expect(requested.some((f) => /^tinymce-chunks\/charmap-\w+\.js$/.test(f))).toBe(true);
  await expect(page.locator('[data-control="charmap"]').first()).toBeAttached();
  // The language is a separate part: init waited for it, the interface is in German right away.
  expect(requested.some((f) => /^tinymce-chunks\/de-\w+\.js$/.test(f))).toBe(true);
  await expect(page.locator('[data-control="bold"]').first()).toHaveAttribute('aria-label', /Fett/);
  expect(errors).toEqual([]);
});

test('CDN: the global NovaProse from an inserted script; tables and plugins from parts', async ({
  page,
}) => {
  test.skip(
    !existsSync('packages/web-component/dist/novaprose.global.js'),
    'needs a build: pnpm --filter "@novaprose/web-component..." build',
  );
  const requested = await serveCdn(page, 'packages/web-component/dist/');
  // As in the CRM: the script is added by code, the editor is created in onload, after the language loads.
  await site(
    page,
    `<!doctype html><html><head>
<link rel="stylesheet" href="https://cdn.example.com/novaprose.css">
</head><body><div id="editor"></div><script>
  const script = document.createElement('script');
  script.src = 'https://cdn.example.com/novaprose.global.js';
  script.onload = async () => {
    await NovaProse.loadLanguage('fr');
    window.editor = NovaProse.createEditor({
      element: document.getElementById('editor'),
      language: 'fr',
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
  // Table mechanics from a part: Tab moves to the next cell and selects its text
  // (without the mechanics Tab would leave the editor and "X" would land nowhere).
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
  // French is a separate part from the same address (loadLanguage), not in the main file.
  expect(requested.some((f) => /^novaprose-chunks\/fr-\w+\.js$/.test(f))).toBe(true);
  await expect(page.locator('[data-control="bold"]').first()).toHaveAttribute('aria-label', /Gras/);
  // The field description dialog comes from a part too.
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
