import { appendFileSync } from 'node:fs';
import { nvdaTest as test, type NVDAPlaywright } from '@guidepup/playwright';
import { expect, type Page } from '@playwright/test';

declare global {
  interface Window {
    editor: {
      ready: Promise<void>;
      getHTML(): string;
      setContent(html: string, options?: { addToHistory?: boolean }): void;
    };
  }
}

// Every phrase NVDA speaks after a key, not only the first: our announcements come a moment later.
test.use({ nvdaStartOptions: { capture: true } });

const html = (page: Page) => page.evaluate(() => window.editor.getHTML());

/**
 * What NVDA said since the last clear, as one line. It is also written to spoken.txt next to the test's
 * results: the workflow prints those files, so a run can be read without a screen reader.
 */
async function heard(nvda: NVDAPlaywright, step: string): Promise<string> {
  const spoken = (await nvda.spokenPhraseLog()).filter(Boolean).join(' | ');
  appendFileSync(test.info().outputPath('spoken.txt'), `${step}: ${spoken}\n`);
  await nvda.clearSpokenPhraseLog();
  return spoken;
}

/** The playground with the given content, NVDA on the page and the cursor in the text. */
async function openEditor(
  page: Page,
  nvda: NVDAPlaywright,
  content: string,
  query = '',
): Promise<void> {
  await page.goto(`/?lang=en${query}`, { waitUntil: 'load' });
  await page.evaluate(async (value) => {
    await window.editor.ready;
    window.editor.setContent(value, { addToHistory: false });
  }, content);
  await nvda.navigateToWebContent();
  await page.locator('.nova-prosemirror').click();
  // NVDA switches to focus mode on an editable field and announces it: let that finish (see also
  // the focus timer in e2e/editor.spec.ts).
  await page.waitForTimeout(1500);
  await heard(nvda, 'focus on the editor');
}

// A format shortcut on a selected word says what changed and nothing else. NVDA used to add the next
// word as "unselected" ("text unselected. Bold on"): Chromium gave <strong> an accessibility object of
// its own, and the line's text NVDA tracks got shorter (fixed in packages/core/src/mark-views.ts).
for (const [shortcut, key, tag, said] of [
  ['Ctrl+B', 'Control+b', 'strong', 'Bold on'],
  ['Ctrl+I', 'Control+i', 'em', 'Italic on'],
  ['Ctrl+E', 'Control+e', 'code', 'Inline code on'],
] as const) {
  test(`${shortcut} on a selected word: "${said}", the next word left alone`, async ({
    page,
    nvda,
  }) => {
    await openEditor(page, nvda, '<p>source text here</p>');
    await nvda.press('Control+Home');
    await nvda.press('Control+Shift+ArrowRight');
    await heard(nvda, 'Ctrl+Shift+Right');
    await nvda.press(key);
    const spoken = await heard(nvda, shortcut);
    expect(await html(page)).toMatch(new RegExp(`^<p><${tag}>source`));
    expect(spoken, `what NVDA said after ${shortcut}`).toContain(said);
    expect(spoken, `what NVDA said after ${shortcut}`).not.toMatch(/unselected/i);
  });
}

test('Ctrl+Shift+Left selects the previous word and says so', async ({ page, nvda }) => {
  await openEditor(page, nvda, '<p>source text here</p>');
  await nvda.press('Control+End');
  await heard(nvda, 'Ctrl+End');
  await nvda.press('Control+Shift+ArrowLeft');
  const spoken = await heard(nvda, 'Ctrl+Shift+Left');
  expect(spoken, 'what NVDA said after Ctrl+Shift+Left').toMatch(/here.*selected/i);
});

test('typing "- " on an empty line: "Bulleted list"', async ({ page, nvda }) => {
  await openEditor(page, nvda, '<p>first</p><p></p>');
  await nvda.press('Control+End');
  await heard(nvda, 'Ctrl+End');
  await nvda.type('- ');
  const spoken = await heard(nvda, 'typing "- "');
  expect(await html(page)).toContain('<ul>');
  expect(spoken, 'what NVDA said after typing "- "').toContain('Bulleted list');
});

test('Alt+0 opens the keyboard shortcuts and Escape closes them', async ({ page, nvda }) => {
  await openEditor(page, nvda, '<p>text</p>');
  await nvda.press('Alt+0');
  const opened = await heard(nvda, 'Alt+0');
  await expect(page.getByRole('dialog', { name: 'Keyboard shortcuts' })).toBeVisible();
  expect(opened, 'what NVDA said after Alt+0').toContain('Keyboard shortcuts');
  await nvda.press('Escape');
  await heard(nvda, 'Escape');
  await expect(page.getByRole('dialog', { name: 'Keyboard shortcuts' })).toBeHidden();
});

// AI autocomplete (the playground's offline demo model): the grey suggestion is hidden from screen
// readers, so it is announced once; Tab accepts it.
test('AI autocomplete: the suggestion is announced, Tab accepts it', async ({ page, nvda }) => {
  await openEditor(page, nvda, '<p>Start</p>', '&ai=1&complete=1');
  await nvda.press('Control+End');
  await heard(nvda, 'Ctrl+End');
  await nvda.type(' here');
  await expect(page.locator('.nova-ai-ghost')).toBeVisible();
  await page.waitForTimeout(1000);
  const spoken = await heard(nvda, 'a pause after typing');
  expect(spoken, 'what NVDA said when the suggestion appeared').toContain(
    'Suggestion: and a little more. Press Tab to accept.',
  );
  await nvda.press('Tab');
  await heard(nvda, 'Tab');
  await expect.poll(() => html(page)).toBe('<p>Start here and a little more.</p>');
});

test('Ctrl+K opens the link dialog: "Insert link"', async ({ page, nvda }) => {
  await openEditor(page, nvda, '<p>text</p>');
  await nvda.press('Control+k');
  const spoken = await heard(nvda, 'Ctrl+K');
  await expect(page.getByRole('dialog', { name: 'Insert link' })).toBeVisible();
  expect(spoken, 'what NVDA said after Ctrl+K').toContain('Insert link');
});
