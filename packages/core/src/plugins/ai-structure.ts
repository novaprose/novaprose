import type { Node as PMNode, NodeType, ResolvedPos } from 'prosemirror-model';
import type { EditorState, Transaction } from 'prosemirror-state';
import { wrapRangeInList } from 'prosemirror-schema-list';
import { findWrapping } from 'prosemirror-transform';

/**
 * Structure in an AI edit (the chat panel's Edit mode): besides a block's new text, the model can
 * make a block another kind, add a block or remove one. The answer stays one line per change:
 *
 *   <block id="N">new text</block>                  the block's text
 *   <block id="N" type="h2">new text</block>        the block as a heading (and its text)
 *   <block after="N" type="p">text</block>          a new block after block N (0: before the first)
 *   <block id="N" remove></block>                   the block removed
 *
 * Kinds: p, h1–h6, quote, bullet, number. Each change is an ordinary transaction that the
 * suggestions plugin turns into a suggestion (a heading that was a paragraph, a new paragraph, a
 * removed one, a paragraph put in a list), so each can be accepted or rejected.
 */

export type BlockKind =
  'p' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'quote' | 'bullet' | 'number';

export type BlockOp =
  | { op: 'text'; id: number; text: string | null; kind: BlockKind | null }
  | { op: 'insert'; after: number; text: string; kind: BlockKind }
  | { op: 'remove'; id: number };

const KINDS: Record<string, BlockKind> = {
  p: 'p',
  paragraph: 'p',
  h1: 'h1',
  h2: 'h2',
  h3: 'h3',
  h4: 'h4',
  h5: 'h5',
  h6: 'h6',
  quote: 'quote',
  blockquote: 'quote',
  bullet: 'bullet',
  ul: 'bullet',
  number: 'number',
  numbered: 'number',
  ol: 'number',
};

// A block's text can hold "<" (a < b), but not another <block> tag: a block the model left unclosed
// isn't read together with the next one. A self-closing <block … /> is read too.
const OP_RE = /<block\b([^>]*?)\/>|<block\b([^>]*)>((?:[^<]|<(?!\/?block\b))*)<\/block>/g;

function attributes(source: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const match of source.matchAll(/([a-z]+)(?:\s*=\s*["']?([^"'\s>]*)["']?)?/gi)) {
    out[match[1]!.toLowerCase()] = match[2] ?? '';
  }
  return out;
}

/**
 * The complete changes of an answer, read from `start` (an answer is read again as it streams
 * in); `end` is where the reading stopped, the start for the next time.
 */
export function readBlockOps(answer: string, start = 0): { ops: BlockOp[]; end: number } {
  const re = new RegExp(OP_RE.source, 'g');
  re.lastIndex = start;
  const ops: BlockOp[] = [];
  let end = start;
  for (let match = re.exec(answer); match; match = re.exec(answer)) {
    end = re.lastIndex;
    const attrs = attributes(match[1] ?? match[2] ?? '');
    const text = match[3];
    const kind = KINDS[(attrs.type ?? '').toLowerCase()] ?? null;
    const id = Number(attrs.id);
    if (attrs.after !== undefined && /^\d+$/.test(attrs.after)) {
      ops.push({ op: 'insert', after: Number(attrs.after), text: text ?? '', kind: kind ?? 'p' });
    } else if (Number.isInteger(id) && id > 0) {
      if ('remove' in attrs || 'delete' in attrs) ops.push({ op: 'remove', id });
      else ops.push({ op: 'text', id, text: text ?? null, kind });
    }
  }
  return { ops, end };
}

// ---------- the changes as transactions ----------

/** The textblock that starts its content at `pos` (a block of the request, mapped), or null. */
export function textblockAt(doc: PMNode, pos: number): ResolvedPos | null {
  if (pos < 0 || pos > doc.content.size) return null;
  const $pos = doc.resolve(pos);
  return $pos.parent.isTextblock && pos === $pos.start() ? $pos : null;
}

function headingLevel(kind: BlockKind): number | null {
  return /^h[1-6]$/.test(kind) ? Number(kind.slice(1)) : null;
}

/** The kind of a textblock where it stands: a heading level, a paragraph, an item of a list… */
export function kindOf($block: ResolvedPos): BlockKind | null {
  const node = $block.parent;
  if (node.type.name === 'heading') return `h${node.attrs.level as number}` as BlockKind;
  if (node.type.name !== 'paragraph') return null;
  const item = $block.depth >= 2 ? $block.node($block.depth - 1) : null;
  if (item?.type.name === 'list_item' && $block.index($block.depth - 1) === 0) {
    const list = $block.node($block.depth - 2);
    return list.type.name === 'ordered_list' ? 'number' : 'bullet';
  }
  if (item?.type.name === 'blockquote') return 'quote';
  return 'p';
}

/**
 * A block's kind as the request shows it, `<block id="N" type="KIND">`: a heading, quote or list
 * item, `cell` for a table cell's paragraph, nothing for a plain paragraph.
 */
export function describedKind($block: ResolvedPos): string | null {
  const container = $block.depth >= 1 ? $block.node($block.depth - 1) : null;
  const role = container?.type.spec.tableRole as string | undefined;
  if (role === 'cell' || role === 'header_cell') return 'cell';
  const kind = kindOf($block);
  return kind === 'p' ? null : kind;
}

/**
 * A paragraph or heading made another of the two (p, h1–h6), in place. Kinds that wrap the block
 * (quote, lists) go through `wrapBlocks`. Returns false when the block can't be that kind here.
 */
export function setTextKind(tr: Transaction, $block: ResolvedPos, kind: BlockKind): boolean {
  const { schema } = tr.doc.type;
  const level = headingLevel(kind);
  const type = level ? schema.nodes.heading : kind === 'p' ? schema.nodes.paragraph : null;
  if (!type) return false;
  const node = $block.parent;
  if (node.type === type && (!level || node.attrs.level === level)) return true;
  const from = $block.before();
  const parent = $block.node($block.depth - 1);
  if (
    !parent.canReplaceWith(
      $block.index($block.depth - 1),
      $block.indexAfter($block.depth - 1),
      type,
    )
  )
    return false;
  try {
    tr.setBlockType(from + 1, from + 1, type, level ? { level } : null);
    return true;
  } catch {
    return false;
  }
}

/** Blocks next to each other put in a quote or a list of one kind, as one wrap. */
export function wrapBlocks(tr: Transaction, from: number, to: number, kind: BlockKind): boolean {
  const { schema } = tr.doc.type;
  const type: NodeType | undefined =
    kind === 'quote'
      ? schema.nodes.blockquote
      : kind === 'bullet'
        ? schema.nodes.bullet_list
        : kind === 'number'
          ? schema.nodes.ordered_list
          : undefined;
  if (!type) return false;
  const $from = tr.doc.resolve(from);
  const $to = tr.doc.resolve(to);
  const range = $from.blockRange($to);
  if (!range) return false;
  try {
    // A list: one item per block, joined to a list of the same kind right before (as the list
    // buttons do).
    if (kind !== 'quote') return wrapRangeInList(tr, range, type);
    const wrapping = findWrapping(range, type);
    if (!wrapping) return false;
    tr.wrap(range, wrapping);
    return true;
  } catch {
    return false;
  }
}

/** A block removed: the textblock, or the list item it is the first paragraph of. */
export function removeBlock(tr: Transaction, $block: ResolvedPos): boolean {
  let depth = $block.depth;
  // A paragraph a list item can't do without goes with its item; a block a quote has only goes
  // with the quote.
  while (depth > 1) {
    const parent = $block.node(depth - 1);
    const name = parent.type.name;
    const alone = parent.childCount === 1;
    if (
      (name === 'list_item' && $block.index(depth - 1) === 0) ||
      (name === 'blockquote' && alone)
    ) {
      depth -= 1;
      continue;
    }
    break;
  }
  // A cell keeps a paragraph: its text goes instead.
  const container = $block.node(depth - 1);
  if (container.type.spec.tableRole === 'cell' && container.childCount === 1) {
    if ($block.parent.content.size) tr.delete($block.start(), $block.end());
    return true;
  }
  const start = $block.before(depth);
  const end = $block.after(depth);
  try {
    tr.delete(start, end);
    return true;
  } catch {
    return false;
  }
}

/** The node of a new block of a kind, with its text (a list item in its list, a paragraph in a quote). */
export function blockNode(state: EditorState, kind: BlockKind, text: string): PMNode | null {
  const { schema } = state;
  const content = text ? schema.text(text) : undefined;
  const level = headingLevel(kind);
  if (level) return schema.nodes.heading?.create({ level }, content) ?? null;
  const paragraph = schema.nodes.paragraph?.create(null, content);
  if (!paragraph) return null;
  if (kind === 'quote') return schema.nodes.blockquote?.create(null, paragraph) ?? null;
  if (kind === 'bullet' || kind === 'number') {
    const list = kind === 'bullet' ? schema.nodes.bullet_list : schema.nodes.ordered_list;
    const item = schema.nodes.list_item?.create(null, paragraph);
    return list && item ? list.create(null, item) : null;
  }
  return paragraph;
}

/** Lists, their items, quotes and tables: what a new block of another kind steps out of. */
const CONTAINERS = new Set(['bullet_list', 'ordered_list', 'list_item', 'blockquote']);
const isContainer = (node: PMNode) =>
  CONTAINERS.has(node.type.name) || node.type.spec.tableRole !== undefined;

function insertAt(tr: Transaction, pos: number, node: PMNode): number | null {
  try {
    tr.insert(pos, node);
    return pos + node.nodeSize;
  } catch {
    return null;
  }
}

function fits(doc: PMNode, pos: number, type: NodeType): boolean {
  const $pos = doc.resolve(pos);
  return $pos.parent.canReplaceWith($pos.index(), $pos.index(), type);
}

/**
 * A new block next to a block of the request: `at` is the position right after that block (mapped),
 * or right before it for `side` -1 (`after="0"`). Returns where the new block ends, or null.
 *
 * A list item goes next to the block's item in a list of its kind; a quote's paragraph joins the
 * quote the block is in. Any other block steps out of the lists, quotes and tables that the block
 * ends (or starts), as far as a block of its kind can stand: a paragraph after a list's last item
 * (a table's last cell) comes after the list (the table), and after a middle item (cell) it stays
 * in that item (cell). A list item or quote that lands next to a list or quote of its kind joins it.
 */
export function insertBlock(
  tr: Transaction,
  state: EditorState,
  at: number,
  kind: BlockKind,
  text: string,
  side: 1 | -1 = 1,
): number | null {
  const { doc } = tr;
  const node = blockNode(state, kind, text);
  if (!node) return null;
  const $at = doc.resolve(Math.max(0, Math.min(at, doc.content.size)));
  const joins = kind === 'bullet' || kind === 'number' || kind === 'quote';
  // In a list (quote) of its kind: an item (a paragraph) next to the block's own.
  if (joins) {
    for (let depth = $at.depth; depth >= 1; depth--) {
      if ($at.node(depth).type !== node.type) continue;
      const pos =
        depth === $at.depth ? $at.pos : side > 0 ? $at.after(depth + 1) : $at.before(depth + 1);
      return insertAt(tr, pos, node.firstChild!);
    }
  }
  let pos = $at.pos;
  let best = fits(doc, pos, node.type) ? pos : null;
  for (let depth = $at.depth; depth >= 1; depth--) {
    if (!isContainer($at.node(depth))) break;
    if (pos !== (side > 0 ? $at.end(depth) : $at.start(depth))) break;
    pos = side > 0 ? $at.after(depth) : $at.before(depth);
    if (fits(doc, pos, node.type)) best = pos;
  }
  if (best === null) {
    // Between two items of a list (after a list item added before): into the item at that side.
    const inner = side > 0 ? $at.pos - 1 : $at.pos + 1;
    const neighbour = side > 0 ? $at.nodeBefore : $at.nodeAfter;
    if (!neighbour || neighbour.isLeaf || !fits(doc, inner, node.type)) return null;
    return insertAt(tr, inner, node);
  }
  if (joins) {
    // Next to a list (quote) of its kind: inside it, at the end of one before or the start of one after.
    const $best = doc.resolve(best);
    const near = side > 0 ? $best.nodeBefore : $best.nodeAfter;
    const far = side > 0 ? $best.nodeAfter : $best.nodeBefore;
    if (near?.type === node.type) return insertAt(tr, best - side, node.firstChild!);
    if (far?.type === node.type) return insertAt(tr, best + side, node.firstChild!);
  }
  return insertAt(tr, best, node);
}
