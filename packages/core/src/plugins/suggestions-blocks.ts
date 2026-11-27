import type { Node as PMNode } from 'prosemirror-model';
import type { EditorState, Transaction } from 'prosemirror-state';
import { AttrStep, ReplaceAroundStep, type Step } from 'prosemirror-transform';
import { newCommentId } from '../comments';
import { blockSuggestion, type BlockBefore, type SuggestionAuthor } from './suggestions';

/**
 * Changes of a block's type or style in suggesting mode (a heading instead of a paragraph,
 * alignment, indent, line height, direction): the change is made, and the block remembers what it
 * was, to go back to it if the suggestion is rejected. A change that brings the block back to what
 * it was takes the suggestion away. Loaded with the plugin's interface (until then such changes
 * apply directly, as other structural changes still do).
 */
export function trackBlockChanges(
  tr: Transaction,
  state: EditorState,
  author: SuggestionAuthor,
): Transaction | null {
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
