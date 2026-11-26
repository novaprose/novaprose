/**
 * Translator's tool. Collects every interface string, the core (i18n/en.ts) and all plugins
 * (export const LABELS in src/plugins/*.ts), into one flat list of keys.
 *
 *   node scripts/i18n.mjs template          → i18n-template.json: { key: English string }
 *   node scripts/i18n.mjs check [code...]   → check the packs in src/i18n/packs/*.ts: every key is present,
 *                                             none extra, {name} parameters match, no empty strings
 *   node scripts/i18n.mjs stats             → how many strings and which packs exist
 *
 * Plugin keys: '<plugin>.<key>', lists: '<plugin>.<key>.<index>' (as at runtime).
 */
import { build } from 'esbuild';
import { readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { Buffer } from 'node:buffer';

const ROOT = resolve(import.meta.dirname, '..');
const SRC = join(ROOT, 'packages/core/src');
const PACKS = join(SRC, 'i18n/packs');

/** Bundles TS modules into one ESM bundle for Node and imports it. */
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
  // The lazy part of a plugin (<name>-ui.ts) writes its labels under the plugin name: '<name>.<key>'.
  .map((f) => [
    `p_${f.replace(/\W/g, '_')}`,
    join(SRC, 'plugins', f),
    f.replace(/(-ui)?\.ts$/, ''),
  ]);
const packFiles = readdirSync(PACKS).filter((f) => f.endsWith('.ts'));

const mods = await load([
  ['en', join(SRC, 'i18n/en.ts')],
  ...plugins.map(([id, path]) => [id, path]),
  ...packFiles.map((f) => [`pack_${f.replace(/\W/g, '_')}`, join(PACKS, f)]),
]);

/** The reference: every core and plugin key with its English string. */
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
  console.log(`${Object.keys(template).length} strings → ${file}`);
} else if (command === 'check') {
  let failed = 0;
  for (const f of packFiles) {
    const code = f.replace('.ts', '');
    if (codes.length && !codes.includes(code)) continue;
    const pack = mods[`pack_${f.replace(/\W/g, '_')}`].default;
    const problems = [];
    for (const [key, en] of Object.entries(template)) {
      const value = pack[key];
      if (value === undefined) problems.push(`missing key ${key}`);
      else if (!value.trim()) problems.push(`empty string ${key}`);
      else if (params(value) !== params(en))
        problems.push(`parameters ${key}: "${value}" vs "${en}"`);
    }
    for (const key of Object.keys(pack)) if (!(key in template)) problems.push(`extra key ${key}`);
    if (problems.length) {
      failed++;
      console.log(
        `✗ ${code}: ${problems.length} problems\n  ${problems.slice(0, 20).join('\n  ')}`,
      );
    } else console.log(`✓ ${code}: ${Object.keys(pack).length} strings`);
  }
  process.exit(failed ? 1 : 0);
} else {
  const core = Object.keys(mods.en.en).length;
  console.log(
    `Strings in total: ${Object.keys(template).length} (core ${core}, plugins ${Object.keys(template).length - core})`,
  );
  console.log(`Packs: ${packFiles.map((f) => f.replace('.ts', '')).join(', ') || 'none'}`);
}
