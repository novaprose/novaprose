// Часть страниц сайта генерируется, чтобы не держать две копии текста:
// - страницы фреймворков — из README пакетов (README видно и на npmjs.com);
// - changelog — из корневого CHANGELOG.md.
// Запуск: pnpm --filter @novaprose/site sync-docs. Проверка без записи (CI): `--check`.
import { readFileSync, writeFileSync } from 'node:fs';

const root = new URL('../../../', import.meta.url);
const check = process.argv.includes('--check');
const stale = [];

function emit(name, target, page) {
  const url = new URL(target, root);
  if (!check) {
    writeFileSync(url, page);
    return;
  }
  let current = '';
  try {
    current = readFileSync(url, 'utf8');
  } catch {
    // нет файла — значит устарел
  }
  if (current !== page) stale.push(name);
}

const PAGES = {
  react: [
    'React',
    'React component and hooks for NovaProse: controlled value, React Hook Form, Next.js.',
  ],
  vue: ['Vue', 'Vue 3 component with v-model and composables for NovaProse.'],
  angular: [
    'Angular',
    'Angular standalone component for NovaProse with ngModel and Reactive Forms.',
  ],
  'web-component': [
    'Web Component',
    'The <novaprose-editor> custom element: a native form field for plain HTML, Svelte and server-rendered pages.',
  ],
};

for (const [pkg, [title, description]] of Object.entries(PAGES)) {
  const md = readFileSync(new URL(`packages/${pkg}/README.md`, root), 'utf8')
    .replace(/^# .*\n+/, '')
    .replace(/> \*\*Status: 0\.x preview\.\*\*[^\n]*\n+/, '')
    .replace(/## License\n+MIT\n*$/, '')
    .replaceAll('https://www.npmjs.com/package/@novaprose/core', '/getting-started/')
    .replaceAll('https://www.npmjs.com/package/@novaprose/angular', '/frameworks/angular/');
  const page =
    `---\ntitle: ${title}\ndescription: ${JSON.stringify(description)}\n---\n\n` +
    `<!-- Сгенерировано из packages/${pkg}/README.md: правьте README, затем pnpm --filter @novaprose/site sync-docs -->\n\n` +
    md.trimEnd() +
    '\n';
  emit(pkg, `apps/site/src/content/docs/frameworks/${pkg}.md`, page);
}

const changelog = readFileSync(new URL('CHANGELOG.md', root), 'utf8').replace(/^# .*\n+/, '');
emit(
  'changelog',
  'apps/site/src/content/docs/changelog.md',
  '---\ntitle: Changelog\ndescription: "Release notes for all @novaprose packages."\n---\n\n' +
    '<!-- Сгенерировано из CHANGELOG.md: правьте его, затем pnpm --filter @novaprose/site sync-docs -->\n\n' +
    changelog.trimEnd() +
    '\n',
);

if (stale.length) {
  console.error(`Устарели сгенерированные страницы: ${stale.join(', ')}. Запустите sync-docs.`);
  process.exit(1);
}
