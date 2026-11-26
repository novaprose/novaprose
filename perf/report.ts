import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';

/** Measurements are written here one at a time right away: a failed test restarts the process and memory is lost. */
export const RESULTS_FILE = 'perf-results/results.jsonl';

export interface PerfResult {
  name: string;
  value: number;
  limit: number;
  unit: string;
}

/** After all measurements: the table to the output, perf-results/perf.json and the run summary in CI. */
export default function report(): void {
  if (!existsSync(RESULTS_FILE)) return;
  const results = readFileSync(RESULTS_FILE, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as PerfResult);
  const rows = results.map(
    (r) =>
      `| ${r.name} | ${r.value} ${r.unit} | ${r.limit} ${r.unit} | ${r.value <= r.limit ? '✓' : '✗'} |`,
  );
  const table = ['| Measurement | Value | Limit | |', '|---|---:|---:|---|', ...rows].join('\n');
  console.log(`\n${table}\n`);
  writeFileSync('perf-results/perf.json', `${JSON.stringify(results, null, 2)}\n`);
  if (process.env.GITHUB_STEP_SUMMARY)
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### Performance (Chromium)\n\n${table}\n`);
  // The annotation shows in the checks API without signing in to GitHub: each run's numbers and the margin to the limit.
  if (process.env.GITHUB_ACTIONS) {
    const lines = results.map((r) => `${r.name}: ${r.value} ${r.unit} (limit ${r.limit})`);
    console.log(`::notice title=Performance (Chromium)::${lines.join('%0A')}`);
  }
}
