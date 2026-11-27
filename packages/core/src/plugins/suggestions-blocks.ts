import type { Node as PMNode } from 'prosemirror-model';
import { TextSelection, type EditorState, type Transaction } from 'prosemirror-state';
import { ReplaceStep } from 'prosemirror-transform';
import { newCommentId } from '../comments';
import {
  around,
  blockSuggestion,
  hasInline,
  type StructureChange,
  type StructureTrackers,
  type SuggestionAuthor,
} from './suggestions';

/**
 * The parts of suggesting mode that load with the plugin's interface (until then such edits aren't
 * made in suggesting mode, so nothing slips through). Paragraph breaks: Enter makes a new one (the
 * new block remembers it), and Backspace or Delete across one marks it deleted instead of joining
 * the blocks; your own new paragraph break is deleted for real. Lists and quotes: what an edit did to
 * them, worked out from the document before and after it (whichever command made it: a button, Tab,
 * a typed "- ", the compatibility layer).
 */
export const trackers: StructureTrackers = { breaks: trackBreak, structure: structureChange };

/** A paragraph break typed (Enter) or deleted (Backspace, Delete), or null for any other edit. */
function trackBreak(
  tr: Transaction,
  state: EditorState,
  author: SuggestionAuthor,
): Transaction | null {
  const step = tr.steps.length === 1 ? tr.steps[0] : null;
  if (!(step instanceof ReplaceStep)) return null;
  const { from, to, slice } = step as ReplaceStep & { from: number; to: number };
  const suggestion = (change: 'split' | 'join', depth: number, id?: string) => ({
    id: id ?? newCommentId('s'),
    author: author.id,
    name: author.name,
    time: Date.now(),
    change,
    depth,
  });
  // Enter: nothing deleted, the ends of two empty blocks inserted. The new block (after the break)
  // remembers the break.
  if (
    from === to &&
    slice.openStart > 0 &&
    slice.openStart === slice.openEnd &&
    slice.content.childCount === 2 &&
    !hasInline(slice.content)
  ) {
    const depth = slice.openStart;
    const pos = from + depth * 2 - 1;
    const block = tr.doc.nodeAt(pos);
    if (!block?.isTextblock || !hasSuggestion(block)) return null;
    // The nodes the break made around the new block (a new list item) were copied from the ones
    // before it, suggestion included: a copy isn't a suggestion of its own.
    const $old = state.doc.resolve(from);
    for (let level = 1; level < depth; level++) {
      const made = tr.doc.nodeAt(from + depth + level - 1);
      const original = $old.node($old.depth - depth + level);
      if (made?.attrs.suggestion && made.attrs.suggestion === original?.attrs.suggestion)
        tr.setNodeAttribute(from + depth + level - 1, 'suggestion', null);
    }
    // A break in your own new block: the new block is new as well (rejecting removes both).
    const split = blockSuggestion(state.doc.resolve(from).parent.attrs.suggestion);
    if (split?.change === 'insert' && split.author === author.id)
      return tr.setNodeAttribute(pos, 'suggestion', { ...split });
    // Inside your own new table or list: part of it, as it is.
    if (around(state.doc, from, author.id).own) return tr.setNodeAttribute(pos, 'suggestion', null);
    // Enter at the end of a line: the new block (a new list item with it) is new as a whole, an
    // empty one to type in. Rejecting removes it with what is typed in it: one suggestion, and in
    // Word an inserted paragraph.
    // Only if nothing that was there moved into it (an item's nested list goes into the new item:
    // then it is a break, so that rejecting gives that list back to the item).
    if (
      $old.parentOffset === $old.parent.content.size &&
      tr.doc.nodeAt(from + depth)?.nodeSize === 2 * depth
    ) {
      if (depth > 1) tr.setNodeAttribute(pos, 'suggestion', null);
      return tr.setNodeAttribute(from + depth, 'suggestion', {
        id: newCommentId('s'),
        author: author.id,
        name: author.name,
        time: Date.now(),
        change: 'insert',
      });
    }
    return tr.setNodeAttribute(pos, 'suggestion', suggestion('split', depth));
  }
  if (slice.size !== 0 || to <= from) return null;
  const $from = state.doc.resolve(from);
  const $to = state.doc.resolve(to);
  // Backspace in an empty block: the whole block goes, which is the break before it going.
  const empty = state.doc.nodeAt(from);
  const whole = !!empty?.isTextblock && empty.content.size === 0 && to === from + empty.nodeSize;
  // Backspace at a block's start or Delete at its end: the break between two sibling blocks.
  const across =
    $from.parent.isTextblock &&
    $to.parent.isTextblock &&
    $from.parentOffset === $from.parent.content.size &&
    $to.parentOffset === 0 &&
    to === from + 2;
  if (!whole && !across) return null;
  const pos = whole ? from : to - 1;
  const block = state.doc.nodeAt(pos)!;
  if (!hasSuggestion(block)) return null;
  const existing = blockSuggestion(block.attrs.suggestion);
  // Your own new paragraph break (or a paragraph you inserted): deleted for real, fixing your own
  // suggestion isn't a new one.
  if (
    (existing?.change === 'split' || existing?.change === 'insert') &&
    existing.author === author.id
  )
    return tr;
  // The empty block your own Enter left before a new paragraph break (Enter at the start of a
  // line): Backspace in it takes the Enter back, the break included.
  const next = whole ? state.doc.nodeAt(from + block.nodeSize) : null;
  const nextBreak = blockSuggestion(next?.attrs.suggestion);
  if (
    nextBreak?.change === 'split' &&
    nextBreak.author === author.id &&
    (!existing || existing.author === author.id)
  )
    return tr.setNodeAttribute(from, 'suggestion', null);
  // A block that carries someone else's suggestion: it isn't lost to a join (the text tracker
  // decides). Your own style suggestion stays with the join: rejecting it gives the style back.
  const ownStyle = existing?.change === 'block' && existing.author === author.id;
  if (existing && existing.change !== 'join' && !ownStyle) return null;
  // An empty block with nothing before it to join: as it was.
  if (whole && $from.index() === 0) return null;
  const join = suggestion('join', 1, existing?.id);
  const before = ownStyle ? existing.before : existing?.before;
  const out = state.tr.setNodeAttribute(pos, 'suggestion', before ? { ...join, before } : join);
  // The cursor goes where the join would have put it: the end of the block before.
  out.setSelection(TextSelection.near(out.doc.resolve(from), -1));
  return out.scrollIntoView();
}

const hasSuggestion = (node: PMNode) =>
  !!node.type.spec.attrs && 'suggestion' in node.type.spec.attrs;

/** A node with no blocks inside (a paragraph, a line, an image) and the nodes around it. */
interface Leaf {
  node: PMNode;
  /** Its ancestors, the outermost first (the document itself left out). */
  around: { node: PMNode; pos: number }[];
}

function leaves(doc: PMNode): Leaf[] {
  const out: Leaf[] = [];
  doc.descendants((node, pos) => {
    if (!node.isTextblock && !(node.isBlock && node.isLeaf)) return true;
    const $pos = doc.resolve(pos);
    const around: Leaf['around'] = [];
    for (let depth = 1; depth <= $pos.depth; depth++)
      around.push({ node: $pos.node(depth), pos: $pos.before(depth) });
    out.push({ node, around });
    return false;
  });
  return out;
}

/** Nodes that a wrap or an unwrap is about: list items and quotes. */
const isItem = (node: PMNode) => node.type.name === 'list_item';
const isWrapper = (node: PMNode) => isItem(node) || node.type.name === 'blockquote';

/**
 * What an edit did to lists and quotes, from the document before and after it: the same text in
 * the same order, some of it one level deeper (wrap) or one level up (unwrap). The node that carries
 * the suggestion is the list item that moved (Tab, Shift+Tab), or the list item or quote added
 * around a block (wrap) or taken from around it (unwrap). Null for anything else; the result is
 * checked before it is used (rejecting or accepting has to give exactly the other document).
 */
function structureChange(before: PMNode, after: PMNode): StructureChange | null {
  const a = leaves(before);
  const b = leaves(after);
  if (a.length !== b.length) return null;
  let change: StructureChange['change'] | null = null;
  const nodes = new Set<number>();
  for (let i = 0; i < a.length; i++) {
    const x = a[i]!;
    const y = b[i]!;
    if (!x.node.eq(y.node)) return null;
    // The biggest part around the leaf that is the same in both: it moved as a whole.
    let same = 0;
    while (same < x.around.length && same < y.around.length) {
      const p = x.around[x.around.length - 1 - same]!.node;
      const q = y.around[y.around.length - 1 - same]!.node;
      if (p !== q && !p.eq(q)) break;
      same++;
    }
    const xs = x.around.slice(0, x.around.length - same);
    const ys = y.around.slice(0, y.around.length - same);
    if (xs.length === ys.length) {
      if (xs.every((n, k) => n.node.type === ys[k]!.node.type)) continue;
      return null;
    }
    const kind = ys.length > xs.length ? 'wrap' : 'unwrap';
    if (change && change !== kind) return null;
    change = kind;
    const longer = kind === 'wrap' ? ys : xs;
    const shorter = kind === 'wrap' ? xs : ys;
    const extra = longer.length - shorter.length;
    // The innermost place the extra levels fit in.
    let at = -1;
    for (let k = shorter.length; k >= 0 && at < 0; k--) {
      if (shorter.every((n, j) => n.node.type === longer[j < k ? j : j + extra]!.node.type)) at = k;
    }
    if (at < 0) return null;
    // The moved part, where the carrier lives (after for a wrap, before for an unwrap).
    const side = kind === 'wrap' ? y : x;
    const moved = same ? side.around[side.around.length - same]! : null;
    const added = longer[at + extra - 1]!;
    const carrier = moved && isItem(moved.node) ? moved : added;
    if (!isWrapper(carrier.node)) return null;
    nodes.add(carrier.pos);
  }
  return change ? { change, nodes: [...nodes].sort((p, q) => p - q) } : null;
}
