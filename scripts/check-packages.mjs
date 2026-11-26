/**
 * Checks the packages to be published, as a user sees them after npm install:
 *  - publint: package.json fields, exports, files in the archive;
 *  - @arethetypeswrong/cli: TypeScript types for ESM and CommonJS, for node16 and bundlers.
 * Checks the archives in .release/ (run pnpm release:pack first). Fails on any error.
 * CDN builds and CSS are excluded: they have no types and shouldn't.
 */
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';

const tarballs = readdirSync('.release').filter((f) => f.endsWith('.tgz'));
if (!tarballs.length) {
  console.error('No archives in .release/: run pnpm release:pack first');
  process.exit(1);
}

const run = (cmd, args) => {
  try {
    // Through pnpm exec: binaries from node_modules/.bin on any OS.
    execFileSync('pnpm', ['exec', cmd, ...args], {
      stdio: 'pipe',
      encoding: 'utf8',
      shell: process.platform === 'win32',
    });
    return null;
  } catch (e) {
    return `${e.stdout || ''}${e.stderr || ''}`.trim();
  }
};

let failed = 0;

// Styles of lazy parts (import css from './x.css?raw') are text inside the core code. There was a bug: the
// bundler replaced them with an empty object and put stray .css files next to them, so plugins in the npm build had no styles.
{
  const dist = 'packages/core/dist';
  const files = readdirSync(dist);
  const code = files
    .filter((f) => f.endsWith('.js'))
    .map((f) => readFileSync(`${dist}/${f}`, 'utf8'))
    .join('\n');
  const problems = [
    ...files.filter((f) => f.endsWith('.css')).map((f) => `stray style file ${dist}/${f}`),
    ...['--nova-page-margins', '.nova-details', '.nova-math']
      .filter((marker) => !code.includes(marker))
      .map((marker) => `plugin styles missing from the code (${marker})`),
  ];
  if (problems.length) {
    failed++;
    console.log(`✗ plugin styles in @novaprose/core\n${problems.join('\n')}\n`);
  } else console.log('✓ plugin styles in the @novaprose/core code');
}

// Descriptions in the types (.d.ts) show up in developers' IDE hints, so they must be English. The whole
// repository is English (scripts/check-english.mjs); this checks what actually ships in the archives.
{
  const walk = (dir) =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
      entry.isDirectory() ? walk(`${dir}/${entry.name}`) : [`${dir}/${entry.name}`],
    );
  const russian = readdirSync('packages')
    .flatMap((pkg) => {
      try {
        return walk(`packages/${pkg}/dist`);
      } catch {
        return [];
      }
    })
    .filter((f) => /\.d\.c?ts$/.test(f))
    .flatMap((f) =>
      readFileSync(f, 'utf8')
        .split('\n')
        .map((line, i) => ({ f, i, line }))
        .filter(({ line }) => /\p{Script=Cyrillic}/u.test(line)),
    );
  if (russian.length) {
    failed++;
    const sample = russian.slice(0, 10).map(({ f, i, line }) => `${f}:${i + 1}: ${line.trim()}`);
    console.log(
      `✗ Cyrillic text in the types (.d.ts): ${russian.length} lines\n${sample.join('\n')}\n`,
    );
  } else console.log('✓ descriptions in the types are in English');
}

for (const file of tarballs) {
  const path = `.release/${file}`;
  const problems = [];
  const lint = run('publint', [path, '--strict']);
  if (lint) problems.push(`publint:\n${lint}`);
  const types = run('attw', [
    path,
    '--profile',
    'node16',
    '--format',
    'ascii',
    '--exclude-entrypoints',
    'style.css',
    'cdn',
    // Angular Package Format is ESM only, by Angular's design.
    ...(file.includes('angular') ? ['--ignore-rules', 'cjs-resolves-to-esm'] : []),
  ]);
  if (types) problems.push(`attw:\n${types}`);
  if (problems.length) {
    failed++;
    console.log(`✗ ${file}\n${problems.join('\n')}\n`);
  } else {
    console.log(`✓ ${file}`);
  }
}
if (failed) {
  console.error(`Package problems: ${failed}`);
  process.exit(1);
}
