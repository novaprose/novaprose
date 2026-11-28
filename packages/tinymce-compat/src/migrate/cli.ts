import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { formatReport, migrate } from './migrate';

/**
 * npx @novaprose/tinymce-compat migrate [folder] [--write] [--json]
 *
 * Reads a TinyMCE project and moves it to NovaProse's compatibility layer: a dry run by default.
 */

const HELP = `Moves a TinyMCE project to NovaProse (the tinymce.init() compatibility layer).

Usage: npx @novaprose/tinymce-compat migrate [folder] [--write] [--json]

  folder    the project (the current folder by default)
  --write   make the changes; without it, nothing is written and the report says what would change
  --json    the report as JSON

It changes what is safe to change by itself: imports of the tinymce package, script tags that load
TinyMCE from Tiny Cloud or a public CDN, and package.json. It reports the rest: options and plugins
NovaProse doesn't have, framework components to move, copies of TinyMCE of your own.`;

function version(): string {
  // dist/migrate.js → the package's package.json.
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
    version: string;
  };
  return pkg.version;
}

async function main(argv: string[]): Promise<number> {
  const args = argv[0] === 'migrate' ? argv.slice(1) : argv;
  if (args.includes('--help') || args.includes('-h')) {
    console.log(HELP);
    return 0;
  }
  const unknown = args.filter(
    (arg) => arg.startsWith('-') && arg !== '--write' && arg !== '--json',
  );
  if (unknown.length) {
    console.error(`Unknown option: ${unknown.join(', ')}\n\n${HELP}`);
    return 2;
  }
  const folders = args.filter((arg) => !arg.startsWith('-'));
  const root = resolve(folders[0] ?? '.');
  try {
    if (!statSync(root).isDirectory()) throw new Error('not a folder');
  } catch {
    console.error(`Not a folder: ${root}`);
    return 2;
  }
  const write = args.includes('--write');
  const result = await migrate({ root, write, version: version() });
  console.log(
    args.includes('--json') ? JSON.stringify(result, null, 2) : formatReport(result, write),
  );
  return 0;
}

main(process.argv.slice(2)).then(
  (code) => {
    process.exitCode = code;
  },
  (error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  },
);
