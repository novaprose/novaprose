import { isHistoryTransaction } from 'prosemirror-history';
import type { Node as PMNode, NodeSpec } from 'prosemirror-model';
import {
  NodeSelection,
  Plugin,
  PluginKey,
  Selection,
  TextSelection,
  type EditorState,
  type Transaction,
} from 'prosemirror-state';
import {
  AddMarkStep,
  AddNodeMarkStep,
  AttrStep,
  RemoveMarkStep,
  RemoveNodeMarkStep,
  ReplaceAroundStep,
  ReplaceStep,
  type Step,
} from 'prosemirror-transform';
import { Decoration, DecorationSet, type EditorView } from 'prosemirror-view';
import type { Editor } from '../editor';
import { SET_CONTENT_META } from '../meta';
import { definePlugin } from '../plugins';
import type { NodeAttribute } from '../schema';
import css from './noneditable.css?raw';
import { pickLabels } from './shared';

/**
 * Locked content: an element with the non-editable class (`mceNonEditable`) or
 * `contenteditable="false"` is kept as one piece. It can be selected, copied, cut and deleted
 * whole; nothing inside it changes, except parts marked editable (`mceEditable`, or
 * `contenteditable="true"` inside a locked element). Formatting a selection that crosses locked
 * content formats what is around it. `plugins: ['noneditable']`; the classes are settings
 * (`pluginOptions.noneditable`), as `noneditable_class` and `editable_class` in TinyMCE.
 *
 * In the document every node can carry `lock`: 'class' and 'attr' lock it (and say how the HTML
 * marked it, so it is written back the same way), 'open' and 'open-attr' open a part again. Elements
 * that aren't nodes of their own keep their place as `noneditable` (div, section…) or as
 * `noneditable_inline` / `editable_inline` (span).
 */

export interface NoneditableOptions {
  /** The class that locks an element (TinyMCE's `noneditable_class`). Default: 'mceNonEditable'. */
  noneditableClass?: string;
  /** The class that opens a part of a locked element (`editable_class`). Default: 'mceEditable'. */
  editableClass?: string;
}

export const LABELS = {
  en: {
    locked: 'Locked content: it can be copied or deleted, but not changed.',
  },
};

const CLASS_NAME = /^[A-Za-z_][\w-]{0,63}$/;
/** Elements kept as a `noneditable` block when they lock (or open) content and aren't nodes. */
const CONTAINERS = ['div', 'section', 'article', 'aside', 'header', 'footer'];

/** The classes of an editor (or of server rendering). */
function classesOf(options: Editor['options']): { locked: string; open: string } {
  const own = (options.pluginOptions?.noneditable ?? {}) as NoneditableOptions;
  const pick = (value: unknown, fallback: string) =>
    typeof value === 'string' && CLASS_NAME.test(value) ? value : fallback;
  return {
    locked: pick(own.noneditableClass, 'mceNonEditable'),
    open: pick(own.editableClass, 'mceEditable'),
  };
}

type LockValue = 'class' | 'attr' | 'open' | 'open-attr';

/** How an element marks itself: locked, opened again, or neither (null). */
function lockOf(el: HTMLElement, classes: { locked: string; open: string }): LockValue | null {
  const editable = el.getAttribute?.('contenteditable');
  if (el.classList?.contains(classes.locked)) return 'class';
  if (editable === 'false') return 'attr';
  if (el.classList?.contains(classes.open)) return 'open';
  // contenteditable="true" counts only inside locked content: anywhere else it would make the
  // published page editable for its readers.
  if (editable === 'true' || editable === '') {
    const lockedAbove = el.parentElement?.closest(`.${classes.locked}, [contenteditable="false"]`);
    return lockedAbove ? 'open-attr' : null;
  }
  return null;
}

function lockAttribute(classes: { locked: string; open: string }): NodeAttribute {
  return {
    nodes: 'all',
    default: null,
    parse: (dom) => lockOf(dom, classes),
    render: (value): Record<string, string> =>
      value === 'class'
        ? { class: classes.locked }
        : value === 'attr'
          ? { contenteditable: 'false' }
          : value === 'open'
            ? { class: classes.open }
            : value === 'open-attr'
              ? { contenteditable: 'true' }
              : {},
  };
}

function nodesFor(classes: { locked: string; open: string }): Record<string, NodeSpec> {
  const locks = (dom: HTMLElement) => {
    const lock = lockOf(dom, classes);
    return lock === 'class' || lock === 'attr';
  };
  const opens = (dom: HTMLElement) => {
    const lock = lockOf(dom, classes);
    return lock === 'open' || lock === 'open-attr';
  };
  return {
    noneditable: {
      group: 'block',
      content: 'block+',
      defining: true,
      attrs: { tag: { default: 'div' } },
      // Below the rules of plugins' own elements (a page break is a div too).
      parseDOM: CONTAINERS.map((tag) => ({
        tag,
        priority: 45,
        getAttrs: (dom: HTMLElement) => (lockOf(dom, classes) ? { tag } : false),
      })),
      toDOM: (node) => [CONTAINERS.includes(node.attrs.tag) ? node.attrs.tag : 'div', 0],
    },
    noneditable_inline: {
      inline: true,
      group: 'inline',
      content: 'inline*',
      atom: true,
      selectable: true,
      parseDOM: [
        {
          tag: 'span',
          priority: 80,
          getAttrs: (dom) => (locks(dom as HTMLElement) ? null : false),
        },
      ],
      toDOM: () => ['span', 0],
    },
    editable_inline: {
      inline: true,
      group: 'inline',
      content: 'inline*',
      parseDOM: [
        {
          tag: 'span',
          priority: 80,
          getAttrs: (dom) => (opens(dom as HTMLElement) ? null : false),
        },
      ],
      toDOM: () => ['span', 0],
    },
  };
}

// ---------- where content may change ----------

/** A node locks what is inside it, opens it again, or does neither. */
export function lockState(node: PMNode): 'locked' | 'open' | null {
  if (node.type.name === 'noneditable_inline') return 'locked';
  if (node.type.name === 'editable_inline') return 'open';
  const lock = node.attrs.lock as unknown;
  if (lock === 'class' || lock === 'attr') return 'locked';
  if (lock === 'open' || lock === 'open-attr') return 'open';
  return null;
}

/**
 * The region a position is in: the innermost locked node around it, or the opened part inside
 * one, or the document (start -1). Only a region that is open lets its content change. An opened
 * part counts only inside locked content: elsewhere it is ordinary content.
 */
export function regionAt(doc: PMNode, pos: number): { start: number; open: boolean } {
  const $pos = doc.resolve(pos);
  let region = { start: -1, open: true };
  let locked = false;
  for (let depth = 1; depth <= $pos.depth; depth++) {
    const state = lockState($pos.node(depth));
    if (state === 'locked') {
      region = { start: $pos.before(depth), open: false };
      locked = true;
    } else if (state === 'open' && locked) {
      region = { start: $pos.before(depth), open: true };
      locked = false;
    }
  }
  return region;
}

/** Whether a change from `from` to `to` stays within one open region (or covers locked nodes whole). */
function withinOpenRegion(doc: PMNode, from: number, to: number): boolean {
  const a = regionAt(doc, from);
  if (!a.open) return false;
  const b = from === to ? a : regionAt(doc, to);
  return b.open && a.start === b.start;
}

/**
 * Whether a step leaves locked content as it is (mark steps are allowed and corrected later).
 * `selected` is the locked piece selected when the change began, if one was.
 */
function stepAllowed(step: Step, doc: PMNode, selected: NodeSelection | null): boolean {
  if (step instanceof ReplaceStep) {
    // The selected locked piece replaced by something: typing or pasting over it (a click
    // selects it). It goes only when it is deleted on purpose.
    if (selected && step.slice.size && step.from === selected.from && step.to === selected.to) {
      return false;
    }
    return withinOpenRegion(doc, step.from, step.to);
  }
  if (step instanceof ReplaceAroundStep) {
    return (
      withinOpenRegion(doc, step.from, step.to) &&
      withinOpenRegion(doc, step.from, step.gapFrom) &&
      withinOpenRegion(doc, step.gapTo, step.to)
    );
  }
  if (
    step instanceof AttrStep ||
    step instanceof AddNodeMarkStep ||
    step instanceof RemoveNodeMarkStep
  ) {
    const pos = (step as unknown as { pos: number }).pos;
    const node = doc.nodeAt(pos);
    return !!node && withinOpenRegion(doc, pos, pos + (node.isLeaf ? 0 : 1));
  }
  return true;
}

/**
 * A transaction applied as it is: from another collaborator (or the documents would part), or an
 * undo / redo (it brings back a state the document already had, exactly).
 */
function passesAsIs(tr: Transaction): boolean {
  return (
    isHistoryTransaction(tr) ||
    !!(tr.getMeta('y-sync$') as { isChangeOrigin?: boolean } | undefined)?.isChangeOrigin
  );
}

/** Whether a document has anything locked (most don't: then nothing here costs anything). */
function hasLocks(doc: PMNode): boolean {
  let found = false;
  doc.descendants((node) => {
    if (found) return false;
    if (lockState(node) === 'locked') found = true;
    return !found;
  });
  return found;
}

/**
 * Formatting across locked content formats what is around it: the marks a step added to (or took
 * from) locked text are put back as they were, in the same transaction (one undo step).
 */
export function keepLockedMarks(tr: Transaction): Transaction {
  const count = tr.steps.length;
  for (let i = 0; i < count; i++) {
    const step = tr.steps[i];
    if (!(step instanceof AddMarkStep) && !(step instanceof RemoveMarkStep)) continue;
    // Comments may cover locked text: they don't change it.
    if (step.mark.type.name === 'comment') continue;
    const before = tr.docs[i]!;
    const adding = step instanceof AddMarkStep;
    const ranges: [number, number][] = [];
    before.nodesBetween(step.from, step.to, (node, pos) => {
      // An inline node in open content is formatted (a locked piece too, as a whole); only
      // what is inside locked content keeps its marks.
      if (!node.isInline || regionAt(before, pos).open) return true;
      // Only where the step changed something: added to text without it, taken from text with it.
      if (adding !== step.mark.isInSet(node.marks)) {
        ranges.push([Math.max(pos, step.from), Math.min(pos + node.nodeSize, step.to)]);
      }
      return true;
    });
    if (!ranges.length) continue;
    const map = tr.mapping.slice(i + 1);
    for (const [from, to] of ranges) {
      const a = map.map(from, 1);
      const b = map.map(to, -1);
      if (a >= b) continue;
      if (adding) tr.removeMark(a, b, step.mark);
      else tr.addMark(a, b, step.mark);
    }
  }
  return tr;
}

// ---------- the editor: decorations, selection, keys ----------

const key = new PluginKey<DecorationSet>('nova-noneditable');

/** Locked nodes can't be edited in the browser; opened parts inside them can. */
function decorationsFor(doc: PMNode): DecorationSet {
  const decorations: Decoration[] = [];
  const visit = (parent: PMNode, offset: number, locked: boolean) => {
    parent.forEach((child, childOffset) => {
      const pos = offset + childOffset;
      const state = lockState(child);
      let inside = locked;
      if (state === 'locked') {
        decorations.push(
          Decoration.node(pos, pos + child.nodeSize, {
            contenteditable: 'false',
            class: 'nova-locked',
          }),
        );
        inside = true;
      } else if (state === 'open' && locked) {
        decorations.push(
          Decoration.node(pos, pos + child.nodeSize, {
            contenteditable: 'true',
            class: 'nova-unlocked',
          }),
        );
        inside = false;
      }
      if (child.childCount) visit(child, pos + 1, inside);
    });
  };
  visit(doc, 0, false);
  return DecorationSet.create(doc, decorations);
}

/**
 * Whether a transaction may have added, removed or changed a locked or opened node (then the
 * decorations are drawn again; typing elsewhere only moves them).
 */
function touchesLocks(tr: Transaction): boolean {
  return tr.steps.some((step, i) => {
    if (step instanceof AttrStep) return step.attr === 'lock';
    if (!(step instanceof ReplaceStep) && !(step instanceof ReplaceAroundStep)) return false;
    let found = false;
    const check = (node: PMNode) => {
      if (lockState(node)) found = true;
      return !found;
    };
    step.slice.content.descendants(check);
    // Removing or changing one: it is in the replaced range of the document before the step.
    if (!found && step.from < step.to) tr.docs[i]!.nodesBetween(step.from, step.to, check);
    return found;
  });
}

/** The locked region to select instead of a cursor inside it, or null. */
function lockedRegionAround(state: EditorState, pos: number): NodeSelection | null {
  const region = regionAt(state.doc, pos);
  if (region.open) return null;
  const node = state.doc.nodeAt(region.start);
  return node && NodeSelection.isSelectable(node)
    ? NodeSelection.create(state.doc, region.start)
    : null;
}

/** Whether `pos` lies inside the node that starts at `start`. */
function inside(doc: PMNode, start: number, pos: number): boolean {
  const node = doc.nodeAt(start);
  return !!node && pos > start && pos < start + node.nodeSize;
}

/**
 * The locked region next to the cursor in a direction (an arrow key, Backspace, Delete at the edge
 * of a block), or null: the cursor would otherwise skip it or try to join with it.
 */
function lockedNext(state: EditorState, forward: boolean): NodeSelection | null {
  const selection = state.selection;
  if (!(selection instanceof TextSelection) || !selection.empty) return null;
  const $cursor = selection.$head;
  if (!$cursor.parent.isTextblock) return null;
  const edge = forward ? $cursor.after() : $cursor.before();
  const next = Selection.findFrom(state.doc.resolve(edge), forward ? 1 : -1);
  if (!next) return null;
  const found = lockedRegionAround(state, next.from);
  // A locked region around the cursor itself (the cursor is in an opened part of it) stays.
  if (!found || inside(state.doc, found.from, $cursor.pos)) return null;
  return found;
}

function protection(editor: Editor): Plugin {
  const labels = pickLabels(editor, 'noneditable', LABELS);
  return new Plugin<DecorationSet>({
    key,
    state: {
      init: (_, state) => decorationsFor(state.doc),
      apply: (tr, old, _before, state) => {
        if (!tr.docChanged) return old;
        return touchesLocks(tr) ? decorationsFor(state.doc) : old.map(tr.mapping, tr.doc);
      },
    },
    filterTransaction: (tr, state) => {
      // setContent replaces the whole document on purpose.
      if (!tr.docChanged || passesAsIs(tr) || tr.getMeta(SET_CONTENT_META)) return true;
      const { selection } = state;
      const selected =
        selection instanceof NodeSelection && lockState(selection.node) === 'locked'
          ? selection
          : null;
      return tr.steps.every((step, i) => stepAllowed(step, tr.docs[i]!, i === 0 ? selected : null));
    },
    // A cursor inside locked content (a click, an arrow key, the browser) selects the locked node.
    appendTransaction: (trs, _old, state) => {
      if (!trs.some((tr) => tr.selectionSet || tr.docChanged)) return null;
      const { selection } = state;
      if (!(selection instanceof TextSelection) || !selection.empty) return null;
      const region = lockedRegionAround(state, selection.from);
      return region ? state.tr.setSelection(region) : null;
    },
    props: {
      decorations: (state) => key.getState(state),
      handleClickOn: (view, pos, _node, _nodePos, _event, direct) => {
        if (!direct) return false;
        const region = lockedRegionAround(view.state, pos);
        if (!region) return false;
        view.dispatch(view.state.tr.setSelection(region));
        return true;
      },
      // Before every keymap (Backspace would otherwise try to join a block with the locked one
      // and do nothing): an arrow key or Backspace/Delete at the edge of a block next to locked
      // content selects that content, as it would an image.
      handleDOMEvents: {
        keydown: (view, event) => {
          const target = keyTarget(view, event);
          if (!target) return false;
          view.dispatch(view.state.tr.setSelection(target).scrollIntoView());
          event.preventDefault();
          return true;
        },
      },
    },
    view: () => {
      let said: number | null = null;
      return {
        update: (view) => {
          const { selection } = view.state;
          const lockedSelected =
            selection instanceof NodeSelection && lockState(selection.node) === 'locked';
          // Said once per selected node: why typing does nothing there.
          if (lockedSelected && said !== selection.from) editor.ui.announce(labels.locked);
          said = lockedSelected ? selection.from : null;
        },
      };
    },
  });
}

/** The locked content a key press should select, or null to let the press go on as usual. */
function keyTarget(view: EditorView, event: KeyboardEvent): NodeSelection | null {
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return null;
  if (event.isComposing || view.composing) return null;
  if (
    !['ArrowDown', 'ArrowUp', 'ArrowRight', 'ArrowLeft', 'Backspace', 'Delete'].includes(event.key)
  )
    return null;
  // This runs before ProseMirror's own key handling: take in a caret the browser has just moved
  // (Home, End, a click) first, as ProseMirror does before its keymaps.
  (
    view as unknown as { domObserver?: { forceFlush?(always?: boolean): void } }
  ).domObserver?.forceFlush?.(true);
  // Arrow keys are visual: in right-to-left text ArrowRight goes back.
  const rtl = view.dom.closest('[dir]')?.getAttribute('dir') === 'rtl';
  const { $head, empty } = view.state.selection;
  switch (event.key) {
    case 'ArrowDown':
    case 'ArrowUp': {
      const forward = event.key === 'ArrowDown';
      return view.endOfTextblock(forward ? 'down' : 'up') ? lockedNext(view.state, forward) : null;
    }
    case 'ArrowRight':
    case 'ArrowLeft': {
      const right = event.key === 'ArrowRight';
      return view.endOfTextblock(right ? 'right' : 'left')
        ? lockedNext(view.state, right !== rtl)
        : null;
    }
    case 'Backspace':
    case 'Delete': {
      if (!empty || !$head.parent.isTextblock) return null;
      const forward = event.key === 'Delete';
      const atEdge = forward
        ? $head.parentOffset === $head.parent.content.size
        : $head.parentOffset === 0;
      return atEdge ? lockedNext(view.state, forward) : null;
    }
    default:
      return null;
  }
}

export default definePlugin({
  name: 'noneditable',
  nodes: (editor) => nodesFor(classesOf(editor.options)),
  nodeAttributes: (editor) => ({ lock: lockAttribute(classesOf(editor.options)) }),
  prosemirrorPlugins: (editor) => [protection(editor)],
  transformTransaction: (tr, state) =>
    tr.docChanged && !passesAsIs(tr) && hasLocks(state.doc) ? keepLockedMarks(tr) : tr,
  setup: (editor) => {
    editor.ui.addStyles('nova-noneditable', css);
  },
});
