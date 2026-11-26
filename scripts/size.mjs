/**
 * Size budget. Counts what a user actually downloads, gzipped:
 *  - first load of the core: the entry point + every statically imported chunk (ProseMirror included),
 *    compressed as one file, the way an app build serves them (Vite/Rollup and webpack put everything
 *    an entry point needs into one chunk; verified with a Vite build: 135.2 KB vs 135.4 KB here). The sum
 *    of separately compressed esbuild chunks is for reference: it grows with chunk splitting, not with code;
 *  - lazy plugins: everything loaded through import(), separately, for information only;
 *  - CSS and CDN builds (finished files).
 * Fails (exit 1) when any budget is exceeded. Needs a build: pnpm build.
 *
 *   node scripts/size.mjs           check
 *   node scripts/size.mjs --json    the same + JSON on stdout (for CI reports)
 */
import { build } from 'esbuild';
import { Buffer } from 'node:buffer';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

const KB = 1024;
const gz = (buf) => gzipSync(buf, { level: 9 }).length;

/** Budgets in KB gzip. Raise them only deliberately, with a CHANGELOG entry. */
const BUDGET = {
  // November 2026: 135.4 KB as one file (before the counting method changed: 150 by the sum of chunks, that is 142.5).
  coreFirstLoad: 145,
  coreCss: 12,
  // CDN: the main file (lazy parts are separate files next to it, scripts/build-cdn.mjs). November 2026:
  // 140.5 and 151.0 KB after moving the parts out (it was 168.1 and 178.6 as one file).
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
  const files = new Map(
    res.outputFiles.map((f) => [f.path.replace(/\\/g, '/').split('/size-out/')[1], f.contents]),
  );
  const sizes = new Map([...files].map(([k, contents]) => [k, gz(contents)]));
  const outputs = Object.fromEntries(
    Object.entries(res.metafile.outputs).map(([k, v]) => [k.replace(/^size-out\//, ''), v]),
  );
  // Lazy chunks are entry points too (import()); we need ours, <stdin>.
  const entryKey = Object.keys(outputs).find((k) => outputs[k].entryPoint === '<stdin>');
  // Static imports load right away; dynamic ones load lazily.
  const first = new Set();
  const walk = (k) => {
    if (first.has(k)) return;
    first.add(k);
    for (const i of outputs[k].imports) {
      if (i.kind === 'import-statement') walk(i.path.replace(/^size-out\//, ''));
    }
  };
  walk(entryKey);
  let chunkSum = 0;
  let lazy = 0;
  for (const [k, size] of sizes) {
    if (!k.endsWith('.js')) continue;
    if (first.has(k)) chunkSum += size;
    else lazy += size;
  }
  const firstLoad = gz(
    Buffer.concat([...first].filter((k) => k.endsWith('.js')).map((k) => files.get(k))),
  );
  return { firstLoad, chunkSum, chunks: first.size, lazy };
}

function fileSize(path) {
  if (!existsSync(path)) throw new Error(`No file ${path}: run pnpm build first`);
  return gz(readFileSync(path));
}

/** Lazy parts of a CDN build (all together): loaded on demand from the same address. */
function chunksSize(dir) {
  if (!existsSync(dir)) throw new Error(`No folder ${dir}: run pnpm build first`);
  return readdirSync(dir)
    .filter((name) => name.endsWith('.js'))
    .reduce((sum, name) => sum + fileSize(`${dir}/${name}`), 0);
}

const core = await measureEntry('./packages/core/dist/index.js', 'Editor');
const rows = [
  ['@novaprose/core: first load (with ProseMirror)', core.firstLoad, BUDGET.coreFirstLoad],
  [
    `  the same as a sum of ${core.chunks} separately compressed esbuild chunks`,
    core.chunkSum,
    null,
  ],
  ['@novaprose/core: lazy plugins (all together)', core.lazy, null],
  ['@novaprose/core — style.css', fileSize('packages/core/src/style.css'), BUDGET.coreCss],
  [
    '@novaprose/web-component: CDN, main file',
    fileSize('packages/web-component/dist/novaprose.global.js'),
    BUDGET.webComponentCdn,
  ],
  [
    '@novaprose/web-component: CDN, lazy parts',
    chunksSize('packages/web-component/dist/novaprose-chunks'),
    null,
  ],
  [
    '@novaprose/tinymce-compat: CDN, main file',
    fileSize('packages/tinymce-compat/dist/tinymce.global.js'),
    BUDGET.tinymceCompatCdn,
  ],
  [
    '@novaprose/tinymce-compat: CDN, lazy parts',
    chunksSize('packages/tinymce-compat/dist/tinymce-chunks'),
    null,
  ],
];

let failed = 0;
console.log('Size (gzip):');
for (const [name, size, budget] of rows) {
  const kb = (size / KB).toFixed(1);
  const over = budget != null && size > budget * KB;
  if (over) failed++;
  const tail = budget == null ? '' : ` / ${budget} KB ${over ? '✗ OVER BUDGET' : '✓'}`;
  console.log(`  ${name.padEnd(52)} ${kb.padStart(7)} KB${tail}`);
}
if (process.argv.includes('--json')) {
  console.log(
    JSON.stringify(rows.map(([name, size, budget]) => ({ name, bytes: size, budgetKb: budget }))),
  );
}
if (failed) {
  console.error(`\nBudget exceeded (${failed}). Reduce the size or raise BUDGET deliberately.`);
  process.exit(1);
}
