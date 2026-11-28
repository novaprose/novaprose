import { expect, test } from '@playwright/test';

/** editor.selection in real browsers: the selection's place on screen, bookmarks around typing. */

type Sel = {
  select(node: Node, content?: boolean): void;
  setRange(from: number, to?: number): void;
  getRect(): DOMRect | null;
  getDOMRange(): Range | null;
  getNode(): HTMLElement | null;
  getText(): string;
  getBookmark(): { id: number };
  moveToBookmark(bookmark: { id: number }): boolean;
};
type EditorHandle = {
  ready: Promise<void>;
  setContent(html: string): void;
  getHTML(): string;
  focus(): void;
  view: { dom: HTMLElement };
  selection: Sel;
};

test('the selection’s rectangle and DOM range match what is drawn; bookmarks survive typing', async ({
  page,
}) => {
  await page.goto('/?lang=en');
  const drawn = await page.evaluate(async () => {
    const e = (window as unknown as { editor: EditorHandle }).editor;
    await e.ready;
    e.setContent('<p>Hello <strong>bold</strong> world</p>');
    const strong = e.view.dom.querySelector('strong')!;
    e.selection.select(strong);
    const rect = e.selection.getRect()!;
    const own = strong.getBoundingClientRect();
    return {
      rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
      own: { left: own.left, top: own.top, width: own.width, height: own.height },
      text: e.selection.getDOMRange()?.toString(),
      node: e.selection.getNode()?.tagName,
    };
  });
  expect(drawn.text).toBe('bold');
  expect(drawn.node).toBe('STRONG');
  // The rectangle is the bold word's, within a pixel or two.
  expect(Math.abs(drawn.rect.left - drawn.own.left)).toBeLessThan(2);
  expect(Math.abs(drawn.rect.width - drawn.own.width)).toBeLessThan(3);
  expect(drawn.rect.height).toBeGreaterThan(8);

  // A bookmark on "bold"; the user types at the start; the bookmark still holds "bold".
  await page.evaluate(() => {
    const e = (window as unknown as { editor: EditorHandle }).editor;
    (window as unknown as { mark: unknown }).mark = e.selection.getBookmark();
    e.selection.setRange(1);
    e.focus();
  });
  await page.keyboard.type('Start ');
  const back = await page.evaluate(() => {
    const e = (window as unknown as { editor: EditorHandle }).editor;
    const ok = e.selection.moveToBookmark((window as unknown as { mark: { id: number } }).mark);
    return { ok, text: e.selection.getText(), html: e.getHTML() };
  });
  expect(back.html).toBe('<p>Start Hello <strong>bold</strong> world</p>');
  expect(back).toMatchObject({ ok: true, text: 'bold' });
  // Typing replaces the restored selection.
  await page.keyboard.type('BOLD');
  expect(
    await page.evaluate(() => (window as unknown as { editor: EditorHandle }).editor.getHTML()),
  ).toBe('<p>Start Hello <strong>BOLD</strong> world</p>');
});
