import { lift, setBlockType, toggleMark, wrapIn } from 'prosemirror-commands';
import { redo, undo } from 'prosemirror-history';
import type { MarkType, Node as PMNode, NodeType } from 'prosemirror-model';
import { liftListItem, sinkListItem, wrapInList } from 'prosemirror-schema-list';
import { Selection, type Command, type EditorState, type Transaction } from 'prosemirror-state';
import {
  indentLevel,
  type MarkName,
  type NodeName,
  type NovaSchema,
  type TextAlign,
} from './schema';
import { isSafeImageUrl, isSafeLinkUrl } from './url';
import { moveBlock } from './blocks';

/** The editor's named commands. The names are part of the public API (see Editor.exec). */
export type CommandName =
  | 'bold'
  | 'italic'
  | 'underline'
  | 'strike'
  | 'code'
  | 'subscript'
  | 'superscript'
  | 'paragraph'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'h4'
  | 'h5'
  | 'h6'
  | 'blockquote'
  | 'codeBlock'
  | 'bulletList'
  | 'orderedList'
  | 'indent'
  | 'outdent'
  | 'alignLeft'
  | 'alignCenter'
  | 'alignRight'
  | 'alignJustify'
  | 'horizontalRule'
  | 'unlink'
  | 'clearFormatting'
  | 'undo'
  | 'redo'
  | 'moveBlockUp'
  | 'moveBlockDown';

/**
 * Node and mark types come from the schema of the specific editor (state.schema): editors with
 * plugins have their own, and comparing with the shared base schema's types would give false.
 */
export const nodesOf = (state: EditorState) => (state.schema as NovaSchema).nodes;
export const marksOf = (state: EditorState) => (state.schema as NovaSchema).marks;

/** A command parameterized by a node type taken from the state's schema. */
const withNode =
  (name: NodeName, make: (type: NodeType) => Command): Command =>
  (state, dispatch, view) =>
    make(nodesOf(state)[name])(state, dispatch, view);

const withMark =
  (name: MarkName, make: (type: MarkType) => Command): Command =>
  (state, dispatch, view) =>
    make(marksOf(state)[name])(state, dispatch, view);

function setAlign(align: TextAlign | null): Command {
  return (state, dispatch) => {
    const { from, to } = state.selection;
    let tr = state.tr;
    let applicable = false;
    state.doc.nodesBetween(from, to, (node, pos) => {
      const nodes = nodesOf(state);
      if (node.type === nodes.paragraph || node.type === nodes.heading) {
        applicable = true;
        tr = tr.setNodeMarkup(pos, undefined, { ...node.attrs, align });
      }
    });
    if (!applicable) return false;
    dispatch?.(tr);
    return true;
  };
}

/**
 * A node in place of the selection, as replaceSelectionWith puts it, except that a block never cuts
 * through a node that can't hold it: in an image's caption the block goes after the image (split,
 * the image would become two, one of them without a picture).
 */
export function replaceSelectionWithBlock(tr: Transaction, node: PMNode): Transaction {
  const { $from } = tr.selection;
  if (node.isBlock) {
    for (let depth = $from.depth - 1; depth > 0; depth--) {
      const container = $from.node(depth);
      if (!container.type.spec.isolating) continue;
      let fits = false;
      for (let i = 0; i <= container.childCount && !fits; i++)
        fits = container.canReplaceWith(i, i, node.type);
      // A table cell holds blocks: the usual way.
      if (fits) break;
      const after = $from.after(depth);
      tr.insert(after, node);
      return tr.setSelection(Selection.near(tr.doc.resolve(after + node.nodeSize)));
    }
  }
  return tr.replaceSelectionWith(node);
}

const insertHorizontalRule: Command = (state, dispatch) => {
  dispatch?.(
    replaceSelectionWithBlock(state.tr, nodesOf(state).horizontal_rule.create()).scrollIntoView(),
  );
  return true;
};

const unlink: Command = (state, dispatch) => {
  const { from, to, empty, $from } = state.selection;
  const marks = marksOf(state);
  if (empty) {
    // The cursor is inside a link: remove the whole link.
    const range = markRange(state, marks.link, $from.pos);
    if (!range) return false;
    dispatch?.(state.tr.removeMark(range.from, range.to, marks.link));
    return true;
  }
  if (!state.doc.rangeHasMark(from, to, marks.link)) return false;
  dispatch?.(state.tr.removeMark(from, to, marks.link));
  return true;
};

const clearFormatting: Command = (state, dispatch) => {
  const { from, to, empty } = state.selection;
  if (empty) return false;
  if (dispatch) {
    const marks = marksOf(state);
    let tr = state.tr;
    for (const mark of Object.values(marks)) {
      if (mark !== marks.link) tr = tr.removeMark(from, to, mark);
    }
    dispatch(tr);
  }
  return true;
};

/**
 * Like setBlockType from prosemirror-commands, but keeps the block's alignment
 * (a centered paragraph → a centered heading), as in Word and Google Docs.
 */
/**
 * Indents paragraphs and headings in the selection (not in lists: there it is the list level). delta: +1 / -1.
 * Returns false when there is nothing to change (so the "decrease indent" button goes dim at level zero).
 */
function changeIndent(delta: number): Command {
  return (state, dispatch) => {
    const nodes = nodesOf(state);
    const changes: { pos: number; attrs: Record<string, unknown> }[] = [];
    const { from, to } = state.selection;
    state.doc.nodesBetween(from, to, (node, pos, parent) => {
      if (node.type !== nodes.paragraph && node.type !== nodes.heading) return true;
      if (parent?.type !== nodes.list_item) {
        const current = indentLevel(node.attrs.indent);
        const next = indentLevel(current + delta);
        if (next !== current) changes.push({ pos, attrs: { ...node.attrs, indent: next } });
      }
      return false;
    });
    if (!changes.length) return false;
    if (dispatch) {
      const tr = state.tr;
      for (const { pos, attrs } of changes) tr.setNodeMarkup(pos, undefined, attrs);
      dispatch(tr.scrollIntoView());
    }
    return true;
  };
}

/** Indent: in a list, the item's nesting; otherwise the paragraph indent. */
const indentCommand: Command = (state, dispatch, view) =>
  sinkListItem(nodesOf(state).list_item)(state, dispatch, view) ||
  changeIndent(1)(state, dispatch, view);

const outdentCommand: Command = (state, dispatch, view) =>
  liftListItem(nodesOf(state).list_item)(state, dispatch, view) ||
  changeIndent(-1)(state, dispatch, view);

/** Tab / Shift+Tab: lists only; in a paragraph Tab still moves the focus (no keyboard trap, WCAG 2.1.2). */
export const listIndent: Command = (state, dispatch, view) =>
  sinkListItem(nodesOf(state).list_item)(state, dispatch, view);
export const listOutdent: Command = (state, dispatch, view) =>
  liftListItem(nodesOf(state).list_item)(state, dispatch, view);

function setBlockKeepAlign(type: NodeType, attrs: Record<string, unknown> = {}): Command {
  const base = setBlockType(type, attrs);
  return (state, dispatch) => {
    if (!base(state)) return false;
    if (dispatch) {
      const tr = state.tr;
      for (const range of state.selection.ranges) {
        tr.setBlockType(range.$from.pos, range.$to.pos, type, (old) => ({
          ...attrs,
          ...('align' in type.spec.attrs! && old.attrs.align ? { align: old.attrs.align } : {}),
          ...('lineHeight' in type.spec.attrs! && old.attrs.lineHeight
            ? { lineHeight: old.attrs.lineHeight }
            : {}),
          ...('dir' in type.spec.attrs! && old.attrs.dir ? { dir: old.attrs.dir } : {}),
          ...('indent' in type.spec.attrs! && old.attrs.indent ? { indent: old.attrs.indent } : {}),
          // Changing the heading level doesn't break links to the section.
          ...('id' in type.spec.attrs! && old.attrs.id ? { id: old.attrs.id } : {}),
        }));
      }
      dispatch(tr.scrollIntoView());
    }
    return true;
  };
}

function heading(level: number): Command {
  return withNode('heading', (type) => setBlockKeepAlign(type, { level }));
}

export const commands: Record<CommandName, Command> = {
  bold: withMark('bold', toggleMark),
  italic: withMark('italic', toggleMark),
  underline: withMark('underline', toggleMark),
  strike: withMark('strike', toggleMark),
  code: withMark('code', toggleMark),
  subscript: withMark('subscript', toggleMark),
  superscript: withMark('superscript', toggleMark),
  paragraph: withNode('paragraph', (type) => setBlockKeepAlign(type)),
  h1: heading(1),
  h2: heading(2),
  h3: heading(3),
  h4: heading(4),
  h5: heading(5),
  h6: heading(6),
  blockquote: (state, dispatch) =>
    isNodeActive(state, nodesOf(state).blockquote)
      ? lift(state, dispatch)
      : wrapIn(nodesOf(state).blockquote)(state, dispatch),
  codeBlock: withNode('code_block', (type) => setBlockType(type)),
  bulletList: withNode('bullet_list', toggleList),
  orderedList: withNode('ordered_list', toggleList),
  indent: indentCommand,
  outdent: outdentCommand,
  alignLeft: setAlign(null),
  alignCenter: setAlign('center'),
  alignRight: setAlign('right'),
  alignJustify: setAlign('justify'),
  horizontalRule: insertHorizontalRule,
  unlink,
  clearFormatting,
  undo,
  redo,
  moveBlockUp: moveBlock(-1),
  moveBlockDown: moveBlock(1),
};

/** The nearest list around the cursor (bulleted, numbered, checklist) and its position. */
export function findParentList(state: EditorState): { node: PMNode; pos: number } | null {
  const nodes = nodesOf(state);
  const { $from } = state.selection;
  for (let depth = $from.depth; depth > 0; depth--) {
    const node = $from.node(depth);
    if (node.type === nodes.bullet_list || node.type === nodes.ordered_list) {
      return { node, pos: $from.before(depth) };
    }
  }
  return null;
}

/**
 * Changes the kind of a list in place: bulleted ↔ numbered ↔ checklist. Items get checked according
 * to the list kind (a checklist keeps true/false and the existing checks; otherwise null).
 */
export function convertList(
  tr: Transaction,
  list: { node: PMNode; pos: number },
  type: NodeType,
  checklist = false,
): Transaction {
  const nodes = (tr.doc.type.schema as NovaSchema).nodes;
  const isChecklist = type === nodes.bullet_list && checklist;
  tr.setNodeMarkup(
    list.pos,
    type,
    type === nodes.bullet_list ? { listStyle: null, checklist: isChecklist } : { start: 1 },
  );
  list.node.forEach((item, offset) => {
    const previous = item.attrs.checked;
    const checked = isChecklist ? (typeof previous === 'boolean' ? previous : false) : null;
    if (checked !== previous) {
      tr.setNodeMarkup(list.pos + 1 + offset, undefined, { ...item.attrs, checked });
    }
  });
  return tr;
}

function toggleList(listType: NodeType): Command {
  return (state, dispatch) => {
    const nodes = nodesOf(state);
    // The same kind of list removes the list. A checklist isn't "bulleted": the bullet button doesn't remove it.
    const plain = listType === nodes.bullet_list ? { checklist: false } : undefined;
    if (isNodeActive(state, listType, plain)) return liftListItem(nodes.list_item)(state, dispatch);
    // Inside a different kind of list: change the kind (instead of nesting a new list).
    const list = findParentList(state);
    if (list) {
      if (dispatch) dispatch(convertList(state.tr, list, listType).scrollIntoView());
      return true;
    }
    return wrapInList(listType)(state, dispatch);
  };
}

/** Insert or update a link on the selection. */
export function setLink(href: string, attrs: { title?: string; target?: string } = {}): Command {
  return (state, dispatch) => {
    if (!isSafeLinkUrl(href)) return false;
    const { from, to, empty, $from } = state.selection;
    const marks = marksOf(state);
    const mark = marks.link.create({
      href,
      title: attrs.title ?? null,
      target: attrs.target ?? null,
    });
    if (empty) {
      const range = markRange(state, marks.link, $from.pos);
      if (range) {
        dispatch?.(
          state.tr.removeMark(range.from, range.to, marks.link).addMark(range.from, range.to, mark),
        );
        return true;
      }
      // An empty selection without a link: insert the address itself as the link text.
      dispatch?.(state.tr.insert(from, state.schema.text(href, [mark])));
      return true;
    }
    dispatch?.(state.tr.removeMark(from, to, marks.link).addMark(from, to, mark));
    return true;
  };
}

/** Insert an image in place of the selection. */
export function insertImage(src: string, alt?: string): Command {
  return (state, dispatch) => {
    if (!isSafeImageUrl(src)) return false;
    dispatch?.(
      state.tr
        .replaceSelectionWith(nodesOf(state).image.create({ src, alt: alt ?? null }))
        .scrollIntoView(),
    );
    return true;
  };
}

// ---------- state queries (like queryCommandState) ----------

export function isMarkActive(state: EditorState, type: MarkType): boolean {
  const { from, $from, to, empty } = state.selection;
  if (empty) return !!type.isInSet(state.storedMarks ?? $from.marks());
  return state.doc.rangeHasMark(from, to, type);
}

export function isNodeActive(
  state: EditorState,
  type: NodeType,
  attrs?: Record<string, unknown>,
): boolean {
  const { $from, to } = state.selection;
  for (let depth = $from.depth; depth > 0; depth--) {
    const node = $from.node(depth);
    if (
      node.type === type &&
      (!attrs || Object.entries(attrs).every(([k, v]) => node.attrs[k] === v))
    ) {
      return to <= $from.end(depth);
    }
  }
  return false;
}

export function getActiveAlign(state: EditorState): TextAlign {
  const parent = state.selection.$from.parent;
  return (parent.attrs.align as TextAlign | null) ?? 'left';
}

/**
 * Whether a command is active for the current selection: the mark is applied, the block has the
 * right type, the alignment matches. Always `false` for action commands (undo, indent, horizontalRule…).
 */
export function isCommandActive(state: EditorState, command: CommandName): boolean {
  const parent = state.selection.$from.parent;
  const nodes = nodesOf(state);
  const marks = marksOf(state);
  switch (command) {
    case 'bold':
    case 'italic':
    case 'underline':
    case 'strike':
    case 'code':
    case 'subscript':
    case 'superscript':
      return isMarkActive(state, marks[command]);
    case 'paragraph':
      return parent.type === nodes.paragraph;
    case 'h1':
    case 'h2':
    case 'h3':
    case 'h4':
    case 'h5':
    case 'h6':
      return parent.type === nodes.heading && parent.attrs.level === Number(command[1]);
    case 'codeBlock':
      return parent.type === nodes.code_block;
    case 'blockquote':
      return isNodeActive(state, nodes.blockquote);
    case 'bulletList':
      return isNodeActive(state, nodes.bullet_list, { checklist: false });
    case 'orderedList':
      return isNodeActive(state, nodes.ordered_list);
    case 'alignLeft':
      return getActiveAlign(state) === 'left';
    case 'alignCenter':
      return getActiveAlign(state) === 'center';
    case 'alignRight':
      return getActiveAlign(state) === 'right';
    case 'alignJustify':
      return getActiveAlign(state) === 'justify';
    default:
      return false;
  }
}

export function getLinkAt(
  state: EditorState,
): { href: string; title: string | null; target: string | null } | null {
  const { $from } = state.selection;
  const marks = marksOf(state);
  const mark =
    marks.link.isInSet($from.marks()) ?? marks.link.isInSet($from.nodeAfter?.marks ?? []);
  return mark
    ? (mark.attrs as { href: string; title: string | null; target: string | null })
    : null;
}

export function markRange(
  state: EditorState,
  type: MarkType,
  pos: number,
): { from: number; to: number } | null {
  // Collect the continuous runs of text with this mark inside the parent block
  // and return the one that contains pos.
  const $pos = state.doc.resolve(pos);
  const base = $pos.start();
  const segments: { from: number; to: number }[] = [];
  $pos.parent.forEach((child, offset) => {
    if (!type.isInSet(child.marks)) return;
    const from = base + offset;
    const to = from + child.nodeSize;
    const last = segments[segments.length - 1];
    if (last && last.to === from) last.to = to;
    else segments.push({ from, to });
  });
  return segments.find((s) => s.from <= pos && pos <= s.to) ?? null;
}
