import { DOMSerializer, type Schema } from 'prosemirror-model';
import type { MarkViewConstructor } from 'prosemirror-view';

/**
 * Marks whose elements Chromium turns into accessibility objects of their own (<strong>, <em>, <s>,
 * <code>, <sub>, <sup>). When a shortcut wraps the selected word in one, the line's text that NVDA
 * tracks gets shorter, and NVDA announces the next word as "unselected" (Ctrl+B said "text unselected.
 * Bold on"). With role="none" the element stays part of the line's text; bold, italic and the rest still
 * reach screen readers as text formatting.
 */
const FLAT_MARKS = ['bold', 'italic', 'strike', 'code', 'subscript', 'superscript'];

/** The elements of these marks in the editing view, with role="none". */
export const FLAT_MARK_SELECTOR = 'strong, em, s, code, sub, sup';

/**
 * Mark views for the editing view only: getHTML(), copying and the server renderer write the plain
 * elements from the schema.
 */
export function flatMarkViews(schema: Schema): Record<string, MarkViewConstructor> {
  const views: Record<string, MarkViewConstructor> = {};
  for (const name of FLAT_MARKS) {
    const toDOM = schema.marks[name]?.spec.toDOM;
    if (!toDOM) continue;
    views[name] = (mark, view, inline) => {
      const { dom, contentDOM } = DOMSerializer.renderSpec(
        view.dom.ownerDocument,
        toDOM(mark, inline),
      );
      (dom as HTMLElement).setAttribute('role', 'none');
      return { dom: dom as HTMLElement, contentDOM: contentDOM ?? undefined };
    };
  }
  return views;
}
