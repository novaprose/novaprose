import { expect, test, type Page } from '@playwright/test';

/**
 * Диалоги плагинов (editor.ui.dialog) в настоящих браузерах: вкладки с клавиатуры, выбор файла
 * через системный input и перетаскивание файлов в зону. jsdom не умеет ни то, ни другое.
 */

type W = {
  editor: { ready: Promise<void>; ui: { dialog(spec: object): Promise<unknown> } };
  result?: unknown;
};

async function openDialog(page: Page) {
  await page.goto('/?lang=en');
  await page.evaluate(async () => {
    const w = window as unknown as W;
    await w.editor.ready;
    void w.editor.ui
      .dialog({
        title: 'Attach',
        submitLabel: 'Attach',
        tabs: [
          {
            title: 'Files',
            fields: [
              {
                type: 'file',
                name: 'files',
                label: 'Attachments',
                accept: 'image/*,.txt',
                multiple: true,
                required: true,
              },
            ],
          },
          { title: 'Details', fields: [{ type: 'text', name: 'note', label: 'Note' }] },
        ],
      })
      .then((data) => (w.result = data));
  });
  await expect(page.locator('[role="dialog"]')).toBeVisible();
}

test('вкладки с клавиатуры, файл через input и перетаскиванием', async ({ page }) => {
  await openDialog(page);
  // Файл через системный выбор (скрытый input, подписанный зоной).
  await page.locator('[role="dialog"] input[type="file"]').setInputFiles({
    name: 'notes.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('hello'),
  });
  // Файл перетаскиванием: настоящее событие drop с DataTransfer.
  const transfer = await page.evaluateHandle(() => {
    const dt = new DataTransfer();
    dt.items.add(new File(['png'], 'photo.png', { type: 'image/png' }));
    return dt;
  });
  await page.locator('.nova-dropzone').dispatchEvent('drop', { dataTransfer: transfer });
  await expect(page.locator('.nova-file-name')).toHaveText(['notes.txt', 'photo.png']);
  // Вкладки: стрелка вправо — следующая, панель видна, поле в ней доступно.
  await page.locator('[role="tab"]').first().focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('[role="tab"]').nth(1)).toBeFocused();
  await expect(page.locator('[role="tabpanel"]').nth(1)).toBeVisible();
  await page.locator('[role="dialog"] input[name="note"]').fill('two files');
  await page.locator('[role="dialog"] button[type="submit"]').click();
  await expect(page.locator('[role="dialog"]')).toBeHidden();
  const result = await page.evaluate(() => {
    const data = (window as unknown as W).result as { files: File[]; note: string };
    return { files: data.files.map((f) => f.name), note: data.note };
  });
  expect(result).toEqual({ files: ['notes.txt', 'photo.png'], note: 'two files' });
});

test('обязательный файл: ошибка, переход на вкладку и фокус на поле', async ({ page }) => {
  await openDialog(page);
  await page.locator('[role="tab"]').nth(1).click();
  await page.locator('[role="dialog"] button[type="submit"]').click();
  await expect(page.locator('[role="tabpanel"]').first()).toBeVisible();
  await expect(page.locator('.nova-field-error:visible')).toHaveText('This field is required');
  await expect(page.locator('[role="dialog"] input[type="file"]')).toBeFocused();
});
