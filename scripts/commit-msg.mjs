/**
 * git-хук commit-msg: сообщение в формате Conventional Commits, как принято в репозитории:
 *   feat(core): editor.insertContent with table-in-table protection
 *   fix: …   docs: …   chore(release): 0.6.0
 * Подключается через simple-git-hooks (package.json), ставится при pnpm install.
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

// Служебные сообщения git (merge, revert) пропускаем.
if (/^(Merge|Revert|fixup!|squash!) /.test(subject) || RE.test(subject)) process.exit(0);

console.error(`
✗ Сообщение коммита не в формате Conventional Commits:
    ${subject}

  Нужно: <тип>(<область>): <что сделано, по-английски>
  Типы: ${TYPES.join(', ')}
  Пример: fix(core): keep leading spaces after a line break
`);
process.exit(1);
