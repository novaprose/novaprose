// Генерирует наборы иконок из Lucide (ISC) и Octicons (MIT, только знак GitHub для сайта):
//   packages/core/src/ui/icons.ts           — иконки редактора и плагинов
//   apps/site/src/components/site/icons.ts  — иконки сайта
// Запуск: pnpm icons. Руками иконки не рисуем: имя действия → имя иконки Lucide в таблицах ниже.
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const lucideDir = join(dirname(require.resolve('lucide-static/package.json')), 'icons');
const octiconsDir = join(dirname(require.resolve('@primer/octicons/package.json')), 'build', 'svg');

/** Содержимое <svg> из Lucide (без обёртки и комментария с лицензией). */
function lucide(name, transform) {
  const source = readFileSync(join(lucideDir, `${name}.svg`), 'utf8');
  const inner = source
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/^[\s\S]*?<svg[^>]*>/, '')
    .replace(/<\/svg>[\s\S]*$/, '')
    .replace(/\s*\n\s*/g, '')
    .trim();
  return transform ? `<g transform="${transform}">${inner}</g>` : inner;
}

// ---------- Редактор ----------
const editor = {
  undo: 'undo-2',
  redo: 'redo-2',
  bold: 'bold',
  italic: 'italic',
  underline: 'underline',
  strike: 'strikethrough',
  code: 'code',
  subscript: 'subscript',
  superscript: 'superscript',
  bulletList: 'list',
  orderedList: 'list-ordered',
  indent: 'list-indent-increase',
  outdent: 'list-indent-decrease',
  blockquote: 'text-quote',
  codeBlock: 'square-code',
  alignLeft: 'text-align-start',
  alignCenter: 'text-align-center',
  alignRight: 'text-align-end',
  alignJustify: 'text-align-justify',
  horizontalRule: 'separator-horizontal',
  link: 'link',
  unlink: 'unlink',
  image: 'image',
  clearFormatting: 'remove-formatting',
  formatMore: 'type',
  imageLeft: 'align-start-vertical',
  imageCenter: 'align-center-vertical',
  imageRight: 'align-end-vertical',
  resize: 'scaling',
  altText: 'captions',
  imageCaption: 'subtitles',
  trash: 'trash-2',
  paragraph: 'pilcrow',
  h1: 'heading-1',
  h2: 'heading-2',
  h3: 'heading-3',
  pasteText: 'clipboard-type',
  table: 'table',
  rowBefore: 'rows-2-plus-top',
  rowAfter: 'rows-2-plus-bottom',
  rowDelete: 'list-x',
  colBefore: 'columns-2-plus-left',
  colAfter: 'columns-2-plus-right',
  colDelete: ['list-x', 'rotate(90 12 12)'],
  merge: 'table-cells-merge',
  split: 'table-cells-split',
  rowHeader: 'panel-top',
  colHeader: 'panel-left',
  sort: 'arrow-down-wide-narrow',
  tableProps: 'table-properties',
  cellProps: 'table-config',
  tableDelete: 'grid-2x2-x',
  chevronUp: 'chevron-up',
  search: 'search',
  fullscreen: 'maximize',
  fullscreenExit: 'minimize',
  preview: 'eye',
  sourceCode: 'code-xml',
  help: 'circle-help',
  print: 'printer',
  check: 'check',
  close: 'x',
  chevronDown: 'chevron-down',
  more: 'ellipsis',
  textColor: 'baseline',
  highlight: 'highlighter',
  lineHeight: 'line-height',
  upload: 'upload',
  externalLink: 'square-arrow-out-up-right',
  copy: 'copy',
  edit: 'pencil',
  resizeHandle: 'grip-horizontal',
  browse: 'folder-open',
  mergeTags: 'braces',
  resizeHandleBoth: 'move-diagonal-2',
  // Плагины
  anchor: 'anchor',
  save: 'save',
  charmap: 'omega',
  commentAdd: 'message-square-plus',
  comments: 'message-square-text',
  emoji: 'smile',
  dateTime: 'calendar-clock',
  media: 'square-play',
  nonBreaking: 'space',
  pageBreak: 'scissors-line-dashed',
  history: 'history',
  suggest: 'pen-line',
  review: 'list-checks',
  visualBlocks: 'square-dashed',
  ltr: 'pilcrow-right',
  rtl: 'pilcrow-left',
};

const entries = Object.entries(editor).map(([key, value]) => {
  const [name, transform] = Array.isArray(value) ? value : [value];
  return `  ${key}: svg('${lucide(name, transform)}'),`;
});

writeFileSync(
  'packages/core/src/ui/icons.ts',
  `// Сгенерировано scripts/icons.mjs (pnpm icons) — не править вручную.
// Иконки: Lucide (https://lucide.dev), лицензия ISC — см. THIRD_PARTY_NOTICES.md.

const svg = (body: string): string =>
  \`<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">\${body}</svg>\`;

export const icons = {
${entries.join('\n')}
};

export type IconName = keyof typeof icons;
`,
);

// ---------- Сайт ----------
const site = {
  users: 'users',
  message: 'message-square-text',
  history: 'history',
  paste: 'clipboard-paste',
  blocks: 'blocks',
  shield: 'shield-check',
  badge: 'badge-check',
  check: 'circle-check',
  lock: 'lock',
  database: 'database',
  file: 'file-text',
  globe: 'globe',
  arrow: 'arrow-right',
  external: 'square-arrow-out-up-right',
  menu: 'menu',
  close: 'x',
  sun: 'sun',
  moon: 'moon',
  language: 'languages',
  sparkles: 'sparkles',
  mail: 'mail',
};
const github = readFileSync(join(octiconsDir, 'mark-github-24.svg'), 'utf8')
  .replace(/^[\s\S]*?<svg[^>]*>/, '')
  .replace(/<\/svg>[\s\S]*$/, '')
  .trim();

writeFileSync(
  'apps/site/src/components/site/icons.ts',
  `// Сгенерировано scripts/icons.mjs (pnpm icons) — не править вручную.
// Иконки: Lucide (ISC). Знак GitHub: Octicons (MIT) — залитый, без обводки.

export const strokeIcons: Record<string, string> = {
${Object.entries(site)
  .map(([key, name]) => `  ${key}: '${lucide(name)}',`)
  .join('\n')}
};

export const fillIcons: Record<string, string> = {
  github: '${github}',
};
`,
);

console.log(`icons: ${entries.length} editor, ${Object.keys(site).length + 1} site`);
