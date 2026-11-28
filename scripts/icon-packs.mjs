// Generates the alternative icon packs of the editor from Tabler Icons (MIT) and Phosphor (MIT):
//   packages/core/src/icons/tabler.ts, packages/core/src/icons/phosphor.ts
// Run: node scripts/icon-packs.mjs (pnpm icons runs it too). Each of the editor's icon names gets
// the first candidate the set has; a name without one keeps the built-in icon.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const tablerDir = join(dirname(require.resolve('@tabler/icons/package.json')), 'icons', 'outline');
// The package doesn't export its package.json: the assets are found next to its main file.
const phosphorDir = join(
  dirname(require.resolve('@phosphor-icons/core')),
  '..',
  'assets',
  'regular',
);

/** Editor icon name → [Tabler candidates, Phosphor candidates]. */
const MAP = {
  undo: [['arrow-back-up'], ['arrow-u-up-left']],
  redo: [['arrow-forward-up'], ['arrow-u-up-right']],
  bold: [['bold'], ['text-b']],
  italic: [['italic'], ['text-italic']],
  underline: [['underline'], ['text-underline']],
  strike: [['strikethrough'], ['text-strikethrough']],
  code: [['code'], ['code']],
  subscript: [['subscript'], ['text-subscript']],
  superscript: [['superscript'], ['text-superscript']],
  bulletList: [['list'], ['list-bullets']],
  orderedList: [['list-numbers'], ['list-numbers']],
  indent: [['indent-increase'], ['text-indent']],
  outdent: [['indent-decrease'], ['text-outdent']],
  blockquote: [['blockquote', 'quote'], ['quotes']],
  codeBlock: [['source-code', 'code-dots'], ['code-block']],
  alignLeft: [['align-left'], ['text-align-left']],
  alignCenter: [['align-center'], ['text-align-center']],
  alignRight: [['align-right'], ['text-align-right']],
  alignJustify: [['align-left-justified', 'align-justified'], ['text-align-justify']],
  horizontalRule: [['separator-horizontal', 'minus'], ['minus']],
  link: [['link'], ['link']],
  unlink: [['unlink', 'link-off'], ['link-break']],
  image: [['photo'], ['image']],
  clearFormatting: [['clear-formatting'], ['text-t-slash', 'eraser']],
  formatMore: [['typography'], ['text-aa']],
  imageLeft: [['layout-align-left'], ['align-left']],
  imageCenter: [['layout-align-center'], ['align-center-vertical']],
  imageRight: [['layout-align-right'], ['align-right']],
  resize: [['resize'], ['resize', 'arrows-out-simple']],
  altText: [['text-caption', 'badge-cc'], ['closed-captioning']],
  imageCaption: [['text-caption', 'blockquote'], ['subtitles']],
  trash: [['trash'], ['trash']],
  paragraph: [['pilcrow'], ['paragraph']],
  h1: [['h-1'], ['text-h-one']],
  h2: [['h-2'], ['text-h-two']],
  h3: [['h-3'], ['text-h-three']],
  pasteText: [['clipboard-text'], ['clipboard-text']],
  table: [['table'], ['table']],
  rowBefore: [['row-insert-top'], ['rows-plus-top']],
  rowAfter: [['row-insert-bottom'], ['rows-plus-bottom']],
  rowDelete: [['row-remove'], ['rows', 'minus-square']],
  colBefore: [['column-insert-left'], ['columns-plus-left']],
  colAfter: [['column-insert-right'], ['columns-plus-right']],
  colDelete: [['column-remove'], ['columns', 'minus-square']],
  merge: [
    ['arrows-join', 'arrow-merge'],
    ['arrows-merge', 'arrows-in-line-horizontal'],
  ],
  split: [
    ['arrows-split', 'arrow-split'],
    ['arrows-split', 'arrows-out-line-horizontal'],
  ],
  rowHeader: [['layout-navbar'], ['rows', 'square-split-vertical']],
  colHeader: [['layout-sidebar'], ['columns', 'square-split-horizontal']],
  sort: [['sort-descending'], ['sort-descending']],
  tableProps: [['table-options'], ['sliders-horizontal', 'sliders']],
  cellProps: [
    ['table-cog', 'settings'],
    ['gear-six', 'gear'],
  ],
  tableDelete: [['table-minus', 'table-off'], ['x-square']],
  chevronUp: [['chevron-up'], ['caret-up']],
  search: [['search'], ['magnifying-glass']],
  fullscreen: [['maximize'], ['arrows-out']],
  fullscreenExit: [['minimize'], ['arrows-in']],
  preview: [['eye'], ['eye']],
  sourceCode: [['code'], ['brackets-angle', 'code']],
  help: [['help-circle'], ['question']],
  print: [['printer'], ['printer']],
  check: [['check'], ['check']],
  close: [['x'], ['x']],
  chevronDown: [['chevron-down'], ['caret-down']],
  more: [['dots'], ['dots-three']],
  textColor: [['text-color'], ['text-a-underline']],
  highlight: [['highlight'], ['highlighter-circle', 'highlighter']],
  lineHeight: [['line-height'], ['text-columns', 'arrows-vertical']],
  language: [['language'], ['translate']],
  upload: [['upload'], ['upload-simple']],
  externalLink: [['external-link'], ['arrow-square-out']],
  copy: [['copy'], ['copy']],
  edit: [['pencil'], ['pencil-simple']],
  resizeHandle: [['grip-horizontal'], ['dots-six']],
  browse: [['folder-open'], ['folder-open']],
  mergeTags: [['braces'], ['brackets-curly']],
  resizeHandleBoth: [['arrows-diagonal-2'], ['arrows-out-simple']],
  sidebar: [['layout-sidebar-right'], ['sidebar-simple']],
  anchor: [['anchor'], ['anchor']],
  save: [['device-floppy'], ['floppy-disk']],
  charmap: [['omega'], ['math-operations', 'hash']],
  commentAdd: [['message-plus'], ['chat-circle-text', 'chat-centered-text']],
  comments: [['messages'], ['chats']],
  emoji: [['mood-smile'], ['smiley']],
  dateTime: [['calendar-time'], ['calendar']],
  media: [['player-play'], ['play']],
  checklist: [['list-check'], ['list-checks']],
  codeSample: [['file-code'], ['file-code']],
  dragHandle: [['grip-vertical'], ['dots-six-vertical']],
  accordion: [
    ['list-details', 'chevrons-down'],
    ['list-dashes', 'caret-circle-down'],
  ],
  tableOfContents: [['list-tree'], ['tree-structure', 'list-dashes']],
  math: [
    ['math-function', 'sum'],
    ['function', 'sigma'],
  ],
  duplicate: [['copy-plus'], ['copy-simple']],
  nonBreaking: [['space'], ['arrows-horizontal']],
  pageBreak: [['page-break', 'scissors'], ['scissors']],
  history: [['history'], ['clock-counter-clockwise']],
  suggest: [['writing', 'pencil-check'], ['pencil-line']],
  review: [['checklist', 'list-check'], ['checks']],
  visualBlocks: [
    ['border-all', 'box-model'],
    ['bounding-box', 'selection'],
  ],
  ltr: [['text-direction-ltr'], ['arrow-line-right']],
  rtl: [['text-direction-rtl'], ['arrow-line-left']],
  caseChange: [['letter-case'], ['text-aa']],
  formatPainter: [['brush'], ['paint-brush']],
  permanentPen: [['highlight'], ['highlighter']],
  visualChars: [['pilcrow'], ['paragraph']],
  cancelChanges: [['rotate'], ['arrow-counter-clockwise']],
  template: [['template'], ['layout']],
  footnote: [['asterisk'], ['asterisk']],
  footnotesUpdate: [['refresh'], ['arrow-clockwise']],
};

/** The inside of an SVG file (without the wrapper and comments). */
function inner(file) {
  return readFileSync(file, 'utf8')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/^[\s\S]*?<svg[^>]*>/, '')
    .replace(/<\/svg>[\s\S]*$/, '')
    .replace(/\s*\n\s*/g, '')
    .trim();
}

function build(dir, column, wrap, title, license) {
  const out = {};
  const missing = [];
  for (const [name, candidates] of Object.entries(MAP)) {
    const found = candidates[column].find((c) => existsSync(join(dir, `${c}.svg`)));
    if (found) out[name] = wrap(inner(join(dir, `${found}.svg`)));
    else missing.push(name);
  }
  const body = Object.entries(out)
    .map(([name, svg]) => `  ${name}: ${JSON.stringify(svg)},`)
    .join('\n');
  const text = `// Generated by scripts/icon-packs.mjs — do not edit by hand.\n// ${title} (${license}) — see THIRD_PARTY_NOTICES.md.\n\n/**\n * The editor's icons in ${title}: \`import ${column ? 'phosphor' : 'tabler'} from '@novaprose/core/icons/${column ? 'phosphor' : 'tabler'}';\n * createEditor({ icons: ${column ? 'phosphor' : 'tabler'} })\`. Icons it lacks stay the built-in ones.\n */\nconst pack: Record<string, string> = {\n${body}\n};\n\nexport default pack;\n`;
  return { text, count: Object.keys(out).length, missing };
}

const svg = (attrs) => (body) =>
  `<svg ${attrs} width="18" height="18" aria-hidden="true">${body}</svg>`;

const root = join(import.meta.dirname, '..', 'packages', 'core', 'src', 'icons');
const tabler = build(
  tablerDir,
  0,
  svg(
    'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"',
  ),
  'Tabler Icons',
  'MIT',
);
const phosphor = build(
  phosphorDir,
  1,
  svg('viewBox="0 0 256 256" fill="currentColor"'),
  'Phosphor Icons',
  'MIT',
);
writeFileSync(join(root, 'tabler.ts'), tabler.text);
writeFileSync(join(root, 'phosphor.ts'), phosphor.text);
console.log(`tabler: ${tabler.count} icons, built-in for: ${tabler.missing.join(' ') || 'none'}`);
console.log(
  `phosphor: ${phosphor.count} icons, built-in for: ${phosphor.missing.join(' ') || 'none'}`,
);
