import { keymap } from 'prosemirror-keymap';
import { Fragment, type Node as PMNode } from 'prosemirror-model';
import {
  Plugin,
  PluginKey,
  TextSelection,
  type Command,
  type EditorState,
} from 'prosemirror-state';
import type { Editor } from '../editor';
import { definePlugin } from '../plugins';
import { icons } from '../ui/icons';
import { detailsAround, isOpen, LABELS, setOpen, summaryEnd, type Found } from './accordion';
import { pickLabels } from './shared';

/**
 * The lazy part of the accordion plugin: the `accordion` button, commands, keys and the cursor in collapsed blocks.
 * Enter in the title adds a new paragraph at the start of the content; Backspace at the start of the title removes
 * the frame (the text stays); Ctrl/Cmd+Enter in the title collapses or expands.
 */

/** Collapses or expands the block under the cursor; a cursor in hidden content moves to the title. */
export const toggleAccordion: Command = (state, dispatch) => {
  const details = detailsAround(state.selection.$from);
  if (!details) return false;
  if (dispatch) {
    const open = isOpen(details.node);
    const tr = setOpen(state.tr, details, !open);
    if (open && state.selection.from > summaryEnd(details)) {
      tr.setSelection(TextSelection.create(tr.doc, summaryEnd(details)));
    }
    dispatch(tr);
  }
  return true;
};

/** Expands (true), collapses (false) or toggles (undefined) every block in the document. */
export function toggleAllAccordions(open?: boolean): Command {
  return (state, dispatch) => {
    const all: Found[] = [];
    state.doc.descendants((node, pos) => {
      if (node.type.name === 'details') all.push({ node, pos });
      return !node.isTextblock;
    });
    if (!all.length) return false;
    if (dispatch) {
      const target = open ?? !all.every((d) => isOpen(d.node));
      const tr = state.tr;
      for (const details of all) setOpen(tr, details, target);
      // Collapsed: the cursor must not stay in the hidden part.
      const around = detailsAround(tr.selection.$from);
      if (!target && around && tr.selection.from > summaryEnd(around)) {
        tr.setSelection(TextSelection.create(tr.doc, summaryEnd(around)));
      }
      dispatch(tr);
    }
    return true;
  };
}

/**
 * Inserts a collapsible block: the selected blocks (or the block under the cursor) become its
 * content, the cursor goes into the empty title.
 */
export const insertAccordion: Command = (state, dispatch) => {
  const { details, details_summary: summary } = state.schema.nodes;
  if (!details || !summary) return false;
  const { $from, $to } = state.selection;
  const range = $from.blockRange($to, (parent) => !!parent.type.contentMatch.matchType(details));
  if (!range) return false;
  const blocks: PMNode[] = [];
  for (let i = range.startIndex; i < range.endIndex; i++) blocks.push(range.parent.child(i));
  const content = Fragment.from([summary.create(), ...blocks]);
  if (!details.validContent(content)) return false;
  if (!range.parent.canReplaceWith(range.startIndex, range.endIndex, details)) return false;
  if (dispatch) {
    const tr = state.tr.replaceWith(
      range.start,
      range.end,
      details.create({ open: true }, content),
    );
    tr.setSelection(TextSelection.create(tr.doc, range.start + 2));
    dispatch(tr.scrollIntoView());
  }
  return true;
};

/** Removes the frame: the title becomes a regular paragraph, the content stays in place. */
export const removeAccordion: Command = (state, dispatch) => {
  const details = detailsAround(state.selection.$from);
  if (!details) return false;
  if (dispatch) {
    const { node, pos } = details;
    const summary = node.firstChild!;
    const blocks: PMNode[] = [];
    if (summary.content.size)
      blocks.push(state.schema.nodes.paragraph!.create(null, summary.content));
    node.forEach((child, _offset, index) => {
      if (index > 0) blocks.push(child);
    });
    // Positions inside shift by the block's opening tag (and by the empty title if there is none).
    const shift = summary.content.size ? -1 : -1 - summary.nodeSize;
    const tr = state.tr.replaceWith(pos, pos + node.nodeSize, blocks);
    const head = Math.min(Math.max(state.selection.head + shift, pos), tr.doc.content.size);
    tr.setSelection(TextSelection.near(tr.doc.resolve(head)));
    dispatch(tr.scrollIntoView());
  }
  return true;
};

/** Enter in the title: the text after the cursor becomes a new paragraph at the start of the content (the block expands). */
const enterInSummary: Command = (state, dispatch) => {
  const { $from, $to } = state.selection;
  if ($from.parent.type.name !== 'details_summary' || !$from.sameParent($to)) return false;
  const details = detailsAround($from);
  if (!details) return false;
  if (dispatch) {
    const tr = state.tr.deleteSelection();
    const $cursor = tr.selection.$from;
    const rest = $cursor.parent.content.cut($cursor.parentOffset);
    const bodyStart = tr.mapping.map(summaryEnd(details)) + 1;
    const first = tr.doc.nodeAt(bodyStart);
    if (!rest.size && first?.type.name === 'paragraph' && first.content.size === 0) {
      // An empty first paragraph already exists: just move into it.
      tr.setSelection(TextSelection.create(tr.doc, bodyStart + 1));
    } else {
      tr.delete($cursor.pos, $cursor.end());
      const at = tr.mapping.map(bodyStart);
      tr.insert(at, state.schema.nodes.paragraph!.create(null, rest));
      tr.setSelection(TextSelection.create(tr.doc, at + 1));
    }
    if (!isOpen(details.node)) tr.setNodeAttribute(details.pos, 'open', true);
    dispatch(tr.scrollIntoView());
  }
  return true;
};

/** Backspace at the start of the title removes the frame (as with lists: leave the structure). */
const backspaceInSummary: Command = (state, dispatch) => {
  const { $from, empty } = state.selection;
  if (!empty || $from.parent.type.name !== 'details_summary' || $from.parentOffset > 0) {
    return false;
  }
  return removeAccordion(state, dispatch);
};

/** Ctrl/Cmd+Enter in the title collapses or expands. */
const toggleInSummary: Command = (state, dispatch) =>
  state.selection.$from.parent.type.name === 'details_summary' && toggleAccordion(state, dispatch);

function cursorPlugin(): Plugin {
  return new Plugin({
    key: new PluginKey('nova-accordion-cursor'),
    /**
     * A cursor in collapsed content is invisible, and typing would go into the hidden part. If the cursor was moved there
     * (search, undo, arrows), the block expands; if it ended up there because the content changed
     * (setContent, a co-author's edits), it moves to the title and the block stays collapsed.
     */
    appendTransaction(transactions, _old, state: EditorState) {
      if (!transactions.some((tr) => tr.selectionSet || tr.docChanged)) return null;
      const { $from } = state.selection;
      const hidden: Found[] = [];
      for (let depth = 1; depth <= $from.depth; depth++) {
        const node = $from.node(depth);
        // In the title (the first child) the cursor is visible even in a collapsed block.
        if (node.type.name === 'details' && !isOpen(node) && $from.index(depth) > 0) {
          hidden.push({ node, pos: $from.before(depth) });
        }
      }
      if (!hidden.length) return null;
      const tr = state.tr;
      if (transactions.some((t) => t.selectionSet)) {
        for (const details of hidden) setOpen(tr, details, true);
      } else {
        tr.setSelection(TextSelection.create(state.doc, summaryEnd(hidden[0]!)));
      }
      return tr;
    },
  });
}

export default definePlugin({
  name: 'accordion-ui',
  requires: ['accordion'],
  toolbar: 'accordion',
  prosemirrorPlugins: () => [
    cursorPlugin(),
    keymap({
      Enter: enterInSummary,
      Backspace: backspaceInSummary,
      'Mod-Enter': toggleInSummary,
    }),
  ],
  setup(editor) {
    const labels = pickLabels(editor, 'accordion', LABELS);
    const isEnabled = (e: Editor) => e.isEditable() && e.isAllowed('accordion');
    editor.ui.registry.addToggleButton('accordion', {
      icon: icons.accordion,
      tooltip: labels.accordion,
      isEnabled: (e) => isEnabled(e) && (e.can(insertAccordion) || e.can(removeAccordion)),
      isActive: (e) => !!detailsAround(e.view.state.selection.$from),
      // As with lists: inside a block, remove the frame; otherwise make a block.
      onAction: (e) =>
        e.exec(detailsAround(e.view.state.selection.$from) ? removeAccordion : insertAccordion),
    });
    editor.ui.registry.addMenuItem('accordion', {
      text: labels.accordion,
      icon: icons.accordion,
      onAction: (e) => e.exec(insertAccordion),
    });
  },
});
