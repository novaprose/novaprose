#!/usr/bin/env node
/**
 * CDN-сборка: обычный <script> (IIFE с глобальным объектом) + ленивые части рядом.
 *
 * Основной файл содержит всё, что нужно при создании редактора, и сразу задаёт глобальный объект
 * (NovaProse / tinymce) — как раньше. Части, которые ядро и так грузит лениво (механика таблиц,
 * необязательные плагины, очистка вставки из Office, диалоги по описанию полей), собираются в
 * отдельные файлы <имя>-chunks/<часть>-<хеш>.js и подгружаются с того же адреса по требованию.
 *
 * Части используют те же экземпляры модулей, что и основной файл (ProseMirror, ядро): иначе
 * ломались бы instanceof и общее состояние. Основной файл кладёт эти модули в свой реестр
 * (globalThis.__novaprose_<имя>), а в частях импорт такого модуля заменён чтением из реестра.
 * Имя файла части — хеш содержимого: старая часть из кэша не встретится с новым основным файлом.
 *
 *   node ../../scripts/build-cdn.mjs --entry src/cdn.ts --out dist/novaprose.global.js \
 *     --global NovaProse --css ../core/src/style.css
 *   (запускается из папки пакета; пути — относительно неё)
 */
import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
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

// Заглушка адреса части с запасом длины: после сборки её заменяет настоящий адрес, дополненный
// пробелами до той же длины, — карты исходников (позиции в строке) остаются верными.
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

/** Ключ модуля — путь от корня репозитория (одинаковый для основного файла и частей). */
const keyOf = (abs) => path.relative(root, abs).replaceAll('\\', '/');
const js = (result) => result.outputFiles.find((f) => !f.path.endsWith('.map'));
const map = (result) => result.outputFiles.find((f) => f.path.endsWith('.map'));

// ---------- ленивые части: id ↔ файл ----------
const lazy = new Map(); // abs path → id
const queue = [];
function lazyId(abs) {
  let id = lazy.get(abs);
  if (!id) {
    // Имя без хеша сборки ядра (charmap-AB12CD34.js → charmap).
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

/** import('…') ленивого модуля → внешняя ссылка-заглушка; настоящий адрес подставим после сборки. */
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

// ---------- 1. основной файл: какие модули в нём есть ----------
const first = await build({
  ...common,
  entryPoints: [entry],
  outfile: outFile,
  format: 'iife',
  globalName,
  plugins: [rawCss, splitDynamic],
});
const mainModules = new Set(Object.keys(first.metafile.inputs));

// ---------- 2. части: общие модули — из реестра основного файла ----------
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
    // Модуль из реестра: геттеры сохраняют «живые» привязки (значения, которые меняются позже).
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

// Модуль, попавший в несколько частей (и не в основной файл), — свой экземпляр в каждой.
// Для модулей с общим состоянием это ошибка: сообщаем, чтобы решение было осознанным.
const duplicated = [...chunkModules].filter(([, ids]) => ids.length > 1);
if (duplicated.length) {
  console.warn(`[build-cdn] ${bundle}: modules copied into several chunks:`);
  for (const [key, ids] of duplicated) console.warn(`  ${key} → ${ids.join(', ')}`);
}

// ---------- 3. имена частей по хешу (сначала те, от которых зависят другие) ----------
const names = new Map();
const finalText = new Map();
const nameOf = (id, stack = []) => {
  if (names.has(id)) return names.get(id);
  if (stack.includes(id)) {
    throw new Error(`[build-cdn] cyclic lazy chunks: ${[...stack, id].join(' → ')}`);
  }
  const { text, deps } = chunks.get(id);
  for (const dep of deps) nameOf(dep, [...stack, id]);
  // Внутри части относительный import() разрешается от адреса самой части (это ES-модуль).
  const resolved = text.replace(PLACEHOLDER_RE, (match, quote, dep) =>
    padTo(`${quote}./${names.get(dep)}${quote}`, match.length),
  );
  const name = `${id}-${createHash('sha256').update(resolved).digest('hex').slice(0, 8)}.js`;
  names.set(id, name);
  finalText.set(id, resolved);
  return name;
};
for (const id of chunks.keys()) nameOf(id);

// ---------- 4. основной файл с реестром ----------
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
  // Адрес частей — от адреса самого скрипта (document.currentScript), а не страницы.
  banner: {
    js:
      'var __novaChunkBase=typeof document!=="undefined"&&(document.currentScript&&document.currentScript.src||document.baseURI)||"";' +
      'function __novaChunk(p){return new URL(p,__novaChunkBase).href}',
  },
});
const mainText = js(main).text.replace(PLACEHOLDER_RE, (match, _quote, id) =>
  padTo(`__novaChunk(${JSON.stringify(`${chunkDir}/${names.get(id)}`)})`, match.length),
);
if (mainText.includes(PLACEHOLDER)) throw new Error('[build-cdn] unresolved chunk placeholder');

// ---------- запись ----------
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

const kb = (s) => (Buffer.byteLength(s) / 1024).toFixed(1);
console.log(
  `[build-cdn] ${path.basename(outFile)}: ${kb(mainText)} KB + ${chunks.size} chunks in ${chunkDir}/ ` +
    `(${kb([...finalText.values()].join(''))} KB), ${shared.size} shared modules`,
);
