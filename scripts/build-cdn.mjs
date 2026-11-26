#!/usr/bin/env node
/**
 * CDN build: a plain <script> (an IIFE with a global object) + lazy parts next to it.
 *
 * The main file holds everything needed to create an editor and sets the global object right away
 * (NovaProse / tinymce), as before. Parts that the core loads lazily anyway (table mechanics,
 * optional plugins, Office paste cleanup, dialogs built from field descriptions) are built into
 * separate files <name>-chunks/<part>-<hash>.js and loaded from the same address on demand.
 *
 * The parts use the same module instances as the main file (ProseMirror, the core): otherwise
 * instanceof and shared state would break. The main file puts these modules into its registry
 * (globalThis.__novaprose_<name>), and in the parts an import of such a module reads the registry.
 * A part's file name is a hash of its content: an old cached part never meets a new main file.
 *
 *   node ../../scripts/build-cdn.mjs --entry src/cdn.ts --out dist/novaprose.global.js \
 *     --global NovaProse --css ../core/src/style.css
 *   (run from the package folder; paths are relative to it)
 */
import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { rawCss } from './esbuild-raw-css.mjs';

const args = {};
for (let i = 2; i < process.argv.length; i += 2) {
  args[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
}
const pkgDir = process.cwd();
const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const entry = path.resolve(pkgDir, args.entry);
const outFile = path.resolve(pkgDir, args.out);
const outDir = path.dirname(outFile);
const globalName = args.global;
const bundle = path.basename(outFile).replace(/\.global\.js$|\.js$/, '');
const chunkDir = `${bundle}-chunks`;
const registry = `__novaprose_${bundle.replace(/\W/g, '_')}`;
const licensesFile = `${bundle}.licenses.txt`;
const { version } = JSON.parse(readFileSync(path.join(pkgDir, 'package.json'), 'utf8'));

// A placeholder for a part's address, long enough: after the build the real address replaces it,
// padded with spaces to the same length, so source maps (positions in the line) stay correct.
const PLACEHOLDER = '__NOVA_CHUNK__:';
const PAD = '_'.repeat(80);
const PLACEHOLDER_RE = new RegExp(`(["'\`])${PLACEHOLDER}([\\w.-]+)#_+\\1`, 'g');
const padTo = (text, length) => {
  if (text.length > length) throw new Error(`[build-cdn] chunk reference too long: ${text}`);
  return text + ' '.repeat(length - text.length);
};

const common = {
  absWorkingDir: root,
  bundle: true,
  minify: true,
  platform: 'browser',
  target: 'es2020',
  legalComments: 'none',
  logLevel: 'error',
  write: false,
  metafile: true,
  sourcemap: 'external',
  loader: { '.css': 'empty' },
};

/** A module's key is its path from the repository root (the same for the main file and the parts). */
const keyOf = (abs) => path.relative(root, abs).replaceAll('\\', '/');
const js = (result) => result.outputFiles.find((f) => !f.path.endsWith('.map'));
const map = (result) => result.outputFiles.find((f) => f.path.endsWith('.map'));

// ---------- lazy parts: id ↔ file ----------
const lazy = new Map(); // abs path → id
const queue = [];
function lazyId(abs) {
  let id = lazy.get(abs);
  if (!id) {
    // The name without the core build hash (charmap-AB12CD34.js → charmap).
    const base = path
      .basename(abs)
      .replace(/\.[cm]?[jt]s$/, '')
      .replace(/-[A-Z0-9]{8}$/, '');
    id = base;
    for (let n = 2; [...lazy.values()].includes(id); n++) id = `${base}${n}`;
    lazy.set(abs, id);
    queue.push(abs);
  }
  return id;
}

/** import('…') of a lazy module → an external placeholder link; the real address is filled in after the build. */
const splitDynamic = {
  name: 'nova-split-dynamic',
  setup(b) {
    b.onResolve({ filter: /.*/ }, async (a) => {
      if (a.kind !== 'dynamic-import' || a.pluginData?.skip) return undefined;
      const r = await b.resolve(a.path, {
        resolveDir: a.resolveDir,
        kind: a.kind,
        importer: a.importer,
        pluginData: { skip: true },
      });
      if (r.errors.length) return { errors: r.errors };
      return { path: `${PLACEHOLDER}${lazyId(r.path)}#${PAD}`, external: true };
    });
  },
};

// ---------- 1. the main file: which modules it contains ----------
const first = await build({
  ...common,
  entryPoints: [entry],
  outfile: outFile,
  format: 'iife',
  globalName,
  plugins: [rawCss, splitDynamic],
});
const mainModules = new Set(Object.keys(first.metafile.inputs));

// ---------- 2. parts: shared modules come from the main file's registry ----------
const shared = new Set();
const fromRegistry = {
  name: 'nova-shared',
  setup(b) {
    b.onResolve({ filter: /.*/ }, async (a) => {
      if (a.kind === 'entry-point' || a.kind === 'dynamic-import' || a.pluginData?.skip) {
        return undefined;
      }
      const r = await b.resolve(a.path, {
        resolveDir: a.resolveDir,
        kind: a.kind,
        importer: a.importer,
        pluginData: { skip: true },
      });
      if (r.errors.length || r.external) return undefined;
      const key = keyOf(r.path);
      if (!mainModules.has(key)) return { path: r.path };
      shared.add(key);
      return { path: key, namespace: 'nova-shared' };
    });
    // A module from the registry: getters keep "live" bindings (values that change later).
    b.onLoad({ filter: /.*/, namespace: 'nova-shared' }, (a) => ({
      contents: `var m = globalThis[${JSON.stringify(registry)}][${JSON.stringify(a.path)}];
Object.defineProperty(exports, '__esModule', { value: true });
for (var k in m) (function (k) { Object.defineProperty(exports, k, { enumerable: true, get: function () { return m[k]; } }); })(k);`,
      loader: 'js',
    }));
  },
};

const chunks = new Map(); // id → { text, map, deps }
const chunkModules = new Map(); // module key → [ids]
while (queue.length) {
  const abs = queue.shift();
  const id = lazy.get(abs);
  const result = await build({
    ...common,
    entryPoints: { [id]: abs },
    outdir: path.join(outDir, chunkDir),
    format: 'esm',
    plugins: [rawCss, splitDynamic, fromRegistry],
  });
  const text = js(result).text;
  const deps = [...text.matchAll(PLACEHOLDER_RE)].map((m) => m[2]);
  chunks.set(id, { text, map: map(result).text, deps });
  for (const key of Object.keys(result.metafile.inputs)) {
    if (key.startsWith('nova-shared:')) continue;
    chunkModules.set(key, [...(chunkModules.get(key) ?? []), id]);
  }
}

// A module that ended up in several parts (and not in the main file) gets its own instance in each.
// For modules with shared state that is a bug: report it so the decision is deliberate.
const duplicated = [...chunkModules].filter(([, ids]) => ids.length > 1);
if (duplicated.length) {
  console.warn(`[build-cdn] ${bundle}: modules copied into several chunks:`);
  for (const [key, ids] of duplicated) console.warn(`  ${key} → ${ids.join(', ')}`);
}

// ---------- 3. part names by hash (first the ones others depend on) ----------
const names = new Map();
const finalText = new Map();
const nameOf = (id, stack = []) => {
  if (names.has(id)) return names.get(id);
  if (stack.includes(id)) {
    throw new Error(`[build-cdn] cyclic lazy chunks: ${[...stack, id].join(' → ')}`);
  }
  const { text, deps } = chunks.get(id);
  for (const dep of deps) nameOf(dep, [...stack, id]);
  // Inside a part, a relative import() resolves against the part's own address (it is an ES module).
  const resolved = text.replace(PLACEHOLDER_RE, (match, quote, dep) =>
    padTo(`${quote}./${names.get(dep)}${quote}`, match.length),
  );
  const name = `${id}-${createHash('sha256').update(resolved).digest('hex').slice(0, 8)}.js`;
  names.set(id, name);
  finalText.set(id, resolved);
  return name;
};
for (const id of chunks.keys()) nameOf(id);

// ---------- 4. the main file with the registry ----------
const exposed = [...shared].sort();
const wrapper = `export * from ${JSON.stringify(entry.replaceAll('\\', '/'))};
${exposed.map((key, i) => `import * as m${i} from ${JSON.stringify(path.join(root, key).replaceAll('\\', '/'))};`).join('\n')}
var r = (globalThis[${JSON.stringify(registry)}] = {});
${exposed.map((key, i) => `r[${JSON.stringify(key)}] = m${i};`).join('\n')}
`;
const main = await build({
  ...common,
  stdin: { contents: wrapper, resolveDir: pkgDir, sourcefile: 'cdn-entry.js', loader: 'js' },
  outfile: outFile,
  format: 'iife',
  globalName,
  plugins: [rawCss, splitDynamic],
  // The parts' address comes from the script's own address (document.currentScript), not the page.
  banner: {
    js:
      `/*! NovaProse ${version} | MIT | third-party licenses: ${licensesFile} */\n` +
      'var __novaChunkBase=typeof document!=="undefined"&&(document.currentScript&&document.currentScript.src||document.baseURI)||"";' +
      'function __novaChunk(p){return new URL(p,__novaChunkBase).href}',
  },
});
const mainText = js(main).text.replace(PLACEHOLDER_RE, (match, _quote, id) =>
  padTo(`__novaChunk(${JSON.stringify(`${chunkDir}/${names.get(id)}`)})`, match.length),
);
if (mainText.includes(PLACEHOLDER)) throw new Error('[build-cdn] unresolved chunk placeholder');

// ---------- writing ----------
rmSync(path.join(outDir, chunkDir), { recursive: true, force: true });
mkdirSync(path.join(outDir, chunkDir), { recursive: true });
const mapName = `${path.basename(outFile)}.map`;
writeFileSync(outFile, `${mainText}//# sourceMappingURL=${mapName}\n`);
writeFileSync(path.join(outDir, mapName), map(main).text);
for (const [id, text] of finalText) {
  const name = names.get(id);
  writeFileSync(path.join(outDir, chunkDir, name), `${text}//# sourceMappingURL=${name}.map\n`);
  writeFileSync(path.join(outDir, chunkDir, `${name}.map`), chunks.get(id).map);
}
if (args.css) copyFileSync(path.resolve(pkgDir, args.css), path.join(outDir, 'novaprose.css'));

// ---------- licenses of third-party code in the build ----------
// The build includes code from packages (ProseMirror, highlight.js…), and their licenses (MIT, BSD)
// require shipping the license text. The list comes from what actually ended up in the main file and parts.
const LICENSE_FILE = /^(licen[cs]e|copying)(\.(md|txt))?$/i;
const packageDirs = new Set();
for (const key of [...Object.keys(main.metafile.inputs), ...chunkModules.keys()]) {
  const at = key.lastIndexOf('node_modules/');
  if (at < 0) continue;
  const [scope, name] = key.slice(at + 'node_modules/'.length).split('/');
  const pkgName = scope.startsWith('@') ? `${scope}/${name}` : scope;
  packageDirs.add(path.join(root, key.slice(0, at), 'node_modules', pkgName));
}
const packages = [...packageDirs]
  .map((dir) => {
    const pkg = JSON.parse(readFileSync(path.join(dir, 'package.json'), 'utf8'));
    const file = readdirSync(dir).find((name) => LICENSE_FILE.test(name));
    const text = file
      ? readFileSync(path.join(dir, file), 'utf8').replace(/\r\n?/g, '\n').trim()
      : `License: ${pkg.license ?? 'see the package'} (the package has no license file).`;
    return { title: `${pkg.name} ${pkg.version} — ${pkg.license ?? 'see below'}`, text };
  })
  .sort((a, b) => a.title.localeCompare(b.title));
const rule = '='.repeat(80);
// Lucide icons live in the core sources; their license is in its THIRD_PARTY_NOTICES.md.
const icons = readFileSync(path.join(root, 'packages/core/THIRD_PARTY_NOTICES.md'), 'utf8')
  .replace(/^# .*\n+/, '')
  .replace(/```(text)?\n?/g, '')
  .trim();
writeFileSync(
  path.join(outDir, licensesFile),
  [
    `NovaProse ${version} (MIT) — third-party software in ${path.basename(outFile)} and ${chunkDir}/.`,
    ...packages.flatMap(({ title, text }) => [rule, title, '', text]),
    rule,
    icons,
    '',
  ].join('\n'),
);

const kb = (s) => (Buffer.byteLength(s) / 1024).toFixed(1);
console.log(
  `[build-cdn] ${path.basename(outFile)}: ${kb(mainText)} KB + ${chunks.size} chunks in ${chunkDir}/ ` +
    `(${kb([...finalText.values()].join(''))} KB), ${shared.size} shared modules, ` +
    `${packages.length} third-party packages in ${licensesFile}`,
);
