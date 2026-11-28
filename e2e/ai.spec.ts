import { expect, test, type Page } from '@playwright/test';

/**
 * The AI assistant in real browsers (the /?ai=1 playground, an offline demo model): selection → window →
 * a quick action → the streamed answer → edits as suggestions from "AI" → accept all.
 */

async function clickControl(page: Page, name: string) {
  const control = page.locator(`.nova-toolbar [data-control="${name}"]`).first();
  if (await control.isVisible()) return control.click();
  await page.locator('.nova-tb-more').click();
  await page.locator(`.nova-tb-overflow-popover [data-control="${name}"]`).click();
}

async function open(page: Page, html: string, query = '') {
  await page.goto(`/?ai=1&lang=en${query}`);
  await page.evaluate(async (content) => {
    await window.editor.ready;
    window.editor.setContent(content);
  }, html);
}

test('"Shorter": deleted words as AI suggestions, "accept all" gives the final text', async ({
  page,
}) => {
  await open(page, '<p>This is a very good text.</p>');
  await page.locator('.nova-prosemirror p').click();
  await page.keyboard.press('ControlOrMeta+a');
  await clickControl(page, 'aidialog');
  const dialog = page.getByRole('dialog', { name: 'AI assistant' });
  await dialog.getByRole('button', { name: 'Make shorter' }).click();
  await expect(dialog).toBeHidden();
  const removed = page.locator('.nova-prosemirror del[data-suggestion]');
  await expect(removed).toHaveText('very ');
  await expect(removed).toHaveAttribute('data-name', 'AI');
  await expect(page.locator('.nova-notification')).toContainText('AI suggested changes');

  await clickControl(page, 'reviewsuggestions');
  await page.getByRole('menuitem', { name: 'Accept all suggestions' }).click();
  await expect
    .poll(() => page.evaluate(() => window.editor.getHTML()))
    .toBe('<p>This is a good text.</p>');
});

test('a custom request without a selection continues at the cursor; Esc cancels the request', async ({
  page,
}) => {
  await open(page, '<p>Start.</p>');
  await page.locator('.nova-prosemirror p').click();
  await page.keyboard.press('End');
  await clickControl(page, 'aidialog');
  const dialog = page.getByRole('dialog', { name: 'AI assistant' });
  await expect(dialog.getByRole('button', { name: 'Improve writing' })).toBeDisabled();
  await dialog.getByRole('button', { name: 'Continue writing' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.locator('.nova-prosemirror ins[data-suggestion]')).toHaveText(
    ' This sentence was written by the demo model.',
  );

  // Cancelling: Esc during the answer changes nothing.
  await page.evaluate(() => window.editor.setContent('<p>Keep.</p>'));
  await page.locator('.nova-prosemirror p').click();
  await page.keyboard.press('End');
  await clickControl(page, 'aidialog');
  await dialog.getByRole('textbox').fill('Write a long story');
  await dialog.getByRole('textbox').press('Enter');
  await expect(dialog.locator('.nova-ai-preview')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => window.editor.getHTML())).toBe('<p>Keep.</p>');
});

test('the chat: a question about the document, the answer inserted as a suggestion', async ({
  page,
}) => {
  await open(page, '<p>One two three.</p>');
  await page.locator('.nova-prosemirror p').click();
  await page.keyboard.press('End');
  await clickControl(page, 'aichat');
  const panel = page.locator('.nova-sidebar[data-sidebar="aichat"]');
  const message = panel.getByRole('textbox', { name: 'Message to AI' });
  // The message box has focus once the panel opens.
  await expect(message).toBeFocused();
  await page.keyboard.type('How long is it?');
  await page.keyboard.press('Enter');
  await expect(panel.locator('.nova-ai-msg-assistant .nova-ai-text')).toHaveText(
    'The document has 3 words.',
  );
  await panel.getByRole('button', { name: 'Insert' }).click();
  // A new paragraph after the last one: new as a whole, one suggestion.
  await expect(page.locator('.nova-prosemirror p.nova-sugg-insert')).toHaveText(
    'The document has 3 words.',
  );
  await expect
    .poll(() => page.evaluate(() => window.editor.getHTML()))
    .toMatch(
      /^<p>One two three\.<\/p><p data-suggestion="[^"]+" data-change="insert"[^>]*>The document has 3 words\.<\/p>$/,
    );
});

test('the chat in Edit mode: the whole document changed as suggestions, then "Accept all"', async ({
  page,
}) => {
  await open(page, '<p>This is good.</p><p>Hi there.</p><p>Nothing here.</p>');
  await page.locator('.nova-prosemirror p').first().click();
  await clickControl(page, 'aichat');
  const panel = page.locator('.nova-sidebar[data-sidebar="aichat"]');
  await panel.getByRole('radio', { name: 'Edit' }).check();
  await expect(panel.getByText('Changes: the whole document')).toBeVisible();
  await panel.getByRole('button', { name: 'Improve writing' }).click();
  await expect(panel.getByText('Paragraphs with suggested changes: 1')).toBeVisible();
  await expect(page.locator('.nova-prosemirror ins[data-suggestion]')).toHaveText('excellent.');
  await panel.getByRole('button', { name: 'Accept all' }).click();
  await expect(panel.getByText('All changes reviewed.')).toBeVisible();
  expect(await page.evaluate(() => window.editor.getHTML())).toBe(
    '<p>This is excellent.</p><p>Hi there.</p><p>Nothing here.</p>',
  );
});

test('the chat in Edit mode changes structure too: a title, a list, a removed paragraph', async ({
  page,
}) => {
  const original = '<p>Shopping:</p><p>Milk</p><p>Eggs</p><p>Old note</p>';
  for (const action of ['Accept all', 'Reject all']) {
    await open(page, original);
    await page.locator('.nova-prosemirror p').first().click();
    await clickControl(page, 'aichat');
    const panel = page.locator('.nova-sidebar[data-sidebar="aichat"]');
    await panel.getByRole('radio', { name: 'Edit' }).check();
    await panel.getByRole('textbox', { name: 'Message to AI' }).fill('Give it structure');
    await panel.getByRole('textbox', { name: 'Message to AI' }).press('Enter');
    await expect(panel.getByText('Paragraphs with suggested changes: 4')).toBeVisible();
    // Until decided, everything is still in the text, marked.
    await expect(page.locator('.nova-prosemirror h2')).toHaveText('A Demo Title');
    await expect(page.locator('.nova-prosemirror')).toContainText('Old note');
    await panel.getByRole('button', { name: action }).click();
    await expect(panel.getByText('All changes reviewed.')).toBeVisible();
    expect(await page.evaluate(() => window.editor.getHTML())).toBe(
      action === 'Accept all'
        ? '<h2>A Demo Title</h2><p>Shopping:</p><ul><li><p>Milk</p></li><li><p>Eggs</p></li></ul>'
        : original,
    );
  }
});

test('the chat in Review mode: remarks with reasons, each fix accepted or rejected on its own', async ({
  page,
}) => {
  await open(page, '<p>We recieve teh results.</p><p>The plan is good.</p>');
  await page.locator('.nova-prosemirror p').first().click();
  await clickControl(page, 'aichat');
  const panel = page.locator('.nova-sidebar[data-sidebar="aichat"]');
  await panel.getByRole('radio', { name: 'Review' }).check();
  await expect(panel.getByText('Review: the whole document')).toBeVisible();
  await panel.getByRole('button', { name: 'Review the document' }).click();
  await expect(panel.getByText('Remarks: 3')).toBeVisible();
  const items = panel.locator('.nova-ai-finding');
  await expect(items).toHaveCount(3);
  await expect(items.nth(0)).toContainText('recieve → receive');
  await expect(items.nth(0)).toContainText('A spelling mistake.');
  await expect(items.nth(2)).toContainText('Say what exactly is good.');
  await expect(items.nth(2)).toContainText('No change proposed');
  // Each fix on its own: the second accepted, the first rejected.
  await items.nth(1).getByRole('button', { name: 'Accept' }).click();
  await expect(items.nth(1)).toContainText('Reviewed');
  await items.nth(0).getByRole('button', { name: 'Reject' }).click();
  await expect(items.nth(0)).toContainText('Reviewed');
  expect(await page.evaluate(() => window.editor.getHTML())).toBe(
    '<p>We recieve the results.</p><p>The plan is good.</p>',
  );
  // A remark without a fix shows its place in the text.
  await items.nth(2).getByRole('button', { name: 'Show in the text' }).click();
  expect(
    await page.evaluate(() => {
      const { state } = (
        window.editor as unknown as {
          view: {
            state: {
              selection: { from: number; to: number };
              doc: { textBetween(a: number, b: number): string };
            };
          };
        }
      ).view;
      return state.doc.textBetween(state.selection.from, state.selection.to);
    }),
  ).toBe('good');
});

test('autocomplete: grey text after a pause, Tab accepts it, Esc dismisses it', async ({
  page,
}) => {
  await open(page, '<p>Start</p>', '&complete=1');
  await page.locator('.nova-prosemirror p').click();
  await page.keyboard.press('End');
  await page.keyboard.type(' here');
  const ghost = page.locator('.nova-prosemirror .nova-ai-ghost');
  await expect(ghost).toContainText('and a little more.');
  // Shown only: not in the document.
  expect(await page.evaluate(() => window.editor.getHTML())).toBe('<p>Start here</p>');
  await page.keyboard.press('Tab');
  await expect(ghost).toBeHidden();
  await expect
    .poll(() => page.evaluate(() => window.editor.getHTML()))
    .toBe('<p>Start here and a little more.</p>');
  // The next pause brings a new suggestion; Esc dismisses it and the text stays.
  await page.keyboard.type(' Then');
  await expect(ghost).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(ghost).toBeHidden();
  expect(await page.evaluate(() => window.editor.getHTML())).toBe(
    '<p>Start here and a little more. Then</p>',
  );
});

test('Describe with AI writes the alternative text of an image for the author to keep', async ({
  page,
}) => {
  const png =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  await open(page, `<p>A photo:</p><p><img src="${png}" width="120" height="120"></p>`);
  await page.locator('.nova-prosemirror img[src^="data:"]').click();
  await page.locator('[data-control="imagealt"]:visible').first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Describe with AI' }).click();
  const field = dialog.getByRole('textbox', { name: 'Alternative text' });
  // The demo model says whether the image itself came with the request.
  await expect(field).toHaveValue('A small blue square, sent as image data.');
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect
    .poll(() => page.evaluate(() => window.editor.getHTML()))
    .toContain('alt="A small blue square, sent as image data."');
});
