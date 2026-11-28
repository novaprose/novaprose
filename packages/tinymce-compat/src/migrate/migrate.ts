import type { Dirent } from 'node:fs';
import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { describeConfig } from '../options';
import { dropInUrl, rewritePackage, rewriteSource } from './rewrite';
import { scanFile, type FileFindings, type Wrapper } from './scan';

/**
 * Moves a TinyMCE project to NovaProse's compatibility layer: reads every source file, makes the
 * changes that are safe to make without a person (see rewrite.ts) and reports the rest: options and
 * plugins NovaProse doesn't have, framework components to move, imports to change by hand.
 * Nothing is written unless `write` is set.
 */

export interface MigrateOptions {
  /** The project's folder. */
  root: string;
  /** Write the changes (otherwise only report them). */
  write?: boolean;
  /** The version of NovaProse to depend on and load from the CDN. */
  version: string;
}

export interface FileResult {
  /** The path from the project's folder, with forward slashes. */
  path: string;
  findings: FileFindings;
  /** Changes made (or to be made, without `write`). */
  changes: string[];
  /** What a person has to do. */
  manual: string[];
  /** Good to know, nothing to do (a plugin under another name, a part that couldn't be read). */
  notes: string[];
}

export interface MigrateResult {
  root: string;
  written: boolean;
  files: FileResult[];
  /** Folders with a copy of TinyMCE of your own (its script, themes and plugins). */
  copies: string[];
  /** Options and plugins NovaProse doesn't have, over all configurations. */
  unknownOptions: string[];
  missingPlugins: string[];
}

const SKIP = new Set([
  'node_modules',
  '.git',
  '.hg',
  '.svn',
  'dist',
  'build',
  'out',
  'coverage',
  '.next',
  '.nuxt',
  '.output',
  '.svelte-kit',
  '.turbo',
  '.cache',
  '.vercel',
  '.angular',
  'vendor',
  'bower_components',
]);

const CODE = /\.(?:[cm]?[jt]sx?|vue|svelte|astro)$/i;
const MARKUP =
  /\.(?:html?|php|phtml|erb|ejs|hbs|handlebars|mustache|twig|njk|liquid|cshtml|razor|jsp|aspx|ascx|tpl)$/i;
const MAX_SIZE = 2_000_000;

async function isTinymceCopy(dir: string, names: string[]): Promise<boolean> {
  if (!names.includes('tinymce.min.js') && !names.includes('tinymce.js')) return false;
  for (const sub of ['plugins', 'themes']) {
    try {
      if ((await stat(join(dir, sub))).isDirectory()) return true;
    } catch {
      // not there
    }
  }
  return false;
}

async function collect(root: string): Promise<{ files: string[]; copies: string[] }> {
  const files: string[] = [];
  const copies: string[] = [];
  const visit = async (dir: string) => {
    let items: Dirent[];
    try {
      items = await readdir(dir, { withFileTypes: true });
    } catch {
      return; // a folder that can't be read is left out
    }
    const names = items.map((item) => item.name);
    if (dir !== root && (await isTinymceCopy(dir, names))) {
      copies.push(dir);
      return;
    }
    for (const item of items) {
      const full = join(dir, item.name);
      if (item.isDirectory()) {
        if (!SKIP.has(item.name)) await visit(full);
      } else if (
        item.isFile() &&
        (item.name === 'package.json' ||
          ((CODE.test(item.name) || MARKUP.test(item.name)) && !/\.min\.js$/i.test(item.name)))
      ) {
        files.push(full);
      }
    }
  };
  await visit(root);
  return { files: files.sort(), copies: copies.sort() };
}

const WRAPPER_PACKAGES: Record<string, Wrapper> = {
  '@tinymce/tinymce-react': 'react',
  '@tinymce/tinymce-vue': 'vue',
  '@tinymce/tinymce-angular': 'angular',
  '@tinymce/tinymce-webcomponent': 'webcomponent',
  '@tinymce/tinymce-jquery': 'jquery',
};

const GUIDE = 'https://novaprose.com/guides/migrating-from-tinymce/';

/** How to move a framework component of TinyMCE's to NovaProse's. */
const MOVE: Record<Wrapper, string> = {
  react:
    "<Editor> of @tinymce/tinymce-react → <NovaProseEditor> of @novaprose/react: apiKey and licenseKey go; initialValue → defaultValue; onEditorChange → onChange(html, editor); onInit → onReady(editor); disabled → editable={false}; textareaName → name; init takes NovaProse's option names",
  vue: '<editor> of @tinymce/tinymce-vue → <NovaProseEditor> of @novaprose/vue: v-model stays; api-key goes; initial-value → default-value; disabled → :editable="false"; init takes NovaProse\'s option names',
  angular:
    "<editor> of @tinymce/tinymce-angular → <novaprose-editor> of @novaprose/angular (NovaProseEditorComponent): ngModel and reactive forms stay; apiKey goes; [init] takes NovaProse's option names; (onInit) → (ready)",
  webcomponent:
    '<tinymce-editor> → <novaprose-editor> of @novaprose/web-component (a form field: name, value, required, disabled)',
  jquery:
    "$(…).tinymce({…}) → tinymce.init({ target: element, … }) with the compatibility layer, or NovaProse's createEditor",
};

function plural(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`;
}

export async function migrate({
  root,
  write = false,
  version,
}: MigrateOptions): Promise<MigrateResult> {
  const { files, copies } = await collect(root);
  const texts = new Map<string, string>();
  for (const file of files) {
    if ((await stat(file)).size > MAX_SIZE) continue;
    texts.set(file, await readFile(file, 'utf8'));
  }
  const rel = (file: string) => relative(root, file).split(sep).join('/') || '.';

  // What the project's packages say: its TinyMCE integrations.
  const wrapperPackages = new Set<Wrapper>();
  for (const [file, text] of texts) {
    if (!file.endsWith('package.json')) continue;
    try {
      const pkg = JSON.parse(text) as Record<string, Record<string, string> | undefined>;
      for (const section of ['dependencies', 'devDependencies', 'peerDependencies']) {
        for (const name of Object.keys(pkg[section] ?? {})) {
          const wrapper = WRAPPER_PACKAGES[name];
          if (wrapper) wrapperPackages.add(wrapper);
        }
      }
    } catch {
      // not JSON: left alone
    }
  }
  const angular =
    wrapperPackages.has('angular') ||
    [...texts.values()].some((text) => text.includes('@tinymce/tinymce-angular'));

  const results: FileResult[] = [];
  const outputs = new Map<string, string>();
  const unknownOptions = new Set<string>();
  const missingPlugins = new Set<string>();
  let stillNeedsTinymce = wrapperPackages.size > 0;

  for (const [file, text] of texts) {
    if (file.endsWith('package.json')) continue;
    const findings = scanFile(text, { angular });
    const manual: string[] = [];
    for (const found of findings.imports) {
      if (found.replacement !== null) continue;
      stillNeedsTinymce = true;
      manual.push(
        `line ${found.line}: ${found.text} — no counterpart to put in its place; see ${GUIDE}`,
      );
    }
    for (const script of findings.scripts) {
      if (script.kind !== 'self-hosted') continue;
      manual.push(
        `line ${script.line}: <script src="${script.url}"> loads a copy of TinyMCE of your own: load ${dropInUrl(version)}, or serve node_modules/@novaprose/tinymce-compat/dist/ (tinymce.global.js, novaprose.css, tinymce-chunks/) from your site`,
      );
    }
    for (const wrapper of findings.wrappers) {
      stillNeedsTinymce = true;
      manual.push(`line ${wrapper.line}: ${MOVE[wrapper.wrapper]}`);
    }
    const notes: string[] = [];
    for (const config of findings.configs) {
      const where =
        config.from === 'init' ? 'tinymce.init()' : `the ${config.from} component's init`;
      const at = `line ${config.line}: ${where}`;
      if (config.unread) {
        notes.push(
          `${at} gets ${config.unread}, defined in another file: its options weren't checked`,
        );
        continue;
      }
      const described = describeConfig(config.keys, config.plugins ?? []);
      if (described.unknown.length) {
        manual.push(
          `${at} — options NovaProse doesn't have yet: ${described.unknown.join(', ')} (they are ignored)`,
        );
        described.unknown.forEach((name) => unknownOptions.add(name));
      }
      if (described.missing.length) {
        manual.push(`${at} — plugins NovaProse doesn't have: ${described.missing.join(', ')}`);
        described.missing.forEach((name) => missingPlugins.add(name));
      }
      const renamed = described.available.filter((plugin) => plugin.as !== plugin.name);
      if (renamed.length) {
        notes.push(
          `${at} — ${renamed.map((p) => `${p.name} is ${p.as}`).join(', ')} in NovaProse (the compatibility layer maps the name)`,
        );
      }
      if (config.plugins === null)
        notes.push(`${at} — the plugin list is computed: it wasn't checked`);
      if (config.spread)
        notes.push(`${at} — options spread in from elsewhere (...) weren't checked`);
    }
    const rewritten = rewriteSource(text, findings, version);
    if (rewritten) outputs.set(file, rewritten.output);
    const interesting =
      findings.configs.length ||
      findings.wrappers.length ||
      findings.scripts.length ||
      findings.imports.length;
    if (interesting) {
      results.push({ path: rel(file), findings, changes: rewritten?.changes ?? [], manual, notes });
    }
  }

  for (const [file, text] of texts) {
    if (!file.endsWith('package.json')) continue;
    const rewritten = rewritePackage(text, version, stillNeedsTinymce);
    if (!rewritten) continue;
    outputs.set(file, rewritten.output);
    results.push({
      path: rel(file),
      findings: { configs: [], wrappers: [], scripts: [], imports: [] },
      changes: rewritten.changes,
      manual: [],
      notes: [],
    });
  }

  if (write) for (const [file, output] of outputs) await writeFile(file, output);
  results.sort((a, b) => a.path.localeCompare(b.path));
  return {
    root,
    written: write && outputs.size > 0,
    files: results,
    copies: copies.map(rel),
    unknownOptions: [...unknownOptions].sort(),
    missingPlugins: [...missingPlugins].sort(),
  };
}

/** The report for a person: file by file, then what's next. */
export function formatReport(result: MigrateResult, write: boolean): string {
  const lines: string[] = [];
  lines.push(
    write
      ? `NovaProse migration: ${result.root}`
      : `NovaProse migration (a dry run: nothing is changed; add --write to make the changes): ${result.root}`,
  );
  lines.push('');
  if (!result.files.length && !result.copies.length) {
    lines.push('No TinyMCE was found: no tinymce.init(), imports, script tags or components.');
    return lines.join('\n');
  }
  for (const file of result.files) {
    lines.push(file.path);
    for (const change of file.changes)
      lines.push(`  ${write ? 'changed' : 'will change'}  ${change}`);
    for (const item of file.manual) lines.push(`  by hand  ${item}`);
    for (const note of file.notes) lines.push(`  note     ${note}`);
    if (!file.changes.length && !file.manual.length && !file.notes.length) {
      lines.push('  nothing to change');
    }
    lines.push('');
  }
  for (const copy of result.copies) {
    lines.push(`${copy}/`);
    lines.push(
      '  by hand  a copy of TinyMCE (its script, themes and plugins): delete it once its pages load NovaProse',
    );
    lines.push('');
  }
  const changes = result.files.reduce((sum, file) => sum + file.changes.length, 0);
  const manual =
    result.files.reduce((sum, file) => sum + file.manual.length, 0) + result.copies.length;
  const changedFiles = result.files.filter((file) => file.changes.length).length;
  lines.push(
    `${write ? 'Changed' : 'To change'}: ${plural(changes, 'change')} in ${plural(changedFiles, 'file')}. By hand: ${plural(manual, 'item')}.`,
  );
  if (result.unknownOptions.length) {
    lines.push(`Options NovaProse doesn't have yet: ${result.unknownOptions.join(', ')}.`);
  }
  if (result.missingPlugins.length) {
    lines.push(`Plugins NovaProse doesn't have: ${result.missingPlugins.join(', ')}.`);
  }
  lines.push('');
  lines.push(
    write
      ? 'Next: install the dependencies (npm install), open the pages with an editor and look at the console: the compatibility layer lists anything it ignores.'
      : 'Next: run again with --write, then install the dependencies and open the pages with an editor.',
  );
  lines.push(`Guide: ${GUIDE}`);
  return lines.join('\n');
}
