/**
 * Глубокий прогон property-based тестов: в десятки раз больше случайных документов, чем в
 * обычном `pnpm test`. Запускается в CI по расписанию и перед релизом.
 *   node scripts/test-deep.mjs [число прогонов, по умолчанию 5000]
 */
import { spawnSync } from 'node:child_process';

const runs = process.argv[2] ?? '5000';
const res = spawnSync('pnpm', ['exec', 'vitest', 'run', 'property', 'markdown'], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: { ...process.env, FC_RUNS: runs },
});
process.exit(res.status ?? 1);
