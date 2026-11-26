/**
 * The repository is English only (CLAUDE.md → Language): fails when a text file contains Cyrillic
 * outside the allowlist below. Allowed are files where Cyrillic is data, not prose: translation packs
 * and test inputs that check how the editor handles non-Latin text.
 *   node scripts/check-english.mjs
 * Checks tracked files and new files that aren't ignored, so it works before a commit too.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

/** Files where Cyrillic is data. Keep the list short and say why each file is here. */
const ALLOWED = new Map([['packages/core/src/i18n/packs/ru.ts', 'the Russian translation pack']]);

const CYRILLIC = /\p{Script=Cyrillic}/u;
const BINARY = /\.(png|jpe?g|gif|webp|avif|ico|woff2?|ttf|otf|docx|xlsx|zip|tgz|pdf)$/i;

const files = execFileSync(
  'git',
  ['ls-files', '-z', '--cached', '--others', '--exclude-standard'],
  {
    encoding: 'utf8',
  },
)
  .split('\0')
  .filter(Boolean);

const problems = [];
for (const file of new Set(files)) {
  if (BINARY.test(file) || ALLOWED.has(file)) continue;
  let text;
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    continue; // deleted in the working tree
  }
  text.split('\n').forEach((line, index) => {
    if (CYRILLIC.test(line)) problems.push(`${file}:${index + 1}: ${line.trim().slice(0, 100)}`);
  });
}

if (problems.length) {
  console.error(
    `✗ Cyrillic outside the allowed files: ${problems.length} lines. The repository is English only;` +
      ' translate the text, or add a data file to ALLOWED in scripts/check-english.mjs with a reason.\n',
  );
  console.error(problems.slice(0, 40).join('\n'));
  if (problems.length > 40) console.error(`…and ${problems.length - 40} more`);
  process.exit(1);
}
console.log(`✓ English only (${files.length} files)`);
