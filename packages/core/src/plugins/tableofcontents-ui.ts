import type { Node as PMNode } from 'prosemirror-model';
import {
  Plugin,
  PluginKey,
  TextSelection,
  type Command,
  type EditorState,
  type Transaction,
} from 'prosemirror-state';
import type { Editor } from '../editor';
import { elementId } from '../element-id';
import { definePlugin } from '../plugins';
import { icons } from '../ui/icons';
import { LABELS, tocEntries, tocSettings, type TocEntry } from './tableofcontents';
import { pickLabels } from './shared';
import { replaceSelectionWithBlock } from '../commands';

/**
 * The lazy part of the tableofcontents plugin: the table of contents follows the headings (new, renamed,
 * deleted: the items update in the same edit, and undo rolls them back too), gives headings
 * stable ids and follows links inside the editor without changing the page address.
 */

/** A new heading id: short and random, so it won't clash between two co-authors. */
function newId(used: Set<string>): string {
  let id: string;
  do id = `toc-${Math.random().toString(36).slice(2, 8)}`;
  while (used.has(id));
  return id;
}

function sameEntries(value: unknown, entries: TocEntry[]): boolean {
  const current = tocEntries(value);
  return (
    Array.isArray(value) &&
    current.length === value.length &&
    current.length === entries.length &&
    current.every(
      (e, i) =>
        e.level === entries[i]!.level && e.id === entries[i]!.id && e.text === entries[i]!.text,
    )
  );
}

/**
 * Brings the tables of contents in line with the document's headings: ids for those without one or with a duplicate, and the items.
 * null means nothing to change (no table of contents, or it is already correct).
 */
export function syncTableOfContents(state: EditorState, depth: number): Transaction | null {
  const tocs: { node: PMNode; pos: number }[] = [];
  const headings: { node: PMNode; pos: number }[] = [];
  state.doc.descendants((node, pos) => {
    if (node.type.name === 'toc') tocs.push({ node, pos });
    else if (node.type.name === 'heading') headings.push({ node, pos });
    return !node.isTextblock && !node.isAtom;
  });
  if (!tocs.length) return null;
  const tr = state.tr;
  const used = new Set<string>();
  const entries: TocEntry[] = [];
  for (const { node, pos } of headings) {
    const level = Number(node.attrs.level);
    const text = node.textContent.trim();
    let id = elementId(node.attrs.id);
    const listed = level >= 1 && level <= depth && !!text;
    if (listed && (!id || used.has(id))) {
      id = newId(used);
      tr.setNodeAttribute(pos, 'id', id);
    }
    if (id) used.add(id);
    if (listed) entries.push({ level, id: id!, text: text.slice(0, 300) });
  }
  for (const toc of tocs) {
    if (!sameEntries(toc.node.attrs.entries, entries))
      tr.setNodeAttribute(toc.pos, 'entries', entries);
  }
  return tr.docChanged ? tr : null;
}

function tocPlugin(editor: Editor, depth: number): Plugin {
  return new Plugin({
    key: new PluginKey('nova-tableofcontents'),
    // In the same edit as the heading: undo rolls back the table of contents too.
    appendTransaction(transactions, _old, state) {
      return transactions.some((tr) => tr.docChanged) ? syncTableOfContents(state, depth) : null;
    },
    props: {
      handleDOMEvents: {
        // A table of contents link in the editor goes to the heading, without navigating the page address.
        click(view, event) {
          const target = event.target instanceof Element ? event.target : null;
          const link = target?.closest('a[href^="#"]');
          if (!link || !link.closest('nav[data-toc]') || !view.dom.contains(link)) return false;
          event.preventDefault();
          const id = link.getAttribute('href')!.slice(1);
          let found = -1;
          view.state.doc.descendants((node, pos) => {
            if (found >= 0) return false;
            if (node.type.name === 'heading' && node.attrs.id === id) found = pos;
            return !node.isTextblock;
          });
          if (found < 0) return true;
          const heading = view.state.doc.nodeAt(found)!;
          view.dispatch(
            view.state.tr
              .setSelection(TextSelection.create(view.state.doc, found + 1 + heading.content.size))
              .scrollIntoView(),
          );
          view.focus();
          return true;
        },
      },
    },
    view(view) {
      // The document loaded with an old table of contents (or from JSON without items): fix it right away.
      const tr = syncTableOfContents(view.state, depth);
      if (tr && editor.isEditable()) view.dispatch(tr.setMeta('addToHistory', false));
      return {};
    },
  });
}

/** Inserts a table of contents at the cursor (an empty paragraph is replaced). */
function insertToc(title: string | null): Command {
  return (state, dispatch) => {
    const type = state.schema.nodes.toc;
    if (!type) return false;
    const { $from } = state.selection;
    const index = $from.index(-1);
    const emptyBlock =
      $from.depth > 0 && $from.parent.isTextblock && $from.parent.content.size === 0;
    if (dispatch) {
      const node = type.create({ title, entries: [] });
      const tr =
        emptyBlock && $from.node(-1).canReplaceWith(index, index + 1, type)
          ? state.tr.replaceWith($from.before(), $from.after(), node)
          : replaceSelectionWithBlock(state.tr, node);
      dispatch(tr.scrollIntoView());
    }
    return true;
  };
}

export default definePlugin({
  name: 'tableofcontents-ui',
  requires: ['tableofcontents'],
  toolbar: 'tableofcontents',
  prosemirrorPlugins: (editor) => [tocPlugin(editor, tocSettings(editor).depth)],
  setup(editor) {
    const labels = pickLabels(editor, 'tableofcontents', LABELS);
    const settings = tocSettings(editor);
    const title = settings.title ?? labels.title;
    const insert = insertToc(title || null);
    const enabled = (e: Editor) => e.isEditable() && e.isAllowed('tableofcontents');
    editor.ui.registry.addButton('tableofcontents', {
      icon: icons.tableOfContents,
      tooltip: labels.insert,
      isEnabled: enabled,
      onAction: (e) => e.exec(insert),
    });
    // It updates by itself; the button is for TinyMCE configs (tableofcontentsupdate).
    editor.ui.registry.addButton('tableofcontentsupdate', {
      icon: icons.history,
      tooltip: labels.update,
      isEnabled: enabled,
      onAction: (e) => {
        const tr = syncTableOfContents(e.view.state, settings.depth);
        if (tr) e.view.dispatch(tr);
      },
    });
    editor.ui.registry.addMenuItem('tableofcontents', {
      text: labels.insert,
      icon: icons.tableOfContents,
      onAction: (e) => e.exec(insert),
    });
  },
});
