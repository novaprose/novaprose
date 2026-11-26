import { InputRule, inputRules } from 'prosemirror-inputrules';
import { keymap } from 'prosemirror-keymap';
import type { Node as PMNode } from 'prosemirror-model';
import { liftListItem, wrapInList } from 'prosemirror-schema-list';
import { Plugin, PluginKey, type Command, type EditorState } from 'prosemirror-state';
import { findWrapping } from 'prosemirror-transform';
import { Decoration, DecorationSet, type EditorView } from 'prosemirror-view';
import { convertList, findParentList, nodesOf } from '../commands';
import type { Editor } from '../editor';
import { definePlugin } from '../plugins';
import { icons } from '../ui/icons';
import css from './checklist.css?raw';
import { pickLabels } from './shared';

/**
 * The checklist plugin: task lists with checkboxes. `plugins: ['checklist']`, the `checklist` button
 * (as in TinyMCE). The checklist itself is a bulleted list with a flag (the core schema), so Enter, Tab,
 * indents, paste and Markdown work as with regular lists; the plugin adds the checkboxes,
 * Ctrl/Cmd+Enter, typing `[ ]` / `[x]` at the start of a line, and the styles.
 */

export const LABELS = { en: { checklist: 'Checklist', done: 'Done' } };

const SHORTCUT = 'Mod-Enter';

/** The checklist item under the cursor. */
function checklistItemAt(state: EditorState): { node: PMNode; pos: number } | null {
  const { $from } = state.selection;
  const nodes = nodesOf(state);
  for (let depth = $from.depth; depth > 0; depth--) {
    const node = $from.node(depth);
    if (node.type === nodes.list_item && typeof node.attrs.checked === 'boolean') {
      return { node, pos: $from.before(depth) };
    }
  }
  return null;
}

/** The cursor is in a checklist (to highlight the button). */
export function isChecklistActive(state: EditorState): boolean {
  return findParentList(state)?.node.attrs.checklist === true;
}

/**
 * The "Checklist" button: inside a checklist it removes the list; in another list it turns it into a checklist;
 * in text it wraps it into a new checklist.
 */
export const toggleChecklist: Command = (state, dispatch) => {
  const nodes = nodesOf(state);
  const list = findParentList(state);
  if (list?.node.attrs.checklist === true) return liftListItem(nodes.list_item)(state, dispatch);
  if (list) {
    if (dispatch) dispatch(convertList(state.tr, list, nodes.bullet_list, true).scrollIntoView());
    return true;
  }
  return wrapInList(nodes.bullet_list, { checklist: true })(
    state,
    dispatch &&
      ((tr) => {
        // New items get checked: false (a list item's default is null).
        const $pos = tr.doc.resolve(tr.mapping.map(state.selection.from));
        for (let depth = $pos.depth; depth > 0; depth--) {
          const node = $pos.node(depth);
          if (node.type === nodes.bullet_list && node.attrs.checklist === true) {
            convertList(tr, { node, pos: $pos.before(depth) }, nodes.bullet_list, true);
            break;
          }
        }
        dispatch(tr.scrollIntoView());
      }),
  );
};

/** Checks or unchecks the item under the cursor (Ctrl/Cmd+Enter). */
export const toggleChecklistItem: Command = (state, dispatch) => {
  const item = checklistItemAt(state);
  if (!item) return false;
  dispatch?.(
    state.tr.setNodeMarkup(item.pos, undefined, {
      ...item.node.attrs,
      checked: !item.node.attrs.checked,
    }),
  );
  return true;
};

/** `[ ] ` or `[x] ` at the start of a line makes a checklist item (in a regular list the whole list becomes one). */
function checklistInputRule(): InputRule {
  return new InputRule(/^\s*\[([ xX]?)\]\s$/, (state, match, start, end) => {
    const nodes = nodesOf(state);
    const checked = match[1]!.toLowerCase() === 'x';
    const tr = state.tr.delete(start, end);
    const $start = tr.doc.resolve(start);
    const itemDepth = $start.depth - 1;
    if (itemDepth > 0 && $start.node(itemDepth).type === nodes.list_item) {
      // Only in the item's first line; the list and the item are already in the document after "[ ] " is removed.
      if ($start.index(itemDepth) !== 0) return null;
      const list = { node: $start.node(itemDepth - 1), pos: $start.before(itemDepth - 1) };
      if (list.node.type !== nodes.bullet_list && list.node.type !== nodes.ordered_list)
        return null;
      convertList(tr, list, nodes.bullet_list, true);
      const itemPos = $start.before(itemDepth);
      tr.setNodeMarkup(itemPos, undefined, { ...tr.doc.nodeAt(itemPos)!.attrs, checked });
      return tr;
    }
    const range = $start.blockRange();
    const wrapping =
      range && findWrapping(range, nodes.bullet_list, { checklist: true }, undefined);
    if (!range || !wrapping) return null;
    wrapping[1] = { type: nodes.list_item, attrs: { checked } };
    tr.wrap(range, wrapping);
    // Right after another checklist: continue it instead of starting a new one.
    const listPos = range.start;
    const before = tr.doc.resolve(listPos).nodeBefore;
    if (before?.type === nodes.bullet_list && before.attrs.checklist === true) tr.join(listPos);
    return tr;
  });
}

/** Checkboxes on checklist items: a widget at the start of the item, checked on click. */
function checkboxes(editor: Editor, label: string): Plugin {
  const key = new PluginKey<DecorationSet>('nova-checklist');
  const build = (doc: PMNode): DecorationSet => {
    const decorations: Decoration[] = [];
    doc.descendants((node, pos) => {
      if (node.isTextblock) return false;
      if (node.type.name === 'list_item' && typeof node.attrs.checked === 'boolean') {
        const checked = node.attrs.checked;
        decorations.push(
          Decoration.widget(pos + 1, (view, getPos) => checkbox(view, getPos, checked), {
            side: -1,
            key: `nova-check-${checked}`,
            ignoreSelection: true,
            stopEvent: () => true,
          }),
        );
      }
      return true;
    });
    return DecorationSet.create(doc, decorations);
  };
  const checkbox = (view: EditorView, getPos: () => number | undefined, checked: boolean) => {
    const box = document.createElement('span');
    box.className = 'nova-check';
    box.contentEditable = 'false';
    box.setAttribute('role', 'checkbox');
    box.setAttribute('aria-checked', String(checked));
    box.setAttribute('aria-label', label);
    // On click, without preventDefault on mousedown: cancelling the press confused WebKit, and the next click
    // in the text put the cursor at the start of the document (found by e2e).
    box.addEventListener('click', () => {
      if (!editor.isEditable()) return;
      const at = getPos();
      if (at === undefined) return;
      const itemPos = at - 1;
      const node = view.state.doc.nodeAt(itemPos);
      if (node?.type.name !== 'list_item' || typeof node.attrs.checked !== 'boolean') return;
      view.dispatch(
        view.state.tr.setNodeMarkup(itemPos, undefined, { ...node.attrs, checked: !checked }),
      );
    });
    return box;
  };
  return new Plugin<DecorationSet>({
    key,
    state: {
      init: (_, state) => build(state.doc),
      apply: (tr, set) => (tr.docChanged ? build(tr.doc) : set),
    },
    props: { decorations: (state) => key.getState(state) },
  });
}

export default definePlugin({
  name: 'checklist',
  toolbar: 'checklist',
  prosemirrorPlugins: (editor) => [
    checkboxes(editor, pickLabels(editor, 'checklist', LABELS).done),
    keymap({ [SHORTCUT]: toggleChecklistItem }),
    inputRules({ rules: [checklistInputRule()] }),
  ],
  setup(editor) {
    editor.ui.addStyles('nova-checklist', css);
    const labels = pickLabels(editor, 'checklist', LABELS);
    editor.ui.registry.addToggleButton('checklist', {
      icon: icons.checklist,
      tooltip: labels.checklist,
      isEnabled: (e) => e.isEditable() && e.isAllowed('checklist'),
      isActive: (e) => isChecklistActive(e.view.state),
      onAction: (e) => e.exec(toggleChecklist),
    });
  },
});
