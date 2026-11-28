import { Plugin, PluginKey } from 'prosemirror-state';
import type { EditorProps, EditorView } from 'prosemirror-view';

/**
 * The header (menu bar and toolbar) sticks to the top of the window while the page scrolls, and the
 * text scrolls under it. The line with the caret is never left there (WCAG 2.4.11 Focus Not
 * Obscured): ProseMirror's own scrolling keeps a margin as tall as the header, and when the browser
 * scrolls by itself (arrow keys, Page Up), the page is scrolled back from under the header.
 */
export function stickyHeader(
  header: HTMLElement,
  content: HTMLElement,
): { plugin: Plugin; props: Pick<EditorProps, 'scrollThreshold' | 'scrollMargin'> } {
  // ProseMirror reads the margins once per scrolling parent: one measurement a turn is enough.
  let measured: number | null = null;
  /** How much of the top of the window the header covers now (0: it covers no text). */
  const cover = (): number => {
    if (measured !== null) return measured;
    measured = 0;
    queueMicrotask(() => (measured = null));
    // Text that scrolls inside its own box is below the header: none of it is covered.
    if (content.scrollHeight > content.clientHeight + 1) return measured;
    const style = getComputedStyle(header);
    if (style.position === 'sticky' && style.display !== 'none')
      measured = header.offsetHeight + (parseFloat(style.top) || 0);
    return measured;
  };

  const uncover = (view: EditorView) => {
    if (!cover() || !view.hasFocus()) return;
    const box = header.getBoundingClientRect();
    let caret: { top: number; bottom: number };
    try {
      caret = view.coordsAtPos(view.state.selection.head);
    } catch {
      return;
    }
    if (caret.bottom <= box.top || caret.top >= box.bottom) return;
    scrollerOf(header).scrollBy(0, caret.top - box.bottom - 5);
  };

  /**
   * With focus outside the text (the find bar, a side panel), ProseMirror doesn't scroll to the
   * selection at all: the text's own selection is brought into view here, below the header.
   */
  const reveal = (view: EditorView) => {
    // A hidden editor (display: none, a closed tab) has nothing to show.
    if (!view.dom.getClientRects().length) return;
    let rect: { top: number; bottom: number };
    try {
      rect = view.coordsAtPos(view.state.selection.head);
    } catch {
      return;
    }
    // A fixed-height editor scrolls its text box first.
    if (content.scrollHeight > content.clientHeight + 1) {
      const box = content.getBoundingClientRect();
      if (rect.top < box.top + 5) content.scrollTop -= box.top + 5 - rect.top;
      else if (rect.bottom > box.bottom - 5) content.scrollTop += rect.bottom - box.bottom + 5;
      rect = view.coordsAtPos(view.state.selection.head);
    }
    const scroller = scrollerOf(content);
    const area =
      scroller instanceof HTMLElement
        ? scroller.getBoundingClientRect()
        : { top: 0, bottom: scroller.innerHeight };
    const top = area.top + cover() + 5;
    const bottom = area.bottom - 5;
    if (rect.top < top) scroller.scrollBy(0, rect.top - top);
    else if (rect.bottom > bottom) scroller.scrollBy(0, rect.bottom - bottom);
  };

  const plugin = new Plugin({
    key: scrolls,
    // Counts the requests to scroll to the selection (tr.scrollIntoView()).
    state: {
      init: () => 0,
      apply: (tr, count: number) => (tr.scrolledIntoView ? count + 1 : count),
    },
    view: () => {
      let frame = 0;
      return {
        update(view, prev) {
          // ProseMirror skips the scrolling while focus is elsewhere (the find bar, a panel).
          if (scrolls.getState(view.state) !== scrolls.getState(prev) && !view.hasFocus())
            reveal(view);
          if (view.state.selection.eq(prev.selection)) return;
          // After the browser's own scrolling for this move.
          cancelAnimationFrame(frame);
          frame = requestAnimationFrame(() => uncover(view));
        },
        destroy: () => cancelAnimationFrame(frame),
      };
    },
  });

  return {
    plugin,
    props: {
      scrollThreshold: {
        left: 0,
        right: 0,
        bottom: 0,
        get top() {
          return cover();
        },
      },
      scrollMargin: {
        left: 5,
        right: 5,
        bottom: 5,
        get top() {
          return cover() + 5;
        },
      },
    },
  };
}

const scrolls = new PluginKey<number>('nova-scroll-requests');

/** What scrolls under the header: the nearest scrolling box around the editor, or the window. */
function scrollerOf(el: HTMLElement): HTMLElement | Window {
  for (let parent = el.parentElement; parent; parent = parent.parentElement) {
    const { overflowY } = getComputedStyle(parent);
    if (/auto|scroll|overlay/.test(overflowY) && parent.scrollHeight > parent.clientHeight + 1)
      return parent;
  }
  return el.ownerDocument.defaultView ?? window;
}
