import type { Node as PMNode } from 'prosemirror-model';

/**
 * Differences between a version and the current document, for viewing the history.
 * Text blocks are compared (paragraphs, headings, list items): matching ones are skipped, changed ones get
 * a word-by-word comparison. The result is in positions of the version's document (the one that is shown):
 * - added: text that exists only in the version;
 * - removed: text that exists only in the current document (shown as an insertion in place).
 */

export interface DiffResult {
  added: { from: number; to: number }[];
  removed: { pos: number; text: string; block: boolean }[];
}

interface Block {
  /** The position before the block node. */
  pos: number;
  /** The position of the end of the block's content. */
  end: number;
  /** The depth of the block's parent (0 means the block is at the top level of the document). */
  depth: number;
  type: string;
  text: string;
  /** The document position of every character of text. */
  chars: number[];
}

/** A limit on the LCS table size: beyond it the result is coarser, but huge documents don't hang. */
const MAX_CELLS = 2_000_000;

function textblocks(doc: PMNode): Block[] {
  const blocks: Block[] = [];
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true;
    let text = '';
    const chars: number[] = [];
    node.forEach((child, offset) => {
      const start = pos + 1 + offset;
      if (child.isText) {
        for (let k = 0; k < child.text!.length; k += 1) chars.push(start + k);
        text += child.text;
      } else {
        const leaf = child.type.spec.leafText?.(child) ?? ' ';
        for (let k = 0; k < leaf.length; k += 1) chars.push(start);
        text += leaf;
      }
    });
    blocks.push({
      pos,
      end: pos + node.nodeSize - 1,
      depth: doc.resolve(pos).depth,
      type: node.type.name,
      text,
      chars,
    });
    return false;
  });
  return blocks;
}

/** Index pairs of the longest common subsequence (or null when the table is too large). */
export function lcs<T>(a: T[], b: T[], eq: (x: T, y: T) => boolean): [number, number][] | null {
  const n = a.length;
  const m = b.length;
  if ((n + 1) * (m + 1) > MAX_CELLS) return null;
  const table = new Uint32Array((n + 1) * (m + 1));
  const at = (i: number, j: number) => i * (m + 1) + j;
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      table[at(i, j)] = eq(a[i]!, b[j]!)
        ? table[at(i + 1, j + 1)]! + 1
        : Math.max(table[at(i + 1, j)]!, table[at(i, j + 1)]!);
    }
  }
  const pairs: [number, number][] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (eq(a[i]!, b[j]!)) {
      pairs.push([i, j]);
      i += 1;
      j += 1;
    } else if (table[at(i + 1, j)]! >= table[at(i, j + 1)]!) i += 1;
    else j += 1;
  }
  return pairs;
}

/** Words and the spaces between them: the units of comparison. */
export const tokenize = (text: string) => text.split(/(\s+)/).filter(Boolean);

function addRange(result: DiffResult, from: number, to: number) {
  if (from >= to) return;
  const last = result.added[result.added.length - 1];
  if (last && last.to >= from) last.to = Math.max(last.to, to);
  else result.added.push({ from, to });
}

/** A block changed: compare word by word. */
function diffBlock(result: DiffResult, rev: Block, cur: Block) {
  // The same text, a different block type (paragraph → heading): the whole block is marked.
  if (rev.text === cur.text) {
    if (rev.text) addRange(result, rev.chars[0]!, rev.end);
    return;
  }
  const a = tokenize(rev.text);
  const b = tokenize(cur.text);
  const pairs = lcs(a, b, (x, y) => x === y);
  if (!pairs) {
    if (rev.text) addRange(result, rev.chars[0]!, rev.end);
    if (cur.text) result.removed.push({ pos: rev.end, text: cur.text, block: false });
    return;
  }
  // The offset of every token of the version, in characters.
  const offsets: number[] = [];
  let offset = 0;
  for (const token of a) {
    offsets.push(offset);
    offset += token.length;
  }
  const charPos = (index: number) => (index < rev.chars.length ? rev.chars[index]! : rev.end);
  let i = 0;
  let j = 0;
  const flushRemoved = (until: number, atToken: number) => {
    const text = b.slice(j, until).join('');
    if (text.trim()) {
      const pos = atToken < a.length ? charPos(offsets[atToken]!) : rev.end;
      result.removed.push({ pos, text, block: false });
    }
    j = until;
  };
  for (const [pi, pj] of [...pairs, [a.length, b.length] as [number, number]]) {
    for (; i < pi; i += 1) {
      if (!a[i]!.trim()) continue;
      const start = offsets[i]!;
      addRange(result, charPos(start), charPos(start + a[i]!.length - 1) + 1);
    }
    // What was removed goes after what was added, before the next matching word.
    flushRemoved(pj, pi);
    i = pi + 1;
    j = pj + 1;
  }
}

/**
 * Where to insert a block that isn't in the version: before the next block of the version, but at the depth of the removed one
 * (a paragraph that stood before a list goes before the list, not inside its first item).
 */
function blockAnchor(revision: PMNode, next: Block | undefined, depth: number): number {
  if (!next) return revision.content.size;
  if (depth >= next.depth) return next.pos;
  return revision.resolve(next.pos).before(depth + 1);
}

export function diffDocs(revision: PMNode, current: PMNode): DiffResult {
  const result: DiffResult = { added: [], removed: [] };
  const rev = textblocks(revision);
  const cur = textblocks(current);
  const same = (x: Block, y: Block) => x.type === y.type && x.text === y.text;
  const pairs = lcs(rev, cur, same) ?? [];
  let i = 0;
  let j = 0;
  for (const [pi, pj] of [...pairs, [rev.length, cur.length] as [number, number]]) {
    // A gap of unmatched blocks: pairs are compared word by word, the rest as a whole.
    const revGap = rev.slice(i, pi);
    const curGap = cur.slice(j, pj);
    const common = Math.min(revGap.length, curGap.length);
    for (let k = 0; k < common; k += 1) diffBlock(result, revGap[k]!, curGap[k]!);
    for (const block of revGap.slice(common)) {
      if (block.text) addRange(result, block.chars[0]!, block.end);
    }
    for (const block of curGap.slice(common)) {
      if (!block.text.trim()) continue;
      result.removed.push({
        pos: blockAnchor(revision, rev[pi], block.depth),
        text: block.text,
        block: true,
      });
    }
    i = pi + 1;
    j = pj + 1;
  }
  return result;
}
