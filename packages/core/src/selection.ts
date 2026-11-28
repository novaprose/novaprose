import { AllSelection, NodeSelection, Plugin, PluginKey, TextSelection } from 'prosemirror-state';
import { htmlSerializer } from './document';
import type { Editor } from './editor';

/**
 * editor.selection: what is selected, as HTML or text, where it is on the screen, and ways to move
 * it. Positions are document positions (0 is before the first block), the numbers ProseMirror uses.
 */

/** A place in the document kept across changes: moveToBookmark() puts the selection back there. */
export interface SelectionBookmark {
  readonly id: number;
}

export interface EditorSelection {
  /** Where the selection starts and ends, as document positions (from ≤ to). */
  getRange(): { from: number; to: number };
  /** Selects from…to (kept inside the document); without `to`, puts the cursor at `from`. */
  setRange(from: number, to?: number): void;
  /** Whether nothing is selected: only a cursor. */
  isCollapsed(): boolean;
  /** Collapses the selection to its start (true) or its end. */
  collapse(toStart?: boolean): void;
  /** Selects the whole document. */
  selectAll(): void;
  /** The selected content as HTML, as getHTML() writes it; '' for a cursor. */
  getHTML(): string;
  /** The selected text, blocks on separate lines. */
  getText(): string;
  /** Replaces the selection with HTML, read and checked like insertContent(). */
  setHTML(html: string): boolean;
  /** The element of the editing area where the selection starts. */
  getNode(): HTMLElement | null;
  /** Selects an element of the editing area: the whole of it, or only what is inside it. */
  select(node: Node, content?: boolean): void;
  /** Puts the cursor in an element of the editing area, `offset` into it (its start by default). */
  setCursorLocation(node: Node, offset?: number): void;
  /** The selection as a DOM Range (to measure it, or for a popup of your own); null when hidden. */
  getDOMRange(): Range | null;
  /** Where the selection is on the screen; null when the editor isn't shown. */
  getRect(): DOMRect | null;
  /** Remembers the selection; later changes to the document move it along. */
  getBookmark(): SelectionBookmark;
  /** Puts the selection back where the bookmark is now; false when its text was deleted. */
  moveToBookmark(bookmark: SelectionBookmark): boolean;
  /** Scrolls the selection into view. */
  scrollIntoView(): void;
}

interface Kept {
  from: number;
  to: number;
  gone: boolean;
}

/** At most this many bookmarks are kept; the oldest go first. */
const MAX_BOOKMARKS = 200;

const bookmarksKey = new PluginKey<Map<number, Kept>>('nova-bookmarks');

/** Moves every kept bookmark along with each change to the document. */
export function bookmarksPlugin(): Plugin {
  return new Plugin<Map<number, Kept>>({
    key: bookmarksKey,
    state: {
      init: () => new Map(),
      apply(tr, kept) {
        const added = tr.getMeta(bookmarksKey) as Map<number, Kept> | undefined;
        if (added) return added;
        if (!tr.docChanged || !kept.size) return kept;
        const next = new Map<number, Kept>();
        for (const [id, mark] of kept) {
          const start = tr.mapping.mapResult(mark.from, 1);
          const end = tr.mapping.mapResult(mark.to, -1);
          next.set(id, {
            from: start.pos,
            to: Math.max(start.pos, end.pos),
            // A selected text that was deleted as a whole is gone; a cursor always has a place.
            gone: mark.gone || (mark.from !== mark.to && start.pos >= end.pos),
          });
        }
        return next;
      },
    },
  });
}

let nextBookmark = 1;

export function createSelection(editor: Editor): EditorSelection {
  const view = () => editor.view;
  const clamp = (pos: unknown) => {
    const size = view().state.doc.content.size;
    const n = typeof pos === 'number' && Number.isFinite(pos) ? Math.round(pos) : 0;
    return Math.max(0, Math.min(n, size));
  };
  const inEditor = (node: unknown): node is Node =>
    node instanceof Node && node !== view().dom && view().dom.contains(node);

  const api: EditorSelection = {
    getRange() {
      const { from, to } = view().state.selection;
      return { from, to };
    },
    setRange(from, to = from) {
      const { state, dispatch } = view();
      const selection = TextSelection.between(
        state.doc.resolve(clamp(from)),
        state.doc.resolve(clamp(to)),
      );
      dispatch(state.tr.setSelection(selection));
    },
    isCollapsed: () => view().state.selection.empty,
    collapse(toStart = false) {
      const { from, to } = view().state.selection;
      api.setRange(toStart ? from : to);
    },
    selectAll() {
      const { state, dispatch } = view();
      dispatch(state.tr.setSelection(new AllSelection(state.doc)));
    },
    getHTML() {
      const { selection } = view().state;
      return selection.empty ? '' : htmlSerializer.serializeFragment(selection.content().content);
    },
    getText() {
      const { state } = view();
      return state.doc.textBetween(state.selection.from, state.selection.to, '\n');
    },
    setHTML: (html) => editor.insertContent(html),
    getNode() {
      const v = view();
      const { selection } = v.state;
      if (selection instanceof NodeSelection) {
        const dom = v.nodeDOM(selection.from);
        if (dom instanceof HTMLElement) return dom;
      }
      const elementAt = (pos: number, side: number) => {
        const { node } = v.domAtPos(pos, side);
        return node instanceof HTMLElement ? node : node.parentElement;
      };
      // Both ends looked at from inside the selection: all of a bold word gives that <strong>, a
      // selection across elements their common parent.
      let el = elementAt(selection.from, selection.empty ? 0 : 1);
      if (!selection.empty) {
        const end = elementAt(selection.to, -1);
        while (el && end && !el.contains(end)) el = el.parentElement;
      }
      return el && v.dom.contains(el) ? el : null;
    },
    select(node, content = false) {
      if (!inEditor(node)) return;
      const v = view();
      const { doc } = v.state;
      const pos = v.posAtDOM(node, 0);
      // The element of a document node (an image, a paragraph): that node, or what is inside it.
      for (const at of [pos - 1, pos]) {
        if (at < 0 || at >= doc.content.size) continue;
        const found = doc.nodeAt(at);
        if (!found || found.isText) continue;
        // A leaf's view may wrap its element (an image in its resize frame).
        const dom = v.nodeDOM(at);
        if (dom !== node && !(found.isLeaf && dom instanceof Node && dom.contains(node))) continue;
        if (found.isLeaf || (!content && NodeSelection.isSelectable(found)))
          v.dispatch(v.state.tr.setSelection(NodeSelection.create(doc, at)));
        else api.setRange(at + 1, at + found.nodeSize - 1);
        return;
      }
      // Text or a formatting element (a link, bold text): what it holds.
      api.setRange(pos, v.posAtDOM(node, node.childNodes.length));
    },
    setCursorLocation(node, offset = 0) {
      if (!inEditor(node)) return;
      const max = node.nodeType === 3 ? (node as Text).length : node.childNodes.length;
      api.setRange(view().posAtDOM(node, Math.max(0, Math.min(offset, max))));
    },
    getDOMRange() {
      const v = view();
      if (!v.dom.isConnected) return null;
      const { from, to } = v.state.selection;
      try {
        const start = v.domAtPos(from);
        const end = v.domAtPos(to);
        const range = document.createRange();
        range.setStart(start.node, start.offset);
        range.setEnd(end.node, end.offset);
        return range;
      } catch {
        return null;
      }
    },
    getRect() {
      const v = view();
      if (!v.dom.isConnected) return null;
      const { from, to, empty } = v.state.selection;
      try {
        if (!empty) {
          const rect = api.getDOMRange()?.getBoundingClientRect?.();
          if (rect && (rect.width || rect.height)) return rect;
        }
        const a = v.coordsAtPos(from);
        const b = empty ? a : v.coordsAtPos(to);
        const left = Math.min(a.left, b.left);
        const top = Math.min(a.top, b.top);
        return new DOMRect(
          left,
          top,
          Math.max(a.right, b.right) - left,
          Math.max(a.bottom, b.bottom) - top,
        );
      } catch {
        return null;
      }
    },
    getBookmark() {
      const v = view();
      const id = nextBookmark++;
      if (v.isDestroyed) return { id };
      const kept = new Map(bookmarksKey.getState(v.state));
      while (kept.size >= MAX_BOOKMARKS) kept.delete(kept.keys().next().value!);
      const { from, to } = v.state.selection;
      kept.set(id, { from, to, gone: false });
      v.dispatch(v.state.tr.setMeta(bookmarksKey, kept).setMeta('addToHistory', false));
      return { id };
    },
    moveToBookmark(bookmark) {
      const v = view();
      const id = (bookmark as SelectionBookmark | undefined)?.id;
      const mark = typeof id === 'number' ? bookmarksKey.getState(v.state)?.get(id) : undefined;
      if (!mark || mark.gone) return false;
      api.setRange(mark.from, mark.to);
      return true;
    },
    scrollIntoView() {
      const { state, dispatch } = view();
      dispatch(state.tr.scrollIntoView());
    },
  };
  return api;
}
