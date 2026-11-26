/**
 * Инструмент переводчика. Собирает все строки интерфейса — ядро (i18n/en.ts) и все плагины
 * (export const LABELS в src/plugins/*.ts) — в один плоский список ключей.
 *
 *   node scripts/i18n.mjs template          → i18n-template.json: { ключ: английская строка }
 *   node scripts/i18n.mjs check [код...]    → проверить пакеты src/i18n/packs/*.ts: все ключи на месте,
 *                                             лишних нет, параметры {name} совпадают, пустых строк нет
 *   node scripts/i18n.mjs stats             → сколько строк и какие пакеты есть
 *
 * Ключи плагинов: '<плагин>.<ключ>', списки — '<плагин>.<ключ>.<номер>' (как в рантайме).
 */
import { build } from 'esbuild';
import { readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { Buffer } from 'node:buffer';

const ROOT = resolve(import.meta.dirname, '..');
const SRC = join(ROOT, 'packages/core/src');
const PACKS = join(SRC, 'i18n/packs');

/** Собрать TS-модули в один ESM-бандл для Node и импортировать его. */
async function load(entries) {
  const contents = entries
    .map(([name, path]) => `export * as ${name} from ${JSON.stringify(path)};`)
    .join('\n');
  const res = await build({
    stdin: { contents, resolveDir: ROOT, loader: 'ts' },
    bundle: true,
    format: 'esm',
    platform: 'node',
    write: false,
    logLevel: 'error',
    loader: { '.css': 'empty' },
  });
  const url = `data:text/javascript;base64,${Buffer.from(res.outputFiles[0].contents).toString('base64')}`;
  return import(url);
}

function flatten(prefix, labels) {
  const out = {};
  for (const [key, value] of Object.entries(labels)) {
    if (typeof value === 'string') out[`${prefix}${key}`] = value;
    else value.forEach((item, i) => (out[`${prefix}${key}.${i}`] = item));
  }
  return out;
}

const plugins = readdirSync(join(SRC, 'plugins'))
  .filter((f) => f.endsWith('.ts'))
  .map((f) => [`p_${f.replace(/\W/g, '_')}`, join(SRC, 'plugins', f), f.replace('.ts', '')]);
const packFiles = readdirSync(PACKS).filter((f) => f.endsWith('.ts'));

const mods = await load([
  ['en', join(SRC, 'i18n/en.ts')],
  ...plugins.map(([id, path]) => [id, path]),
  ...packFiles.map((f) => [`pack_${f.replace(/\W/g, '_')}`, join(PACKS, f)]),
]);

/** Эталон: все ключи ядра и плагинов с английскими строками. */
const template = { ...mods.en.en };
for (const [id, , name] of plugins) {
  const labels = mods[id].LABELS;
  if (labels) Object.assign(template, flatten(`${name}.`, labels.en));
}

const params = (s) =>
  [...s.matchAll(/\{(\w+)\}/g)]
    .map((m) => m[1])
    .sort()
    .join(',');

const [command = 'stats', ...codes] = process.argv.slice(2);

if (command === 'template') {
  const file = join(ROOT, 'i18n-template.json');
  writeFileSync(file, `${JSON.stringify(template, null, 2)}\n`);
  console.log(`${Object.keys(template).length} строк → ${file}`);
} else if (command === 'check') {
  let failed = 0;
  for (const f of packFiles) {
    const code = f.replace('.ts', '');
    if (codes.length && !codes.includes(code)) continue;
    const pack = mods[`pack_${f.replace(/\W/g, '_')}`].default;
    const problems = [];
    for (const [key, en] of Object.entries(template)) {
      const value = pack[key];
      if (value === undefined) problems.push(`нет ключа ${key}`);
      else if (!value.trim()) problems.push(`пустая строка ${key}`);
      else if (params(value) !== params(en))
        problems.push(`параметры ${key}: «${value}» vs «${en}»`);
    }
    for (const key of Object.keys(pack))
      if (!(key in template)) problems.push(`лишний ключ ${key}`);
    if (problems.length) {
      failed++;
      console.log(`✗ ${code}: ${problems.length} проблем\n  ${problems.slice(0, 20).join('\n  ')}`);
    } else console.log(`✓ ${code}: ${Object.keys(pack).length} строк`);
  }
  process.exit(failed ? 1 : 0);
} else {
  const core = Object.keys(mods.en.en).length;
  console.log(
    `Строк всего: ${Object.keys(template).length} (ядро ${core}, плагины ${Object.keys(template).length - core})`,
  );
  console.log(`Пакеты: ${packFiles.map((f) => f.replace('.ts', '')).join(', ') || 'нет'}`);
}
