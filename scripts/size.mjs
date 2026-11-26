/**
 * Бюджет размера. Считает то, что реально скачает пользователь, в gzip:
 *  - первая загрузка ядра: точка входа + все статически подключённые чанки (вместе с ProseMirror);
 *  - ленивые плагины: всё, что грузится через import() — отдельно, только для информации;
 *  - CSS и CDN-сборки (готовые файлы).
 * Падает (exit 1), если превышен любой бюджет. Нужна сборка: pnpm build.
 *
 *   node scripts/size.mjs           проверка
 *   node scripts/size.mjs --json    то же + JSON в stdout (для отчётов CI)
 */
import { build } from 'esbuild';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

const KB = 1024;
const gz = (buf) => gzipSync(buf, { level: 9 }).length;

/** Бюджеты в КБ gzip. Поднимать только осознанно, с записью в CHANGELOG. */
const BUDGET = {
  coreFirstLoad: 150,
  coreCss: 12,
  // CDN: основной файл (ленивые части — отдельные файлы рядом, scripts/build-cdn.mjs). Ноябрь 2026:
  // 140.5 и 151.0 КБ после выноса частей (было 168.1 и 178.6 одним файлом).
  webComponentCdn: 150,
  tinymceCompatCdn: 160,
};

async function measureEntry(entry, names) {
  const res = await build({
    stdin: {
      contents: `export { ${names} } from ${JSON.stringify(entry)};`,
      resolveDir: process.cwd(),
      loader: 'js',
    },
    bundle: true,
    splitting: true,
    format: 'esm',
    minify: true,
    outdir: 'size-out',
    write: false,
    metafile: true,
    logLevel: 'error',
  });
  const sizes = new Map(
    res.outputFiles.map((f) => [f.path.replace(/\\/g, '/').split('/size-out/')[1], gz(f.contents)]),
  );
  const outputs = Object.fromEntries(
    Object.entries(res.metafile.outputs).map(([k, v]) => [k.replace(/^size-out\//, ''), v]),
  );
  // Ленивые чанки тоже точки входа (import()), нам нужна именно наша — <stdin>.
  const entryKey = Object.keys(outputs).find((k) => outputs[k].entryPoint === '<stdin>');
  // Статические импорты — тянутся сразу; динамические — лениво.
  const first = new Set();
  const walk = (k) => {
    if (first.has(k)) return;
    first.add(k);
    for (const i of outputs[k].imports) {
      if (i.kind === 'import-statement') walk(i.path.replace(/^size-out\//, ''));
    }
  };
  walk(entryKey);
  let firstLoad = 0;
  let lazy = 0;
  for (const [k, size] of sizes) {
    if (!k.endsWith('.js')) continue;
    if (first.has(k)) firstLoad += size;
    else lazy += size;
  }
  return { firstLoad, lazy };
}

function fileSize(path) {
  if (!existsSync(path)) throw new Error(`Нет файла ${path} — сначала pnpm build`);
  return gz(readFileSync(path));
}

/** Ленивые части CDN-сборки (все вместе): грузятся по требованию с того же адреса. */
function chunksSize(dir) {
  if (!existsSync(dir)) throw new Error(`Нет папки ${dir} — сначала pnpm build`);
  return readdirSync(dir)
    .filter((name) => name.endsWith('.js'))
    .reduce((sum, name) => sum + fileSize(`${dir}/${name}`), 0);
}

const core = await measureEntry('./packages/core/dist/index.js', 'Editor');
const rows = [
  ['@novaprose/core — первая загрузка (с ProseMirror)', core.firstLoad, BUDGET.coreFirstLoad],
  ['@novaprose/core — ленивые плагины (все вместе)', core.lazy, null],
  ['@novaprose/core — style.css', fileSize('packages/core/src/style.css'), BUDGET.coreCss],
  [
    '@novaprose/web-component — CDN, основной файл',
    fileSize('packages/web-component/dist/novaprose.global.js'),
    BUDGET.webComponentCdn,
  ],
  [
    '@novaprose/web-component — CDN, ленивые части',
    chunksSize('packages/web-component/dist/novaprose-chunks'),
    null,
  ],
  [
    '@novaprose/tinymce-compat — CDN, основной файл',
    fileSize('packages/tinymce-compat/dist/tinymce.global.js'),
    BUDGET.tinymceCompatCdn,
  ],
  [
    '@novaprose/tinymce-compat — CDN, ленивые части',
    chunksSize('packages/tinymce-compat/dist/tinymce-chunks'),
    null,
  ],
];

let failed = 0;
console.log('Размер (gzip):');
for (const [name, size, budget] of rows) {
  const kb = (size / KB).toFixed(1);
  const over = budget != null && size > budget * KB;
  if (over) failed++;
  const tail = budget == null ? '' : ` / ${budget} КБ ${over ? '✗ ПРЕВЫШЕН' : '✓'}`;
  console.log(`  ${name.padEnd(52)} ${kb.padStart(7)} КБ${tail}`);
}
if (process.argv.includes('--json')) {
  console.log(
    JSON.stringify(rows.map(([name, size, budget]) => ({ name, bytes: size, budgetKb: budget }))),
  );
}
if (failed) {
  console.error(`\nБюджет превышен (${failed}). Уменьшите размер или осознанно поднимите BUDGET.`);
  process.exit(1);
}
