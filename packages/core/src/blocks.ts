import { Fragment, type Node as PMNode, type ResolvedPos } from 'prosemirror-model';
import {
  NodeSelection,
  TextSelection,
  type Command,
  type EditorState,
  type Transaction,
} from 'prosemirror-state';

/**
 * Blocks as units of movement: Alt+Shift+↑/↓ and the drag handle (the draghandle plugin).
 * The unit is the innermost list item, otherwise a top-level block (a paragraph, a heading, a whole table
 * or quote, an image).
 */
export interface BlockUnit {
  node: PMNode;
  /** The position before the node. */
  pos: number;
  /** The node's depth (1 for a top-level block). */
  depth: number;
}

/** The unit around a position. A position between top-level blocks means the next block. */
export function blockUnitAt($pos: ResolvedPos): BlockUnit | null {
  for (let depth = $pos.depth; depth > 0; depth--) {
    const node = $pos.node(depth);
    if (node.type.name === 'list_item') return { node, pos: $pos.before(depth), depth };
  }
  if ($pos.depth === 0) {
    const node = $pos.nodeAfter;
    return node ? { node, pos: $pos.pos, depth: 1 } : null;
  }
  return { node: $pos.node(1), pos: $pos.before(1), depth: 1 };
}

/** A selected node is a unit by itself; otherwise the unit around the start of the selection. */
export function selectedBlockUnit(state: EditorState): BlockUnit | null {
  const { selection } = state;
  if (selection instanceof NodeSelection) {
    return { node: selection.node, pos: selection.from, depth: selection.$from.depth + 1 };
  }
  return selection instanceof TextSelection ? blockUnitAt(selection.$from) : null;
}

interface UnitRange {
  parent: PMNode;
  startIndex: number;
  endIndex: number;
  from: number;
  to: number;
}

/** Adjacent units under the selection (a selection across several paragraphs moves them together). */
function unitRange(state: EditorState): UnitRange | null {
  const unit = selectedBlockUnit(state);
  if (!unit) return null;
  const { selection } = state;
  // The cursor in a table cell: rows aren't blocks, and the whole table is moved with the handle.
  if (!(selection instanceof NodeSelection) && unit.node.type.spec.tableRole === 'table') {
    return null;
  }
  const $unit = state.doc.resolve(unit.pos);
  const parent = $unit.parent;
  const startIndex = $unit.index();
  let endIndex = startIndex;
  if (!selection.empty && !(selection instanceof NodeSelection)) {
    const last = blockUnitAt(selection.$to);
    if (last && last.depth === unit.depth) {
      const $last = state.doc.resolve(last.pos);
      if ($last.start() === $unit.start()) endIndex = Math.max(startIndex, $last.index());
    }
  }
  let to = unit.pos;
  for (let i = startIndex; i <= endIndex; i++) to += parent.child(i).nodeSize;
  return { parent, startIndex, endIndex, from: unit.pos, to };
}

/** The selection after a move: the same one, shifted along with the block. */
function shiftSelection(tr: Transaction, state: EditorState, shift: number): void {
  const { selection } = state;
  tr.setSelection(
    selection instanceof NodeSelection
      ? NodeSelection.create(tr.doc, selection.from + shift)
      : TextSelection.create(tr.doc, selection.anchor + shift, selection.head + shift),
  );
}

/** Swaps the block (or the selected blocks) with the neighbor above (-1) or below (1). */
export function moveBlock(direction: -1 | 1): Command {
  return (state, dispatch) => {
    const range = unitRange(state);
    if (!range) return false;
    const { parent, startIndex, endIndex, from, to } = range;
    const siblingIndex = direction < 0 ? startIndex - 1 : endIndex + 1;
    if (siblingIndex < 0 || siblingIndex >= parent.childCount) return false;
    const sibling = parent.child(siblingIndex);
    const units: PMNode[] = [];
    for (let i = startIndex; i <= endIndex; i++) units.push(parent.child(i));
    const moved = Fragment.fromArray(units);
    const swapped =
      direction < 0 ? moved.append(Fragment.from(sibling)) : Fragment.from(sibling).append(moved);
    const first = Math.min(startIndex, siblingIndex);
    const last = Math.max(endIndex, siblingIndex);
    if (!parent.canReplace(first, last + 1, swapped)) return false;
    if (dispatch) {
      const tr =
        direction < 0
          ? state.tr.replaceWith(from - sibling.nodeSize, to, swapped)
          : state.tr.replaceWith(from, to + sibling.nodeSize, swapped);
      shiftSelection(tr, state, direction * sibling.nodeSize);
      dispatch(tr.scrollIntoView());
    }
    return true;
  };
}

/** A copy of the selected block right below it (the copy gets selected). */
export const duplicateBlock: Command = (state, dispatch) => {
  const unit = selectedBlockUnit(state);
  if (!unit) return false;
  // The cursor in a cell: a whole table can be copied only by selecting it (with the handle).
  if (unit.node.type.spec.tableRole === 'table' && !(state.selection instanceof NodeSelection)) {
    return false;
  }
  const end = unit.pos + unit.node.nodeSize;
  const $end = state.doc.resolve(end);
  if (!$end.parent.canReplaceWith($end.index(), $end.index(), unit.node.type)) return false;
  if (dispatch) {
    const tr = state.tr.insert(end, unit.node);
    tr.setSelection(NodeSelection.create(tr.doc, end));
    dispatch(tr.scrollIntoView());
  }
  return true;
};
