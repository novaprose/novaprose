import type { Node as PMNode } from 'prosemirror-model';
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

/** Text blocks in the range, cut to it, with the position of every character. */
export function textSegments(doc: PMNode, from: number, to: number): TextSegment[] {
  const segments: TextSegment[] = [];
  doc.nodesBetween(from, to, (node, pos) => {
    if (!node.isTextblock) return true;
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
export function rangeText(doc: PMNode, from: number, to: number): string {
  return textSegments(doc, from, to)
    .map((segment) => segment.text)
    .join('\n\n');
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
    if (to > from && text) tr.insertText(text, from, to);
    else if (to > from) tr.delete(from, to);
    else if (text) tr.insertText(text, from);
  }
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
  const segments = textSegments(state.doc, from, to);
  const next = paragraphs(text);
  const targets = segments.map((_, index) =>
    index < segments.length - 1 ? (next[index] ?? '') : next.slice(index).join(' '),
  );
  for (let index = segments.length - 1; index >= 0; index--)
    rewriteSegment(tr, segments[index]!, targets[index]!);
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
 * the paragraph cut in two.
 */
export function suggestInsert(
  state: EditorState,
  pos: number,
  text: string,
  author: SuggestionAuthor,
  { newParagraph = false } = {},
): Transaction {
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
