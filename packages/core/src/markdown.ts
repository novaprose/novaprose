/**
 * Markdown in and out: a separate entry point `@novaprose/core/markdown` (~46 KB gzip with the parser,
 * not part of the core). Only data and functions: the core is imported here for types only.
 *
 *   import { markdownToHTML, toMarkdown } from '@novaprose/core/markdown';
 *   editor.setContent(markdownToHTML('# Heading'));
 *   const md = toMarkdown(editor);
 *
 * Security: Markdown becomes HTML without raw HTML (`html: false`) and then goes through the
 * editor's schema like any content: links, images and CSS are checked there.
 */
import MarkdownIt from 'markdown-it';
import type { Mark, Node as PMNode } from 'prosemirror-model';
import {
  MarkdownSerializer,
  MarkdownSerializerState,
  defaultMarkdownSerializer,
} from 'prosemirror-markdown';
import type { Editor } from './editor';
import { codeLanguage } from './code-language';

export interface MarkdownToHTMLOptions {
  /** Turn addresses like https://… into links (true by default). */
  linkify?: boolean;
  /** A single line break becomes <br> (as in chats). Default false (as in CommonMark). */
  breaks?: boolean;
}

/**
 * GFM tasks ("- [ ] item", "- [x] done") → a NovaProse checklist (data-type/data-checked, as in
 * Tiptap). Only in bulleted lists: the editor has no numbered checklists.
 */
function taskLists(md: InstanceType<typeof MarkdownIt>): void {
  md.core.ruler.after('inline', 'nova-task-lists', (state) => {
    const tokens = state.tokens;
    for (let i = 2; i < tokens.length; i++) {
      const inline = tokens[i]!;
      const item = tokens[i - 2]!;
      if (inline.type !== 'inline' || tokens[i - 1]!.type !== 'paragraph_open') continue;
      if (item.type !== 'list_item_open') continue;
      const match = /^\[([ xX])\](?:\s+|$)/.exec(inline.content);
      if (!match) continue;
      let list = -1;
      for (let j = i - 3; j >= 0; j--) {
        if (tokens[j]!.level === item.level - 1 && tokens[j]!.type.endsWith('_list_open')) {
          list = j;
          break;
        }
      }
      if (list < 0 || tokens[list]!.type !== 'bullet_list_open') continue;
      // Strip "[ ] " from the start of the item text (it may be split into several text tokens).
      let rest = match[0].length;
      for (const child of inline.children ?? []) {
        if (rest <= 0 || child.type !== 'text') break;
        const cut = Math.min(rest, child.content.length);
        child.content = child.content.slice(cut);
        rest -= cut;
      }
      inline.content = inline.content.slice(match[0].length);
      item.attrSet('data-type', 'taskItem');
      item.attrSet('data-checked', String(match[1] !== ' '));
      tokens[list]!.attrSet('data-type', 'taskList');
    }
  });
}

/** Markdown (CommonMark plus GFM tables and ~~strikethrough~~) → HTML for `setContent` / `insertContent`. */
export function markdownToHTML(markdown: string, options: MarkdownToHTMLOptions = {}): string {
  const md = new MarkdownIt('default', {
    html: false,
    linkify: options.linkify ?? true,
    breaks: options.breaks ?? false,
  });
  taskLists(md);
  // markdown-it ends the code in a block with a service "\n": in the editor it would be an extra empty
  // line at the bottom of the block (and inside a quote it multiplied on every save). The content is escaped,
  // so "</code></pre>" can't occur in the code text.
  return md.render(markdown).replace(/\n<\/code><\/pre>/g, '</code></pre>');
}

const nodes = defaultMarkdownSerializer.nodes;

/** The same address detector as in markdownToHTML (linkify). */
const linkify = new MarkdownIt('default', { linkify: true }).linkify;

/**
 * Text without a link that looks like an address ("example.com", "https://…") would become a link when
 * the Markdown is read back, so the document would change from save to save. All the punctuation of the
 * address is escaped (`example\.com`): it reads as the same text, and the detector sees only pieces without dots and "//".
 * Only for addresses the author left without a link, a rare case.
 * Found by a property-based test (packages/core/test/markdown.test.ts).
 */
/** ![alt](src "title"): for an image and for an image with a caption (figure). */
function imageNode(state: MarkdownSerializerState, node: PMNode): void {
  const src = String(node.attrs.src ?? '');
  const alt = state.esc(String(node.attrs.alt ?? ''));
  const title = node.attrs.title ? ` "${String(node.attrs.title).replace(/"/g, '\\"')}"` : '';
  state.write(`![${alt}](${src.replace(/[()]/g, '\\$&')}${title})`);
}

/** How many nodes of the same type stand in a row right before this one (to alternate list markers). */
function siblingsBefore(parent: PMNode, index: number, node: PMNode): number {
  let count = 0;
  for (let i = index - 1; i >= 0 && parent.child(i).type === node.type; i--) count++;
  return count;
}

/** Characters the serializer escapes: the reader splits the text into pieces at them. */
const ESCAPED = /[`*\\~[\]_]/g;

/** Ranges [from, to) of the text that the reader would detect as an address. */
function linkLikeRanges(text: string): [number, number][] {
  const ranges: [number, number][] = [];
  const add = (offset: number, chunk: string) => {
    for (const m of linkify.match(chunk) ?? [])
      ranges.push([offset + m.index, offset + m.lastIndex]);
  };
  add(0, text);
  // An address can "appear" in a piece between escaped characters: "https://a.io_" → "…\_".
  let start = 0;
  for (const m of text.matchAll(ESCAPED)) {
    add(start, text.slice(start, m.index));
    start = m.index + 1;
  }
  add(start, text.slice(start));
  // markdown-it detects "scheme://" inside a word too ("$https://…"), with a separate rule.
  for (const m of text.matchAll(/[a-z][a-z\d+.-]*:\/\/\S*/gi)) {
    ranges.push([m.index, m.index + m[0].length]);
  }
  return ranges.sort((a, b) => a[0] - b[0]);
}

function textNode(state: MarkdownSerializerState, node: PMNode): void {
  const text = node.text ?? '';
  const ranges = node.marks.some((m) => m.type.name === 'link') ? [] : linkLikeRanges(text);
  if (!ranges.length) {
    state.text(text);
    return;
  }
  let last = 0;
  for (const [from, to] of ranges) {
    if (to <= last) continue;
    const begin = Math.max(from, last);
    state.text(text.slice(last, begin));
    // Any ASCII punctuation character can be escaped with a backslash (CommonMark).
    state.write(text.slice(begin, to).replace(/[!-/:-@[-`{-~]/g, '\\$&'));
    last = to;
  }
  state.text(text.slice(last));
}
const marks = defaultMarkdownSerializer.marks;

/** Formatting Markdown doesn't have: the text stays, the markup goes. */
const plain = { open: '', close: '', mixable: true, expelEnclosingWhitespace: true };

/** Cell text on one line: "|" and line breaks are escaped, blocks are joined with a space. */
function cellText(cell: PMNode): string {
  const parts: string[] = [];
  cell.forEach((block) => parts.push(serialize(block).replace(/\n+/g, ' ').trim()));
  return parts.join(' ').replace(/\|/g, '\\|');
}

const serializer: MarkdownSerializer = new MarkdownSerializer(
  {
    ...nodes,
    text: textNode,
    heading(state, node) {
      state.write(`${'#'.repeat(Number(node.attrs.level) || 1)} `);
      state.renderInline(node);
      // "# Tag #": in CommonMark trailing "#" after a space are an optional closing of the heading
      // and get dropped, so the text would be lost on every save. The last "#" is escaped.
      const s = state as unknown as { out: string };
      if (
        /(^|[ \t])#+$/.test(
          s.out.slice(s.out.lastIndexOf('\n') + 1).slice(Number(node.attrs.level) + 1),
        )
      ) {
        s.out = `${s.out.slice(0, -1)}\\#`;
      }
      state.closeBlock(node);
    },
    code_block(state, node) {
      // From JSON the language can be anything: only a safe name goes into the fence line.
      const language = codeLanguage(node.attrs.language) ?? '';
      // The fence is longer than any run of backticks inside the code.
      const longest = Math.max(2, ...(node.textContent.match(/`+/g) ?? []).map((s) => s.length));
      const fence = '`'.repeat(longest + 1);
      state.write(`${fence}${language}\n`);
      // An empty block has no empty line inside: otherwise reading it back makes the line content and the block
      // would grow with every save (found by a property-based test).
      // Exactly one "\n" after the content: the reader drops it (see markdownToHTML).
      if (node.textContent) state.text(`${node.textContent}\n`, false);
      state.write(fence);
      state.closeBlock(node);
    },
    // Adjacent lists of the same type alternate the marker (* / -, 1. / 1)): otherwise reading the Markdown
    // would merge them into one list (found by a property-based test).
    bullet_list(state, node, parent, index) {
      const marker = siblingsBefore(parent, index, node) % 2 ? '-' : '*';
      // A checklist becomes GFM tasks: "- [ ] item", "- [x] done".
      const box = (i: number) =>
        node.attrs.checklist === true ? `[${node.child(i).attrs.checked ? 'x' : ' '}] ` : '';
      state.renderList(node, '  ', (i) => `${marker} ${box(i)}`);
    },
    ordered_list(state, node, parent, index) {
      const start = (node.attrs.start as number | null) ?? 1;
      const delimiter = siblingsBefore(parent, index, node) % 2 ? ')' : '.';
      const maxW = String(start + node.childCount - 1).length;
      const space = ' '.repeat(maxW + 2);
      state.renderList(node, space, (i) => {
        const n = String(start + i);
        return `${' '.repeat(maxW - n.length)}${n}${delimiter} `;
      });
    },
    image: imageNode,
    // Markdown has no captions: the image, then the caption as a separate paragraph, so the text is kept.
    figure(state, node) {
      if (node.firstChild) imageNode(state, node.firstChild);
      state.closeBlock(node);
      const caption = node.childCount > 1 ? node.child(1) : null;
      if (caption?.content.size) {
        state.renderInline(caption);
        state.closeBlock(caption);
      }
    },
    figcaption() {},
    figure_image() {},
    table(state, node) {
      const rows: string[][] = [];
      node.forEach((row) => {
        const cells: string[] = [];
        row.forEach((cell) => cells.push(cellText(cell)));
        rows.push(cells);
      });
      const width = Math.max(...rows.map((r) => r.length));
      const line = (cells: string[]) =>
        `| ${Array.from({ length: width }, (_, i) => cells[i] ?? '').join(' | ')} |`;
      // In GFM a table always has a header row: take the first one.
      state.write(line(rows[0] ?? []));
      state.ensureNewLine();
      state.write(`| ${Array.from({ length: width }, () => '---').join(' | ')} |`);
      for (const row of rows.slice(1)) {
        state.ensureNewLine();
        state.write(line(row));
      }
      state.closeBlock(node);
    },
    // Cells and rows are serialized by table.
    table_row() {},
    table_cell() {},
    table_header() {},
    // Plugin nodes.
    mergetag(state, node) {
      state.write(`{{${String(node.attrs.key ?? '')}}}`);
    },
    mention(state, node) {
      state.text(`@${String(node.attrs.name ?? '')}`);
    },
    media(state, node) {
      const src = String(node.attrs.src ?? '');
      state.write(`[${state.esc(String(node.attrs.title || src))}](${src})`);
      state.closeBlock(node);
    },
    anchor() {},
    // Elements from extendedValidElements / customElements: their text stays in Markdown.
    html_block(state, node) {
      state.renderContent(node);
    },
    html_textblock(state, node) {
      state.renderInline(node);
      state.closeBlock(node);
    },
    html_inline_atom() {},
    pagebreak(state, node) {
      state.closeBlock(node);
    },
    // Formulas go in dollars, as in most dialects (GitHub, Obsidian, Pandoc).
    math_inline(state, node) {
      state.write(`$${String(node.attrs.latex ?? '')}$`);
    },
    math_block(state, node) {
      state.write(`$$\n${String(node.attrs.latex ?? '')}\n$$`);
      state.closeBlock(node);
    },
    // The table of contents is built from headings: in Markdown, readers (and sites) build it themselves.
    toc() {},
    // Markdown has no collapsible block: the title becomes a paragraph, the content stays as is.
    details(state, node) {
      state.renderContent(node);
    },
    details_summary(state, node) {
      state.renderInline(node);
      state.closeBlock(node);
    },
  },
  {
    ...marks,
    bold: marks.strong!,
    italic: marks.em!,
    strike: { open: '~~', close: '~~', mixable: true, expelEnclosingWhitespace: true },
    link: {
      // Italic/bold may wrap a link entirely: "*text [link](url)*". Otherwise the formatting
      // closes before the link, and Markdown doesn't count a closing after a space.
      mixable: true,
      open: '[',
      close: (_state: MarkdownSerializerState, mark: Mark) => {
        const href = String(mark.attrs.href ?? '').replace(/[()]/g, '\\$&');
        const title = mark.attrs.title ? ` "${String(mark.attrs.title).replace(/"/g, '\\"')}"` : '';
        return `](${href}${title})`;
      },
    },
    underline: plain,
    subscript: plain,
    superscript: plain,
    color: plain,
    background: plain,
    font_family: plain,
    font_size: plain,
    span_class: plain,
    html_inline: plain,
    comment: plain,
    suggestion_insert: plain,
    suggestion_delete: plain,
  },
  { strict: false },
);

/**
 * A document → Markdown (CommonMark plus GFM tables and strikethrough). Formatting Markdown doesn't
 * have (underline, color, font, page break) is dropped and the text is kept. Template variables
 * become `{{key}}`, mentions `@Name`.
 */
export function toMarkdown(source: Editor | PMNode): string {
  const doc = 'view' in source ? source.view.state.doc : source;
  return serialize(doc).trim();
}

/**
 * Escaping at the start of a line in prosemirror-markdown is incomplete: "0)", "2025." at the end of a line, "+" and
 * a line of "=" (a heading underline) would change the structure when read back: a paragraph became a list
 * or a heading, text disappeared. Our own subclass rather than a prototype patch: other code using the
 * same library isn't affected. Found by a property-based test.
 */
// The constructor and `out` are marked internal in the library's types; at runtime they are public
// (MarkdownSerializer.serialize itself uses them that way).
type StateConstructor = new (
  nodes: MarkdownSerializer['nodes'],
  marks: MarkdownSerializer['marks'],
  options: { tightLists?: boolean },
) => MarkdownSerializerState & { out: string };
const BaseState = MarkdownSerializerState as unknown as StateConstructor;

class NovaMarkdownState extends BaseState {
  override esc(str: string, startOfLine = false): string {
    // The library treats only the start of a block as the start of a line; a line after a break (Shift+Enter)
    // is a start too: otherwise "#" there turned the rest of the paragraph into a heading.
    const self = this as unknown as { out: string; delim: string };
    const lastLine = self.out.slice(self.out.lastIndexOf('\n') + 1);
    const lineStart =
      startOfLine || lastLine === self.delim || lastLine.trim() === self.delim.trim();
    let out = super.esc(str, lineStart);
    // A regular list item that starts with "[ ]" / "[x]" must not become a task when read back.
    if (/^\s*(?:[*+-]|\d{1,9}[.)])\s$/.test(lastLine)) out = out.replace(/^\[([ xX])\]/, '\\[$1]');
    if (lineStart) {
      out = out
        .replace(/^(\s*\d{1,9})([.)])(?=\s|$)/, '$1\\$2')
        .replace(/^(\s*)\+(?=\s|$)/, '$1\\+')
        .replace(/^(\s*)(=+)(\s*)$/, '$1\\$2$3');
    }
    return out;
  }
}

function serialize(node: PMNode): string {
  const state = new NovaMarkdownState(serializer.nodes, serializer.marks, { tightLists: true });
  state.renderContent(
    node.type.name === 'doc' ? node : node.type.schema.topNodeType.create(null, node),
  );
  return state.out;
}
