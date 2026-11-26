import {
  Fragment,
  Slice,
  type Mark,
  type MarkSpec,
  type MarkType,
  type Node as PMNode,
} from 'prosemirror-model';
import {
  Plugin,
  PluginKey,
  TextSelection,
  type EditorState,
  type Transaction,
} from 'prosemirror-state';
import { ReplaceStep } from 'prosemirror-transform';
import { Decoration, DecorationSet } from 'prosemirror-view';
import { keymap } from 'prosemirror-keymap';
import type { Editor } from '../editor';
import { definePlugin } from '../plugins';
import { pickLabels } from './shared';

/**
 * The suggestions plugin — suggesting mode (like "Suggesting" in Google Docs). In suggesting mode,
 * typing doesn't change the text directly: insertions are marked <ins>, deletions <del> (the text
 * stays until a decision). Every suggestion knows its author and time; it is accepted or rejected
 * one by one (the panel above it) or all at once. In HTML: `<ins data-suggestion="id" …>`.
 *
 * Inserting and deleting text is tracked. Structural changes (a new paragraph, a list, a format)
 * apply directly even in suggesting mode.
 */

export interface SuggestionAuthor {
  id: string;
  name: string;
}

export interface SuggestionsOptions {
  /** Who is suggesting. */
  author?: SuggestionAuthor;
  /** Start in suggesting mode. */
  enabled?: boolean;
  /** Suggestions only: the mode can't be turned off (someone who may not change the text directly). */
  force?: boolean;
  /** Whether this user can accept and reject suggestions (yes by default). */
  canReview?: boolean;
}

export interface Suggestion {
  id: string;
  kind: 'insert' | 'delete';
  author: SuggestionAuthor;
  time: number;
  from: number;
  to: number;
  text: string;
}

const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const USER_ID_RE = /^[\w.@:+-]{1,128}$/;

export const LABELS = {
  en: {
    toggle: 'Suggest edits',
    review: 'Review suggestions',
    accept: 'Accept',
    reject: 'Reject',
    acceptAll: 'Accept all suggestions',
    rejectAll: 'Reject all suggestions',
    next: 'Next suggestion',
    previous: 'Previous suggestion',
    inserted: 'Inserted by {name}',
    deleted: 'Deleted by {name}',
    toolbar: 'Suggestion',
    guest: 'Guest',
    none: 'No suggestions',
  },
};

export const suggestionsKey = new PluginKey<{ enabled: boolean }>('nova-suggestions');

/** The marker of the plugin's own transactions (accept/reject, toggling the mode): they aren't tracked. */
export const OWN = 'nova-suggestions-own';

/**
 * Author colors: the text of an edit in this color has a contrast of at least 6:1 on white, on the tinted
 * background (insertion) and in the dark theme (where the color is lightened by 45%). It was below 4.5:1 until axe caught it.
 */
const PALETTE = ['#116329', '#6639ba', '#99286e', '#0550ae', '#953800', '#0e5b5e'];

/** The color of an edit's author: the same for the same person. */
function colorFor(key: string): string {
  let hash = 0;
  for (const ch of String(key ?? '')) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return PALETTE[Math.abs(hash) % PALETTE.length]!;
}

function newId(): string {
  const bytes = new Uint8Array(9);
  globalThis.crypto.getRandomValues(bytes);
  return 's' + Array.from(bytes, (b) => (b % 36).toString(36)).join('');
}

function markSpec(kind: 'insert' | 'delete'): MarkSpec {
  const tag = kind === 'insert' ? 'ins' : 'del';
  return {
    attrs: { id: {}, author: { default: '' }, name: { default: '' }, time: { default: 0 } },
    inclusive: false,
    excludes: '',
    parseDOM: [
      {
        tag: `${tag}[data-suggestion]`,
        // Before the strike-through rules (<del> without data-suggestion is a regular strike-through).
        priority: 60,
        getAttrs: (dom) => {
          const el = dom as HTMLElement;
          const id = el.getAttribute('data-suggestion') ?? '';
          if (!ID_RE.test(id)) return false;
          const author = el.getAttribute('data-author') ?? '';
          return {
            id,
            author: USER_ID_RE.test(author) ? author : '',
            name: (el.getAttribute('data-name') ?? '').slice(0, 80),
            time: Number(el.getAttribute('data-time')) || 0,
          };
        },
      },
    ],
    toDOM: (mark: Mark) => [
      tag,
      {
        'data-suggestion': ID_RE.test(mark.attrs.id as string) ? mark.attrs.id : null,
        'data-author': USER_ID_RE.test(mark.attrs.author as string) ? mark.attrs.author : null,
        'data-name': String(mark.attrs.name ?? '').slice(0, 80) || null,
        'data-time': Number(mark.attrs.time) || null,
      },
      0,
    ],
  };
}

const typesOf = (schema: EditorState['schema']) => ({
  insert: schema.marks.suggestion_insert as MarkType,
  delete: schema.marks.suggestion_delete as MarkType,
});

/** Transactions that must not become suggestions. */
function isTracked(tr: Transaction): boolean {
  if (!tr.docChanged || tr.getMeta(OWN)) return false;
  if (tr.getMeta('addToHistory') === false) return false;
  // Undo/redo (own and shared history) and other participants' edits arrive ready-made.
  if (tr.getMeta('history$')) return false;
  const ySync = tr.getMeta('y-sync$') as { isChangeOrigin?: boolean } | undefined;
  if (ySync?.isChangeOrigin) return false;
  // Inserted and deleted text is tracked; structure (lists, wrappers, attributes) changes directly.
  return tr.steps.every((step) => step instanceof ReplaceStep);
}

/**
 * An edit by the same author right next to the position is continued with the same mark (id and time), otherwise
 * neighboring letters would become separate suggestions.
 */
function neighbourMark(doc: PMNode, pos: number, type: MarkType, authorId: string): Mark | null {
  const $pos = doc.resolve(pos);
  for (const node of [$pos.nodeBefore, $pos.nodeAfter]) {
    const mark = node?.marks.find((m) => m.type === type && m.attrs.author === authorId);
    if (mark) return mark;
  }
  return null;
}

function withMark(fragment: Fragment, mark: Mark, parent: PMNode['type'] | null): Fragment {
  const nodes: PMNode[] = [];
  fragment.forEach((node) => {
    if (node.isInline) {
      nodes.push(
        parent && !parent.allowsMarkType(mark.type) ? node : node.mark(mark.addToSet(node.marks)),
      );
    } else {
      nodes.push(node.copy(withMark(node.content, mark, node.type)));
    }
  });
  return Fragment.from(nodes);
}

/**
 * Turns a user's edit into a suggestion: what was deleted gets marked, what was inserted gets marked.
 * Your own insertion that isn't accepted yet is deleted for real (fixing a typo in your own suggestion).
 */
export function suggestTransaction(
  tr: Transaction,
  state: EditorState,
  author: SuggestionAuthor,
): Transaction {
  if (!isTracked(tr)) return tr;
  const types = typesOf(state.schema);
  const out = state.tr;
  const time = Date.now();
  // A position in the document of the original transaction (after step i) → a position in out.
  let toOut = (pos: number) => pos;
  let forwardDeleteEnd: number | null = null;
  // The end of what was inserted (for regular typing): the cursor goes right after it.
  let insertEnd: number | null = null;

  tr.steps.forEach((rawStep) => {
    const step = rawStep as ReplaceStep & { from: number; to: number; slice: Slice };
    const outStart = out.steps.length;
    const prev = toOut;
    let from = prev(step.from);
    let to = Math.max(from, prev(step.to));

    // 1. Deletion: mark it; your own insertions are deleted for real.
    if (to > from) {
      const own: { from: number; to: number }[] = [];
      const plain: { from: number; to: number }[] = [];
      out.doc.nodesBetween(from, to, (node, pos) => {
        if (!node.isInline) return true;
        const start = Math.max(pos, from);
        const end = Math.min(pos + node.nodeSize, to);
        if (start >= end) return false;
        const mine = node.marks.some(
          (m) => m.type === types.insert && m.attrs.author === author.id,
        );
        if (mine) own.push({ from: start, to: end });
        else if (!types.delete.isInSet(node.marks)) plain.push({ from: start, to: end });
        return false;
      });
      if (plain.length) {
        const first = plain[0]!;
        const mark =
          neighbourMark(out.doc, first.from, types.delete, author.id) ??
          neighbourMark(out.doc, plain[plain.length - 1]!.to, types.delete, author.id) ??
          types.delete.create({ id: newId(), author: author.id, name: author.name, time });
        for (const range of plain) out.addMark(range.from, range.to, mark);
      }
      for (const range of own.reverse()) out.delete(range.from, range.to);
      const map = out.mapping.slice(outStart);
      from = map.map(from, 1);
      to = map.map(to, -1);
      // Delete (forward) with the cursor at the start: the cursor jumps over the marked text.
      const sel = state.selection;
      if (
        tr.steps.length === 1 &&
        step.slice.size === 0 &&
        sel.empty &&
        sel.from === step.from &&
        tr.selection.head === step.from
      ) {
        forwardDeleteEnd = to;
      }
    }

    // 2. Insertion goes after the marked deleted text, marked "inserted". If the cursor is
    // right before the deleted text (a word erased with Backspace, then typing), it goes after it too: "~~May~~ June".
    if (step.slice.size > 0) {
      let at = to;
      if (!step.slice.openStart) {
        for (let next = out.doc.resolve(at).nodeAfter; next && types.delete.isInSet(next.marks);) {
          at += next.nodeSize;
          next = out.doc.resolve(at).nodeAfter;
        }
      }
      const mark =
        neighbourMark(out.doc, at, types.insert, author.id) ??
        types.insert.create({ id: newId(), author: author.id, name: author.name, time });
      const $at = out.doc.resolve(at);
      const content = withMark(
        step.slice.content,
        mark,
        step.slice.openStart ? null : $at.parent.type,
      );
      out.replace(at, at, new Slice(content, step.slice.openStart, step.slice.openEnd));
      if (tr.steps.length === 1) insertEnd = at + step.slice.size;
    }

    const inverse = step.getMap().invert();
    const outMap = out.mapping.slice(outStart);
    toOut = (pos) => outMap.map(prev(inverse.map(pos, -1)), 1);
  });

  // Selection: where the cursor would have ended up in the original transaction.
  if (forwardDeleteEnd !== null) {
    out.setSelection(TextSelection.create(out.doc, forwardDeleteEnd));
  } else if (insertEnd !== null && tr.selection.empty) {
    out.setSelection(TextSelection.create(out.doc, insertEnd));
  } else {
    const anchor = toOut(tr.selection.anchor);
    const head = toOut(tr.selection.head);
    try {
      out.setSelection(TextSelection.create(out.doc, anchor, head));
    } catch {
      // The position isn't in text (an image/table nearby): keep the default selection.
    }
  }
  for (const key of ['addToHistory', 'uiEvent', 'paste', 'scrollIntoView'] as const) {
    const value = tr.getMeta(key);
    if (value !== undefined) out.setMeta(key, value);
  }
  if (tr.scrolledIntoView) out.scrollIntoView();
  return out;
}

/** All suggestions in the document (consecutive parts of one suggestion are merged). */
export function listSuggestions(doc: PMNode): Suggestion[] {
  const types = typesOf(doc.type.schema);
  const result: Suggestion[] = [];
  doc.descendants((node, pos) => {
    if (!node.isInline) return true;
    for (const mark of node.marks) {
      const kind =
        mark.type === types.insert ? 'insert' : mark.type === types.delete ? 'delete' : null;
      if (!kind) continue;
      const last = result[result.length - 1];
      const text = node.isText ? node.text! : '';
      if (last && last.id === mark.attrs.id && last.kind === kind && last.to === pos) {
        last.to = pos + node.nodeSize;
        last.text += text;
      } else {
        result.push({
          id: mark.attrs.id as string,
          kind,
          author: { id: mark.attrs.author as string, name: mark.attrs.name as string },
          time: Number(mark.attrs.time) || 0,
          from: pos,
          to: pos + node.nodeSize,
          text,
        });
      }
    }
    return false;
  });
  return result;
}

/** Accept or reject suggestions (all of them, or those with the given ids). */
export function resolveSuggestions(
  state: EditorState,
  action: 'accept' | 'reject',
  ids?: readonly string[],
): Transaction {
  const types = typesOf(state.schema);
  const tr = state.tr.setMeta(OWN, true);
  const chosen = listSuggestions(state.doc).filter((s) => !ids || ids.includes(s.id));
  // Blocks whose text was removed (the position before the block).
  const emptied = new Set<number>();
  // From the end, so positions ahead don't shift.
  for (const s of [...chosen].sort((a, b) => b.from - a.from)) {
    const remove = (s.kind === 'insert') === (action === 'reject');
    if (remove) {
      emptied.add(state.doc.resolve(s.from).before());
      tr.delete(s.from, s.to);
    } else tr.removeMark(s.from, s.to, s.kind === 'insert' ? types.insert : types.delete);
  }
  // A block whose whole text was a suggestion goes with it: a new paragraph was rejected or the deletion
  // of a whole paragraph accepted, so no empty line is left (the paragraph break itself isn't tracked as a suggestion).
  for (const pos of [...emptied].sort((a, b) => b - a)) removeEmptyBlock(tr, tr.mapping.map(pos));
  return tr;
}

/**
 * Removes an empty text block if the content stays valid without it. If it can't (the only paragraph
 * of the document or a cell), it moves up to a parent made only of this block (a list
 * item, a quote); cells and other isolating nodes are left alone.
 */
function removeEmptyBlock(tr: Transaction, pos: number): void {
  const block = tr.doc.nodeAt(pos);
  if (!block?.isTextblock || block.content.size > 0) return;
  const $pos = tr.doc.resolve(pos);
  let from = pos;
  let to = pos + block.nodeSize;
  for (let depth = $pos.depth; ; depth--) {
    const parent = $pos.node(depth);
    const index = $pos.index(depth);
    if (parent.canReplace(index, index + 1)) {
      tr.delete(from, to);
      return;
    }
    if (depth === 0 || parent.childCount > 1 || parent.type.spec.isolating) return;
    from = $pos.before(depth);
    to = $pos.after(depth);
  }
}

/** The document without suggestions: as if all were accepted (accept) or all rejected (reject). */
export function suggestionsResult(editor: Editor, action: 'accept' | 'reject'): PMNode {
  return resolveSuggestions(editor.view.state, action).doc;
}

export function isSuggesting(state: EditorState): boolean {
  return suggestionsKey.getState(state)?.enabled ?? false;
}

export function setSuggesting(editor: Editor, enabled: boolean): void {
  const { state, dispatch } = editor.view;
  dispatch(state.tr.setMeta(suggestionsKey, { enabled }).setMeta(OWN, true));
  editor.updateUI();
}

export default definePlugin({
  name: 'suggestions',
  toolbar: 'suggestions reviewsuggestions',
  marks: {
    suggestion_insert: markSpec('insert'),
    suggestion_delete: markSpec('delete'),
  },
  prosemirrorPlugins: (editor) => {
    const options = (editor.options.pluginOptions?.suggestions ?? {}) as SuggestionsOptions;
    let cache: { doc: PMNode; set: DecorationSet } | null = null;
    return [
      new Plugin<{ enabled: boolean }>({
        key: suggestionsKey,
        state: {
          init: () => ({ enabled: !!(options.enabled || options.force) }),
          apply(tr, value) {
            const meta = tr.getMeta(suggestionsKey) as { enabled: boolean } | undefined;
            if (!meta) return value;
            return { enabled: options.force ? true : meta.enabled };
          },
        },
        props: {
          attributes: (state): Record<string, string> =>
            suggestionsKey.getState(state)?.enabled ? { class: 'nova-suggesting' } : {},
          decorations(state) {
            if (cache?.doc === state.doc) return cache.set;
            const labels = pickLabels(editor, 'suggestions', LABELS);
            const time = new Intl.DateTimeFormat(editor.options.language ?? 'en', {
              dateStyle: 'medium',
              timeStyle: 'short',
            });
            const set = DecorationSet.create(
              state.doc,
              listSuggestions(state.doc).map((s) =>
                Decoration.inline(s.from, s.to, {
                  title:
                    (s.kind === 'insert' ? labels.inserted : labels.deleted).replace(
                      '{name}',
                      s.author.name || labels.guest,
                    ) + (s.time ? ` · ${time.format(s.time)}` : ''),
                  class: s.kind === 'insert' ? 'nova-sugg-insert' : 'nova-sugg-delete',
                  style: `--nova-suggestion: ${colorFor(s.author.id || s.author.name)}`,
                }),
              ),
            );
            cache = { doc: state.doc, set };
            return set;
          },
        },
      }),
      keymap({
        // Ctrl/Cmd+Alt+Shift+E toggles suggesting mode.
        'Mod-Alt-Shift-e': () => {
          if (options.force) return false;
          setSuggesting(editor, !isSuggesting(editor.view.state));
          return true;
        },
      }),
    ];
  },
  transformTransaction(tr, state, editor) {
    if (!isSuggesting(state)) return tr;
    const options = (editor.options.pluginOptions?.suggestions ?? {}) as SuggestionsOptions;
    const labels = pickLabels(editor, 'suggestions', LABELS);
    const author = {
      id: USER_ID_RE.test(options.author?.id ?? '') ? options.author!.id : 'guest',
      name: String(options.author?.name || labels.guest).slice(0, 80),
    };
    return suggestTransaction(tr, state, author);
  },
  load: () => import('./suggestions-ui'),
});
