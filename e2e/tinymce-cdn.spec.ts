import { existsSync, readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
/** CDN-сборка вместо tinymce.min.js на странице «как у клиента»: init в <head>, стили подключаются сами. */
test('CDN: замена tinymce.min.js без других правок страницы', async ({ page }) => {
  test.skip(
    !existsSync('packages/tinymce-compat/dist/tinymce.global.js'),
    'нужна сборка: pnpm --filter "@novaprose/tinymce-compat..." build',
  );
  const dist = 'packages/tinymce-compat/dist/';
  await page.route('https://cdn.example.com/**', (route) => {
    const file = route.request().url().split('/').pop()!;
    route.fulfill({
      body: readFileSync(dist + file),
      contentType: file.endsWith('.css') ? 'text/css' : 'text/javascript',
    });
  });
  await page.route('https://site.example.com/', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: `<!doctype html><html><head>
<script src="https://cdn.example.com/tinymce.global.js" referrerpolicy="origin"></script>
<script>
  tinymce.init({
    selector: 'textarea#default',
    plugins: 'lists link image table code help wordcount',
    toolbar: 'undo redo | blocks | bold italic | alignleft aligncenter | bullist numlist | link image | code',
    menubar: 'file edit insert format',
    setup: (editor) => { editor.on('init', () => { document.body.dataset.ready = '1'; }); },
  });
</script></head><body>
<form method="post"><textarea id="default"><p>Existing <em>content</em></p></textarea><button>Save</button></form>
</body></html>`,
    }),
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
  expect(errors).toEqual([]);
});
