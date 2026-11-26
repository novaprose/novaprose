/**
 * Примеры (examples/*) — заодно чистые проекты для проверки архивов перед релизом (пункт 4
 * docs/RELEASING.md). Каждый пример копируется во временную папку, зависимости @novaprose/*
 * заменяются архивами из .release/ (pnpm release:pack), затем npm install и проверка:
 *   react, vue      — проверка типов (tsc, vue-tsc) и сборка Vite;
 *   server-render   — запуск в Node (ESM) и импорт ядра через require (CJS);
 *   cdn             — ссылки на CDN ведут на текущий минор (@X.Y).
 *
 * Запуск: pnpm verify:examples (после pnpm release:pack). --strict — диапазоны @novaprose/* в
 * примерах обязаны совпадать с версией пакетов (так в релизе); без него — предупреждение.
 */
import { execSync, spawn } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const strict = process.argv.includes('--strict');
const only = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));
const version = JSON.parse(readFileSync(join(root, 'packages/core/package.json'), 'utf8')).version;
const minor = version.split('.').slice(0, 2).join('.');

const release = join(root, '.release');
const tarballs = new Map(
  readdirSync(release)
    .map((file) => [file.match(/^novaprose-(.+)-\d+\.\d+\.\d+(?:-[\w.]+)?\.tgz$/)?.[1], file])
    .filter(([name]) => name)
    .map(([name, file]) => [`@novaprose/${name}`, join(release, file)]),
);
if (!tarballs.size) {
  console.error('Нет архивов в .release/ — сначала pnpm release:pack');
  process.exit(1);
}

const problems = [];
const warnings = [];

function run(command, cwd) {
  try {
    return execSync(command, { cwd, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' });
  } catch (error) {
    throw new Error(`${command}\n${error.stdout ?? ''}${error.stderr ?? ''}`.trim());
  }
}

/** Диапазоны @novaprose/* в примере — на текущий минор (^X.Y.0). */
function checkRanges(name, pkg) {
  for (const deps of [pkg.dependencies, pkg.devDependencies])
    for (const [dep, range] of Object.entries(deps ?? {}))
      if (dep.startsWith('@novaprose/') && range !== `^${minor}.0`)
        (strict ? problems : warnings).push(
          `${name}: ${dep} "${range}", а версия пакетов ${version}`,
        );
}

/** Копия примера, где @novaprose/* — архивы из .release/ (и для вложенных зависимостей тоже). */
function prepare(name, extra = []) {
  const source = join(root, 'examples', name);
  const dir = mkdtempSync(join(tmpdir(), `nova-example-${name}-`));
  cpSync(source, dir, {
    recursive: true,
    filter: (path) => !/[\\/](node_modules|dist)([\\/]|$)/.test(path.slice(source.length)),
  });
  const file = join(dir, 'package.json');
  const pkg = JSON.parse(readFileSync(file, 'utf8'));
  checkRanges(name, pkg);
  pkg.dependencies ??= {};
  for (const dep of extra) pkg.dependencies[dep] = '*';
  const overrides = {};
  for (const deps of [pkg.dependencies, pkg.devDependencies])
    for (const dep of Object.keys(deps ?? {}))
      if (tarballs.has(dep)) {
        deps[dep] = `file:${tarballs.get(dep)}`;
        overrides[dep] = `$${dep}`;
      }
  pkg.overrides = overrides;
  writeFileSync(file, JSON.stringify(pkg, null, 2));
  return { dir, pkg };
}

/** Поднять сервер примера и дождаться ответа по адресу. */
async function serve(command, cwd, port) {
  // Своя группа процессов (не Windows): остановка гасит и оболочку, и сам сервер.
  const child = spawn(command, {
    cwd,
    shell: true,
    stdio: 'ignore',
    detached: process.platform !== 'win32',
  });
  const url = `http://localhost:${port}/`;
  for (let i = 0; i < 200; i++) {
    if (child.exitCode !== null)
      throw new Error(`${command}: сервер завершился (${child.exitCode})`);
    try {
      if ((await fetch(url)).ok) return { url, stop: () => stopTree(child) };
    } catch {
      // ещё не слушает
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  stopTree(child);
  throw new Error(`${command}: сервер не ответил на ${url}`);
}

function stopTree(child) {
  try {
    if (process.platform === 'win32')
      execSync(`taskkill /pid ${child.pid} /T /F`, { stdio: 'ignore' });
    else process.kill(-child.pid, 'SIGTERM');
  } catch {
    // уже завершён
  }
}

/** Открыть пример в Chromium и выполнить сценарий; ошибки страницы — провал. */
async function inBrowser(url, scenario) {
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error' && !message.text().includes('favicon'))
        errors.push(message.text());
    });
    page.setDefaultTimeout(15_000);
    await page.goto(url);
    await scenario(page);
    if (errors.length) throw new Error(`ошибки на странице:\n${errors.join('\n')}`);
  } finally {
    await browser.close();
  }
}

/** React и Vue: собранное приложение — выноска (вид узла), смена тона, формула (ленивый чанк). */
async function appSmoke(dir, port) {
  run('npm run build', dir);
  const server = await serve(`npx vite preview --port ${port} --strictPort`, dir, port);
  try {
    await inBrowser(server.url, async (page) => {
      await page.locator('.callout select').selectOption('warning');
      await page.locator('pre', { hasText: 'data-tone="warning"' }).waitFor();
      await page.locator('.nova-math math').first().waitFor();
    });
  } finally {
    server.stop();
  }
}

const checks = {
  react: (dir) => appSmoke(dir, 4310),
  vue: (dir) => appSmoke(dir, 4311),
  /** Сборка для CDN из архива вместо jsDelivr: элемент, ввод, отправка формы. */
  cdn: async (dir) => {
    // Файлы dist — в public/: Vite отдаёт их как есть, как CDN.
    cpSync(join(dir, 'node_modules/@novaprose/web-component/dist'), join(dir, 'public/novaprose'), {
      recursive: true,
    });
    const file = join(dir, 'index.html');
    writeFileSync(
      file,
      readFileSync(file, 'utf8').replace(
        /https:\/\/cdn\.jsdelivr\.net\/npm\/@novaprose\/web-component@[\d.]+\/dist\//g,
        '/novaprose/',
      ),
    );
    const server = await serve('npx vite --port 4312 --strictPort', dir, 4312);
    try {
      await inBrowser(server.url, async (page) => {
        await page.locator('novaprose-editor .ProseMirror').click();
        await page.keyboard.press('End');
        await page.keyboard.type(' Checked.');
        await page.getByRole('button', { name: 'Send' }).click();
        await page.locator('#sent', { hasText: 'Checked.' }).waitFor();
      });
    } finally {
      server.stop();
    }
  },
  'server-render': (dir) => {
    const output = run('node render.js', dir);
    for (const expected of [
      '<h2>Release notes</h2>',
      'data-mention="u42"',
      '<a href="#">click me</a>',
    ])
      if (!output.includes(expected)) throw new Error(`render.js: нет «${expected}» в выводе`);
    const cjs = run(
      `node -e "const { renderHTML } = require('@novaprose/core'); process.stdout.write(renderHTML({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'cjs' }] }] }))"`,
      dir,
    );
    if (cjs !== '<p>cjs</p>') throw new Error(`CommonJS: «${cjs}»`);
  },
};

for (const name of readdirSync(join(root, 'examples'), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)) {
  if (only.length && !only.includes(name)) continue;
  const started = Date.now();
  if (name === 'cdn') {
    const html = readFileSync(join(root, 'examples/cdn/index.html'), 'utf8');
    const versions = [...html.matchAll(/@novaprose\/web-component@([\d.]+)\//g)].map((m) => m[1]);
    if (!versions.length) problems.push('cdn: нет ссылок на @novaprose/web-component');
    for (const v of versions)
      if (v !== minor)
        (strict ? problems : warnings).push(`cdn: CDN @${v}, а версия пакетов ${version}`);
  }
  const check = checks[name];
  if (!check) {
    problems.push(`${name}: нет проверки в scripts/verify-examples.mjs`);
    continue;
  }
  const { dir } = prepare(
    name,
    name === 'cdn' ? ['@novaprose/web-component', '@novaprose/core'] : [],
  );
  try {
    run('npm install --no-audit --no-fund --loglevel=error', dir);
    await check(dir);
    console.log(`✓ ${name} (${Math.round((Date.now() - started) / 1000)} с)`);
  } catch (error) {
    problems.push(`${name}: ${error.message}`);
    console.log(`✗ ${name}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

for (const warning of warnings) console.warn(`! ${warning}`);
if (problems.length) {
  console.error(`\nПримеры не прошли проверку:\n\n${problems.join('\n\n')}`);
  process.exit(1);
}
