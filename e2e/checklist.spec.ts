import { expect, test, type Locator, type Page } from '@playwright/test';

/** Чек-листы в настоящих браузерах: галочки мышью, Ctrl/Cmd+Enter, ввод «[ ]», кнопка, Enter. */

type W = {
  editor: { getHTML(): string; setContent(h: string, o?: object): void; ready: Promise<void> };
};
const html = (page: Page) => page.evaluate(() => (window as unknown as W).editor.getHTML());

const TASKS =
  '<ul data-type="taskList">' +
  '<li data-type="taskItem" data-checked="true"><p>Buy milk</p></li>' +
  '<li data-type="taskItem" data-checked="false"><p>Call Anna</p></li>' +
  '</ul>';

async function open(page: Page, content: string) {
  await page.goto('/?lang=en&parity=1');
  await page.evaluate(async (c) => {
    const { editor } = window as unknown as W;
    await editor.ready;
    editor.setContent(c, { addToHistory: false });
  }, content);
}

/**
 * Щелчок в текст и ожидание курсора. Если редактор не в фокусе, ProseMirror ставит выделение по месту
 * щелчка, но в браузер переносит его чуть позже — человек столько не печатает, а тест успевает.
 */
async function clickInto(page: Page, target: Locator) {
  await target.click();
  const handle = await target.elementHandle();
  // Курсор редактора — внутри этого абзаца…
  await expect
    .poll(() =>
      page.evaluate((el) => {
        const view = (window as unknown as { editor: { view: EditorViewLike } }).editor.view;
        const start = view.posAtDOM(el!, 0);
        const { from } = view.state.selection;
        return from >= start && from <= start + (el!.textContent ?? '').length;
      }, handle),
    )
    .toBe(true);
  // …и браузер успел перенести его к себе (два кадра отрисовки).
  await page.evaluate(
    () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  );
}

type SelectionState = {
  doc: unknown;
  tr: { setSelection(selection: unknown): unknown };
  selection: { constructor: { atEnd(doc: unknown): unknown } };
};

type EditorViewLike = {
  posAtDOM(node: Node, offset: number): number;
  state: { selection: { from: number } };
};

async function clickControl(page: Page, name: string) {
  const control = page.locator(`.nova-toolbar [data-control="${name}"]`).first();
  if (await control.isVisible()) return control.click();
  await page.locator('.nova-tb-more').click();
  await page.locator(`.nova-tb-overflow-popover [data-control="${name}"]`).click();
}

test('галочка мышью и Ctrl/Cmd+Enter отмечают пункт', async ({ page, isMobile }) => {
  await open(page, TASKS);
  const boxes = page.locator('.nova-prosemirror .nova-check');
  await expect(boxes).toHaveCount(2);
  await boxes.nth(0).click();
  await expect(boxes.nth(0)).toHaveAttribute('aria-checked', 'false');
  // На телефоне галочку нажимают пальцем (проверено выше); Ctrl+Enter там нет: Android-путь Enter
  // в ProseMirror (экранная клавиатура) не передаёт модификаторы.
  if (isMobile) return;
  await clickInto(page, page.locator('.nova-prosemirror p', { hasText: 'Call Anna' }));
  await page.keyboard.press('End');
  await page.keyboard.press('ControlOrMeta+Enter');
  await expect.poll(() => html(page)).toContain('data-checked="true"><p>Call Anna</p>');
  // Enter — новый неотмеченный пункт.
  await page.keyboard.press('Enter');
  await page.keyboard.type('Bread');
  await expect.poll(() => html(page)).toContain('data-checked="false"><p>Bread</p>');
});

test('ввод «[ ] » в начале строки и кнопка тулбара', async ({ page }) => {
  // Проверяем ввод, а не щелчки: курсор — в пустую последнюю строку программно, печатаем по-настоящему.
  // (Щелчок по пустой последней строке в WebKit без фокуса ставит курсор в начало — отдельная задача.)
  await open(page, '<p>Plan</p><p></p>');
  await page.evaluate(() => {
    const { view } = (
      window as unknown as {
        editor: { view: { focus(): void; dispatch(tr: unknown): void; state: SelectionState } };
      }
    ).editor;
    view.focus();
    const { state } = view;
    view.dispatch(state.tr.setSelection(state.selection.constructor.atEnd(state.doc)));
  });
  await page.keyboard.type('[x] Done already');
  await expect
    .poll(() => html(page))
    .toBe(
      '<p>Plan</p><ul data-type="taskList"><li data-type="taskItem" data-checked="true"><p>Done already</p></li></ul>',
    );
  await clickInto(page, page.locator('.nova-prosemirror p', { hasText: 'Plan' }));
  await clickControl(page, 'checklist');
  await expect.poll(() => html(page)).toContain('data-checked="false"><p>Plan</p>');
});
