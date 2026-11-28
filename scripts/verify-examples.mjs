/**
 * The examples (examples/*) double as clean projects for checking the archives before a release (step 4
 * of docs/RELEASING.md). Each example is copied into a temporary folder, the @novaprose/* dependencies
 * are replaced with archives from .release/ (pnpm release:pack), then npm install and the checks:
 *   react, vue      type checks (tsc, vue-tsc) and a Vite build;
 *   server-render   a run in Node (ESM) and importing the core through require (CJS);
 *   cdn             CDN links point to the current minor (@X.Y);
 *   migrate         the migration command on a small TinyMCE project: the report, then --write.
 *
 * Run: pnpm verify:examples (after pnpm release:pack). --strict: the @novaprose/* ranges in the
 * examples must match the package version (as in a release); without it, a warning.
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
  console.error('No archives in .release/: run pnpm release:pack first');
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

/** The @novaprose/* ranges in an example point to the current minor (^X.Y.0). */
function checkRanges(name, pkg) {
  for (const deps of [pkg.dependencies, pkg.devDependencies])
    for (const [dep, range] of Object.entries(deps ?? {}))
      if (dep.startsWith('@novaprose/') && range !== `^${minor}.0`)
        (strict ? problems : warnings).push(
          `${name}: ${dep} "${range}", but the packages are at ${version}`,
        );
}

/** A copy of an example where @novaprose/* are archives from .release/ (nested dependencies too). */
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

/** Starts the example's server and waits for an answer at the address. */
async function serve(command, cwd, port) {
  // Its own process group (not on Windows): stopping it kills both the shell and the server.
  const child = spawn(command, {
    cwd,
    shell: true,
    stdio: 'ignore',
    detached: process.platform !== 'win32',
  });
  const url = `http://localhost:${port}/`;
  for (let i = 0; i < 200; i++) {
    if (child.exitCode !== null)
      throw new Error(`${command}: the server exited (${child.exitCode})`);
    try {
      if ((await fetch(url)).ok) return { url, stop: () => stopTree(child) };
    } catch {
      // not listening yet
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  stopTree(child);
  throw new Error(`${command}: the server didn't answer at ${url}`);
}

function stopTree(child) {
  try {
    if (process.platform === 'win32')
      execSync(`taskkill /pid ${child.pid} /T /F`, { stdio: 'ignore' });
    else process.kill(-child.pid, 'SIGTERM');
  } catch {
    // already finished
  }
}

/** Opens an example in Chromium and runs a scenario; page errors are a failure. */
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
    if (errors.length) throw new Error(`errors on the page:\n${errors.join('\n')}`);
  } finally {
    await browser.close();
  }
}

/** React and Vue: the built app: a callout (node view), changing the tone, a formula (lazy chunk). */
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
  /** A CDN build from the archive instead of jsDelivr: the element, typing, submitting the form. */
  cdn: async (dir) => {
    // dist files go into public/: Vite serves them as is, like a CDN.
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
  /** The migration command from the archive: the report of a dry run, then the changes made. */
  migrate: (dir) => {
    const report = run('npm run --silent migrate', dir);
    for (const expected of [
      'a dry run',
      "will change  line 1: import tinymce from 'tinymce'",
      "options NovaProse doesn't have yet: images_upload_url",
      'tinycomments is comments in NovaProse',
    ])
      if (!report.includes(expected)) throw new Error(`the report lacks "${expected}":\n${report}`);
    run('npm run --silent migrate:write', dir);
    const html = readFileSync(join(dir, 'project/index.html'), 'utf8');
    const dropIn = `https://cdn.jsdelivr.net/npm/@novaprose/tinymce-compat@${minor}/dist/tinymce.global.js`;
    if (!html.includes(`src="${dropIn}"`) || html.includes('tiny.cloud'))
      throw new Error(`project/index.html:\n${html}`);
    const js = readFileSync(join(dir, 'project/src/editor.js'), 'utf8');
    if (
      !js.startsWith(
        "import '@novaprose/core/style.css';\nimport { tinymce } from '@novaprose/tinymce-compat';\n\nexport",
      )
    )
      throw new Error(`project/src/editor.js:\n${js}`);
    const deps = JSON.parse(readFileSync(join(dir, 'project/package.json'), 'utf8')).dependencies;
    if (deps.tinymce || deps['@novaprose/tinymce-compat'] !== `^${version}`)
      throw new Error(`project/package.json: ${JSON.stringify(deps)}`);
  },
  'server-render': (dir) => {
    const output = run('node render.js', dir);
    for (const expected of [
      '<h2>Release notes</h2>',
      'data-mention="u42"',
      '<a href="#">click me</a>',
    ])
      if (!output.includes(expected))
        throw new Error(`render.js: "${expected}" is missing from the output`);
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
    if (!versions.length) problems.push('cdn: no links to @novaprose/web-component');
    for (const v of versions)
      if (v !== minor)
        (strict ? problems : warnings).push(`cdn: CDN @${v}, but the packages are at ${version}`);
  }
  const check = checks[name];
  if (!check) {
    problems.push(`${name}: no check in scripts/verify-examples.mjs`);
    continue;
  }
  // Packages an example gets through another one: from the archives too, not from npm.
  const extra = {
    cdn: ['@novaprose/web-component', '@novaprose/core'],
    migrate: ['@novaprose/core'],
  };
  const { dir } = prepare(name, extra[name] ?? []);
  try {
    run('npm install --no-audit --no-fund --loglevel=error', dir);
    await check(dir);
    console.log(`✓ ${name} (${Math.round((Date.now() - started) / 1000)} s)`);
  } catch (error) {
    problems.push(`${name}: ${error.message}`);
    console.log(`✗ ${name}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

for (const warning of warnings) console.warn(`! ${warning}`);
if (problems.length) {
  console.error(`\nThe examples failed the check:\n\n${problems.join('\n\n')}`);
  process.exit(1);
}
