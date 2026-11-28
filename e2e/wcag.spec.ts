import { expect, test, type Page } from '@playwright/test';

/**
 * WCAG checks that axe can't make (axe is in a11y.spec.ts): the sticky header never hides the line
 * with the caret (2.4.11), field borders, focus rings and pressed states stand out 3:1 (1.4.11),
 * wider text spacing loses nothing (1.4.12), Windows high contrast keeps every state visible, and
 * a passage gets its language (3.1.2). Layout and color math don't depend on the engine: Chromium.
 */

declare global {
  interface Window {
    editor: {
      ready: Promise<void>;
      setContent(html: string, options?: object): void;
      getHTML(): string;
    };
  }
}

test.skip(
  ({ browserName, isMobile }) => browserName !== 'chromium' || isMobile,
  'measured in Chromium',
);

const LONG = Array.from(
  { length: 80 },
  (_, i) => `<p>Paragraph ${i + 1} of a long document that scrolls under the header.</p>`,
).join('');

async function open(page: Page, query = '', html = LONG, theme: 'light' | 'dark' = 'light') {
  await page.goto(`/?lang=en${query}`);
  await page.evaluate(
    async ([content, t]) => {
      await window.editor.ready;
      window.editor.setContent(content!, { addToHistory: false });
      document.documentElement.dataset.theme = t!;
    },
    [html, theme] as const,
  );
}

/** Two frames: the editor's own correction of the scroll runs in the next one. */
const settle = (page: Page) =>
  page.evaluate(
    () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))),
  );

/** The caret's top and bottom and the header's bottom edge, in the window. */
const caretAndHeader = (page: Page) =>
  page.evaluate(() => {
    const range = getSelection()!.getRangeAt(0).cloneRange();
    const rects = range.getClientRects();
    const caret = rects.length ? rects[rects.length - 1]! : range.getBoundingClientRect();
    const header = document.querySelector('.nova-header')!.getBoundingClientRect();
    return { top: caret.top, bottom: caret.bottom, headerBottom: header.bottom };
  });

test.describe('2.4.11 Focus Not Obscured: the sticky header', () => {
  for (const [label, query] of [
    ['at the top of the window', ''],
    ["under the page's own fixed header (toolbarStickyOffset)", '&sticky=60'],
  ] as const) {
    test(`moving up line by line keeps the caret below the header, ${label}`, async ({ page }) => {
      await open(page, query);
      await page.locator('.nova-prosemirror').click();
      await page.keyboard.press('Control+End');
      await settle(page);
      for (let i = 1; i <= 45; i++) {
        await page.keyboard.press('ArrowUp');
        await settle(page);
        const { top, headerBottom } = await caretAndHeader(page);
        expect(top, `after ArrowUp ×${i}`).toBeGreaterThanOrEqual(headerBottom - 1);
      }
      if (query) {
        // The header sits below the page's fixed header, not under it.
        const header = await page.locator('.nova-header').boundingBox();
        expect(Math.round(header!.y)).toBe(60);
      }
    });
  }

  test('Page Up and typing at the top keep the caret below the header', async ({ page }) => {
    await open(page);
    await page.locator('.nova-prosemirror').click();
    await page.keyboard.press('Control+End');
    for (let i = 1; i <= 4; i++) {
      await page.keyboard.press('PageUp');
      await settle(page);
      const { top, headerBottom } = await caretAndHeader(page);
      expect(top, `after PageUp ×${i}`).toBeGreaterThanOrEqual(headerBottom - 1);
    }
    // Scrolled by hand so the caret's line is under the header, then typing brings it back out.
    const { top } = await caretAndHeader(page);
    await page.evaluate((y) => scrollBy(0, y), top - 20);
    await page.keyboard.type('x');
    await settle(page);
    const after = await caretAndHeader(page);
    expect(after.top).toBeGreaterThanOrEqual(after.headerBottom - 1);
  });

  test('the find bar stays in view, and each match is shown below the header', async ({ page }) => {
    await open(page);
    await page.locator('.nova-prosemirror').click();
    await page.keyboard.press('Control+End');
    // Opening the bar doesn't take the page back to the top (it is in the sticky header): the
    // text you were at stays on screen.
    await page.keyboard.press('Control+f');
    await settle(page);
    await expect(page.locator('.nova-prosemirror p').last()).toBeInViewport();
    const bar = page.getByRole('searchbox', { name: 'Find' });
    await expect(bar).toBeInViewport();
    for (const query of ['Paragraph 30 ', 'Paragraph 75 ', 'Paragraph 2 ']) {
      await bar.fill(query);
      await page.keyboard.press('Enter');
      await settle(page);
      const match = (await page.locator('.nova-search-current').first().boundingBox())!;
      const header = (await page.locator('.nova-header').boundingBox())!;
      const height = await page.evaluate(() => innerHeight);
      expect(match.y, query).toBeGreaterThanOrEqual(header.y + header.height - 1);
      expect(match.y + match.height, query).toBeLessThanOrEqual(height);
      await expect(bar).toBeInViewport();
    }
  });
});

/** Contrast of field borders, focus rings and state indicators with what is next to them. */
function measure(page: Page, what: 'fields' | 'focus' | 'pressed') {
  return page.evaluate((kind) => {
    const rgba = (value: string): number[] | null => {
      const m = /rgba?\(([^)]+)\)/.exec(value);
      if (!m) return null;
      const p = m[1]!
        .split(/[\s,/]+/)
        .filter(Boolean)
        .map(Number);
      return [p[0]!, p[1]!, p[2]!, p[3] ?? 1];
    };
    const over = (top: number[], bottom: number[]) =>
      top
        .slice(0, 3)
        .map((v, i) => v * top[3]! + bottom[i]! * (1 - top[3]!))
        .concat(1);
    /** The color behind an element: the backgrounds of it and its ancestors, blended down to white. */
    const behind = (el: Element | null): number[] => {
      const layers: number[][] = [];
      for (let e = el; e; e = e.parentElement) {
        const c = rgba(getComputedStyle(e).backgroundColor);
        if (c && c[3]! > 0) {
          layers.push(c);
          if (c[3]! >= 1) break;
        }
      }
      return layers.reverse().reduce((acc, layer) => over(layer, acc), [255, 255, 255, 1]);
    };
    const lum = (c: number[]) => {
      const [r, g, b] = c
        .slice(0, 3)
        .map((v) => (v / 255 <= 0.03928 ? v / 255 / 12.92 : ((v / 255 + 0.055) / 1.055) ** 2.4));
      return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
    };
    const ratio = (a: number[], b: number[]) => {
      const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
      return (x! + 0.05) / (y! + 0.05);
    };
    const name = (el: Element) =>
      el.tagName.toLowerCase() +
      (typeof el.className === 'string' && el.className.trim()
        ? '.' + el.className.trim().split(/\s+/).join('.')
        : '') +
      (el.getAttribute('aria-label') ? `[${el.getAttribute('aria-label')}]` : '');
    const visible = (el: Element) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden';
    };
    /** The strongest of the element's borders against a background. */
    const border = (el: Element, against: number[]) => {
      const s = getComputedStyle(el);
      let best = 0;
      for (const side of ['Top', 'Right', 'Bottom', 'Left'] as const) {
        const width = parseFloat(s[`border${side}Width`]);
        const color = rgba(s[`border${side}Color`]);
        if (width >= 1 && color && color[3]! > 0 && s[`border${side}Style`] !== 'none')
          best = Math.max(best, ratio(over(color, against), against));
      }
      return best;
    };
    /** An inset ring drawn with box-shadow (its color) against a background. */
    const ring = (el: Element, against: number[]) => {
      const c = rgba(getComputedStyle(el).boxShadow);
      return c && c[3]! > 0 ? ratio(over(c, against), against) : 0;
    };
    const out: string[] = [];
    if (kind === 'fields') {
      // A field is told apart by its border or its own background (both against what is around it).
      const fields = [
        ...document.querySelectorAll<HTMLInputElement>(
          '.nova-editor input, .nova-editor select, .nova-editor textarea, .nova-editor',
        ),
      ].filter(
        (el) =>
          visible(el) &&
          !el.disabled &&
          !/^(checkbox|radio|range|color|file|hidden)$/.test(el.type ?? '') &&
          !el.closest('.cm-editor'),
      );
      for (const field of fields) {
        const outside = behind(field.parentElement);
        const best = Math.max(border(field, outside), ratio(behind(field), outside));
        if (best < 3) out.push(`${name(field)} ${best.toFixed(2)}:1`);
      }
    } else if (kind === 'focus') {
      const el = document.activeElement!;
      const s = getComputedStyle(el);
      const outside = behind(el.parentElement);
      const outline = rgba(s.outlineColor);
      const width = parseFloat(s.outlineWidth);
      const best = Math.max(
        s.outlineStyle !== 'none' && width >= 1 && outline
          ? ratio(over(outline, outside), outside)
          : 0,
        border(el, outside),
        ring(el, behind(el)),
      );
      out.push(`${name(el)} ${best.toFixed(2)}`);
    } else {
      for (const el of document.querySelectorAll(
        '.nova-btn.is-active, [aria-pressed="true"], [role="tab"][aria-selected="true"]',
      )) {
        if (!visible(el)) continue;
        const outside = behind(el.parentElement);
        const best = Math.max(
          ratio(behind(el), outside),
          border(el, outside),
          ring(el, behind(el)),
        );
        if (best < 3) out.push(`${name(el)} ${best.toFixed(2)}:1`);
      }
    }
    return out;
  }, what);
}

const ratioOf = (line: string) => Number(line.split(' ').pop());

test.describe('1.4.11 Non-text Contrast', () => {
  for (const theme of ['light', 'dark'] as const) {
    test(`fields, focus rings and pressed buttons, ${theme} theme`, async ({ page }) => {
      await open(page, '&menubar=1', '<p>Bold text and more</p>', theme);
      // The editor's own edge, without focus (with focus it takes the focus color).
      expect(await measure(page, 'fields')).toEqual([]);
      const text = page.locator('.nova-prosemirror');
      await text.click();
      // A pressed button: bold on.
      await page.keyboard.press('Control+a');
      await page.keyboard.press('Control+b');
      expect(await measure(page, 'pressed')).toEqual([]);
      expect(await measure(page, 'fields')).toEqual([]);

      // Focus on a toolbar button (Alt+F10), on a menu item, on a dialog's field and button.
      await page.keyboard.press('Alt+F10');
      const toolbarFocus = await measure(page, 'focus');
      expect(ratioOf(toolbarFocus[0]!), toolbarFocus[0]).toBeGreaterThanOrEqual(3);
      await page.keyboard.press('Escape');
      await text.click();
      await page.keyboard.press('Alt+F9');
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('ArrowDown');
      const menuFocus = await measure(page, 'focus');
      expect(ratioOf(menuFocus[0]!), menuFocus[0]).toBeGreaterThanOrEqual(3);
      await page.keyboard.press('Escape');
      await page.keyboard.press('Escape');

      await text.click();
      await page.keyboard.press('Control+k');
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      expect(await measure(page, 'fields')).toEqual([]);
      const fieldFocus = await measure(page, 'focus');
      expect(ratioOf(fieldFocus[0]!), fieldFocus[0]).toBeGreaterThanOrEqual(3);
      await page.keyboard.press('Tab');
      const nextFocus = await measure(page, 'focus');
      expect(ratioOf(nextFocus[0]!), nextFocus[0]).toBeGreaterThanOrEqual(3);
    });
  }
});

/** Interface text that the wider spacing pushes out of its box (clipped or spilling over). */
function overflowing(page: Page) {
  return page.evaluate(() => {
    const out: string[] = [];
    for (const el of document.querySelectorAll<HTMLElement>('.nova-editor *')) {
      if (el.closest('.nova-prosemirror, .nova-visually-hidden, svg')) continue;
      const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent!.trim());
      if (!own) continue;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      if (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1)
        out.push(
          `${el.tagName.toLowerCase()}.${[...el.classList].join('.')} "${el.textContent!.trim().slice(0, 24)}" ${el.scrollWidth}x${el.scrollHeight} in ${el.clientWidth}x${el.clientHeight}`,
        );
    }
    return out;
  });
}

const SPACING =
  '* { line-height: 1.5 !important; letter-spacing: 0.12em !important;' +
  ' word-spacing: 0.16em !important; } p { margin-bottom: 2em !important; }';

test('1.4.12 Text Spacing: the toolbar, menus, a dialog and the status bar keep all their text', async ({
  page,
}) => {
  await open(page, '&menubar=1', '<h2>Heading</h2><p>Some text</p>');
  await page.addStyleTag({ content: SPACING });
  await page.locator('.nova-prosemirror p').click();
  expect(await overflowing(page), 'toolbar, menu bar, status bar').toEqual([]);
  await page.locator('.nova-toolbar [data-control="blocks"]').first().click();
  expect(await overflowing(page), 'the Blocks menu').toEqual([]);
  await page.keyboard.press('Escape');
  await page.locator('.nova-prosemirror p').click();
  await page.keyboard.press('Control+k');
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(await overflowing(page), 'the link dialog').toEqual([]);
});

test('1.4.10 Reflow: at 320 CSS pixels nothing scrolls sideways, the toolbar and a dialog fit', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await open(page, '&menubar=1', '<h2>A heading that is fairly long</h2><p>Some text to edit</p>');
  const fits = () =>
    page.evaluate(() => {
      const wide = [
        document.scrollingElement!,
        ...document.querySelectorAll('.nova-header, .nova-toolbar, .nova-menubar, [role="dialog"]'),
      ].filter((el) => el.getBoundingClientRect().right > innerWidth + 1 || el.scrollWidth > 321);
      return wide.map((el) => `${el.tagName.toLowerCase()}.${[...el.classList].join('.')}`);
    });
  expect(await fits(), 'the page and the bars').toEqual([]);
  await page.locator('.nova-prosemirror p').click();
  await page.keyboard.press('Control+k');
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(await fits(), 'the link dialog').toEqual([]);
});

test('Windows high contrast: focus, pressed buttons, icons and fields stay visible', async ({
  page,
}) => {
  await page.emulateMedia({ forcedColors: 'active' });
  await open(page, '', '<p>Bold text</p>');
  await page.locator('.nova-prosemirror').click();
  await page.keyboard.press('Control+a');
  await page.keyboard.press('Control+b');
  const look = await page.evaluate(() => {
    const style = (el: Element) => {
      const s = getComputedStyle(el);
      return [s.backgroundColor, s.color, s.outlineStyle, s.outlineColor, s.borderTopStyle].join(
        ' ',
      );
    };
    const pressed = document.querySelector('.nova-toolbar [data-control="bold"]')!;
    const plain = document.querySelector('.nova-toolbar [data-control="italic"]')!;
    const icon = getComputedStyle(plain.querySelector('svg')!).stroke;
    return { pressed: style(pressed), plain: style(plain), icon };
  });
  expect(look.pressed, 'a pressed button looks different').not.toBe(look.plain);
  expect(look.icon).not.toBe('none');
  await page.keyboard.press('Alt+F10');
  const outline = await page.evaluate(() => getComputedStyle(document.activeElement!).outlineStyle);
  expect(outline).not.toBe('none');
});

test.describe('3.1.2 Language of Parts', () => {
  test('the language button marks the selected words and takes the mark off again', async ({
    page,
  }) => {
    // Lines above the sentence keep the quick toolbar over the selection away from the main one.
    await open(page, '&langs=1', '<p>One</p><p>Two</p><p>Three</p><p>She said bonjour to me.</p>');
    await page.locator('.nova-prosemirror').click();
    await page.evaluate(() => {
      const text = document.querySelector('.nova-prosemirror p:last-child')!.firstChild!;
      const range = document.createRange();
      range.setStart(text, 9);
      range.setEnd(text, 16);
      getSelection()!.removeAllRanges();
      getSelection()!.addRange(range);
    });
    const button = page.locator('.nova-toolbar [data-control="language"]');
    await button.click();
    await page.getByRole('menuitemradio', { name: 'French' }).click();
    await expect
      .poll(() => page.evaluate(() => window.editor.getHTML()))
      .toBe(
        '<p>One</p><p>Two</p><p>Three</p><p>She said <span lang="fr">bonjour</span> to me.</p>',
      );
    await button.click();
    await expect(page.getByRole('menuitemradio', { name: 'French' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await page.getByRole('menuitemradio', { name: 'Default language' }).click();
    await expect
      .poll(() => page.evaluate(() => window.editor.getHTML()))
      .toBe('<p>One</p><p>Two</p><p>Three</p><p>She said bonjour to me.</p>');
  });

  test('Format → Language… asks in a dialog', async ({ page }) => {
    await open(page, '&langs=1&menubar=1', '<p>Guten Tag</p>');
    await page.locator('.nova-prosemirror').click();
    await page.keyboard.press('Control+a');
    await page.getByRole('menuitem', { name: 'Format' }).click();
    await page.getByRole('menuitem', { name: 'Language…' }).click();
    const dialog = page.getByRole('dialog', { name: 'Language' });
    await dialog.getByLabel('Language of the selected text').selectOption('de');
    await dialog.getByRole('button', { name: 'Save' }).click();
    await expect
      .poll(() => page.evaluate(() => window.editor.getHTML()))
      .toBe('<p><span lang="de">Guten Tag</span></p>');
  });
});
