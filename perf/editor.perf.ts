import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { bigDocument, wordClipboard } from './document';
import { RESULTS_FILE, type PerfResult } from './report';

/**
 * Speed measurements on the CDN build, the same minified code users get. The limits are about
 * five times a developer machine (November 2026: a keystroke in 100 pages takes 4–5 ms, creation
 * 90 ms): they catch breakage like "every keystroke walks the whole document", not CI runner noise. report.ts prints the results table after all measurements.
 */

const DIST = 'packages/web-component/dist/';
const DOC = bigDocument(100);

interface PerfEditor {
  ready: Promise<void>;
  view: { dom: HTMLElement };
  getHTML(): string;
  setContent(html: string): void;
  exec(name: string): boolean;
  destroy(): void;
}
declare const NovaProse: { createEditor(options: Record<string, unknown>): PerfEditor };
declare global {
  interface Window {
    editor: PerfEditor;
    perfLatency: number[];
    perfLongTasks: number[];
  }
}

/** Records a measurement and compares it with the limit (softly: the other measurements still run). */
function record(name: string, value: number, limit: number, unit = 'ms'): void {
  const result: PerfResult = { name, value: Math.round(value * 10) / 10, limit, unit };
  appendFileSync(RESULTS_FILE, `${JSON.stringify(result)}\n`);
  expect
    .soft(value, `${name}: ${value.toFixed(1)} ${unit}, limit ${limit}`)
    .toBeLessThanOrEqual(limit);
}

const PAGE = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="https://perf.local/novaprose.css">
<script src="https://perf.local/novaprose.global.js"></script>
</head><body><div id="editor"></div></body></html>`;

async function open(page: Page): Promise<void> {
  test.skip(!existsSync(`${DIST}novaprose.global.js`), 'needs a build: pnpm build');
  await page.route('https://perf.local/**', (route) => {
    const file = new URL(route.request().url()).pathname.slice(1);
    if (!file) return route.fulfill({ contentType: 'text/html', body: PAGE });
    if (!existsSync(DIST + file)) return route.fulfill({ status: 404, body: 'not found' });
    return route.fulfill({
      body: readFileSync(DIST + file),
      contentType: file.endsWith('.css') ? 'text/css' : 'text/javascript',
    });
  });
  await page.goto('https://perf.local/');
}

/** Creates an editor; the creation time and the time to the first frame after ready. */
async function create(page: Page, content: string, options: Record<string, unknown> = {}) {
  return page.evaluate(
    async ({ content, options }) => {
      const element = document.getElementById('editor')!;
      const start = performance.now();
      window.editor = NovaProse.createEditor({ element, content, ...options });
      const created = performance.now() - start;
      await window.editor.ready;
      await new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve)));
      return { created, shown: performance.now() - start };
    },
    { content, options },
  );
}

/** The cursor to the end of a paragraph in the middle of the document (a click scrolls to it). */
async function caretInMiddle(page: Page): Promise<void> {
  const paragraphs = page.locator('.nova-prosemirror > p');
  await paragraphs.nth(Math.floor((await paragraphs.count()) / 2)).click();
  await page.keyboard.press('End');
}

/**
 * Real keystrokes (through CDP): each one is timed from keydown to keyup, that is, until the page is ready
 * to take the next key (input handling, the document edit, the interface update). Timers
 * don't work for this: while typing goes on, Chrome defers them until the stream of keys ends. Plus long
 * tasks (> 50 ms) during typing, which a user sees as a freeze.
 */
async function measureKeys(page: Page, press: () => Promise<void>) {
  await page.evaluate(() => {
    window.perfLatency = [];
    window.perfLongTasks = [];
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) window.perfLongTasks.push(entry.duration);
    }).observe({ type: 'longtask' });
    let down: number | null = null;
    window.addEventListener('keydown', () => (down = performance.now()), true);
    window.addEventListener(
      'keyup',
      () => {
        if (down !== null) window.perfLatency.push(performance.now() - down);
        down = null;
      },
      true,
    );
  });
  await press();
  // Deferred work after typing (page layout, the word counter) also lands in long tasks.
  await page.waitForTimeout(500);
  const { latency, longTasks } = await page.evaluate(() => ({
    latency: window.perfLatency,
    longTasks: window.perfLongTasks,
  }));
  const sorted = [...latency].sort((a, b) => a - b);
  const at = (q: number) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))]!;
  return { count: sorted.length, p50: at(0.5), p95: at(0.95), longTasks: longTasks.length };
}

const SENTENCE = 'The quick brown fox jumps over the lazy dog. ';

test('creating an editor: 100 pages', async ({ page }) => {
  await open(page);
  const { created, shown } = await create(page, DOC);
  record('Create, 100 pages', created, 500);
  record('Create → first frame, 100 pages', shown, 800);
});

test('typing in the middle of 100 pages', async ({ page }) => {
  await open(page);
  await create(page, DOC);
  await caretInMiddle(page);
  const keys = await measureKeys(page, () => page.keyboard.type(SENTENCE.repeat(4)));
  expect(keys.count).toBeGreaterThan(150);
  record('Typing, 100 pages: keystroke p50', keys.p50, 15);
  record('Typing, 100 pages: keystroke p95', keys.p95, 25);
  record('Typing, 100 pages: long tasks', keys.longTasks, 2, 'tasks');
});

test('Enter and Backspace in the middle of 100 pages', async ({ page }) => {
  await open(page);
  await create(page, DOC);
  await caretInMiddle(page);
  const keys = await measureKeys(page, async () => {
    for (let i = 0; i < 30; i++) await page.keyboard.press('Enter');
    for (let i = 0; i < 30; i++) await page.keyboard.press('Backspace');
  });
  record('Enter/Backspace, 100 pages: p95', keys.p95, 50);
  record('Enter/Backspace, 100 pages: long tasks', keys.longTasks, 2, 'tasks');
});

test('getHTML and setContent: 100 pages', async ({ page }) => {
  await open(page);
  await create(page, DOC);
  const times = await page.evaluate((html) => {
    const runs: number[] = [];
    for (let i = 0; i < 5; i++) {
      const start = performance.now();
      window.editor.getHTML();
      runs.push(performance.now() - start);
    }
    const start = performance.now();
    window.editor.setContent(html);
    document.body.getBoundingClientRect();
    return { getHTML: runs.sort((a, b) => a - b)[2]!, setContent: performance.now() - start };
  }, DOC);
  record('getHTML, 100 pages', times.getHTML, 40);
  record('setContent, 100 pages', times.setContent, 150);
});

test('paste from Word: 300 paragraphs', async ({ page }) => {
  await open(page);
  await create(page, '<p>Start</p>');
  const time = await page.evaluate((html) => {
    const data = new DataTransfer();
    data.setData('text/html', html);
    data.setData('text/plain', 'Paragraph');
    const start = performance.now();
    window.editor.view.dom.dispatchEvent(
      new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }),
    );
    document.body.getBoundingClientRect();
    return performance.now() - start;
  }, wordClipboard(300));
  // The first pasted paragraph merges with "Start": as many paragraphs as were pasted.
  expect(await page.locator('.nova-prosemirror p').count()).toBeGreaterThanOrEqual(300);
  // The paste is cleaned of Word markup.
  expect(await page.evaluate(() => window.editor.getHTML())).not.toContain('Mso');
  record('Paste from Word, 300 paragraphs', time, 200);
});

test('select all and underline: 100 pages', async ({ page }) => {
  await open(page);
  await create(page, DOC);
  await page.locator('.nova-prosemirror p').first().click();
  await page.keyboard.press('ControlOrMeta+a');
  const time = await page.evaluate(() => {
    const start = performance.now();
    window.editor.exec('underline');
    document.body.getBoundingClientRect();
    return performance.now() - start;
  });
  expect(await page.locator('.nova-prosemirror u').count()).toBeGreaterThan(1000);
  record('Select all + underline, 100 pages', time, 600);
});

test('typing in page mode: 100 pages', async ({ page }) => {
  await open(page);
  await create(page, DOC, { plugins: ['pagelayout'] });
  await caretInMiddle(page);
  const keys = await measureKeys(page, () => page.keyboard.type(SENTENCE.repeat(2)));
  record('Typing with page layout, 100 pages: p95', keys.p95, 30);
  record('Typing with page layout, 100 pages: long tasks', keys.longTasks, 2, 'tasks');
});

test('typing in suggesting mode: 100 pages', async ({ page }) => {
  await open(page);
  await create(page, DOC, {
    plugins: ['suggestions'],
    pluginOptions: { suggestions: { enabled: true, author: { id: 'u1', name: 'Anna' } } },
  });
  await caretInMiddle(page);
  const keys = await measureKeys(page, () => page.keyboard.type(SENTENCE.repeat(2)));
  record('Typing as suggestions, 100 pages: p95', keys.p95, 30);
  record('Typing as suggestions, 100 pages: long tasks', keys.longTasks, 2, 'tasks');
});

test('typing in a 60×6 table', async ({ page }) => {
  await open(page);
  const row = (i: number) =>
    `<tr>${Array.from({ length: 6 }, (_, j) => `<td><p>cell ${i}.${j}</p></td>`).join('')}</tr>`;
  await create(
    page,
    `<table><tbody>${Array.from({ length: 60 }, (_, i) => row(i)).join('')}</tbody></table>`,
  );
  await page.locator('.nova-prosemirror td').nth(180).click();
  await page.keyboard.press('End');
  const keys = await measureKeys(page, () => page.keyboard.type(SENTENCE.repeat(2)));
  record('Typing in a 60×6 table: p95', keys.p95, 20);
});

test('memory leak: create and destroy an editor 30 times', async ({ page }) => {
  await open(page);
  const cdp = await page.context().newCDPSession(page);
  const heap = async () => {
    await cdp.send('HeapProfiler.collectGarbage');
    return (await cdp.send('Runtime.getHeapUsage')).usedSize;
  };
  const cycle = (times: number) =>
    page.evaluate(async (times) => {
      const content = '<h2>Title</h2><p>Some <strong>text</strong></p>'.repeat(100);
      for (let i = 0; i < times; i++) {
        const element = document.createElement('div');
        document.body.append(element);
        const editor = NovaProse.createEditor({
          element,
          content,
          plugins: ['suggestions', 'pagelayout', 'codesample'],
        });
        await editor.ready;
        editor.destroy();
        element.remove();
      }
    }, times);
  await cycle(3); // warm-up: lazy parts loaded, caches filled
  const before = await heap();
  await cycle(30);
  const after = await heap();
  record('Heap growth after 30 create/destroy', (after - before) / 1024 / 1024, 3, 'MB');
});
