import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { bigDocument, wordClipboard } from './document';
import { RESULTS_FILE, type PerfResult } from './report';

/**
 * Замеры скорости на CDN-сборке — том же минифицированном коде, что у пользователей. Пороги — около
 * пятикратного запаса к машине разработчика (ноябрь 2026: нажатие в 100 страницах — 4–5 мс, создание —
 * 90 мс): они ловят поломки вроде «каждое нажатие перебирает весь документ», а не шум раннера CI. Таблицу результатов печатает report.ts после всех замеров.
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

/** Записать замер и сравнить с порогом (мягко: остальные замеры всё равно идут). */
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
  test.skip(!existsSync(`${DIST}novaprose.global.js`), 'нужна сборка: pnpm build');
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

/** Создать редактор; время создания и до первого кадра после готовности. */
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

/** Курсор в конец абзаца посередине документа (щелчок прокручивает к нему). */
async function caretInMiddle(page: Page): Promise<void> {
  const paragraphs = page.locator('.nova-prosemirror > p');
  await paragraphs.nth(Math.floor((await paragraphs.count()) / 2)).click();
  await page.keyboard.press('End');
}

/**
 * Настоящие нажатия (через CDP): время каждого — от keydown до keyup, то есть пока страница не готова
 * принять следующую клавишу (обработка ввода, правка документа, обновление интерфейса). Таймеры
 * для замера не годятся: пока идёт ввод, Chrome откладывает их до конца потока клавиш. Плюс длинные
 * задачи (> 50 мс) за время ввода — их пользователь видит как подвисание.
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
  // Отложенная работа после ввода (раскладка страниц, счётчик слов) тоже попадает в длинные задачи.
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

test('создание редактора: 100 страниц', async ({ page }) => {
  await open(page);
  const { created, shown } = await create(page, DOC);
  record('Create, 100 pages', created, 500);
  record('Create → first frame, 100 pages', shown, 800);
});

test('ввод в середине 100 страниц', async ({ page }) => {
  await open(page);
  await create(page, DOC);
  await caretInMiddle(page);
  const keys = await measureKeys(page, () => page.keyboard.type(SENTENCE.repeat(4)));
  expect(keys.count).toBeGreaterThan(150);
  record('Typing, 100 pages: keystroke p50', keys.p50, 15);
  record('Typing, 100 pages: keystroke p95', keys.p95, 25);
  record('Typing, 100 pages: long tasks', keys.longTasks, 2, 'tasks');
});

test('Enter и Backspace в середине 100 страниц', async ({ page }) => {
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

test('getHTML и setContent: 100 страниц', async ({ page }) => {
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

test('вставка из Word: 300 абзацев', async ({ page }) => {
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
  // Первый вставленный абзац сливается с «Start» — абзацев столько же, сколько вставлено.
  expect(await page.locator('.nova-prosemirror p').count()).toBeGreaterThanOrEqual(300);
  // Вставка очищена от разметки Word.
  expect(await page.evaluate(() => window.editor.getHTML())).not.toContain('Mso');
  record('Paste from Word, 300 paragraphs', time, 200);
});

test('выделить всё и подчеркнуть: 100 страниц', async ({ page }) => {
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

test('ввод в режиме страниц: 100 страниц', async ({ page }) => {
  await open(page);
  await create(page, DOC, { plugins: ['pagelayout'] });
  await caretInMiddle(page);
  const keys = await measureKeys(page, () => page.keyboard.type(SENTENCE.repeat(2)));
  record('Typing with page layout, 100 pages: p95', keys.p95, 30);
  record('Typing with page layout, 100 pages: long tasks', keys.longTasks, 2, 'tasks');
});

test('ввод в режиме правок: 100 страниц', async ({ page }) => {
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

test('ввод в таблице 60×6', async ({ page }) => {
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

test('утечка памяти: 30 раз создать и удалить редактор', async ({ page }) => {
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
  await cycle(3); // прогрев: ленивые части загружены, кэши заполнены
  const before = await heap();
  await cycle(30);
  const after = await heap();
  record('Heap growth after 30 create/destroy', (after - before) / 1024 / 1024, 3, 'MB');
});
