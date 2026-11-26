// Some pages of the site are generated so that the text doesn't live in two copies:
// - framework pages come from the package READMEs (the README shows on npmjs.com too);
// - the changelog comes from the root CHANGELOG.md.
// Run: pnpm --filter @novaprose/site sync-docs. Check without writing (CI): `--check`.
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
    // no file means it is outdated
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
    `<!-- Generated from packages/${pkg}/README.md: edit the README, then run pnpm --filter @novaprose/site sync-docs -->\n\n` +
    md.trimEnd() +
    '\n';
  emit(pkg, `apps/site/src/content/docs/frameworks/${pkg}.md`, page);
}

const changelog = readFileSync(new URL('CHANGELOG.md', root), 'utf8').replace(/^# .*\n+/, '');
emit(
  'changelog',
  'apps/site/src/content/docs/changelog.md',
  '---\ntitle: Changelog\ndescription: "Release notes for all @novaprose packages."\n---\n\n' +
    '<!-- Generated from CHANGELOG.md: edit it, then run pnpm --filter @novaprose/site sync-docs -->\n\n' +
    changelog.trimEnd() +
    '\n',
);

if (stale.length) {
  console.error(`Generated pages are outdated: ${stale.join(', ')}. Run sync-docs.`);
  process.exit(1);
}
