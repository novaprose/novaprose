import { mkdirSync, rmSync } from 'node:fs';
import { RESULTS_FILE } from './report';

/** Перед замерами — чистый файл результатов. */
export default function setup(): void {
  mkdirSync('perf-results', { recursive: true });
  rmSync(RESULTS_FILE, { force: true });
}
