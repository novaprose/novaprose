import { mkdirSync, rmSync } from 'node:fs';
import { RESULTS_FILE } from './report';

/** Before the measurements: a clean results file. */
export default function setup(): void {
  mkdirSync('perf-results', { recursive: true });
  rmSync(RESULTS_FILE, { force: true });
}
