import { Mark, type Node as PMNode } from 'prosemirror-model';
import type { EditorState, Transaction } from 'prosemirror-state';
import { lcs, tokenize } from './history-diff';
import { OWN, suggestTransaction, type SuggestionAuthor } from './suggestions';

/**
 * AI edits arrive as suggestions, like a co-author's. The rewritten text is compared with the original word by word:
 * only changed words change (each one is its own suggestion that can be accepted or rejected separately),
 * unchanged ones keep their formatting (bold, links, color). Atoms in the text (mentions, variables)
 * are compared as words: if the AI touches them, their replacement is a suggestion too.
 */

export interface TextSegment {
  /** The start and end of the block's text inside the range. */
  from: number;
  to: number;
  text: string;
  /** The document position of every character of text (all characters of an atom share its position). */
  chars: number[];
}

/**
 * Text blocks in the range, cut to it, with the position of every character. `skipCode` leaves code
 * blocks out: AI edits are suggestions, and code can't carry them (it has no marks).
 */
export function textSegments(
  doc: PMNode,
  from: number,
  to: number,
  { skipCode = false } = {},
): TextSegment[] {
  const segments: TextSegment[] = [];
  doc.nodesBetween(from, to, (node, pos) => {
    if (!node.isTextblock) return true;
    if (skipCode && node.type.spec.code) return false;
    const start = Math.max(from, pos + 1);
    const end = Math.min(to, pos + node.nodeSize - 1);
    let text = '';
    const chars: number[] = [];
    node.forEach((child, offset) => {
      const at = pos + 1 + offset;
      if (at + child.nodeSize <= start || at >= end) return;
      if (child.isText) {
        const value = child.text ?? '';
        for (let k = 0; k < value.length; k++) {
          const p = at + k;
          if (p >= start && p < end) {
            chars.push(p);
            text += value[k];
          }
        }
      } else if (child.isLeaf) {
        // An atom entirely inside the selection gives its text (@Anna, {{client}}); a line break gives \n.
        const leaf =
          child.type.name === 'hard_break' ? '\n' : (child.type.spec.leafText?.(child) ?? '￼');
        for (let k = 0; k < leaf.length; k++) chars.push(at);
        text += leaf;
      }
    });
    segments.push({ from: start, to: end, text, chars });
    return false;
  });
  return segments;
}

/** The range's text for the model request: paragraphs separated by an empty line. */
export function rangeText(
  doc: PMNode,
  from: number,
  to: number,
  options: { skipCode?: boolean } = {},
): string {
  return textSegments(doc, from, to, options)
    .map((segment) => segment.text)
    .join('\n\n');
}

/** Whether the selection has text AI can change: some outside code blocks. */
export function hasEditableText(state: EditorState): boolean {
  const { from, to, empty } = state.selection;
  if (empty) return false;
  return textSegments(state.doc, from, to, { skipCode: true }).some((s) => s.text.trim());
}

/** The model's answer → paragraphs (a single line break inside a paragraph is a space). */
export function paragraphs(text: string): string[] {
  return text
    .replace(/\r\n?/g, '\n')
    .trim()
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s*\n\s*/g, ' ').trim())
    .filter((p, index, all) => p || all.length === 1);
}

/**
 * Replaces [from, to) with text. A line break in the text (an edit block by block keeps the block's
 * line breaks) becomes a line break node, not a newline character inside the text.
 */
function replaceText(tr: Transaction, text: string, from: number, to: number): void {
  const br = tr.doc.type.schema.nodes.hard_break;
  if (!text.includes('\n') || !br) {
    if (text) tr.insertText(text, from, to);
    else if (to > from) tr.delete(from, to);
    return;
  }
  const $from = tr.doc.resolve(from);
  const marks = to > from ? ($from.marksAcross(tr.doc.resolve(to)) ?? Mark.none) : $from.marks();
  const nodes = text
    .split('\n')
    .flatMap((part, index) => [
      ...(index ? [br.create(null, null, marks)] : []),
      ...(part ? [tr.doc.type.schema.text(part, marks)] : []),
    ]);
  try {
    tr.replaceWith(from, to, nodes);
  } catch {
    // The block doesn't take line breaks: spaces instead.
    tr.insertText(text.replace(/\n/g, ' '), from, to);
  }
}

/** Replacements of the changed words of one block, from the end, so the start positions stay correct. */
function rewriteSegment(tr: Transaction, segment: TextSegment, next: string): void {
  const before = tokenize(segment.text);
  const after = tokenize(next);
  const pairs = lcs(before, after, (a, b) => a === b) ?? [];
  // Gaps between matched pairs: old [i0, i1) → new [j0, j1).
  const hunks: Array<[number, number, number, number]> = [];
  let i = 0;
  let j = 0;
  for (const [pi, pj] of [...pairs, [before.length, after.length] as [number, number]]) {
    if (pi > i || pj > j) hunks.push([i, pi, j, pj]);
    i = pi + 1;
    j = pj + 1;
  }
  const offsets = [0];
  for (const token of before) offsets.push(offsets[offsets.length - 1]! + token.length);
  for (const [i0, i1, j0, j1] of hunks.reverse()) {
    const start = offsets[i0]!;
    const end = offsets[i1]!;
    const text = after.slice(j0, j1).join('');
    const from = start < segment.chars.length ? segment.chars[start]! : segment.to;
    const to = end > start ? segment.chars[end - 1]! + 1 : from;
    if (to > from || text) replaceText(tr, text, from, to);
  }
}

// ---------- edits block by block (the chat panel's Edit mode) ----------
//
// A whole document can't go through rewriteTransaction: one paragraph more or less in the answer
// would shift every paragraph after it. Instead each block (a paragraph, a heading, a list item, a
// cell) goes to the model with a number, <block id="N">text</block>, and the model sends back only the
// blocks it changed. Unchanged blocks cost nothing to write back, and a missing or extra block can't
// shift the others.

/**
 * Whole text blocks that the range touches, for edits block by block. Code blocks (a spelling fix
 * would break the code) and empty blocks are left out.
 */
export function editableBlocks(doc: PMNode, from: number, to: number): TextSegment[] {
  const blocks: TextSegment[] = [];
  doc.nodesBetween(from, Math.max(from, to), (node, pos) => {
    if (!node.isTextblock) return true;
    if (!node.type.spec.code) {
      const [segment] = textSegments(doc, pos + 1, pos + node.nodeSize - 1);
      if (segment?.text.trim()) blocks.push(segment);
    }
    return false;
  });
  return blocks;
}

/** The blocks for the model: `<block id="N">text</block>`, one per line, numbered from 1. */
export function blocksText(blocks: readonly TextSegment[]): string {
  return blocks.map((block, index) => `<block id="${index + 1}">${block.text}</block>`).join('\n');
}

// A block's text can hold "<" (a < b), but not another <block> tag: a block the model left unclosed
// isn't read together with the next one.
const BLOCK_RE = /<block\s+id=["']?(\d+)["']?\s*>((?:[^<]|<(?!\/?block\b))*)<\/block>/g;

/**
 * The complete blocks of an answer, read from `start` (an answer is read again as it streams in);
 * `end` is where the reading stopped, the start for the next time.
 */
export function readBlocks(
  answer: string,
  start = 0,
): { blocks: Array<[id: number, text: string]>; end: number } {
  const re = new RegExp(BLOCK_RE.source, 'g');
  re.lastIndex = start;
  const blocks: Array<[number, string]> = [];
  let end = start;
  for (let match = re.exec(answer); match; match = re.exec(answer)) {
    blocks.push([Number(match[1]), match[2]!]);
    end = re.lastIndex;
  }
  return { blocks, end };
}

/**
 * A block's new text from the answer: line ends as \n, no paragraph breaks (a block stays one block:
 * an empty line becomes a space), and spaces at the edges only where the original had them.
 */
export function blockText(original: string, next: string): string {
  let text = next.replace(/\r\n?/g, '\n').replace(/\n[^\S\n]*\n\s*/g, ' ');
  if (!/^\s/.test(original)) text = text.replace(/^\s+/, '');
  if (!/\s$/.test(original)) text = text.replace(/\s+$/, '');
  return text;
}

/**
 * The block that started at `pos` when the request was sent (pos mapped through the changes since),
 * if it is still there with the same text. A block someone changed while the model was writing is
 * left alone: the model's version of it would undo their edit.
 */
export function currentBlock(doc: PMNode, pos: number, text: string): TextSegment | null {
  if (pos < 0 || pos > doc.content.size) return null;
  const $pos = doc.resolve(pos);
  if (!$pos.parent.isTextblock || pos !== $pos.start()) return null;
  const [segment] = textSegments(doc, pos, $pos.end());
  return segment && segment.text === text ? segment : null;
}

export interface BlockEdit {
  segment: TextSegment;
  text: string;
}

/** Edits of whole blocks in one transaction: in each block only the changed words change. */
export function blockEditsTransaction(
  state: EditorState,
  edits: readonly BlockEdit[],
): Transaction {
  const tr = state.tr;
  for (const { segment, text } of [...edits].sort((a, b) => b.segment.from - a.segment.from))
    rewriteSegment(tr, segment, text);
  return tr;
}

/**
 * The range's rewritten text → steps that replace only the changed words. The answer's paragraphs map onto the blocks
 * in order; extra ones are appended to the last block, and with fewer, the text of blocks without a pair
 * is deleted (the document structure doesn't change, so the edits stay textual and undoable).
 */
export function rewriteTransaction(
  state: EditorState,
  from: number,
  to: number,
  text: string,
): Transaction {
  const tr = state.tr;
  const segments = textSegments(state.doc, from, to, { skipCode: true });
  const next = paragraphs(text);
  const targets = segments.map((_, index) =>
    index < segments.length - 1 ? (next[index] ?? '') : next.slice(index).join(' '),
  );
  for (let index = segments.length - 1; index >= 0; index--) {
    const segment = segments[index]!;
    // A block the answer has no paragraph for, all of it in the range: the block goes (accepted,
    // no empty line is left), unless its parent needs it.
    const $block = tr.doc.resolve(segment.from);
    if (
      index > 0 &&
      !targets[index] &&
      segment.from === $block.start() &&
      segment.to === $block.end() &&
      $block.node(-1).canReplace($block.index(-1), $block.index(-1) + 1)
    ) {
      tr.delete($block.before(), $block.after());
      continue;
    }
    rewriteSegment(tr, segment, targets[index]!);
  }
  return tr;
}

/** AI edits to the range, as suggestions under its name. */
export function suggestRewrite(
  state: EditorState,
  from: number,
  to: number,
  text: string,
  author: SuggestionAuthor,
): Transaction {
  const tr = rewriteTransaction(state, from, to, text);
  if (!tr.docChanged) return tr;
  return suggestTransaction(tr, state, author).setMeta(OWN, true);
}

/**
 * AI text at a position (a continuation, a summary) as a suggestion; paragraphs become new paragraphs.
 * `newParagraph` starts with a new paragraph (a summary after the selection). In the middle of a paragraph the answer goes
 * into that paragraph as one insertion: a paragraph break isn't tracked as a suggestion, and "reject" would leave
 * the paragraph cut in two. At a position inside a code block the text goes after the block, as new
 * paragraphs: code can't carry suggestions.
 */
export function suggestInsert(
  state: EditorState,
  pos: number,
  text: string,
  author: SuggestionAuthor,
  { newParagraph = false } = {},
): Transaction {
  const $code = state.doc.resolve(pos);
  if ($code.parent.type.spec.code) {
    const paragraph = state.schema.nodes.paragraph;
    const parts = paragraphs(text).filter(Boolean);
    const out = state.tr;
    if (!paragraph || !parts.length) return out;
    try {
      out.insert(
        $code.after(),
        parts.map((part) => paragraph.create(null, state.schema.text(part))),
      );
    } catch {
      return state.tr; // the block's parent takes no paragraphs here
    }
    return suggestTransaction(out, state, author).setMeta(OWN, true);
  }
  const tr = state.tr;
  let at = pos;
  const $pos = state.doc.resolve(pos);
  let parts = paragraphs(text);
  if (!newParagraph && pos < $pos.end()) parts = [parts.join(' ')];
  // Right next to a word, add a space (the model often starts without one); the same before a following word.
  const before = state.doc.textBetween(Math.max(0, pos - 1), pos, '\n', '￼');
  if (!newParagraph && parts[0] && before && !/\s$/.test(before) && /^[\p{L}\p{N}]/u.test(parts[0]))
    parts[0] = ` ${parts[0]}`;
  const after = state.doc.textBetween(pos, Math.min(pos + 1, $pos.end()), '\n', '￼');
  const last = parts.length - 1;
  if (!newParagraph && /\S$/.test(parts[last] ?? '') && /^[\p{L}\p{N}]/u.test(after))
    parts[last] += ' ';
  parts.forEach((paragraph, index) => {
    if (index > 0 || newParagraph) {
      tr.split(at);
      at += 2;
    }
    if (paragraph) {
      tr.insertText(paragraph, at);
      at += paragraph.length;
    }
  });
  if (!tr.docChanged) return tr;
  return suggestTransaction(tr, state, author).setMeta(OWN, true);
}
