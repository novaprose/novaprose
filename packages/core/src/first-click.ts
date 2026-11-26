import { Plugin, Selection } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';

/** The browser's cursor position in the document; null when the selection isn't in the editor's text (or is in a shadow root). */
function browserCaret(view: EditorView): number | null {
  const selection = view.dom.ownerDocument.getSelection();
  const node = selection?.focusNode;
  if (!selection || !node || !view.dom.contains(node)) return null;
  try {
    return view.posAtDOM(node, selection.focusOffset);
  } catch {
    return null;
  }
}

/**
 * The first click into an unfocused editor lands where you clicked. A click away from the text (to the right of
 * the last line, below it) is turned by browsers into a cursor at the start of the document when they focus,
 * in Chromium, WebKit and Firefox. The click position ProseMirror computes is correct: if
 * the browser's cursor ended up in another block, it is put there. The same block is left alone;
 * ProseMirror itself selects images, mentions and other atom nodes.
 */
export function firstClickPlugin(): Plugin {
  let focusedOnMouseDown = true;
  return new Plugin({
    props: {
      handleDOMEvents: {
        mousedown(view) {
          focusedOnMouseDown = view.hasFocus();
          return false;
        },
      },
      handleClick(view, pos, event) {
        if (focusedOnMouseDown || event.button !== 0 || event.shiftKey || event.detail > 1)
          return false;
        const { doc } = view.state;
        const hit = view.posAtCoords({ left: event.clientX, top: event.clientY });
        const node = hit && hit.inside >= 0 ? doc.nodeAt(hit.inside) : null;
        if (node && !node.isTextblock) return false;
        const $pos = doc.resolve(pos);
        const caret = browserCaret(view);
        if (caret !== null && doc.resolve(caret).parent === $pos.parent) return false;
        const selection = Selection.near($pos);
        if (!view.state.selection.eq(selection))
          view.dispatch(view.state.tr.setSelection(selection).setMeta('pointer', true));
        // The browser has already placed its selection: focus() writes the editor's selection into the DOM.
        view.focus();
        return true;
      },
    },
  });
}
