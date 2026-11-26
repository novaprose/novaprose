/**
 * A deep run of the property-based tests: tens of times more random documents than in the
 * regular `pnpm test`. CI runs it on a schedule and before a release.
 *   node scripts/test-deep.mjs [number of runs, 5000 by default]
 */
import { spawnSync } from 'node:child_process';

const runs = process.argv[2] ?? '5000';
const res = spawnSync('pnpm', ['exec', 'vitest', 'run', 'property', 'markdown'], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: { ...process.env, FC_RUNS: runs },
});
process.exit(res.status ?? 1);
