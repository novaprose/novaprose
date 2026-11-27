import { expect, test, type Page } from '@playwright/test';

/** Suggesting mode in real browsers: real keyboard input, accepting and rejecting. */

type Win = {
  editor: { ready: Promise<void>; setContent(h: string, o?: object): void; getHTML(): string };
};
/** HTML without random ids/times/authors. */
const html = (page: Page) =>
  page.evaluate(() =>
    (window as unknown as Win).editor
      .getHTML()
      .replace(/ data-(suggestion|time|author|name)="[^"]*"/g, ''),
  );
const content = (page: Page) => page.locator('.nova-prosemirror');

/** Just enough of ProseMirror's view to put the cursor somewhere from the page. */
type CursorView = {
  state: {
    doc: unknown;
    selection: { constructor: unknown };
    tr: { setSelection(selection: unknown): unknown };
  };
  dispatch(tr: unknown): void;
  focus(): void;
};
type CursorSelection = { create(doc: unknown, pos: number): unknown };

async function clickControl(page: Page, name: string) {
  const control = page.locator(`.nova-toolbar [data-control="${name}"]`).first();
  if (await control.isVisible()) return control.click();
  await page.locator('.nova-tb-more').click();
  await page.locator(`.nova-tb-overflow-popover [data-control="${name}"]`).click();
}

async function open(page: Page, initial: string) {
  await page.goto('/?lang=en&comments=1');
  await page.evaluate(async (value) => {
    const { editor } = window as unknown as Win;
    await editor.ready;
    editor.setContent(value, { addToHistory: false });
  }, initial);
  await content(page).click();
  await page.keyboard.press('ControlOrMeta+End');
}

test('typing, Backspace and Delete in suggesting mode; Ctrl+Alt+Shift+E toggles the mode', async ({
  page,
}) => {
  await open(page, '<p>Ship in May</p>');
  await page.keyboard.press('ControlOrMeta+Alt+Shift+e');
  await expect(content(page)).toHaveClass(/nova-suggesting/);
  for (let i = 0; i < 3; i += 1) await page.keyboard.press('Backspace');
  await page.keyboard.type('June');
  await expect.poll(() => html(page)).toBe('<p>Ship in <del>May</del><ins>June</ins></p>');
  await page.keyboard.press('Home');
  await page.keyboard.press('Delete');
  await expect
    .poll(() => html(page))
    .toBe('<p><del>S</del>hip in <del>May</del><ins>June</ins></p>');

  await page.keyboard.press('ControlOrMeta+Alt+Shift+e');
  await expect(content(page)).not.toHaveClass(/nova-suggesting/);
  await page.keyboard.press('ControlOrMeta+End');
  await page.keyboard.type('!');
  await expect
    .poll(() => html(page))
    .toBe('<p><del>S</del>hip in <del>May</del><ins>June</ins>!</p>');
});

test('accept and reject: the buttons at a suggestion and "accept all" in the menu', async ({
  page,
}) => {
  await open(page, '<p>The quick fox</p>');
  await clickControl(page, 'suggestions');
  await page.keyboard.press('Escape');
  await content(page).click();
  await page.keyboard.press('ControlOrMeta+End');
  await page.keyboard.type(' jumps');
  // The cursor in a suggestion shows the "Accept / Reject" toolbar.
  await page.keyboard.press('ArrowLeft');
  const bar = page.getByRole('toolbar', { name: 'Suggestion' });
  await expect(bar).toBeVisible();
  await bar.getByRole('button', { name: 'Reject' }).click();
  await expect.poll(() => html(page)).toBe('<p>The quick fox</p>');

  await content(page).click();
  await page.keyboard.press('ControlOrMeta+End');
  await page.keyboard.type(' runs');
  await clickControl(page, 'reviewsuggestions');
  await page.getByRole('menuitem', { name: 'Accept all suggestions' }).click();
  await expect.poll(() => html(page)).toBe('<p>The quick fox runs</p>');
});

/** Ann replaced "May" with "June", Bob inserted "very ", Ann deleted "old". */
const BY_TWO =
  '<p>Ship in <del data-suggestion="d1" data-author="ann" data-name="Ann">May</del>' +
  '<ins data-suggestion="i1" data-author="ann" data-name="Ann">June</ins>.</p>' +
  '<p>A <ins data-suggestion="i2" data-author="bob" data-name="Bob">very </ins>good ' +
  '<del data-suggestion="d2" data-author="ann" data-name="Ann">old </del>plan.</p>';

test("the panel: every suggestion as a card; one author's at once with the filter", async ({
  page,
}) => {
  await open(page, BY_TWO);
  await clickControl(page, 'reviewsuggestions');
  await page.getByRole('menuitem', { name: 'Show all suggestions' }).click();
  const panel = page.getByRole('complementary', { name: 'Suggestions' });
  await expect(panel.locator('.nova-sugg-card')).toHaveCount(3);
  await expect(panel.locator('.nova-sugg-card').first()).toContainText('Replaced');
  await panel.getByLabel('Author').selectOption({ label: 'Ann (2)' });
  await expect(panel.locator('.nova-sugg-card')).toHaveCount(2);
  await panel.getByRole('button', { name: 'Accept shown' }).click();
  await expect
    .poll(() => html(page))
    .toBe('<p>Ship in June.</p><p>A <ins>very </ins>good plan.</p>');
  await expect(panel).toContainText('No suggestions from Ann');
  // A click on Bob's card selects his suggestion in the text; Reject on it rejects it.
  await panel.getByLabel('Author').selectOption({ label: 'All authors (1)' });
  await panel.locator('.nova-sugg-summary').click();
  await panel.getByRole('button', { name: 'Reject', exact: true }).click();
  await expect.poll(() => html(page)).toBe('<p>Ship in June.</p><p>A good plan.</p>');
});

test('a heading instead of a paragraph is a suggestion; Reject makes it a paragraph again', async ({
  page,
}) => {
  await open(page, '<p>Title</p><p>Text</p>');
  await page.keyboard.press('ControlOrMeta+Alt+Shift+e');
  await page.keyboard.press('ControlOrMeta+Home');
  await clickControl(page, 'blocks');
  await page.getByRole('menuitemradio', { name: 'Heading 2' }).click();
  await expect(content(page).locator('h2.nova-sugg-block')).toHaveText('Title');
  await expect.poll(() => html(page)).toContain('<h2 data-before=');
  await clickControl(page, 'reviewsuggestions');
  await page.getByRole('menuitem', { name: 'Show all suggestions' }).click();
  const panel = page.getByRole('complementary', { name: 'Suggestions' });
  await expect(panel.locator('.nova-sugg-changes')).toHaveText('Paragraph → Heading 2');
  await panel.getByRole('button', { name: 'Reject', exact: true }).click();
  await expect.poll(() => html(page)).toBe('<p>Title</p><p>Text</p>');
});

test('Enter and Backspace across a paragraph break are suggestions too', async ({ page }) => {
  await open(page, '<p>Ship it</p><p>Then rest</p>');
  await page.keyboard.press('ControlOrMeta+Alt+Shift+e');
  // Enter in the middle of the first paragraph, after "Ship": a new paragraph break, suggested.
  // (The cursor is put there directly: arrow keys in the mobile emulation sometimes drop a press.)
  await page.evaluate(() => {
    const { view } = (window as unknown as { editor: { view: CursorView } }).editor;
    const Selection = view.state.selection.constructor as unknown as CursorSelection;
    view.dispatch(view.state.tr.setSelection(Selection.create(view.state.doc, 5)));
    view.focus();
  });
  await page.keyboard.press('Enter');
  await expect(content(page).locator('p.nova-sugg-split')).toHaveText(' it');
  // Backspace at the start of the last paragraph: the break before it, suggested deleted.
  await page.keyboard.press('ControlOrMeta+End');
  await page.keyboard.press('Home');
  await page.keyboard.press('Backspace');
  await expect(content(page).locator('p.nova-sugg-join')).toHaveText('Then rest');
  await clickControl(page, 'reviewsuggestions');
  await page.getByRole('menuitem', { name: 'Show all suggestions' }).click();
  const panel = page.getByRole('complementary', { name: 'Suggestions' });
  await expect(panel.locator('.nova-sugg-kind')).toHaveText(['New paragraph', 'Paragraphs joined']);
  // Reject the new break, accept the join: one paragraph again, with both texts.
  await panel.getByRole('button', { name: 'Reject', exact: true }).first().click();
  await panel.getByRole('button', { name: 'Accept', exact: true }).first().click();
  await expect.poll(() => html(page)).toBe('<p>Ship itThen rest</p>');
});

test('a suggestion is discussed on its card; accepting it resolves the discussion', async ({
  page,
}) => {
  await open(page, BY_TWO);
  await clickControl(page, 'reviewsuggestions');
  await page.getByRole('menuitem', { name: 'Show all suggestions' }).click();
  const panel = page.getByRole('complementary', { name: 'Suggestions' });
  const card = panel.locator('.nova-sugg-card').first();
  await card.getByRole('button', { name: 'Comment' }).click();
  const box = card.getByRole('textbox', { name: 'Add a comment…' });
  await expect(box).toBeFocused();
  await page.keyboard.type('Why June?');
  await page.keyboard.press('ControlOrMeta+Enter');
  await expect(card.locator('.nova-sugg-reply-text')).toHaveText(['Why June?']);
  await card.getByRole('button', { name: 'Reply' }).click();
  await page.keyboard.type('The launch moved.');
  await card.getByRole('button', { name: 'Reply' }).click();
  await expect(card.locator('.nova-sugg-reply-text')).toHaveText([
    'Why June?',
    'The launch moved.',
  ]);
  // Accepted: the card and its discussion go (the thread is resolved; see the unit tests).
  await card.getByRole('button', { name: 'Accept' }).click();
  await expect(panel.locator('.nova-sugg-card')).toHaveCount(2);
  await expect(panel.locator('.nova-sugg-reply')).toHaveCount(0);
});

test('Ctrl+B in suggesting mode suggests the format; Reject takes the bold away', async ({
  page,
}) => {
  await open(page, '<p>plain words</p>');
  await page.keyboard.press('ControlOrMeta+Alt+Shift+e');
  await page.keyboard.press('Home');
  await page.keyboard.press('Shift+ArrowRight');
  await page.keyboard.press('Shift+ArrowRight');
  await page.keyboard.press('Shift+ArrowRight');
  await page.keyboard.press('Shift+ArrowRight');
  await page.keyboard.press('Shift+ArrowRight');
  await page.keyboard.press('ControlOrMeta+b');
  await expect
    .poll(() => html(page))
    .toBe('<p><strong><span data-format="[]">plain</span></strong> words</p>');
  // The text is bold at once, with the suggestion's dotted line under it.
  await expect(
    content(page).locator('strong .nova-sugg-format, .nova-sugg-format strong').first(),
  ).toBeVisible();
  await page.keyboard.press('ArrowLeft');
  const bar = page.getByRole('toolbar', { name: 'Suggestion' });
  await bar.getByRole('button', { name: 'Reject' }).click();
  await expect.poll(() => html(page)).toBe('<p>plain words</p>');
});

test('previews: the text with every suggestion accepted, then rejected; the text stays', async ({
  page,
}) => {
  await open(page, BY_TWO);
  await clickControl(page, 'reviewsuggestions');
  await page.getByRole('menuitem', { name: 'Preview: all accepted' }).click();
  const dialog = page.getByRole('dialog', { name: 'Preview: all accepted' });
  await expect(dialog).toContainText('Ship in June.');
  await expect(dialog).toContainText('A very good plan.');
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await clickControl(page, 'reviewsuggestions');
  await page.getByRole('menuitem', { name: 'Preview: all rejected' }).click();
  await expect(page.getByRole('dialog', { name: 'Preview: all rejected' })).toContainText(
    'A good old plan.',
  );
  await page.keyboard.press('Escape');
  expect(await html(page)).toBe(
    '<p>Ship in <del>May</del><ins>June</ins>.</p><p>A <ins>very </ins>good <del>old </del>plan.</p>',
  );
});
