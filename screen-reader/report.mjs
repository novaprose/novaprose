// Prints what NVDA said in each screen reader test as GitHub notices (shown on the workflow run).
//   node screen-reader/report.mjs
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const results = join(import.meta.dirname, 'test-results');
const escape = (text) => text.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
const escapeTitle = (text) => escape(text).replace(/:/g, '%3A').replace(/,/g, '%2C');

const dirs = existsSync(results) ? readdirSync(results, { withFileTypes: true }) : [];
let count = 0;
for (const dir of dirs) {
  const file = join(results, dir.name, 'spoken.txt');
  if (!dir.isDirectory() || !existsSync(file)) continue;
  const text = readFileSync(file, 'utf8').trim();
  console.log(`::notice title=${escapeTitle(`NVDA ${dir.name}`)}::${escape(text)}`);
  count++;
}
if (!count) console.log('No spoken.txt files: the tests did not get as far as NVDA speaking.');
