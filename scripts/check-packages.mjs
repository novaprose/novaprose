/**
 * Проверка опубликуемых пакетов — то, что увидит пользователь после npm install:
 *  - publint: поля package.json, exports, файлы в архиве;
 *  - @arethetypeswrong/cli: типы TypeScript для ESM и CommonJS, для node16 и бандлеров.
 * Проверяются архивы из .release/ (сначала pnpm release:pack). Падает при любой ошибке.
 * CDN-сборки и CSS исключены: у них нет и не должно быть типов.
 */
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';

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

// Стили ленивых частей (import css from './x.css?raw') — текстом в коде ядра. Был сбой: сборщик
// подменял их пустым объектом и клал рядом лишние .css — плагины в npm-сборке оставались без стилей.
{
  const dist = 'packages/core/dist';
  const files = readdirSync(dist);
  const code = files
    .filter((f) => f.endsWith('.js'))
    .map((f) => readFileSync(`${dist}/${f}`, 'utf8'))
    .join('\n');
  const problems = [
    ...files.filter((f) => f.endsWith('.css')).map((f) => `лишний файл стилей ${dist}/${f}`),
    ...['--nova-page-margins', '.nova-details', '.nova-math']
      .filter((marker) => !code.includes(marker))
      .map((marker) => `в коде нет стилей плагинов (${marker})`),
  ];
  if (problems.length) {
    failed++;
    console.log(`✗ стили плагинов в @novaprose/core\n${problems.join('\n')}\n`);
  } else console.log('✓ стили плагинов в коде @novaprose/core');
}

// Описания в типах (.d.ts) видны разработчикам в подсказках IDE — только по-английски. JSDoc у
// экспортов и публичных полей пишется на английском; внутренние комментарии могут быть русскими.
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
        .filter(({ line }) => /[А-Яа-яЁё]/.test(line)),
    );
  if (russian.length) {
    failed++;
    const sample = russian.slice(0, 10).map(({ f, i, line }) => `${f}:${i + 1}: ${line.trim()}`);
    console.log(`✗ русский текст в типах (.d.ts): ${russian.length} строк\n${sample.join('\n')}\n`);
  } else console.log('✓ описания в типах — на английском');
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
