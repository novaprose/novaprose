import { Fragment, Slice, type Node as PMNode, type NodeType } from 'prosemirror-model';
import {
  NodeSelection,
  Plugin,
  PluginKey,
  TextSelection,
  type Command,
  type EditorState,
  type Transaction,
} from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';
import { REMOTE_CHANGE_META, type Editor } from '../editor';
import { definePlugin } from '../plugins';
import { icons } from '../ui/icons';
import { footnoteId } from './footnotes';
import { pickLabels } from './shared';

/**
 * The footnotes plugin's behavior: "Insert footnote" puts a reference at the cursor and the cursor into
 * its note; after every change to footnotes the references are numbered in order of appearance and the
 * section at the end holds exactly their notes, in that order. A deleted reference takes its note along,
 * a copied one gets its own note (a copy of the text), and the section goes away with the last footnote.
 *
 * Changes are as small as they can be: inserting a footnote inserts one note and deleting one deletes
 * one, so a co-author typing in another note keeps every letter. A note split by a paste (or by Enter
 * where the key doesn't reach us) is joined back with a line break: no text is dropped.
 */

export const LABELS = {
  en: {
    insert: 'Insert footnote',
    update: 'Update footnotes',
  },
};

interface SyncState {
  /** Whether the document has footnotes (counted again only after changes to them). */
  has: boolean;
  /** A co-author changed footnotes: the next change made here brings them in step. */
  dirty: boolean;
}

const syncKey = new PluginKey<SyncState>('nova-footnotes-sync');
/** Transaction meta: the id of a new footnote whose note gets the cursor. */
const FOCUS_NOTE = 'nova:footnote-focus';
const FOOTNOTE_NODES = new Set(['footnote_ref', 'footnote', 'footnotes']);

interface Found {
  pos: number;
  node: PMNode;
}

function scan(doc: PMNode): { refs: Found[]; sections: Found[] } {
  const refs: Found[] = [];
  const sections: Found[] = [];
  doc.descendants((node, pos) => {
    if (node.type.name === 'footnotes') {
      sections.push({ pos, node });
      return false;
    }
    // A paragraph with content it can't hold (JSON from elsewhere, a code block with a reference in
    // it): its references are left alone, a change there would throw.
    if (node.isTextblock && !node.type.validContent(node.content)) return false;
    if (node.type.name === 'footnote_ref') refs.push({ pos, node });
    return true;
  });
  return { refs, sections };
}

let warned = false;

/** syncFootnotes that never breaks the change it follows: a document it can't fix stays as it is. */
function safeSync(state: EditorState, focusId?: string): Transaction | null {
  try {
    return syncFootnotes(state, focusId);
  } catch (error) {
    if (!warned) {
      warned = true;
      console.warn('[nova] footnotes: could not bring them in step', error);
    }
    return null;
  }
}

function hasFootnotes(doc: PMNode): boolean {
  let found = false;
  doc.descendants((node) => {
    if (FOOTNOTE_NODES.has(node.type.name)) found = true;
    return !found;
  });
  return found;
}

const touchedCache = new WeakMap<Transaction, boolean>();

/**
 * Whether a transaction added, removed, cut or joined footnote nodes. Typing inside a note or anywhere
 * else doesn't count, so most keystrokes cost nothing here.
 */
function touchesFootnotes(tr: Transaction): boolean {
  const cached = touchedCache.get(tr);
  if (cached !== undefined) return cached;
  let touched = false;
  const check = (doc: PMNode, from: number, to: number) => {
    if (touched || from >= to) return;
    doc.nodesBetween(from, to, (node, pos) => {
      if (FOOTNOTE_NODES.has(node.type.name)) {
        const end = pos + node.nodeSize;
        // Its start or its end is in the range: the node itself comes, goes or is cut.
        if ((pos >= from && pos < to) || (end > from && end <= to)) touched = true;
      }
      return !touched;
    });
  };
  tr.steps.forEach((step, index) => {
    step.getMap().forEach((oldStart, oldEnd, newStart, newEnd) => {
      check(tr.docs[index]!, oldStart, oldEnd);
      check(tr.docs[index + 1] ?? tr.doc, newStart, newEnd);
    });
  });
  touchedCache.set(tr, touched);
  return touched;
}

/** A new footnote id, not used yet. */
function freshId(used: Set<string>): string {
  let id = '';
  do id = Math.random().toString(36).slice(2, 10);
  while (!id || used.has(id));
  used.add(id);
  return id;
}

/** A note as it will be: its id, its content and the node it comes from while that stays as it is. */
interface Note {
  id: string;
  content: Fragment;
  from: Found | null;
}

/** Where the cursor goes back to: the note node it was in, the note it belongs to and the offset there. */
interface CursorSpot {
  child: Found;
  id: string;
  offset: number;
}

/**
 * The notes of the sections by id (the first note with an id wins). A stray piece — a note without an
 * id or with an id taken already, left by a paste or a split — joins the note before it after a line
 * break (or the next note, when it comes first), so its text stays.
 */
function collectNotes(
  state: EditorState,
  sections: Found[],
): { notes: Map<string, Note>; children: Found[]; cursor: CursorSpot | null } {
  const breakType = state.schema.nodes.hard_break;
  const separator = breakType ? Fragment.from(breakType.create()) : Fragment.empty;
  const head = state.selection.head;
  const notes = new Map<string, Note>();
  const children: Found[] = [];
  let cursor: CursorSpot | null = null;
  for (const section of sections) {
    let previous: Note | null = null;
    // Stray pieces before the section's first note: they go to the start of that note.
    let lead: Fragment | null = null;
    let leadCursor: { child: Found; offset: number } | null = null;
    section.node.forEach((node, offset) => {
      const child: Found = { pos: section.pos + 1 + offset, node };
      children.push(child);
      const inside = head > child.pos && head < child.pos + node.nodeSize;
      const at = head - child.pos - 1;
      const id = footnoteId(node.attrs.id);
      if (id && !notes.has(id)) {
        const note: Note = { id, content: node.content, from: child };
        let shift = 0;
        if (lead?.size) {
          shift = lead.size + separator.size;
          note.content = lead.append(separator).append(node.content);
          note.from = null;
        }
        if (leadCursor) cursor = { child: leadCursor.child, id, offset: leadCursor.offset };
        if (inside) cursor = { child, id, offset: shift + at };
        lead = null;
        leadCursor = null;
        notes.set(id, note);
        previous = note;
        return;
      }
      if (!previous) {
        const base = lead?.size ? lead.size + (node.content.size ? separator.size : 0) : 0;
        if (inside) leadCursor = { child, offset: base + at };
        lead = lead?.size ? (node.content.size ? lead.append(separator) : lead) : Fragment.empty;
        lead = lead.append(node.content);
        return;
      }
      const target: Note = previous;
      const base = target.content.size + (node.content.size ? separator.size : 0);
      if (node.content.size) {
        target.content = target.content.append(separator).append(node.content);
        target.from = null;
      }
      if (inside) cursor = { child, id: target.id, offset: base + at };
    });
  }
  return { notes, children, cursor };
}

/** Indexes (into `values`) of a longest increasing run, not necessarily adjacent. */
function increasing(values: number[]): number[] {
  const tails: number[] = [];
  const previous: number[] = values.map(() => -1);
  values.forEach((value, index) => {
    let low = 0;
    let high = tails.length;
    while (low < high) {
      const middle = (low + high) >> 1;
      if (values[tails[middle]!]! < value) low = middle + 1;
      else high = middle;
    }
    if (low > 0) previous[index] = tails[low - 1]!;
    tails[low] = index;
  });
  const out: number[] = [];
  for (let index = tails.length ? tails[tails.length - 1]! : -1; index >= 0;) {
    out.push(index);
    index = previous[index]!;
  }
  return out.reverse();
}

/**
 * The one section at the end, put in step by inserting and deleting single notes: the notes that are
 * wanted, unchanged and already in order stay as they are. Returns the note nodes that stayed.
 */
function patchSection(
  tr: Transaction,
  section: Found,
  wanted: Note[],
  children: Found[],
  noteType: NodeType,
): Set<Found> {
  const order = new Map(wanted.map((note, index) => [note, index]));
  const present = wanted.filter((note) => note.from).sort((a, b) => a.from!.pos - b.from!.pos);
  const keep = new Set(increasing(present.map((note) => order.get(note)!)).map((i) => present[i]!));
  // Inserts first, so the section always has a note (its content can't be empty).
  let at = tr.mapping.map(section.pos + 1);
  for (const note of wanted) {
    if (keep.has(note)) {
      at = tr.mapping.map(note.from!.pos) + note.from!.node.nodeSize;
      continue;
    }
    const node = noteType.create({ id: note.id }, note.content);
    tr.insert(at, node);
    at += node.nodeSize;
  }
  const staying = new Set([...keep].map((note) => note.from!));
  for (let index = children.length - 1; index >= 0; index--) {
    const child = children[index]!;
    if (staying.has(child)) continue;
    // The end sticks to the left: a note inserted right after this one is not deleted with it.
    tr.delete(tr.mapping.map(child.pos), tr.mapping.map(child.pos + child.node.nodeSize, -1));
  }
  return staying;
}

/** The cursor into a note of the section at the end. */
function placeCursor(tr: Transaction, id: string, offset: number): void {
  const section = tr.doc.lastChild;
  if (!section || section.type.name !== 'footnotes') return;
  let pos = tr.doc.content.size - section.nodeSize + 1;
  section.forEach((note) => {
    if (footnoteId(note.attrs.id) === id) {
      const inNote = Math.max(0, Math.min(offset, note.content.size));
      tr.setSelection(TextSelection.create(tr.doc, pos + 1 + inNote));
    }
    pos += note.nodeSize;
  });
}

/** Brings references and notes in step; null when they already are. */
export function syncFootnotes(state: EditorState, focusId?: string): Transaction | null {
  const { schema } = state;
  const refType = schema.nodes.footnote_ref;
  const sectionType = schema.nodes.footnotes;
  const noteType = schema.nodes.footnote;
  if (!refType || !sectionType || !noteType) return null;
  const { refs, sections } = scan(state.doc);
  const { notes, children, cursor } = collectNotes(state, sections);
  const tr = state.tr;

  // References: numbered in order. A copy (its id seen before) or one without an id gets a new id
  // and a note of its own with a copy of the text.
  const used = new Set<string>(notes.keys());
  for (const { node } of refs) used.add(footnoteId(node.attrs.id));
  const seen = new Set<string>();
  const wanted: Note[] = [];
  refs.forEach(({ pos, node }, index) => {
    const original = footnoteId(node.attrs.id);
    const note = notes.get(original);
    const id = original && !seen.has(original) ? original : freshId(used);
    seen.add(id);
    // Attribute steps: the reference stays the same node (a selection on it too).
    if (node.attrs.id !== id) tr.setNodeAttribute(pos, 'id', id);
    if (node.attrs.number !== index + 1) tr.setNodeAttribute(pos, 'number', index + 1);
    wanted.push(
      id === original && note ? note : { id, content: note?.content ?? Fragment.empty, from: null },
    );
  });

  let staying = new Set<Found>();
  const last = sections[sections.length - 1];
  const atEnd =
    sections.length === 1 && last && last.pos + last.node.nodeSize === state.doc.content.size;
  if (wanted.length && atEnd) {
    staying = patchSection(tr, last, wanted, children, noteType);
  } else if (wanted.length || sections.length) {
    // Several sections, or text after the section: one section at the end, built anew.
    for (const { pos, node } of [...sections].reverse()) {
      const from = tr.mapping.map(pos);
      const to = tr.mapping.map(pos + node.nodeSize);
      // The document can't be left empty.
      if (tr.doc.childCount === 1 && !wanted.length) {
        tr.replaceWith(from, to, schema.nodes.paragraph!.create());
      } else tr.delete(from, to);
    }
    if (wanted.length) {
      const notesNodes = wanted.map((note) => noteType.create({ id: note.id }, note.content));
      tr.insert(tr.doc.content.size, sectionType.create(null, notesNodes));
    }
  }

  // The cursor stays in its note, or goes into a new one.
  if (focusId) placeCursor(tr, focusId, 0);
  else if (cursor && !staying.has(cursor.child)) placeCursor(tr, cursor.id, cursor.offset);
  return tr.docChanged || tr.selectionSet ? tr : null;
}

/** Where the cursor is inside a note, if it is. */
function inNote(state: EditorState): boolean {
  const { $from } = state.selection;
  for (let depth = $from.depth; depth > 0; depth--) {
    if ($from.node(depth).type.name === 'footnote') return true;
  }
  return false;
}

/** Inserts a reference after the selection; its note is created and gets the cursor. */
export const insertFootnote: Command = (state, dispatch) => {
  const refType = state.schema.nodes.footnote_ref;
  if (!refType) return false;
  const { $to } = state.selection;
  if (!$to.parent.inlineContent) return false;
  // A paragraph with content it can't hold (JSON from elsewhere) can't be asked what fits in it.
  if (!$to.parent.type.validContent($to.parent.content)) return false;
  if (!$to.parent.canReplaceWith($to.index(), $to.index(), refType)) return false;
  // Not inside a note: a footnote of a footnote has nowhere to go.
  if (inNote(state)) return false;
  if (dispatch) {
    const { refs, sections } = scan(state.doc);
    const used = new Set(refs.map(({ node }) => footnoteId(node.attrs.id)));
    for (const { node } of sections) node.forEach((note) => used.add(footnoteId(note.attrs.id)));
    const id = freshId(used);
    dispatch(
      state.tr
        .insert($to.pos, refType.create({ id, number: 1 }))
        .setMeta(FOCUS_NOTE, id)
        .scrollIntoView(),
    );
  }
  return true;
};

/** Numbers and notes brought in step now (they are kept in step after every change anyway). */
export const updateFootnotes: Command = (state, dispatch) => {
  const tr = safeSync(state);
  if (tr && dispatch) dispatch(tr);
  return true;
};

/**
 * Keys in a note: Enter is a line break (a note is one paragraph), Backspace at its start and Delete at
 * its end don't join it with the next note. On keydown, so this comes before the editor's keymap.
 */
/**
 * Pasted into a note: paragraphs become lines of the note (a note is one paragraph; otherwise the paste
 * would carry the rest of the note out into the text). Footnote references don't go into notes.
 */
function pastedIntoNote(slice: Slice, view: EditorView): Slice {
  const { $from } = view.state.selection;
  if ($from.parent.type.name !== 'footnote') return slice;
  const breakType = view.state.schema.nodes.hard_break;
  const inline: PMNode[] = [];
  let lines = 0;
  const take = (node: PMNode) => {
    if (node.type.name !== 'footnote_ref') inline.push(node);
  };
  slice.content.descendants((node) => {
    if (node.isInline) {
      take(node);
      return false;
    }
    if (!node.isTextblock) return true;
    if (lines++ && breakType) inline.push(breakType.create());
    node.forEach(take);
    return false;
  });
  return new Slice(Fragment.from(inline), 0, 0);
}

function noteKeys(view: EditorView, event: KeyboardEvent): boolean {
  if (!view.editable || event.isComposing || event.keyCode === 229) return false;
  if (event.altKey || event.ctrlKey || event.metaKey) return false;
  const { state } = view;
  const { $from, $to, empty } = state.selection;
  if ($from.parent.type.name !== 'footnote' || !$from.sameParent($to)) return false;
  let handled = false;
  if (event.key === 'Enter' && !event.shiftKey) {
    const breakType = state.schema.nodes.hard_break;
    if (breakType)
      view.dispatch(state.tr.replaceSelectionWith(breakType.create()).scrollIntoView());
    handled = true;
  } else if (event.key === 'Backspace' && empty && $from.parentOffset === 0) {
    handled = true;
  } else if (event.key === 'Delete' && empty && $from.parentOffset === $from.parent.content.size) {
    handled = true;
  }
  if (handled) event.preventDefault();
  return handled;
}

/** The reference of a note, or the note of a reference: where a click on it leads. */
function jumpTo(editor: Editor, target: 'ref' | 'note', id: string): boolean {
  const { state } = editor.view;
  let found: number | null = null;
  state.doc.descendants((node, pos) => {
    if (found !== null) return false;
    const type = target === 'ref' ? 'footnote_ref' : 'footnote';
    if (node.type.name === type && footnoteId(node.attrs.id) === id) found = pos;
    return true;
  });
  if (found === null) return false;
  const selection =
    target === 'ref'
      ? NodeSelection.create(state.doc, found)
      : TextSelection.create(state.doc, found + 1);
  editor.view.dispatch(state.tr.setSelection(selection).scrollIntoView());
  editor.focus();
  return true;
}

export default definePlugin({
  name: 'footnotes-ui',
  requires: ['footnotes'],
  toolbar: 'footnotes',
  prosemirrorPlugins: (editor) => [
    new Plugin<SyncState>({
      key: syncKey,
      state: {
        init: (_config, state) => ({ has: hasFootnotes(state.doc), dirty: false }),
        apply(tr, value, _old, state) {
          if (!tr.docChanged) return value;
          const touched = touchesFootnotes(tr);
          return {
            has: touched ? hasFootnotes(state.doc) : value.has,
            dirty: tr.getMeta(REMOTE_CHANGE_META) ? value.dirty || touched : false,
          };
        },
      },
      appendTransaction(transactions, oldState, state) {
        // A co-author's change was put in step on their side; if not (two people at once), the next
        // change made here does it.
        const local = transactions.filter((tr) => tr.docChanged && !tr.getMeta(REMOTE_CHANGE_META));
        if (!local.length) return null;
        const focus = local.map((tr) => tr.getMeta(FOCUS_NOTE) as string | undefined).find(Boolean);
        const needed =
          !!focus ||
          !!syncKey.getState(oldState)?.dirty ||
          local.some(touchesFootnotes) ||
          // Text typed after the section: the section moves back to the end.
          (!!syncKey.getState(state)?.has && state.doc.lastChild?.type.name !== 'footnotes');
        return needed ? safeSync(state, focus) : null;
      },
      props: {
        transformPasted: pastedIntoNote,
        handleDOMEvents: {
          keydown: noteKeys,
          click: (_view, event) => {
            const target = event.target as HTMLElement | null;
            const back = target?.closest?.('a.mce-footnotes-backlink');
            if (back) {
              event.preventDefault();
              const id = footnoteId(back.getAttribute('href')?.replace(/^#footnote-ref-/, ''));
              return jumpTo(editor, 'ref', id);
            }
            const ref = target?.closest?.('sup.mce-footnote');
            if (ref) {
              event.preventDefault();
              const id = footnoteId(
                ref
                  .querySelector('a')
                  ?.getAttribute('href')
                  ?.replace(/^#footnote-/, ''),
              );
              return jumpTo(editor, 'note', id);
            }
            return false;
          },
        },
      },
    }),
  ],
  setup(editor) {
    const labels = pickLabels(editor, 'footnotes', LABELS);
    const isEnabled = (e: Editor) => e.isEditable() && e.isAllowed('footnotes');
    editor.ui.registry.addButton('footnotes', {
      icon: icons.footnote,
      tooltip: labels.insert,
      isEnabled: (e) => isEnabled(e) && e.can(insertFootnote),
      onAction: (e) => e.exec(insertFootnote),
    });
    editor.ui.registry.addMenuItem('footnotes', {
      text: labels.insert,
      icon: icons.footnote,
      isEnabled: (e) => isEnabled(e) && e.can(insertFootnote),
      onAction: (e) => e.exec(insertFootnote),
    });
    editor.ui.registry.addButton('footnotesupdate', {
      icon: icons.footnotesUpdate,
      tooltip: labels.update,
      isEnabled,
      onAction: (e) => e.exec(updateFootnotes),
    });
    // Footnotes loaded with the content (before this part) get their numbers and notes in step.
    const tr = safeSync(editor.view.state);
    if (tr) editor.view.dispatch(tr.setMeta('addToHistory', false));
  },
});
