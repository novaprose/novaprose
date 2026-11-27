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
import { AddMarkStep, RemoveMarkStep, ReplaceStep } from 'prosemirror-transform';
import { Decoration, DecorationSet } from 'prosemirror-view';
import { keymap } from 'prosemirror-keymap';
import type { Editor } from '../editor';
import type { NodeAttribute } from '../schema';
import { SET_CONTENT_META } from '../meta';
import { definePlugin } from '../plugins';
import { pickLabels } from './shared';

/**
 * The suggestions plugin — suggesting mode (like "Suggesting" in Google Docs). In suggesting mode,
 * typing doesn't change the text directly: insertions are marked <ins>, deletions <del> (the text
 * stays until a decision). Every suggestion knows its author and time; it is accepted or rejected
 * one by one (the panel above it) or all at once. In HTML: `<ins data-suggestion="id" …>`.
 *
 * Inserting and deleting text is tracked, and so is text formatting (bold, a color, a link…): the
 * new formatting shows at once, and the text remembers what it was, to go back to it if the
 * suggestion is rejected (`<span data-suggestion="id" data-format="[…]">`). So is a block's type
 * and style (a heading instead of a paragraph, alignment, indent): the block remembers what it was
 * (`<h2 data-suggestion="id" data-before='{"type":"paragraph"}'>`). Other structural changes (a new
 * paragraph, a list) apply directly even in suggesting mode.
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
  /** insert and delete: text; format: the text's formatting changed; block: a block's type or style. */
  kind: 'insert' | 'delete' | 'format' | 'block';
  author: SuggestionAuthor;
  time: number;
  from: number;
  to: number;
  text: string;
  /** format: the formatting (mark names) the text got, and the formatting it lost. */
  added?: string[];
  removed?: string[];
  /** block: what the block was before: its type and attributes. */
  before?: BlockBefore;
}

export interface BlockBefore {
  type: string;
  attrs: Record<string, string | number | boolean | null>;
}

/** A suggested change of a block's type or style, kept on the block (its `suggestion` attribute). */
export interface BlockSuggestion {
  id: string;
  author: string;
  name: string;
  time: number;
  before: BlockBefore;
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
    formatted: 'Formatted by {name}',
    toolbar: 'Suggestion',
    guest: 'Guest',
    none: 'No suggestions',
  },
};

export const suggestionsKey = new PluginKey<{ enabled: boolean }>('nova-suggestions');

/** The marker of the plugin's own transactions (accept/reject, toggling the mode): they aren't tracked. */
export const OWN = 'nova-suggestions-own';

/** On a transaction that accepts or rejects suggestions: `{ action, ids }`. */
export const RESOLVED = 'nova-suggestions-resolved';

/**
 * Author colors: the text of an edit in this color has a contrast of at least 6:1 on white, on the tinted
 * background (insertion) and in the dark theme (where the color is lightened by 45%). It was below 4.5:1 until axe caught it.
 */
const PALETTE = ['#116329', '#6639ba', '#99286e', '#0550ae', '#953800', '#0e5b5e'];

/** The color of an edit's author: the same for the same person (by id, or by name without one). */
export function suggestionColor(key: string): string {
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

/**
 * What the text's formatting was before a suggested change: a list of marks as JSON (`[{"type":
 * "bold"}, {"type": "color", "attrs": {…}}]`). From HTML or JSON it can be anything, so it is cleaned:
 * mark names only, plain attribute values, at most 16 marks; anything else becomes `[]`.
 */
export function cleanFormat(value: unknown): string {
  let list: unknown;
  try {
    list = typeof value === 'string' ? JSON.parse(value) : value;
  } catch {
    return '[]';
  }
  if (!Array.isArray(list)) return '[]';
  const out: { type: string; attrs?: Record<string, string | number | boolean | null> }[] = [];
  for (const item of list.slice(0, 16)) {
    const type = (item as { type?: unknown } | null)?.type;
    if (typeof type !== 'string' || !/^[a-z][a-z0-9_]{0,39}$/.test(type)) continue;
    const attrs = cleanAttrs((item as { attrs?: unknown }).attrs, 8);
    out.push(Object.keys(attrs).length ? { type, attrs } : { type });
  }
  return JSON.stringify(out);
}

/** Plain attribute values only (short strings, numbers, booleans, null), at most `max` of them. */
function cleanAttrs(raw: unknown, max: number): BlockBefore['attrs'] {
  const attrs: BlockBefore['attrs'] = {};
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    for (const [key, attr] of Object.entries(raw).slice(0, max)) {
      if (!/^[A-Za-z][\w-]{0,39}$/.test(key) || key === 'suggestion') continue;
      if (typeof attr === 'string') attrs[key] = attr.slice(0, 2000);
      else if (typeof attr === 'number' || typeof attr === 'boolean' || attr === null)
        attrs[key] = attr;
    }
  }
  return attrs;
}

/**
 * A block suggestion from a block's attribute, or null. It comes from HTML or JSON, so it can be
 * anything: only an id, an author, a time and a type name with plain attribute values are kept.
 */
export function blockSuggestion(value: unknown): BlockSuggestion | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  let before = raw.before;
  try {
    if (typeof before === 'string') before = JSON.parse(before);
  } catch {
    return null;
  }
  const type = (before as { type?: unknown } | null)?.type;
  if (typeof raw.id !== 'string' || !ID_RE.test(raw.id)) return null;
  if (typeof type !== 'string' || !/^[a-z][a-z0-9_]{0,39}$/.test(type)) return null;
  const author = String(raw.author ?? '');
  return {
    id: raw.id,
    author: USER_ID_RE.test(author) ? author : '',
    name: String(raw.name ?? '').slice(0, 80),
    time: Number(raw.time) || 0,
    before: { type, attrs: cleanAttrs((before as { attrs?: unknown }).attrs, 12) },
  };
}

/** The suggestion attribute of blocks, read from and written to the block's element. */
const blockAttribute: NodeAttribute = {
  nodes: 'textblock',
  default: null,
  parse: (dom) =>
    dom.hasAttribute('data-before')
      ? blockSuggestion({
          id: dom.getAttribute('data-suggestion'),
          author: dom.getAttribute('data-author'),
          name: dom.getAttribute('data-name'),
          time: dom.getAttribute('data-time'),
          before: dom.getAttribute('data-before'),
        })
      : null,
  render(value) {
    const s = blockSuggestion(value);
    if (!s) return {};
    const out: Record<string, string> = {
      'data-suggestion': s.id,
      'data-before': JSON.stringify(s.before),
    };
    if (s.author) out['data-author'] = s.author;
    if (s.name) out['data-name'] = s.name;
    if (s.time) out['data-time'] = String(s.time);
    return out;
  },
};

/** Where the block tracker plugs in (suggestions-blocks.ts, loaded with the plugin's interface). */
type BlockTracker = (
  tr: Transaction,
  state: EditorState,
  author: SuggestionAuthor,
) => Transaction | null;
let trackBlocks: BlockTracker | null = null;
export function setBlockTracker(tracker: BlockTracker): void {
  trackBlocks = tracker;
}

function formatSpec(): MarkSpec {
  return {
    attrs: {
      id: {},
      author: { default: '' },
      name: { default: '' },
      time: { default: 0 },
      before: { default: '[]' },
    },
    inclusive: false,
    excludes: '',
    parseDOM: [
      {
        tag: 'span[data-suggestion][data-format]',
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
            before: cleanFormat(el.getAttribute('data-format')),
          };
        },
      },
    ],
    toDOM: (mark: Mark) => [
      'span',
      {
        'data-suggestion': ID_RE.test(mark.attrs.id as string) ? mark.attrs.id : null,
        'data-format': cleanFormat(mark.attrs.before),
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
  format: schema.marks.suggestion_format as MarkType,
});

/** Marks that aren't formatting: suggestions themselves and comments. */
const NOT_FORMATTING = new Set([
  'suggestion_insert',
  'suggestion_delete',
  'suggestion_format',
  'comment',
]);

const formatting = (marks: readonly Mark[]) =>
  marks.filter((m) => !NOT_FORMATTING.has(m.type.name));

/** The marks of a `before` list that this schema knows (others are left out, never an error). */
export function formatMarks(schema: EditorState['schema'], before: unknown): Mark[] {
  const marks: Mark[] = [];
  for (const json of JSON.parse(cleanFormat(before)) as { type: string }[]) {
    if (NOT_FORMATTING.has(json.type) || !schema.marks[json.type]) continue;
    try {
      const mark = schema.markFromJSON(json);
      if (!mark.isInSet(marks)) marks.push(mark);
    } catch {
      // Attributes the mark doesn't take: without this mark.
    }
  }
  return marks;
}

const sameMarks = (a: readonly Mark[], b: readonly Mark[]) =>
  a.length === b.length && a.every((mark) => mark.isInSet(b));

/** Transactions that must not become suggestions. */
function isTracked(tr: Transaction): boolean {
  if (!tr.docChanged || tr.getMeta(OWN)) return false;
  if (tr.getMeta('addToHistory') === false) return false;
  // setContent loads a document: that is not an edit to suggest.
  if (tr.getMeta(SET_CONTENT_META)) return false;
  // Undo/redo (own and shared history) and other participants' edits arrive ready-made.
  if (tr.getMeta('history$')) return false;
  const ySync = tr.getMeta('y-sync$') as { isChangeOrigin?: boolean } | undefined;
  if (ySync?.isChangeOrigin) return false;
  // Inserted and deleted text and text formatting are tracked; structure (lists, wrappers, block
  // attributes) changes directly.
  return tr.steps.every(
    (step) =>
      step instanceof ReplaceStep || step instanceof AddMarkStep || step instanceof RemoveMarkStep,
  );
}

/**
 * A formatting change as a suggestion: the change is made (the new look shows at once), and text that
 * had no suggested format yet remembers its formatting before it. Your own suggested insertion is
 * just formatted: rejecting it removes the text anyway. A change that brings text back to how it was
 * takes the suggestion away.
 */
function suggestFormat(
  out: Transaction,
  from: number,
  to: number,
  op: 'add' | 'remove',
  mark: Mark,
  author: SuggestionAuthor,
  time: number,
): void {
  const types = typesOf(out.doc.type.schema);
  const apply = (start: number, end: number) =>
    op === 'add' ? out.addMark(start, end, mark) : out.removeMark(start, end, mark);
  if (NOT_FORMATTING.has(mark.type.name) || !types.format) {
    apply(from, to);
    return;
  }
  const pieces: { from: number; to: number; node: PMNode }[] = [];
  out.doc.nodesBetween(from, to, (node, pos, parent) => {
    if (!node.isInline) return true;
    const start = Math.max(pos, from);
    const end = Math.min(pos + node.nodeSize, to);
    if (start < end && parent?.type.allowsMarkType(mark.type))
      pieces.push({ from: start, to: end, node });
    return false;
  });
  let id: string | null = null;
  for (const { from: start, to: end, node } of pieces) {
    const after = op === 'add' ? mark.addToSet(node.marks) : mark.removeFromSet(node.marks);
    if (sameMarks(after, node.marks)) continue;
    apply(start, end);
    const own = node.marks.some((m) => m.type === types.insert && m.attrs.author === author.id);
    if (own || types.delete.isInSet(node.marks)) continue;
    const suggested = node.marks.find((m) => m.type === types.format);
    if (suggested) {
      // Already a suggested format: it keeps what the text was; back there, it goes away.
      const before = formatMarks(out.doc.type.schema, suggested.attrs.before);
      if (sameMarks(formatting(after), before)) out.removeMark(start, end, suggested);
      continue;
    }
    id ??= newId();
    const before = cleanFormat(formatting(node.marks).map((m) => m.toJSON()));
    out.addMark(
      start,
      end,
      types.format.create({ id, author: author.id, name: author.name, time, before }),
    );
  }
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
  // A change of a block's type or style: the block remembers what it was.
  const blocks = tr.docChanged && !tr.getMeta(OWN) ? trackBlocks?.(tr, state, author) : null;
  if (blocks) return blocks;
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
    // Formatting: marks don't move positions, here or in the original.
    if (rawStep instanceof AddMarkStep || rawStep instanceof RemoveMarkStep) {
      const op = rawStep instanceof AddMarkStep ? 'add' : 'remove';
      suggestFormat(out, toOut(rawStep.from), toOut(rawStep.to), op, rawStep.mark, author, time);
      return;
    }
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
  if (tr.steps.every((step) => !(step instanceof ReplaceStep))) {
    // Formatting only: positions are the same, the selection too (text, a node or everything).
    out.setSelection(tr.selection.map(out.doc, out.mapping.slice(out.steps.length)));
  } else if (forwardDeleteEnd !== null) {
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

/** What a suggested format changed on a piece of text: mark names it got and lost. */
function formatChange(node: PMNode, mark: Mark): { added: string[]; removed: string[] } {
  const before = formatMarks(node.type.schema, mark.attrs.before);
  const now = formatting(node.marks);
  const added = now.filter((m) => !m.isInSet(before)).map((m) => m.type.name);
  const removed = before
    .filter((m) => !m.isInSet(now) && !added.includes(m.type.name))
    .map((m) => m.type.name);
  return { added, removed };
}

const addAll = (list: string[], more: string[]) => {
  for (const name of more) if (!list.includes(name)) list.push(name);
};

/** All suggestions in the document (consecutive parts of one suggestion are merged). */
export function listSuggestions(doc: PMNode): Suggestion[] {
  const types = typesOf(doc.type.schema);
  const result: Suggestion[] = [];
  doc.descendants((node, pos) => {
    if (!node.isInline) {
      const block = blockSuggestion(node.attrs.suggestion);
      if (block) {
        result.push({
          id: block.id,
          kind: 'block',
          author: { id: block.author, name: block.name },
          time: block.time,
          from: pos + 1,
          to: pos + node.nodeSize - 1,
          text: node.textContent,
          before: block.before,
        });
      }
      return true;
    }
    for (const mark of node.marks) {
      const kind =
        mark.type === types.insert
          ? 'insert'
          : mark.type === types.delete
            ? 'delete'
            : mark.type === types.format
              ? 'format'
              : null;
      if (!kind) continue;
      const last = result[result.length - 1];
      // Not text (a mention, a footnote number, a line break): its text form, if it has one.
      const text = node.isText ? node.text! : (node.type.spec.leafText?.(node) ?? '');
      const change = kind === 'format' ? formatChange(node, mark) : null;
      if (last && last.id === mark.attrs.id && last.kind === kind && last.to === pos) {
        last.to = pos + node.nodeSize;
        last.text += text;
        if (change) {
          addAll(last.added!, change.added);
          addAll(last.removed!, change.removed);
        }
      } else {
        result.push({
          id: mark.attrs.id as string,
          kind,
          author: { id: mark.attrs.author as string, name: mark.attrs.name as string },
          time: Number(mark.attrs.time) || 0,
          from: pos,
          to: pos + node.nodeSize,
          text,
          ...(change ?? {}),
        });
      }
    }
    return false;
  });
  return result;
}

/** A suggested format accepted (the mark goes) or rejected (the text gets back its formatting). */
function resolveFormat(tr: Transaction, s: Suggestion, action: 'accept' | 'reject'): void {
  const type = typesOf(tr.doc.type.schema).format;
  const pieces: { from: number; to: number; node: PMNode; mark: Mark }[] = [];
  tr.doc.nodesBetween(s.from, s.to, (node, pos) => {
    if (!node.isInline) return true;
    const mark = node.marks.find((m) => m.type === type && m.attrs.id === s.id);
    if (mark) {
      pieces.push({
        from: Math.max(pos, s.from),
        to: Math.min(pos + node.nodeSize, s.to),
        node,
        mark,
      });
    }
    return false;
  });
  for (const { from, to, node, mark } of pieces) {
    if (action === 'reject') {
      const before = formatMarks(tr.doc.type.schema, mark.attrs.before);
      for (const m of formatting(node.marks)) if (!m.isInSet(before)) tr.removeMark(from, to, m);
      for (const m of before) if (!m.isInSet(node.marks)) tr.addMark(from, to, m);
    }
    tr.removeMark(from, to, mark);
  }
}

/**
 * A block's suggested type or style accepted (the block forgets what it was) or rejected (it gets
 * back its type and attributes; a type that can't hold the text now leaves the block as it is).
 */
function resolveBlock(tr: Transaction, s: Suggestion, action: 'accept' | 'reject'): void {
  const pos = s.from - 1;
  const node = tr.doc.nodeAt(pos);
  if (!node) return;
  const type = action === 'reject' ? tr.doc.type.schema.nodes[s.before!.type] : undefined;
  if (
    type?.isTextblock &&
    type.spec.attrs &&
    'suggestion' in type.spec.attrs &&
    type.validContent(node.content)
  ) {
    const attrs = Object.fromEntries(
      Object.entries(s.before!.attrs).filter(([key]) => key in type.spec.attrs!),
    );
    tr.setNodeMarkup(pos, type, { ...attrs, suggestion: null }, node.marks);
  } else tr.setNodeAttribute(pos, 'suggestion', null);
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
  tr.setMeta(RESOLVED, { action, ids: [...new Set(chosen.map((s) => s.id))] });
  // Formats first: they don't move text, and the text they are on may go next.
  for (const s of chosen) if (s.kind === 'format') resolveFormat(tr, s, action);
  for (const s of chosen) if (s.kind === 'block') resolveBlock(tr, s, action);
  // Blocks whose text was removed (the position before the block).
  const emptied = new Set<number>();
  // From the end, so positions ahead don't shift.
  for (const s of [...chosen].sort((a, b) => b.from - a.from)) {
    if (s.kind === 'format' || s.kind === 'block') continue;
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

/** A block suggestion's decoration: on the whole block (from…to is its content). */
const blockDecoration = (from: number, to: number, attrs: Record<string, string>) =>
  Decoration.node(from - 1, to + 1, attrs);

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
  toolbar: 'suggestions reviewsuggestions suggestionspanel',
  marks: {
    suggestion_insert: markSpec('insert'),
    suggestion_delete: markSpec('delete'),
    suggestion_format: formatSpec(),
  },
  nodeAttributes: { suggestion: blockAttribute },
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
                (s.kind === 'block' ? blockDecoration : Decoration.inline)(s.from, s.to, {
                  title:
                    (s.kind === 'insert'
                      ? labels.inserted
                      : s.kind === 'delete'
                        ? labels.deleted
                        : labels.formatted
                    ).replace('{name}', s.author.name || labels.guest) +
                    (s.time ? ` · ${time.format(s.time)}` : ''),
                  class: `nova-sugg-${s.kind}`,
                  style: `--nova-suggestion: ${suggestionColor(s.author.id || s.author.name)}`,
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
