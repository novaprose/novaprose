import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/**
 * Automated accessibility checks (axe-core, WCAG 2.1 A/AA rules): ARIA roles, labels,
 * contrast, focus, button names. The editor and all its overlays (menus, dialogs, panels) are checked
 * in the light and dark themes, in typical states. The playground chrome isn't checked.
 * axe rules don't depend on the browser engine, so Chromium is enough.
 */

declare global {
  interface Window {
    editor: { ready: Promise<void>; setContent(html: string): void };
  }
}

test.skip(
  ({ browserName, isMobile }) => browserName !== 'chromium' || isMobile,
  'axe runs in Chromium only',
);

const CONTENT =
  '<h2>Heading</h2><p>Text <strong>bold</strong> and <a href="https://example.com">a link</a>.</p>' +
  '<ul><li><p>item</p></li></ul><table><tbody><tr><td><p>a</p></td><td><p>b</p></td></tr></tbody></table>';

async function open(page: Page, theme: 'light' | 'dark', query = '') {
  await page.goto(`/?lang=en${query}`);
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
    // The editor's overlays mount into body: menus, dialogs, tooltips, panels.
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
  expect(violations, `${label}: accessibility violations`).toEqual([]);
}

async function control(page: Page, name: string) {
  const el = page.locator(`.nova-toolbar [data-control="${name}"]`).first();
  if (await el.isVisible()) return el.click();
  await page.locator('.nova-tb-more').click();
  await page.locator(`.nova-tb-overflow-popover [data-control="${name}"]`).click();
}

for (const theme of ['light', 'dark'] as const) {
  test.describe(`theme: ${theme}`, () => {
    test('the editor at rest', async ({ page }) => {
      await open(page, theme);
      await audit(page, 'editor');
    });

    test('the "Blocks" menu open', async ({ page }) => {
      await open(page, theme);
      await control(page, 'blocks');
      await expect(
        page.locator('[role="menu"]:visible, [role="listbox"]:visible').first(),
      ).toBeVisible();
      await audit(page, 'blocks menu');
    });

    test('the text color palette open', async ({ page }) => {
      await open(page, theme);
      await control(page, 'forecolor');
      await audit(page, 'palette');
    });

    test('the link dialog open', async ({ page }) => {
      await open(page, theme);
      await control(page, 'link');
      await expect(page.locator('[role="dialog"]')).toBeVisible();
      await audit(page, 'link dialog');
    });

    test('the image dialog open', async ({ page }) => {
      await open(page, theme);
      await control(page, 'image');
      await expect(page.locator('[role="dialog"]')).toBeVisible();
      await audit(page, 'image dialog');
    });

    test('a dialog from a field description (editor.ui.dialog) with field errors', async ({
      page,
    }) => {
      await open(page, theme);
      await page.evaluate(() => {
        const ui = (window as unknown as { editor: { ui: { dialog(spec: object): void } } }).editor
          .ui;
        ui.dialog({
          title: 'Insert video',
          submitLabel: 'Insert',
          fields: [
            { type: 'message', text: 'YouTube and Vimeo are supported', tone: 'info' },
            { type: 'url', name: 'src', label: 'Video address', required: true, hint: 'https://…' },
            { type: 'number', name: 'width', label: 'Width', min: 100 },
            {
              type: 'select',
              name: 'size',
              label: 'Size',
              options: [
                { value: 's', label: 'Small' },
                { value: 'm', label: 'Medium' },
              ],
            },
            { type: 'textarea', name: 'note', label: 'Note' },
            { type: 'checkbox', name: 'autoplay', label: 'Autoplay' },
          ],
        });
      });
      await page.locator('[role="dialog"] button[type="submit"]').click();
      await expect(page.locator('.nova-field-error:visible').first()).toBeVisible();
      await audit(page, 'dialog from a field description');
    });

    test('a dialog with tabs and a file field', async ({ page }) => {
      await open(page, theme);
      await page.evaluate(() => {
        const ui = (window as unknown as { editor: { ui: { dialog(spec: object): void } } }).editor
          .ui;
        ui.dialog({
          title: 'Attachments',
          tabs: [
            {
              title: 'Files',
              fields: [
                { type: 'file', name: 'files', label: 'Files', multiple: true, required: true },
              ],
            },
            { title: 'Details', fields: [{ type: 'text', name: 'note', label: 'Note' }] },
          ],
        });
      });
      await page.locator('[role="dialog"] button[type="submit"]').click();
      await expect(page.locator('.nova-field-error:visible').first()).toBeVisible();
      await audit(page, 'dialog with tabs and files');
    });

    test('a checklist with checkboxes', async ({ page }) => {
      await open(page, theme, '&parity=1');
      await page.evaluate(async () => {
        const e = (
          window as unknown as { editor: { ready: Promise<void>; setContent(h: string): void } }
        ).editor;
        await e.ready;
        e.setContent(
          '<ul data-type="taskList"><li data-type="taskItem" data-checked="true"><p>Done</p></li>' +
            '<li data-type="taskItem" data-checked="false"><p>To do</p></li></ul>',
        );
      });
      await expect(page.locator('.nova-check').first()).toBeVisible();
      await audit(page, 'checklist');
    });

    test('code highlighting (token contrast) and the language menu', async ({ page }) => {
      await open(page, theme, '&parity=1');
      await page.evaluate(async () => {
        const e = (
          window as unknown as { editor: { ready: Promise<void>; setContent(h: string): void } }
        ).editor;
        await e.ready;
        // Every token group of the theme: keywords, strings, comments, numbers, functions, types,
        // attributes, meta, string interpolation, deleted and added.
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
      await audit(page, 'code highlighting and language menu');
    });

    test('the "Code sample" dialog', async ({ page }) => {
      await open(page, theme, '&parity=1');
      await control(page, 'codesample');
      await expect(page.locator('.nova-dialog textarea.nova-input-code')).toBeVisible();
      await audit(page, 'code sample dialog');
    });

    test('the "Permanent pen properties" dialog and the pressed pen and painter', async ({
      page,
    }) => {
      await open(page, theme, '&tools=1');
      await control(page, 'permanentpen');
      await control(page, 'formatpainter');
      await page.evaluate(() => {
        const editor = window.editor as unknown as {
          ui: { registry: { getMenuItem(name: string): { onAction(e: unknown): void } } };
        };
        editor.ui.registry.getMenuItem('configurepermanentpen').onAction(editor);
      });
      await expect(page.getByRole('dialog', { name: 'Permanent pen properties' })).toBeVisible();
      await audit(page, 'permanent pen dialog');
    });

    test('the "Insert template" dialog with its preview', async ({ page }) => {
      await open(page, theme, '&tools=1');
      await control(page, 'template');
      await expect(page.getByRole('region', { name: 'Preview' })).toContainText('Meeting notes');
      await audit(page, 'template dialog');
    });

    test('the Accessibility panel with errors and a warning', async ({ page }) => {
      await open(page, theme, '&a11y=1');
      await page.evaluate(async () => {
        const e = (
          window as unknown as { editor: { ready: Promise<void>; setContent(h: string): void } }
        ).editor;
        await e.ready;
        // Problems axe itself doesn't count in the text (an image without alt would be one).
        e.setContent(
          '<h2>A</h2><h4>B</h4><p>• one</p><p>• two</p>' +
            '<p>See <a href="https://example.com">click here</a>.</p>',
        );
      });
      await control(page, 'a11ycheck');
      await expect(page.locator('.nova-a11y-card')).toHaveCount(3);
      // The outline of a problem in the text is part of what is checked.
      await page.locator('.nova-a11y-card').first().hover();
      await audit(page, 'accessibility panel');
    });

    test('spell check: underlined problems and the bubble with corrections', async ({ page }) => {
      await open(page, theme, '&spell=1');
      await page.evaluate(async () => {
        const e = (
          window as unknown as { editor: { ready: Promise<void>; setContent(h: string): void } }
        ).editor;
        await e.ready;
        e.setContent('<p>I recieve teh letter.</p><p>Eat a apple.</p>');
      });
      await expect(page.locator('.nova-spell')).toHaveCount(3);
      await page.locator('.nova-spell', { hasText: 'recieve' }).click();
      await expect(page.getByRole('dialog', { name: 'Spelling: recieve' })).toBeVisible();
      await audit(page, 'spell check bubble');
    });

    test('autocorrect: a corrected word and the menu of the button', async ({ page }) => {
      await open(page, theme, '&autocorrect=1');
      await page.evaluate(async () => {
        const e = (
          window as unknown as {
            editor: { ready: Promise<void>; setContent(h: string): void; focus(): void };
          }
        ).editor;
        await e.ready;
        e.setContent('<p>A sentence</p>');
        e.focus();
      });
      await page.keyboard.press('ControlOrMeta+End');
      await page.keyboard.type(' and teh ');
      await expect(page.locator('.nova-autocorrected')).toHaveText('the');
      await control(page, 'autocorrect-options');
      await expect(page.getByRole('menuitemcheckbox')).toHaveCount(2);
      await audit(page, 'autocorrect menu');
    });

    test('typography: the menu of the button with the languages', async ({ page }) => {
      await open(page, theme, '&typography=1');
      await page.evaluate(
        () => (window as unknown as { editor: { ready: Promise<void> } }).editor.ready,
      );
      await control(page, 'typography-options');
      await expect(page.getByRole('menuitemradio', { name: 'German' })).toBeVisible();
      await audit(page, 'typography menu');
    });

    test('the suggestions panel with cards by two authors', async ({ page }) => {
      await open(page, theme, '&comments=1');
      await page.evaluate(async () => {
        const e = (
          window as unknown as { editor: { ready: Promise<void>; setContent(h: string): void } }
        ).editor;
        await e.ready;
        e.setContent(
          '<p>Ship in <del data-suggestion="d1" data-author="ann" data-name="Ann">May</del>' +
            '<ins data-suggestion="i1" data-author="ann" data-name="Ann">June</ins>.</p>' +
            '<p>A <ins data-suggestion="i2" data-author="bob" data-name="Bob">very </ins>good plan.</p>' +
            // A suggested block style: the bar in the author's color and its card.
            `<h2 data-suggestion="b1" data-before='{"type":"paragraph"}' data-author="bob" data-name="Bob">Plan</h2>`,
        );
      });
      await control(page, 'reviewsuggestions');
      await page.getByRole('menuitem', { name: 'Show all suggestions' }).click();
      await expect(page.locator('.nova-sugg-card')).toHaveCount(3);
      // The active card (the cursor in a suggestion) has its own look: check it too.
      await page.locator('.nova-sugg-summary').first().click();
      await audit(page, 'suggestions panel');
      // A discussion on a card: a reply, and the box for the next one.
      const card = page.locator('.nova-sugg-card').first();
      await card.getByRole('button', { name: 'Comment' }).click();
      await page.keyboard.type('Why June?');
      await page.keyboard.press('ControlOrMeta+Enter');
      await card.getByRole('button', { name: 'Reply' }).click();
      await audit(page, 'suggestion discussion');
    });

    test('footnotes: numbers in the text, the notes at the end', async ({ page }) => {
      await open(page, theme, '&tools=1');
      await page.keyboard.press('ControlOrMeta+End');
      await control(page, 'footnotes');
      await page.keyboard.type('A note');
      await expect(page.locator('.nova-prosemirror .mce-footnote-text')).toHaveText('A note');
      await audit(page, 'footnotes');
    });

    test('collapsible blocks: expanded, collapsed, empty title', async ({ page }) => {
      await open(page, theme, '&parity=1');
      await page.evaluate(async () => {
        const e = (
          window as unknown as { editor: { ready: Promise<void>; setContent(h: string): void } }
        ).editor;
        await e.ready;
        e.setContent(
          '<details open><summary>Question</summary><p>Answer</p></details>' +
            '<details><summary>Collapsed</summary><p>Hidden</p></details>' +
            '<details open><summary></summary><p>Without a title</p></details>',
        );
      });
      await expect(page.locator('.nova-details-toggle').first()).toBeVisible();
      await audit(page, 'collapsible blocks');
    });

    test('a table of contents with links and an empty one', async ({ page }) => {
      await open(page, theme, '&parity=1');
      await page.evaluate(async () => {
        const e = (
          window as unknown as { editor: { ready: Promise<void>; setContent(h: string): void } }
        ).editor;
        await e.ready;
        e.setContent(
          '<nav data-toc><p>Contents</p><ul><li><a href="#a">A</a></li></ul></nav>' +
            '<h2 id="a">Section</h2><h3>Subsection</h3><nav data-toc></nav>',
        );
      });
      await expect(page.locator('nav[data-toc] a').first()).toBeVisible();
      await audit(page, 'table of contents');
    });

    test('formulas and the "Formula" dialog', async ({ page }) => {
      await open(page, theme, '&parity=1');
      await page.evaluate(async () => {
        const e = (
          window as unknown as { editor: { ready: Promise<void>; setContent(h: string): void } }
        ).editor;
        await e.ready;
        e.setContent(
          '<p>Energy <span data-type="inline-math" data-latex="E=mc^2"></span></p>' +
            '<div data-type="block-math" data-latex="\\frac{a}{b}"></div>' +
            '<p><span data-type="inline-math" data-latex=""></span> <span data-type="inline-math" data-latex="\\frac{1"></span></p>',
        );
      });
      await expect(page.locator('.nova-math-block math')).toBeVisible();
      await page.locator('.nova-math-inline').first().click();
      await expect(page.locator('.nova-dialog .nova-math-preview math')).toBeVisible();
      // The dialog fades in: contrast is measured after the animation, not on a semi-transparent frame.
      await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished)));
      await audit(page, 'formulas');
    });

    test('the AI assistant: the window with actions and an answer; edits as suggestions', async ({
      page,
    }) => {
      await open(page, theme, '&ai=1');
      await page.evaluate(() => {
        const e = window.editor;
        e.setContent('<p>This is a very good text.</p>');
      });
      await page.locator('.nova-prosemirror p').click();
      await page.keyboard.press('ControlOrMeta+a');
      await control(page, 'aidialog');
      await expect(page.locator('.nova-dialog .nova-ai-action').first()).toBeVisible();
      await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished)));
      await audit(page, 'AI assistant window');
      await page
        .locator('.nova-ai-action')
        .filter({ hasText: /shorter/i })
        .click();
      await expect(page.locator('.nova-dialog')).toBeHidden();
      await expect(page.locator('.nova-prosemirror del[data-suggestion]')).toBeVisible();
      // The notification fades in: its colors are checked once the animation is over.
      await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished)));
      await audit(page, 'AI edits in the text');
    });

    test('the AI chat: an answer, document edits, the selection kept visible; autocomplete', async ({
      page,
    }) => {
      await open(page, theme, '&ai=1&complete=1');
      await page.evaluate(() => window.editor.setContent('<p>This is good.</p><p>Hi there.</p>'));
      await page.locator('.nova-prosemirror p').first().click();
      await control(page, 'aichat');
      const panel = page.locator('.nova-sidebar[data-sidebar="aichat"]');
      await expect(panel.locator('.nova-ai-chip').first()).toBeVisible();
      await audit(page, 'AI chat, empty');
      await panel.getByRole('textbox', { name: 'Message to AI' }).fill('Suggest a title');
      await panel.getByRole('textbox', { name: 'Message to AI' }).press('Enter');
      await expect(panel.getByRole('button', { name: 'Insert' })).toBeVisible();
      await panel.getByRole('radio', { name: 'Edit' }).check();
      await panel.getByRole('textbox', { name: 'Message to AI' }).fill('Make it formal');
      await panel.getByRole('textbox', { name: 'Message to AI' }).press('Enter');
      await expect(panel.getByRole('button', { name: 'Accept all' })).toBeVisible();
      // The selection stays visible while focus is in the panel.
      await page.locator('.nova-prosemirror p').first().dblclick();
      await panel.getByRole('textbox', { name: 'Message to AI' }).focus();
      await expect(page.locator('.nova-prosemirror .nova-ai-context')).toBeVisible();
      await audit(page, 'AI chat with an answer and edits');
      // Autocomplete: the grey suggestion after the cursor.
      await page.locator('.nova-prosemirror p').first().click();
      await page.keyboard.press('End');
      await page.keyboard.type(' Very');
      await expect(page.locator('.nova-ai-ghost')).toBeVisible();
      await audit(page, 'AI autocomplete suggestion');
    });

    test('the Email preview window: the email in a frame, the screen switch, the size', async ({
      page,
    }) => {
      await open(page, theme, '&email=1');
      await control(page, 'emailpreview');
      const dialog = page.getByRole('dialog', { name: 'Email preview' });
      await expect(dialog.getByRole('status')).toHaveText(/KB/);
      await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished)));
      await audit(page, 'Email preview');
    });

    test('the block handle and its menu', async ({ page }) => {
      await open(page, theme, '&parity=1');
      await page.locator('.nova-prosemirror h2').hover();
      await page.locator('.nova-drag-handle').click();
      await expect(page.locator('.nova-popover-menu [role="menu"]')).toBeVisible();
      await audit(page, 'block handle menu');
    });

    test("a plugin's sidebar open", async ({ page }) => {
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
          title: 'Outline',
          render: (container: HTMLElement) => {
            const list = document.createElement('ul');
            list.innerHTML = '<li><a href="#h">Heading</a></li>';
            container.append(list);
          },
        });
        await editor.ui.sidebar.show('outline');
      });
      await expect(page.locator('[data-sidebar="outline"]')).toBeVisible();
      await audit(page, 'sidebar');
    });

    test('a menu from the menubar open', async ({ page }) => {
      await open(page, theme, '&menubar=1');
      const menubar = page.locator('.nova-menubar [role="menuitem"]').first();
      await menubar.click();
      await expect(page.locator('[role="menu"]:visible').first()).toBeVisible();
      await audit(page, 'menu from the menubar');
    });
  });
}
