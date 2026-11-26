import { lift, setBlockType, toggleMark, wrapIn } from 'prosemirror-commands';
import { redo, undo } from 'prosemirror-history';
import type { MarkType, Node as PMNode, NodeType } from 'prosemirror-model';
import { liftListItem, sinkListItem, wrapInList } from 'prosemirror-schema-list';
import type { Command, EditorState, Transaction } from 'prosemirror-state';
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

/** Команда, параметризованная типом узла, который берётся из схемы состояния. */
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

const insertHorizontalRule: Command = (state, dispatch) => {
  dispatch?.(
    state.tr.replaceSelectionWith(nodesOf(state).horizontal_rule.create()).scrollIntoView(),
  );
  return true;
};

const unlink: Command = (state, dispatch) => {
  const { from, to, empty, $from } = state.selection;
  const marks = marksOf(state);
  if (empty) {
    // Курсор внутри ссылки — снимаем ссылку целиком.
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
 * Как setBlockType из prosemirror-commands, но сохраняет выравнивание блока
 * (абзац по центру → заголовок по центру), как в Word и Google Docs.
 */
/**
 * Отступ абзацев и заголовков в выделении (не в списках — там уровень списка). delta: +1 / -1.
 * Возвращает false, если менять нечего (так кнопка «уменьшить отступ» гаснет на нулевом уровне).
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

/** Отступ: в списке — вложенность пункта, иначе — отступ абзаца. */
const indentCommand: Command = (state, dispatch, view) =>
  sinkListItem(nodesOf(state).list_item)(state, dispatch, view) ||
  changeIndent(1)(state, dispatch, view);

const outdentCommand: Command = (state, dispatch, view) =>
  liftListItem(nodesOf(state).list_item)(state, dispatch, view) ||
  changeIndent(-1)(state, dispatch, view);

/** Tab / Shift+Tab: только списки — в абзаце Tab остаётся переходом фокуса (без ловушки, WCAG 2.1.2). */
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
          // Смена уровня заголовка не ломает ссылки на раздел.
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

/** Ближайший список вокруг курсора (маркированный, нумерованный, чек-лист) и его позиция. */
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
 * Сменить вид списка на месте: маркированный ↔ нумерованный ↔ чек-лист. Пункты получают checked по
 * виду списка (чек-лист — true/false, сохраняя отметки; иначе null).
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
    // Тот же вид списка — снять список. Чек-лист — не «маркированный»: кнопка маркеров его не снимает.
    const plain = listType === nodes.bullet_list ? { checklist: false } : undefined;
    if (isNodeActive(state, listType, plain)) return liftListItem(nodes.list_item)(state, dispatch);
    // Внутри другого вида списка — сменить вид (а не вкладывать новый список).
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
      // Пустое выделение без ссылки — вставляем сам адрес как текст ссылки.
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

// ---------- запросы состояния (аналог queryCommandState) ----------

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
  // Собираем непрерывные отрезки текста с этой маркой внутри родительского блока
  // и возвращаем тот, что содержит pos.
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
