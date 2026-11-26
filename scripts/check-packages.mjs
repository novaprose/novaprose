/**
 * Проверка опубликуемых пакетов — то, что увидит пользователь после npm install:
 *  - publint: поля package.json, exports, файлы в архиве;
 *  - @arethetypeswrong/cli: типы TypeScript для ESM и CommonJS, для node16 и бандлеров.
 * Проверяются архивы из .release/ (сначала pnpm release:pack). Падает при любой ошибке.
 * CDN-сборки и CSS исключены: у них нет и не должно быть типов.
 */
import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';

const tarballs = readdirSync('.release').filter((f) => f.endsWith('.tgz'));
if (!tarballs.length) {
  console.error('В .release/ нет архивов — сначала pnpm release:pack');
  process.exit(1);
}

const run = (cmd, args) => {
  try {
    // Через pnpm exec — бинарники из node_modules/.bin на любой ОС.
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
    // Angular Package Format — только ESM, так задумано Angular.
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
  console.error(`Проблем с пакетами: ${failed}`);
  process.exit(1);
}
