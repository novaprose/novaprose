import type { Node as PMNode } from 'prosemirror-model';
import { TextSelection, type EditorState, type Transaction } from 'prosemirror-state';
import { AttrStep, ReplaceAroundStep, ReplaceStep, type Step } from 'prosemirror-transform';
import { newCommentId } from '../comments';
import { blockSuggestion, type BlockBefore, type SuggestionAuthor } from './suggestions';

/**
 * Changes of a block's type or style in suggesting mode (a heading instead of a paragraph,
 * alignment, indent, line height, direction): the change is made, and the block remembers what it
 * was, to go back to it if the suggestion is rejected. A change that brings the block back to what
 * it was takes the suggestion away. Paragraph breaks too: Enter makes a new one (the new block
 * remembers it), and Backspace or Delete across one marks it deleted instead of joining the blocks;
 * your own new paragraph break is deleted for real. Loaded with the plugin's interface (until then
 * such changes apply directly, as other structural changes still do).
 */
export function trackBlockChanges(
  tr: Transaction,
  state: EditorState,
  author: SuggestionAuthor,
): Transaction | null {
  const step = tr.steps.length === 1 ? tr.steps[0] : null;
  if (step instanceof ReplaceStep) return trackBreak(tr, step, state, author);
  // Only transactions that change nothing but the markup of blocks (types and attributes): they
  // don't move any position, so a block is at the same place before and after.
  const positions = new Set<number>();
  for (let i = 0; i < tr.steps.length; i++) {
    const pos = markupChangeAt(tr.steps[i]!, tr.docs[i]!);
    if (pos === null) return null;
    positions.add(pos);
  }
  if (!positions.size) return null;
  const time = Date.now();
  const changes: { pos: number; value: unknown }[] = [];
  for (const pos of positions) {
    const node = tr.doc.nodeAt(pos);
    const old = state.doc.nodeAt(pos);
    if (!node?.isTextblock || !old || !hasSuggestion(node)) return null;
    const existing = blockSuggestion(old.attrs.suggestion);
    const before = existing?.before ?? markup(old);
    const now = markup(node);
    const same =
      before.type === now.type &&
      [...new Set([...Object.keys(before.attrs), ...Object.keys(now.attrs)])].every(
        (key) => value(state, before, key) === value(state, now, key),
      );
    changes.push({
      pos,
      value: same
        ? null
        : {
            id: existing?.id ?? newCommentId('s'),
            author: author.id,
            name: author.name,
            time,
            before,
          },
    });
  }
  for (const { pos, value } of changes) tr.setNodeAttribute(pos, 'suggestion', value);
  return tr;
}

/** A paragraph break typed (Enter) or deleted (Backspace, Delete), or null for any other edit. */
function trackBreak(
  tr: Transaction,
  step: ReplaceStep,
  state: EditorState,
  author: SuggestionAuthor,
): Transaction | null {
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
    !hasText(slice.content)
  ) {
    const depth = slice.openStart;
    const pos = from + depth * 2 - 1;
    const block = tr.doc.nodeAt(pos);
    if (!block?.isTextblock || !hasSuggestion(block)) return null;
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
  // Your own new paragraph break: deleted for real (fixing your own suggestion isn't a new one).
  if (existing?.change === 'split' && existing.author === author.id) return tr;
  // An empty block with nothing before it to join: as it was.
  if (whole && $from.index() === 0) return null;
  const out = state.tr.setNodeAttribute(pos, 'suggestion', suggestion('join', 1, existing?.id));
  // The cursor goes where the join would have put it: the end of the block before.
  out.setSelection(TextSelection.near(out.doc.resolve(whole ? from : from), -1));
  return out.scrollIntoView();
}

/** Whether a fragment holds any inline content (text, an image, a mention). */
function hasText(fragment: PMNode['content']): boolean {
  let found = false;
  fragment.descendants((node) => {
    if (node.isInline) found = true;
    return !found;
  });
  return found;
}

/** The block a step changes the markup of (type or attributes), or null for any other step. */
function markupChangeAt(step: Step, doc: PMNode): number | null {
  if (step instanceof AttrStep) return doc.nodeAt(step.pos)?.isTextblock ? step.pos : null;
  if (!(step instanceof ReplaceAroundStep)) return null;
  const old = doc.nodeAt(step.from);
  const next = step.slice.content.firstChild;
  const markupOnly =
    !!old?.isTextblock &&
    !!next?.isTextblock &&
    step.slice.content.childCount === 1 &&
    step.slice.openStart === 0 &&
    step.slice.openEnd === 0 &&
    step.insert === 1 &&
    step.to === step.from + old.nodeSize &&
    step.gapFrom === step.from + 1 &&
    step.gapTo === step.to - 1 &&
    next.content.size === 0;
  return markupOnly ? step.from : null;
}

const hasSuggestion = (node: PMNode) =>
  !!node.type.spec.attrs && 'suggestion' in node.type.spec.attrs;

/** An attribute of a block's markup; a missing one is its default (HTML saved elsewhere may leave defaults out). */
const value = (state: EditorState, block: BlockBefore, key: string): unknown =>
  block.attrs[key] ??
  (state.schema.nodes[block.type]?.spec.attrs?.[key] as { default?: unknown } | undefined)
    ?.default ??
  null;

/** A block's type and plain attributes, without its suggestion. */
function markup(node: PMNode): BlockBefore {
  const attrs: BlockBefore['attrs'] = {};
  for (const [key, value] of Object.entries(node.attrs)) {
    if (key === 'suggestion') continue;
    if (value === null || ['string', 'number', 'boolean'].includes(typeof value))
      attrs[key] = value as string | number | boolean | null;
  }
  return { type: node.type.name, attrs };
}
