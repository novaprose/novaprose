/**
 * Code highlighting languages: highlight.js grammars, aliases and the list to choose from. Each
 * grammar is a separate lazy chunk: a document with JavaScript code downloads only the highlighter
 * core and JavaScript (~11 KB gzip), not every language at once.
 */

/** A highlight.js grammar: a function returning the language definition. */
export type CodeGrammar = (hljs: never) => unknown;
/** A grammar loader: a module with a default export, or the function itself. */
export type CodeGrammarLoader = () => Promise<{ default: CodeGrammar } | CodeGrammar>;

/** An item of the language list: the value (the class `language-<value>` in HTML) and a label. */
export interface CodeLanguage {
  value: string;
  label: string;
}

/** Встроенные грамматики по имени highlight.js. */
export const GRAMMARS: Record<string, CodeGrammarLoader> = {
  bash: () => import('highlight.js/lib/languages/bash'),
  c: () => import('highlight.js/lib/languages/c'),
  cpp: () => import('highlight.js/lib/languages/cpp'),
  csharp: () => import('highlight.js/lib/languages/csharp'),
  css: () => import('highlight.js/lib/languages/css'),
  diff: () => import('highlight.js/lib/languages/diff'),
  dockerfile: () => import('highlight.js/lib/languages/dockerfile'),
  go: () => import('highlight.js/lib/languages/go'),
  graphql: () => import('highlight.js/lib/languages/graphql'),
  java: () => import('highlight.js/lib/languages/java'),
  javascript: () => import('highlight.js/lib/languages/javascript'),
  json: () => import('highlight.js/lib/languages/json'),
  kotlin: () => import('highlight.js/lib/languages/kotlin'),
  lua: () => import('highlight.js/lib/languages/lua'),
  markdown: () => import('highlight.js/lib/languages/markdown'),
  php: () => import('highlight.js/lib/languages/php'),
  powershell: () => import('highlight.js/lib/languages/powershell'),
  python: () => import('highlight.js/lib/languages/python'),
  ruby: () => import('highlight.js/lib/languages/ruby'),
  rust: () => import('highlight.js/lib/languages/rust'),
  scss: () => import('highlight.js/lib/languages/scss'),
  sql: () => import('highlight.js/lib/languages/sql'),
  swift: () => import('highlight.js/lib/languages/swift'),
  typescript: () => import('highlight.js/lib/languages/typescript'),
  xml: () => import('highlight.js/lib/languages/xml'),
  yaml: () => import('highlight.js/lib/languages/yaml'),
};

/**
 * Грамматики, которые нужны вместе с основной: HTML подсвечивает <script> и <style> чужими
 * языками — без них код внутри остался бы бесцветным.
 */
export const GRAMMAR_DEPENDENCIES: Record<string, string[]> = {
  xml: ['javascript', 'css'],
};

/**
 * Синонимы → грамматика. Значения из чужого HTML (Prism, TinyMCE, GitHub, Markdown) и из VS Code:
 * `markup` у Prism и TinyMCE — это HTML/XML, `sh` — Bash, `ts` — TypeScript.
 */
export const ALIASES: Record<string, string> = {
  sh: 'bash',
  shell: 'bash',
  shellscript: 'bash',
  zsh: 'bash',
  h: 'c',
  'c++': 'cpp',
  cc: 'cpp',
  cxx: 'cpp',
  hpp: 'cpp',
  cs: 'csharp',
  'c#': 'csharp',
  patch: 'diff',
  docker: 'dockerfile',
  golang: 'go',
  gql: 'graphql',
  js: 'javascript',
  jsx: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  javascriptreact: 'javascript',
  jsonc: 'json',
  json5: 'json',
  kt: 'kotlin',
  kts: 'kotlin',
  md: 'markdown',
  ps: 'powershell',
  ps1: 'powershell',
  pwsh: 'powershell',
  py: 'python',
  python3: 'python',
  rb: 'ruby',
  rs: 'rust',
  mysql: 'sql',
  postgresql: 'sql',
  postgres: 'sql',
  ts: 'typescript',
  tsx: 'typescript',
  mts: 'typescript',
  cts: 'typescript',
  typescriptreact: 'typescript',
  html: 'xml',
  xhtml: 'xml',
  svg: 'xml',
  markup: 'xml',
  mathml: 'xml',
  yml: 'yaml',
};

/** Список языков по умолчанию (меню выбора и диалог). Названия языков не переводятся. */
export const DEFAULT_LANGUAGES: CodeLanguage[] = [
  { value: 'bash', label: 'Bash' },
  { value: 'c', label: 'C' },
  { value: 'cpp', label: 'C++' },
  { value: 'csharp', label: 'C#' },
  { value: 'css', label: 'CSS' },
  { value: 'diff', label: 'Diff' },
  { value: 'dockerfile', label: 'Dockerfile' },
  { value: 'go', label: 'Go' },
  { value: 'graphql', label: 'GraphQL' },
  { value: 'html', label: 'HTML' },
  { value: 'java', label: 'Java' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'json', label: 'JSON' },
  { value: 'kotlin', label: 'Kotlin' },
  { value: 'lua', label: 'Lua' },
  { value: 'markdown', label: 'Markdown' },
  { value: 'php', label: 'PHP' },
  { value: 'powershell', label: 'PowerShell' },
  { value: 'python', label: 'Python' },
  { value: 'ruby', label: 'Ruby' },
  { value: 'rust', label: 'Rust' },
  { value: 'scss', label: 'SCSS' },
  { value: 'sql', label: 'SQL' },
  { value: 'swift', label: 'Swift' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'xml', label: 'XML' },
  { value: 'yaml', label: 'YAML' },
];

/** Подписи для синонимов, которых нет в списке (блок с `language-js` показывается как JavaScript). */
const ALIAS_LABELS: Record<string, string> = {
  js: 'JavaScript',
  jsx: 'JSX',
  ts: 'TypeScript',
  tsx: 'TSX',
  sh: 'Shell',
  shell: 'Shell',
  py: 'Python',
  rb: 'Ruby',
  rs: 'Rust',
  yml: 'YAML',
  md: 'Markdown',
  markup: 'HTML/XML',
  svg: 'SVG',
  cs: 'C#',
  'c++': 'C++',
  kt: 'Kotlin',
  golang: 'Go',
  ps1: 'PowerShell',
};

/** Подпись языка: из списка, затем из синонимов, иначе само значение. */
export function languageLabel(value: string, languages: readonly CodeLanguage[]): string {
  const key = value.toLowerCase();
  return languages.find((l) => l.value.toLowerCase() === key)?.label ?? ALIAS_LABELS[key] ?? value;
}
