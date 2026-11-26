import { Fragment, type Node as PMNode, type ResolvedPos } from 'prosemirror-model';
import {
  NodeSelection,
  TextSelection,
  type Command,
  type EditorState,
  type Transaction,
} from 'prosemirror-state';

/**
 * Блоки как единицы перемещения: Alt+Shift+↑/↓ и ручка перетаскивания (плагин draghandle).
 * Единица — самый внутренний пункт списка, иначе блок верхнего уровня (абзац, заголовок, таблица
 * или цитата целиком, картинка).
 */
export interface BlockUnit {
  node: PMNode;
  /** Позиция перед узлом. */
  pos: number;
  /** Глубина узла (у блока верхнего уровня — 1). */
  depth: number;
}

/** Единица вокруг позиции. Позиция между блоками верхнего уровня — следующий блок. */
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

/** Выделенный узел — сам по себе единица; иначе — единица вокруг начала выделения. */
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

/** Соседние единицы под выделением (выделение через несколько абзацев двигает их вместе). */
function unitRange(state: EditorState): UnitRange | null {
  const unit = selectedBlockUnit(state);
  if (!unit) return null;
  const { selection } = state;
  // Курсор в ячейке таблицы: строки — не блоки, а таблицу целиком двигают ручкой.
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

/** Выделение после перемещения: то же, сдвинутое вместе с блоком. */
function shiftSelection(tr: Transaction, state: EditorState, shift: number): void {
  const { selection } = state;
  tr.setSelection(
    selection instanceof NodeSelection
      ? NodeSelection.create(tr.doc, selection.from + shift)
      : TextSelection.create(tr.doc, selection.anchor + shift, selection.head + shift),
  );
}

/** Поменять блок (или выделенные блоки) местами с соседом выше (-1) или ниже (1). */
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

/** Копия выделенного блока сразу под ним (выделяется копия). */
export const duplicateBlock: Command = (state, dispatch) => {
  const unit = selectedBlockUnit(state);
  if (!unit) return false;
  // Курсор в ячейке: копировать таблицу целиком можно только выделив её (ручкой).
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
