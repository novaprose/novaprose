import { closing, entries, lineAt, strings } from './js';

/**
 * What a file of a TinyMCE project holds, read without running it: tinymce.init() configurations,
 * imports of the tinymce package, script tags that load TinyMCE, and the framework components of
 * TinyMCE's integrations. Names come from TinyMCE's public documentation (the packages, the
 * component props and the CDN addresses it describes), not from its code.
 */

export type Wrapper = 'react' | 'vue' | 'angular' | 'webcomponent' | 'jquery';

export interface ConfigFinding {
  line: number;
  /** Where the configuration is: tinymce.init(), or the init of a framework component. */
  from: 'init' | Wrapper;
  /** The top-level option names. */
  keys: string[];
  /** The configuration spreads in other objects (`...base`): their options aren't read. */
  spread: boolean;
  /** The plugins when they are written as literals; null when they are computed. */
  plugins: string[] | null;
  /** tinymce.init(name) with an object this file doesn't define: its name. */
  unread?: string;
}

export interface WrapperFinding {
  line: number;
  wrapper: Wrapper;
  /** The props (attributes) the component is given. */
  props: string[];
}

export interface ScriptFinding {
  line: number;
  url: string;
  /** Tiny Cloud, a public CDN copy of the tinymce package, or a copy of your own. */
  kind: 'cloud' | 'cdn' | 'self-hosted';
}

export interface ImportFinding {
  line: number;
  /** The statement as written. */
  text: string;
  module: string;
  /** What it becomes ('' when removed), or null when it has to be changed by hand. */
  replacement: string | null;
  start: number;
  end: number;
}

export interface FileFindings {
  configs: ConfigFinding[];
  wrappers: WrapperFinding[];
  scripts: ScriptFinding[];
  imports: ImportFinding[];
}

// ---------- configurations ----------

const IDENTIFIER = /^[A-Za-z_$][\w$]*/;

function readObject(src: string, open: number, from: ConfigFinding['from']): ConfigFinding | null {
  const close = closing(src, open);
  if (close < 0) return null;
  const list = entries(src, open, close);
  const keys = list.flatMap((entry) => (entry.key ? [entry.key] : []));
  const pluginsEntry = list.find((entry) => entry.key === 'plugins');
  let plugins: string[] | null = [];
  if (pluginsEntry) {
    const values = strings(pluginsEntry.value);
    plugins = values ? values.flatMap((value) => value.split(/[\s,]+/).filter(Boolean)) : null;
  }
  return {
    line: lineAt(src, open),
    from,
    keys,
    spread: list.some((entry) => entry.spread),
    plugins,
  };
}

/** The object literal assigned to `name` in this file (`const name = {`), if there is one. */
function variableObject(src: string, name: string): number | null {
  const re = new RegExp(
    `\\b(?:const|let|var)\\s+${name.replace(/\$/g, '\\$')}\\s*(?::[^=]+)?=\\s*\\{`,
  );
  const match = re.exec(src);
  return match ? match.index + match[0].length - 1 : null;
}

/** The configuration an expression stands for: an object literal, or a variable of this file. */
function readExpression(
  src: string,
  at: number,
  from: ConfigFinding['from'],
): ConfigFinding | null {
  while (/\s/.test(src[at] ?? '')) at++;
  if (src[at] === '{') return readObject(src, at, from);
  const name = IDENTIFIER.exec(src.slice(at))?.[0];
  if (!name) return null;
  const open = variableObject(src, name);
  if (open !== null) return readObject(src, open, from);
  return { line: lineAt(src, at), from, keys: [], spread: false, plugins: null, unread: name };
}

function initCalls(src: string): ConfigFinding[] {
  const out: ConfigFinding[] = [];
  for (const match of src.matchAll(/\btinymce\s*\.\s*init\s*\(/g)) {
    const found = readExpression(src, match.index + match[0].length, 'init');
    if (found) out.push(found);
  }
  return out;
}

// ---------- framework components ----------

interface Tag {
  start: number;
  props: Array<{ name: string; value: string; at: number }>;
}

/**
 * The attributes of the tag that opens at `start` (`<Editor` …): JSX (`name={…}`, `{...spread}`)
 * and HTML-like templates (`name="…"`, `:name="…"`, `[name]="…"`). `at` is where a value starts.
 */
function readTag(src: string, start: number): Tag | null {
  const name = /^<[\w.:-]+/.exec(src.slice(start));
  if (!name) return null;
  const props: Tag['props'] = [];
  let i = start + name[0].length;
  while (i < src.length) {
    while (/\s/.test(src[i] ?? '')) i++;
    if (src[i] === '>' || src.startsWith('/>', i)) return { start, props };
    if (src[i] === '{') {
      const end = closing(src, i);
      if (end < 0) return null;
      i = end + 1;
      continue;
    }
    const attribute = /^[^\s=>/]+/.exec(src.slice(i));
    if (!attribute) return null;
    i += attribute[0].length;
    while (/\s/.test(src[i] ?? '')) i++;
    let value = '';
    let at = i;
    if (src[i] === '=') {
      i++;
      while (/\s/.test(src[i] ?? '')) i++;
      const quote = src[i];
      if (quote === '"' || quote === "'") {
        const end = src.indexOf(quote, i + 1);
        if (end < 0) return null;
        at = i + 1;
        value = src.slice(i + 1, end);
        i = end + 1;
      } else if (quote === '{') {
        const end = closing(src, i);
        if (end < 0) return null;
        at = i + 1;
        value = src.slice(i + 1, end);
        i = end + 1;
      } else {
        const bare = /^[^\s>]+/.exec(src.slice(i))?.[0] ?? '';
        at = i;
        value = bare;
        i += bare.length;
      }
    }
    props.push({ name: attribute[0], value, at });
  }
  return null;
}

const kebab = (name: string) => name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

/** The names a TinyMCE integration's component is imported under in this file. */
function importedNames(src: string, module: string, named: string | null): string[] {
  const names: string[] = [];
  const escaped = module.replace(/[/.-]/g, (c) => `\\${c}`);
  const re = new RegExp(`import\\s+([^'";]*?)\\s+from\\s*['"]${escaped}['"]`, 'g');
  for (const match of src.matchAll(re)) {
    const clause = match[1]!;
    const braces = /\{([^}]*)\}/.exec(clause);
    const defaultName = /^([A-Za-z_$][\w$]*)/.exec(clause.trim())?.[1];
    if (named === null && defaultName) names.push(defaultName);
    if (named !== null && braces) {
      for (const part of braces[1]!.split(',')) {
        const [imported, local] = part.trim().split(/\s+as\s+/);
        if (imported === named) names.push(local ?? imported);
      }
    }
  }
  return names;
}

function wrapperTags(
  src: string,
  tagNames: string[],
  wrapper: Wrapper,
  initProps: string[],
): { wrappers: WrapperFinding[]; configs: ConfigFinding[] } {
  const wrappers: WrapperFinding[] = [];
  const configs: ConfigFinding[] = [];
  for (const tagName of new Set(tagNames)) {
    const re = new RegExp(`<${tagName.replace(/[.$]/g, (c) => `\\${c}`)}(?=[\\s/>])`, 'g');
    for (const match of src.matchAll(re)) {
      const tag = readTag(src, match.index);
      if (!tag) continue;
      wrappers.push({
        line: lineAt(src, match.index),
        wrapper,
        props: tag.props.map((prop) => prop.name),
      });
      const init = tag.props.find((prop) => initProps.includes(prop.name));
      if (init) {
        const found = readExpression(src, init.at, wrapper);
        if (found) configs.push(found);
      }
    }
  }
  return { wrappers, configs };
}

function frameworkComponents(
  src: string,
  angular: boolean,
): { wrappers: WrapperFinding[]; configs: ConfigFinding[] } {
  const wrappers: WrapperFinding[] = [];
  const configs: ConfigFinding[] = [];
  const add = (found: { wrappers: WrapperFinding[]; configs: ConfigFinding[] }) => {
    wrappers.push(...found.wrappers);
    configs.push(...found.configs);
  };
  // React: import { Editor } from '@tinymce/tinymce-react', then <Editor init={{…}} />.
  const react = importedNames(src, '@tinymce/tinymce-react', 'Editor');
  if (react.length) add(wrapperTags(src, react, 'react', ['init']));
  // Vue: import Editor from '@tinymce/tinymce-vue', then <editor :init="{…}" /> in the template.
  const vue = importedNames(src, '@tinymce/tinymce-vue', null);
  if (vue.length) {
    add(wrapperTags(src, [...vue, ...vue.map(kebab)], 'vue', [':init', 'v-bind:init']));
  }
  // Angular: <editor [init]="{…}"> in a template, when the project uses @tinymce/tinymce-angular.
  if (angular) add(wrapperTags(src, ['editor'], 'angular', ['[init]']));
  // The web component and the jQuery integration are listed only.
  for (const match of src.matchAll(/<tinymce-editor(?=[\s/>])/g)) {
    const tag = readTag(src, match.index);
    wrappers.push({
      line: lineAt(src, match.index),
      wrapper: 'webcomponent',
      props: tag?.props.map((prop) => prop.name) ?? [],
    });
  }
  for (const match of src.matchAll(/\.tinymce\s*\(\s*\{/g)) {
    wrappers.push({ line: lineAt(src, match.index), wrapper: 'jquery', props: [] });
    const found = readObject(src, match.index + match[0].length - 1, 'jquery');
    if (found) configs.push(found);
  }
  return { wrappers, configs };
}

// ---------- script tags ----------

const TINY_SCRIPT =
  /<script\b[^>]*?\bsrc\s*=\s*(["'])([^"']*?\btinymce(?:\.min)?\.js(?:[?#][^"']*)?)\1/gi;

export function scriptKind(url: string): ScriptFinding['kind'] {
  if (/^(?:https?:)?\/\/cdn\.tiny\.cloud\//i.test(url)) return 'cloud';
  if (
    /^(?:https?:)?\/\/(?:cdn\.jsdelivr\.net\/npm\/tinymce[@/]|unpkg\.com\/tinymce[@/]|cdnjs\.cloudflare\.com\/ajax\/libs\/tinymce\/)/i.test(
      url,
    )
  )
    return 'cdn';
  return 'self-hosted';
}

function scripts(src: string): ScriptFinding[] {
  return [...src.matchAll(TINY_SCRIPT)].map((match) => ({
    line: lineAt(src, match.index),
    url: match[2]!,
    kind: scriptKind(match[2]!),
  }));
}

// ---------- imports ----------

/** The package itself (what sets up the `tinymce` object), as opposed to its parts. */
const MAIN = /^tinymce(?:\/tinymce(?:\.min)?(?:\.js)?)?$/;
/** Parts a bundled TinyMCE needs and NovaProse doesn't: its theme, model, icons, skins, plugins. */
const PART = /^tinymce\/(?:themes|models|icons|skins|plugins)\//;
/** Named exports of the tinymce package and what the compatibility layer has instead. */
const NAMED: Record<string, string> = { Editor: 'CompatEditor', RawEditorOptions: 'TinyConfig' };
const COMPAT = '@novaprose/tinymce-compat';

/** `{ a, b as c }` → its names, or null when one of them has no counterpart. */
function namedImports(clause: string): string[] | null {
  const out: string[] = [];
  for (const part of clause.split(',')) {
    const text = part.trim().replace(/^type\s+/, '');
    if (!text) continue;
    const [imported, local] = text.split(/\s+as\s+/) as [string, string | undefined];
    const target = NAMED[imported];
    if (!target) return null;
    out.push(`${target} as ${local ?? imported}`);
  }
  return out;
}

/** What an import of the tinymce package becomes; null when it has to be changed by hand. */
function rewriteImport(clause: string | null, module: string, isType: boolean): string | null {
  if (PART.test(module)) return clause === null ? '' : null;
  if (!MAIN.test(module)) return null;
  if (clause === null) return `import { tinymce } from '${COMPAT}';`;
  const text = clause.trim();
  const namespace = /^\*\s+as\s+([A-Za-z_$][\w$]*)$/.exec(text);
  const names: string[] = [];
  if (namespace) names.push(namespace[1] === 'tinymce' ? 'tinymce' : `tinymce as ${namespace[1]}`);
  else {
    const defaultName = /^([A-Za-z_$][\w$]*)\s*(?:,|$)/.exec(text)?.[1];
    if (defaultName)
      names.push(defaultName === 'tinymce' ? 'tinymce' : `tinymce as ${defaultName}`);
    const braces = /\{([^}]*)\}/.exec(text);
    if (braces) {
      const named = namedImports(braces[1]!);
      if (!named) return null;
      names.push(...named);
    }
    if (!defaultName && !braces) return null;
  }
  return `import ${isType ? 'type ' : ''}{ ${names.join(', ')} } from '${COMPAT}';`;
}

function rewriteRequire(binding: string | null, module: string): string | null {
  if (PART.test(module)) return binding === null ? '' : null;
  if (!MAIN.test(module)) return null;
  // require('tinymce') alone sets up the global; the module gives it to this file instead.
  if (binding === null) return `const { tinymce } = require('${COMPAT}');`;
  const [keyword, name, ...rest] = binding.split(/\s+/) as [string, string, ...string[]];
  if (rest.length || !/^[A-Za-z_$][\w$]*$/.test(name)) return null;
  return `${keyword} { tinymce${name === 'tinymce' ? '' : `: ${name}`} } = require('${COMPAT}');`;
}

// A statement on lines of its own (\r: a file with Windows line ends).
const IMPORT_FROM =
  /^[ \t]*import\s+(type\s+)?((?:[^'";])*?)\s*from\s*(['"])(tinymce(?:\/[^'"]*)?)\3[ \t]*;?[ \t]*\r?$/gm;
const IMPORT_BARE = /^[ \t]*import\s*(['"])(tinymce(?:\/[^'"]*)?)\1[ \t]*;?[ \t]*\r?$/gm;
const REQUIRE =
  /^[ \t]*(?:((?:const|let|var)\s+[^=]+?)\s*=\s*)?require\(\s*(['"])(tinymce(?:\/[^'"]*)?)\2\s*\)[ \t]*;?[ \t]*\r?$/gm;

function imports(src: string): ImportFinding[] {
  const out: ImportFinding[] = [];
  const push = (match: RegExpMatchArray, module: string, replacement: string | null) => {
    const text = match[0].trim();
    const start = match.index! + match[0].indexOf(text);
    out.push({
      line: lineAt(src, start),
      text,
      module,
      replacement,
      start,
      end: start + text.length,
    });
  };
  for (const match of src.matchAll(IMPORT_FROM)) {
    push(match, match[4]!, rewriteImport(match[2]!, match[4]!, !!match[1]));
  }
  for (const match of src.matchAll(IMPORT_BARE))
    push(match, match[2]!, rewriteImport(null, match[2]!, false));
  for (const match of src.matchAll(REQUIRE)) {
    push(match, match[3]!, rewriteRequire(match[1]?.trim() ?? null, match[3]!));
  }
  return out.sort((a, b) => a.start - b.start);
}

/** Everything of interest in one file. `angular`: the project uses @tinymce/tinymce-angular. */
export function scanFile(
  src: string,
  { angular = false }: { angular?: boolean } = {},
): FileFindings {
  const components = frameworkComponents(src, angular);
  return {
    configs: [...initCalls(src), ...components.configs].sort((a, b) => a.line - b.line),
    wrappers: components.wrappers.sort((a, b) => a.line - b.line),
    scripts: scripts(src),
    imports: imports(src),
  };
}
