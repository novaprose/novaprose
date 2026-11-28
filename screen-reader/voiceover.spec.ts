import { appendFileSync } from 'node:fs';
import { voiceOverTest as test, type VoiceOverPlaywright } from '@guidepup/playwright';
import { expect, type Page } from '@playwright/test';

/**
 * VoiceOver on macOS reading the playground editor in WebKit (Safari's engine): what a blind user
 * on a Mac hears after a shortcut, a Markdown shortcut and in a dialog. The same checks as
 * nvda.spec.ts, with the Mac's keys (Command instead of Control). Runs on a macOS runner in CI.
 */

declare global {
  interface Window {
    editor: {
      ready: Promise<void>;
      getHTML(): string;
      setContent(html: string, options?: { addToHistory?: boolean }): void;
    };
  }
}

// Every phrase VoiceOver speaks after a key, not only the first: our announcements come a moment later.
test.use({ voiceOverStartOptions: { capture: true } });

const html = (page: Page) => page.evaluate(() => window.editor.getHTML());

/** What VoiceOver said since the last clear, as one line, also written to spoken.txt (see report.mjs). */
async function heard(voiceOver: VoiceOverPlaywright, step: string): Promise<string> {
  // Announcements are polite: give them a moment to be spoken.
  await new Promise((done) => setTimeout(done, 1500));
  const spoken = (await voiceOver.spokenPhraseLog()).filter(Boolean).join(' | ');
  appendFileSync(test.info().outputPath('spoken.txt'), `${step}: ${spoken}\n`);
  await voiceOver.clearSpokenPhraseLog();
  return spoken;
}

/** The playground with the given content, VoiceOver on the page and the cursor in the text. */
async function openEditor(page: Page, voiceOver: VoiceOverPlaywright, content: string) {
  await page.goto('/?lang=en', { waitUntil: 'load' });
  await page.evaluate(async (value) => {
    await window.editor.ready;
    window.editor.setContent(value, { addToHistory: false });
  }, content);
  await voiceOver.navigateToWebContent();
  await page.locator('.nova-prosemirror').click();
  await heard(voiceOver, 'focus on the editor');
}

test('Command+B on a selected word says "Bold on"', async ({ page, voiceOver }) => {
  await openEditor(page, voiceOver, '<p>source text here</p>');
  await voiceOver.press('Command+ArrowUp');
  await voiceOver.press('Option+Shift+ArrowRight');
  await heard(voiceOver, 'Option+Shift+Right');
  await voiceOver.press('Command+b');
  const spoken = await heard(voiceOver, 'Command+B');
  expect(await html(page)).toMatch(/^<p><strong>source<\/strong>/);
  expect(spoken, 'what VoiceOver said after Command+B').toContain('Bold on');
});

test('typing "- " says "Bulleted list"', async ({ page, voiceOver }) => {
  await openEditor(page, voiceOver, '<p></p>');
  await voiceOver.type('- ');
  const spoken = await heard(voiceOver, 'typed "- "');
  expect(await html(page)).toBe('<ul><li><p></p></li></ul>');
  expect(spoken, 'what VoiceOver said after "- "').toContain('Bulleted list');
});

test('Command+K opens the link dialog and says its name', async ({ page, voiceOver }) => {
  await openEditor(page, voiceOver, '<p>a link here</p>');
  await voiceOver.press('Command+k');
  await expect(page.getByRole('dialog', { name: 'Insert link' })).toBeVisible();
  const spoken = await heard(voiceOver, 'Command+K');
  expect(spoken, 'what VoiceOver said when the dialog opened').toMatch(/Insert link/);
  // It said "URL required invalid data" while the address field was a native required field:
  // the empty address isn't an error before anything was typed.
  expect(spoken, 'what VoiceOver said when the dialog opened').not.toMatch(/invalid/i);
});
