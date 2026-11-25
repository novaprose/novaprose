import type { Command, EditorState } from 'prosemirror-state';
import { marksOf, nodesOf } from './commands';
import { cssValue } from './schema';

/** Марки-стили со значением: цвет, фон, шрифт, размер. */
export type StyleMark = 'color' | 'background' | 'font_family' | 'font_size';

const validators: Record<StyleMark, (v: unknown) => string | null> = {
  color: cssValue.color,
  background: cssValue.color,
  font_family: cssValue.fontFamily,
  font_size: cssValue.length,
};

/**
 * Установить стиль на выделении (value = null — убрать).
 * На пустом выделении стиль применится к следующему набранному тексту (storedMarks).
 */
export function setStyle(markName: StyleMark, value: string | null): Command {
  return (state, dispatch) => {
    const type = marksOf(state)[markName];
    const valid = value === null ? null : validators[markName](value);
    if (value !== null && !valid) return false;
    const { empty } = state.selection;
    if (!dispatch) return true;
    const tr = state.tr;
    if (empty) {
      tr.removeStoredMark(type);
      if (valid) tr.addStoredMark(type.create({ value: valid }));
    } else {
      for (const range of state.selection.ranges) {
        tr.removeMark(range.$from.pos, range.$to.pos, type);
        if (valid) tr.addMark(range.$from.pos, range.$to.pos, type.create({ value: valid }));
      }
    }
    dispatch(tr.scrollIntoView());
    return true;
  };
}

/** Текущее значение стиля в начале выделения (или null). */
export function getStyle(state: EditorState, markName: StyleMark): string | null {
  const type = marksOf(state)[markName];
  const { $from, empty } = state.selection;
  const marks = empty
    ? (state.storedMarks ?? $from.marks())
    : ($from.nodeAfter?.marks ?? $from.marks());
  const mark = type.isInSet(marks);
  return mark ? (mark.attrs.value as string) : null;
}

/** Межстрочный интервал для абзацев и заголовков в выделении. */
export function setLineHeight(value: string | null): Command {
  return (state, dispatch) => {
    const valid = value === null ? null : cssValue.lineHeight(value);
    if (value !== null && !valid) return false;
    const { from, to } = state.selection;
    const tr = state.tr;
    let applicable = false;
    state.doc.nodesBetween(from, to, (node, pos) => {
      if (node.type === nodesOf(state).paragraph || node.type === nodesOf(state).heading) {
        applicable = true;
        tr.setNodeMarkup(pos, undefined, { ...node.attrs, lineHeight: valid });
      }
    });
    if (!applicable) return false;
    dispatch?.(tr);
    return true;
  };
}

export function getLineHeight(state: EditorState): string | null {
  return (state.selection.$from.parent.attrs.lineHeight as string | null) ?? null;
}
