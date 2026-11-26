import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';

/** Замеры пишутся сюда по одному сразу: упавший тест перезапускает процесс, память теряется. */
export const RESULTS_FILE = 'perf-results/results.jsonl';

export interface PerfResult {
  name: string;
  value: number;
  limit: number;
  unit: string;
}

/** После всех замеров: таблица в вывод, perf-results/perf.json и сводка прогона в CI. */
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
}
