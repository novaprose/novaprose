import { Plugin, Selection } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';

/** Позиция курсора браузера в документе; null — выделение не в тексте редактора (или в теневом корне). */
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
 * Первый щелчок в редактор без фокуса — туда, куда щёлкнули. Щелчок не по тексту (справа от
 * последней строки, ниже неё) браузеры при фокусировке превращают в курсор в начале документа —
 * так в Chromium, WebKit и Firefox. Позиция щелчка, которую считает ProseMirror, верная: если
 * курсор браузера оказался в другом блоке, ставим его туда. Тот же блок — ничего не трогаем;
 * картинки, упоминания и другие узлы-атомы выделяет сам ProseMirror.
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
        // Браузер уже поставил своё выделение — focus() записывает в DOM выделение редактора.
        view.focus();
        return true;
      },
    },
  });
}
