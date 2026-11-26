import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/**
 * Автоматическая проверка доступности (axe-core, правила WCAG 2.1 A/AA): роли ARIA, подписи,
 * контраст, фокус, имена кнопок. Проверяем редактор и все его оверлеи (меню, диалоги, панели)
 * в светлой и тёмной теме, в типовых состояниях. Обвязка playground не проверяется.
 * Правила axe не зависят от движка браузера — достаточно Chromium.
 */

declare global {
  interface Window {
    editor: { ready: Promise<void>; setContent(html: string): void };
  }
}

test.skip(
  ({ browserName, isMobile }) => browserName !== 'chromium' || isMobile,
  'axe — только Chromium',
);

const CONTENT =
  '<h2>Заголовок</h2><p>Текст <strong>жирный</strong> и <a href="https://example.com">ссылка</a>.</p>' +
  '<ul><li><p>пункт</p></li></ul><table><tbody><tr><td><p>a</p></td><td><p>b</p></td></tr></tbody></table>';

async function open(page: Page, theme: 'light' | 'dark', query = '') {
  await page.goto(`/?lang=ru${query}`);
  await page.evaluate(
    async ([html, t]) => {
      await window.editor.ready;
      window.editor.setContent(html!);
      document.documentElement.dataset.theme = t!;
    },
    [CONTENT, theme] as const,
  );
  await page.locator('.nova-prosemirror').click();
}

async function audit(page: Page, label: string) {
  const result = await new AxeBuilder({ page })
    .include('.nova-editor')
    // Оверлеи редактора монтируются в body: меню, диалоги, подсказки, панели.
    .include('body > [class*="nova-"]')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  const violations = result.violations.map((v) => ({
    rule: v.id,
    impact: v.impact,
    help: v.help,
    nodes: v.nodes
      .slice(0, 3)
      .map((n) => `${n.target.join(' ')} — ${n.failureSummary?.split('\n')[1]?.trim()}`),
  }));
  expect(violations, `${label}: нарушения доступности`).toEqual([]);
}

async function control(page: Page, name: string) {
  const el = page.locator(`.nova-toolbar [data-control="${name}"]`).first();
  if (await el.isVisible()) return el.click();
  await page.locator('.nova-tb-more').click();
  await page.locator(`.nova-tb-overflow-popover [data-control="${name}"]`).click();
}

for (const theme of ['light', 'dark'] as const) {
  test.describe(`тема: ${theme}`, () => {
    test('редактор в покое', async ({ page }) => {
      await open(page, theme);
      await audit(page, 'редактор');
    });

    test('меню «Блоки» открыто', async ({ page }) => {
      await open(page, theme);
      await control(page, 'blocks');
      await expect(
        page.locator('[role="menu"]:visible, [role="listbox"]:visible').first(),
      ).toBeVisible();
      await audit(page, 'меню блоков');
    });

    test('палитра цвета текста открыта', async ({ page }) => {
      await open(page, theme);
      await control(page, 'forecolor');
      await audit(page, 'палитра');
    });

    test('диалог ссылки открыт', async ({ page }) => {
      await open(page, theme);
      await control(page, 'link');
      await expect(page.locator('[role="dialog"]')).toBeVisible();
      await audit(page, 'диалог ссылки');
    });

    test('диалог картинки открыт', async ({ page }) => {
      await open(page, theme);
      await control(page, 'image');
      await expect(page.locator('[role="dialog"]')).toBeVisible();
      await audit(page, 'диалог картинки');
    });

    test('диалог по описанию полей (editor.ui.dialog) с ошибками полей', async ({ page }) => {
      await open(page, theme);
      await page.evaluate(() => {
        const ui = (window as unknown as { editor: { ui: { dialog(spec: object): void } } }).editor
          .ui;
        ui.dialog({
          title: 'Вставить видео',
          submitLabel: 'Вставить',
          fields: [
            { type: 'message', text: 'Поддерживаются YouTube и Vimeo', tone: 'info' },
            { type: 'url', name: 'src', label: 'Адрес видео', required: true, hint: 'https://…' },
            { type: 'number', name: 'width', label: 'Ширина', min: 100 },
            {
              type: 'select',
              name: 'size',
              label: 'Размер',
              options: [
                { value: 's', label: 'Маленький' },
                { value: 'm', label: 'Средний' },
              ],
            },
            { type: 'textarea', name: 'note', label: 'Заметка' },
            { type: 'checkbox', name: 'autoplay', label: 'Автовоспроизведение' },
          ],
        });
      });
      await page.locator('[role="dialog"] button[type="submit"]').click();
      await expect(page.locator('.nova-field-error:visible').first()).toBeVisible();
      await audit(page, 'диалог по описанию полей');
    });

    test('диалог со вкладками и полем файлов', async ({ page }) => {
      await open(page, theme);
      await page.evaluate(() => {
        const ui = (window as unknown as { editor: { ui: { dialog(spec: object): void } } }).editor
          .ui;
        ui.dialog({
          title: 'Вложения',
          tabs: [
            {
              title: 'Файлы',
              fields: [
                { type: 'file', name: 'files', label: 'Файлы', multiple: true, required: true },
              ],
            },
            { title: 'Подробно', fields: [{ type: 'text', name: 'note', label: 'Заметка' }] },
          ],
        });
      });
      await page.locator('[role="dialog"] button[type="submit"]').click();
      await expect(page.locator('.nova-field-error:visible').first()).toBeVisible();
      await audit(page, 'диалог со вкладками и файлами');
    });

    test('чек-лист с галочками', async ({ page }) => {
      await open(page, theme, '&parity=1');
      await page.evaluate(async () => {
        const e = (
          window as unknown as { editor: { ready: Promise<void>; setContent(h: string): void } }
        ).editor;
        await e.ready;
        e.setContent(
          '<ul data-type="taskList"><li data-type="taskItem" data-checked="true"><p>Готово</p></li>' +
            '<li data-type="taskItem" data-checked="false"><p>Сделать</p></li></ul>',
        );
      });
      await expect(page.locator('.nova-check').first()).toBeVisible();
      await audit(page, 'чек-лист');
    });

    test('подсветка кода (контраст токенов) и меню языка', async ({ page }) => {
      await open(page, theme, '&parity=1');
      await page.evaluate(async () => {
        const e = (
          window as unknown as { editor: { ready: Promise<void>; setContent(h: string): void } }
        ).editor;
        await e.ready;
        // Все группы токенов темы: ключевые слова, строки, комментарии, числа, функции, типы,
        // атрибуты, мета, вставки в строку, удалённое и добавленное.
        e.setContent(
          '<pre><code class="language-ts">// note\nclass A extends B<T> { m(p: number) { return `x ${p}` && 42 && true } }</code></pre>' +
            '<pre><code class="language-html">&lt;div class="a" id="b"&gt;x&lt;/div&gt;</code></pre>' +
            '<pre><code class="language-css">.a #b:hover[x] { color: red; --v: 1px }</code></pre>' +
            '<pre><code class="language-python">@decorator\ndef f(self): pass</code></pre>' +
            '<pre><code class="language-markdown"># Title\n*em* **strong** [link](https://x)</code></pre>' +
            '<pre><code class="language-diff">- old\n+ new</code></pre>',
        );
      });
      await expect(page.locator('.nova-prosemirror .hljs-addition')).toBeVisible();
      await page.locator('.nova-prosemirror pre').first().click();
      await page.locator('.nova-context-toolbar [data-control="codelanguage"]').click();
      await expect(page.locator('.nova-menu [role="menuitemradio"]').first()).toBeVisible();
      await audit(page, 'подсветка кода и меню языка');
    });

    test('диалог «Пример кода»', async ({ page }) => {
      await open(page, theme, '&parity=1');
      await control(page, 'codesample');
      await expect(page.locator('.nova-dialog textarea.nova-input-code')).toBeVisible();
      await audit(page, 'диалог примера кода');
    });

    test('раскрывающиеся блоки: раскрытый, свёрнутый, пустой заголовок', async ({ page }) => {
      await open(page, theme, '&parity=1');
      await page.evaluate(async () => {
        const e = (
          window as unknown as { editor: { ready: Promise<void>; setContent(h: string): void } }
        ).editor;
        await e.ready;
        e.setContent(
          '<details open><summary>Вопрос</summary><p>Ответ</p></details>' +
            '<details><summary>Свёрнутый</summary><p>Скрыто</p></details>' +
            '<details open><summary></summary><p>Без заголовка</p></details>',
        );
      });
      await expect(page.locator('.nova-details-toggle').first()).toBeVisible();
      await audit(page, 'раскрывающиеся блоки');
    });

    test('оглавление со ссылками и пустое', async ({ page }) => {
      await open(page, theme, '&parity=1');
      await page.evaluate(async () => {
        const e = (
          window as unknown as { editor: { ready: Promise<void>; setContent(h: string): void } }
        ).editor;
        await e.ready;
        e.setContent(
          '<nav data-toc><p>Содержание</p><ul><li><a href="#a">A</a></li></ul></nav>' +
            '<h2 id="a">Раздел</h2><h3>Подраздел</h3><nav data-toc></nav>',
        );
      });
      await expect(page.locator('nav[data-toc] a').first()).toBeVisible();
      await audit(page, 'оглавление');
    });

    test('формулы и диалог «Формула»', async ({ page }) => {
      await open(page, theme, '&parity=1');
      await page.evaluate(async () => {
        const e = (
          window as unknown as { editor: { ready: Promise<void>; setContent(h: string): void } }
        ).editor;
        await e.ready;
        e.setContent(
          '<p>Энергия <span data-type="inline-math" data-latex="E=mc^2"></span></p>' +
            '<div data-type="block-math" data-latex="\\frac{a}{b}"></div>' +
            '<p><span data-type="inline-math" data-latex=""></span> <span data-type="inline-math" data-latex="\\frac{1"></span></p>',
        );
      });
      await expect(page.locator('.nova-math-block math')).toBeVisible();
      await page.locator('.nova-math-inline').first().click();
      await expect(page.locator('.nova-dialog .nova-math-preview math')).toBeVisible();
      // Диалог появляется плавно: контраст считаем после анимации, а не на полупрозрачном кадре.
      await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished)));
      await audit(page, 'формулы');
    });

    test('ручка блока и её меню', async ({ page }) => {
      await open(page, theme, '&parity=1');
      await page.locator('.nova-prosemirror h2').hover();
      await page.locator('.nova-drag-handle').click();
      await expect(page.locator('.nova-popover-menu [role="menu"]')).toBeVisible();
      await audit(page, 'меню ручки блока');
    });

    test('боковая панель плагина открыта', async ({ page }) => {
      await open(page, theme);
      await page.evaluate(async () => {
        const editor = (
          window as unknown as {
            editor: {
              ui: {
                registry: { addSidebar(name: string, spec: object): void };
                sidebar: { show(name: string): Promise<void> };
              };
            };
          }
        ).editor;
        editor.ui.registry.addSidebar('outline', {
          title: 'Оглавление',
          render: (container: HTMLElement) => {
            const list = document.createElement('ul');
            list.innerHTML = '<li><a href="#h">Заголовок</a></li>';
            container.append(list);
          },
        });
        await editor.ui.sidebar.show('outline');
      });
      await expect(page.locator('[data-sidebar="outline"]')).toBeVisible();
      await audit(page, 'боковая панель');
    });

    test('меню из строки меню открыто', async ({ page }) => {
      await open(page, theme, '&menubar=1');
      const menubar = page.locator('.nova-menubar [role="menuitem"]').first();
      await menubar.click();
      await expect(page.locator('[role="menu"]:visible').first()).toBeVisible();
      await audit(page, 'меню из строки меню');
    });
  });
}
