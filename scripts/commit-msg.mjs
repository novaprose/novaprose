/**
 * commit-msg git hook: the message follows Conventional Commits, as the repository does:
 *   feat(core): editor.insertContent with table-in-table protection
 *   fix: …   docs: …   chore(release): 0.6.0
 * Installed through simple-git-hooks (package.json) on pnpm install.
 */
import { readFileSync } from 'node:fs';

const file = process.argv[2];
const message = readFileSync(file, 'utf8')
  .split('\n')
  .filter((line) => !line.startsWith('#'))
  .join('\n')
  .trim();
const subject = message.split('\n')[0] ?? '';

const TYPES = [
  'feat',
  'fix',
  'perf',
  'refactor',
  'docs',
  'test',
  'build',
  'ci',
  'chore',
  'style',
  'revert',
];
const RE = new RegExp(`^(${TYPES.join('|')})(\\([a-z0-9-]+\\))?!?: \\S.{0,99}$`);

// Service messages from git (merge, revert) are skipped.
if (/^(Merge|Revert|fixup!|squash!) /.test(subject) || RE.test(subject)) process.exit(0);

console.error(`
✗ The commit message doesn't follow Conventional Commits:
    ${subject}

  Expected: <type>(<scope>): <what was done, in English>
  Types: ${TYPES.join(', ')}
  Example: fix(core): keep leading spaces after a line break
`);
process.exit(1);
