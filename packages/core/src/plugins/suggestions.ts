import {
  Fragment,
  Slice,
  type Mark,
  type MarkSpec,
  type MarkType,
  type Node as PMNode,
} from 'prosemirror-model';
import {
  EditorState,
  NodeSelection,
  Plugin,
  PluginKey,
  Selection,
  TextSelection,
  type Transaction,
} from 'prosemirror-state';
import { liftListItem } from 'prosemirror-schema-list';
import {
  AddMarkStep,
  AttrStep,
  canJoin,
  liftTarget,
  RemoveMarkStep,
  ReplaceAroundStep,
  ReplaceStep,
  Transform,
  type Step,
} from 'prosemirror-transform';
import { Decoration, DecorationSet } from 'prosemirror-view';
import { keymap } from 'prosemirror-keymap';
import type { Editor } from '../editor';
import type { NodeAttribute } from '../schema';
import { SET_CONTENT_META } from '../meta';
import { definePlugin } from '../plugins';
import { pickLabels } from './shared';

/**
 * The suggestions plugin — suggesting mode (like "Suggesting" in Google Docs). In suggesting mode,
 * an edit doesn't change the document directly: insertions are marked <ins>, deletions <del> (the
 * text stays until a decision). Every suggestion knows its author and time; it is accepted or
 * rejected one by one (the panel above it) or all at once. In HTML: `<ins data-suggestion="id" …>`.
 *
 * Inserting and deleting text is tracked, and so is text formatting (bold, a color, a link…): the
 * new formatting shows at once, and the text remembers what it was, to go back to it if the
 * suggestion is rejected (`<span data-suggestion="id" data-format="[…]">`). So is a node's type and
 * style (a heading instead of a paragraph, alignment, a numbered list instead of a bulleted one,
 * table and cell properties, an image's size): the node remembers what it was
 * (`<h2 data-suggestion="id" data-before='{"type":"paragraph"}'>`). Whole nodes inserted or deleted
 * (a table, a row, a column, an image, a line) carry the suggestion themselves
 * (`<tr data-suggestion="id" data-change="delete">`); a deleted one stays until the deletion is
 * accepted. Putting paragraphs into a list or a quote, taking them out, Tab and Shift+Tab in a list
 * are suggestions on the item or the quote (`data-change="wrap"` / `"unwrap"`). An edit that can't be
 * a suggestion (merging table cells, a page setup) isn't made in suggesting mode: nothing changes
 * the document directly.
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
  /**
   * insert and delete: text, or a whole node (`node` says which); format: the text's formatting
   * changed; block: a node's type or style; split: a new paragraph break before the block; join:
   * the paragraph break before it deleted; wrap: the node put into a list or a quote, or one level
   * deeper in a list (Tab); unwrap: taking it out of one suggested.
   */
  kind: 'insert' | 'delete' | 'format' | 'block' | 'split' | 'join' | 'wrap' | 'unwrap';
  author: SuggestionAuthor;
  time: number;
  /** Text: where it starts and ends. A suggestion a node carries (`node` is set): the whole node. */
  from: number;
  to: number;
  text: string;
  /** The type name of the node that carries the suggestion (not set for text). */
  node?: string;
  /** format: the formatting (mark names) the text got, and the formatting it lost. */
  added?: string[];
  removed?: string[];
  /** block: what the block was before: its type and attributes. */
  before?: BlockBefore;
  /** split and join: how many levels the paragraph break is (a list item: 2). */
  depth?: number;
}

export interface BlockBefore {
  type: string;
  attrs: Record<string, string | number | boolean | null>;
}

/** A suggested change a node carries (its `suggestion` attribute). */
export interface BlockSuggestion {
  id: string;
  author: string;
  name: string;
  time: number;
  /**
   * block: its type or style changed; split: a new paragraph break before it; join: that break
   * deleted; insert / delete: the whole node; wrap / unwrap: put into a list or a quote, or one level
   * deeper (wrap), and taken out (unwrap).
   */
  change: 'block' | 'split' | 'join' | 'insert' | 'delete' | 'wrap' | 'unwrap';
  /** block: what it was before. */
  before?: BlockBefore;
  /** split: how many levels the break opened (a new list item: 2). */
  depth?: number;
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
    unsupported: 'This change can’t be a suggestion',
    unsupportedDirect: 'This change can’t be a suggestion. To make it, turn off Suggest edits.',
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
  if (typeof raw.id !== 'string' || !ID_RE.test(raw.id)) return null;
  const author = String(raw.author ?? '');
  const base = {
    id: raw.id,
    author: USER_ID_RE.test(author) ? author : '',
    name: String(raw.name ?? '').slice(0, 80),
    time: Number(raw.time) || 0,
  };
  if (raw.change === 'split' || raw.change === 'join') {
    // A join that took the place of your own style suggestion remembers the style too.
    const before = raw.change === 'join' && raw.before != null ? parseBefore(raw.before) : null;
    return {
      ...base,
      change: raw.change,
      depth: Math.min(4, Math.max(1, Math.trunc(Number(raw.depth)) || 1)),
      ...(before ? { before } : {}),
    };
  }
  if (raw.change === 'insert' || raw.change === 'delete') return { ...base, change: raw.change };
  if (raw.change === 'wrap' || raw.change === 'unwrap') {
    return {
      ...base,
      change: raw.change,
      depth: Math.min(9, Math.max(1, Math.trunc(Number(raw.depth)) || 1)),
    };
  }
  const before = parseBefore(raw.before);
  return before ? { ...base, change: 'block', before } : null;
}

/** What a node was (a type name and plain attributes), from JSON or its string, or null. */
function parseBefore(value: unknown): BlockBefore | null {
  let before = value;
  try {
    if (typeof before === 'string') before = JSON.parse(before);
  } catch {
    return null;
  }
  const type = (before as { type?: unknown } | null)?.type;
  if (typeof type !== 'string' || !/^[a-z][a-z0-9_]{0,39}$/.test(type)) return null;
  return { type, attrs: cleanAttrs((before as { attrs?: unknown }).attrs, 12) };
}

/** The suggestion attribute of nodes, read from and written to the node's element. */
const blockAttribute: NodeAttribute = {
  nodes: 'all',
  default: null,
  parse: (dom) =>
    dom.hasAttribute('data-before') || dom.hasAttribute('data-change')
      ? blockSuggestion({
          id: dom.getAttribute('data-suggestion'),
          author: dom.getAttribute('data-author'),
          name: dom.getAttribute('data-name'),
          time: dom.getAttribute('data-time'),
          before: dom.getAttribute('data-before'),
          change: dom.getAttribute('data-change'),
          depth: dom.getAttribute('data-depth'),
        })
      : null,
  render(value) {
    const s = blockSuggestion(value);
    if (!s) return {};
    const out: Record<string, string> = { 'data-suggestion': s.id };
    if (s.change !== 'block') out['data-change'] = s.change;
    if (s.before) out['data-before'] = JSON.stringify(s.before);
    if ((s.depth ?? 1) > 1) out['data-depth'] = String(s.depth);
    if (s.author) out['data-author'] = s.author;
    if (s.name) out['data-name'] = s.name;
    if (s.time) out['data-time'] = String(s.time);
    return out;
  },
};

/**
 * What a change of structure did (suggestions-blocks.ts works it out from the document before and
 * after it): nodes put into a list or a quote, or one level deeper in a list (wrap: their positions
 * after), or taken out (unwrap: their positions before).
 */
export interface StructureChange {
  change: 'wrap' | 'unwrap';
  /** The nodes that carry the suggestion: list items and quotes. */
  nodes: number[];
}

/** The trackers that load with the plugin's interface (suggestions-blocks.ts). */
export interface StructureTrackers {
  /** A paragraph break typed (Enter) or deleted (Backspace, Delete), or null for any other edit. */
  breaks(tr: Transaction, state: EditorState, author: SuggestionAuthor): Transaction | null;
  /** Lists and quotes: what changed between the two documents, or null for anything else. */
  structure(before: PMNode, after: PMNode): StructureChange | null;
}
let trackers: StructureTrackers | null = null;
export function setStructureTrackers(value: StructureTrackers): void {
  trackers = value;
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

/**
 * This user's own edit: not the plugin's own (accept, reject), not a document being loaded, not
 * undo or redo, not a collaborator's change, not one kept out of the history. Only these become
 * suggestions.
 */
function isUserEdit(tr: Transaction): boolean {
  if (!tr.docChanged || tr.getMeta(OWN)) return false;
  if (tr.getMeta('addToHistory') === false) return false;
  // setContent loads a document: that is not an edit to suggest.
  if (tr.getMeta(SET_CONTENT_META)) return false;
  // Undo/redo (own and shared history) and other participants' edits arrive ready-made.
  if (tr.getMeta('history$')) return false;
  const ySync = tr.getMeta('y-sync$') as { isChangeOrigin?: boolean } | undefined;
  return !ySync?.isChangeOrigin;
}

/** Whether a node can carry a suggestion (every node but the document and text, with the plugin). */
const carries = (node: PMNode) => !!node.type.spec.attrs && 'suggestion' in node.type.spec.attrs;

/** A suggestion a node carries: who, when, what. */
function nodeValue(
  change: 'insert' | 'delete' | 'wrap' | 'unwrap',
  id: string,
  author: SuggestionAuthor,
  time: number,
  depth = 1,
): BlockSuggestion {
  return {
    id,
    author: author.id,
    name: author.name,
    time,
    change,
    ...(depth > 1 ? { depth } : {}),
  };
}

/** What the nodes around a position say: inside your own new node, inside a deleted one. */
export function around(
  doc: PMNode,
  pos: number,
  authorId: string,
): { own: boolean; deleted: boolean } {
  const $pos = doc.resolve(pos);
  const result = { own: false, deleted: false };
  for (let depth = $pos.depth; depth > 0; depth--) {
    const s = blockSuggestion($pos.node(depth).attrs.suggestion);
    if (s?.change === 'insert' && s.author === authorId) result.own = true;
    if (s?.change === 'delete') result.deleted = true;
  }
  return result;
}

/** Whether a fragment holds any inline content (text, an image, a mention). */
export function hasInline(fragment: Fragment): boolean {
  let found = false;
  fragment.descendants((node) => {
    if (node.isInline) found = true;
    return !found;
  });
  return found;
}

/** A node's type and plain attributes, without its suggestion. */
export function markup(node: PMNode): BlockBefore {
  const attrs: BlockBefore['attrs'] = {};
  for (const [key, value] of Object.entries(node.attrs)) {
    if (key === 'suggestion') continue;
    if (value === null || ['string', 'number', 'boolean'].includes(typeof value))
      attrs[key] = value as string | number | boolean | null;
  }
  return { type: node.type.name, attrs };
}

/** An attribute of a node's markup; a missing one is its default (HTML saved elsewhere may leave defaults out). */
export function attrValue(schema: EditorState['schema'], block: BlockBefore, key: string): unknown {
  return (
    block.attrs[key] ??
    (schema.nodes[block.type]?.spec.attrs?.[key] as { default?: unknown } | undefined)?.default ??
    null
  );
}

/** The attributes in which two markups differ. */
function differ(schema: EditorState['schema'], a: BlockBefore, b: BlockBefore): string[] {
  return [...new Set([...Object.keys(a.attrs), ...Object.keys(b.attrs)])].filter(
    (key) => attrValue(schema, a, key) !== attrValue(schema, b, key),
  );
}

/**
 * The node whose markup (type, attributes) a step changes, or null for any other step. Such a step
 * moves no position.
 */
function markupChange(step: Step, doc: PMNode): number | null {
  if (step instanceof AttrStep) return doc.nodeAt(step.pos) ? step.pos : null;
  if (step instanceof ReplaceAroundStep) {
    const old = doc.nodeAt(step.from);
    const next = step.slice.content.firstChild;
    const markupOnly =
      !!old &&
      !!next &&
      !next.isLeaf &&
      step.slice.content.childCount === 1 &&
      step.slice.openStart === 0 &&
      step.slice.openEnd === 0 &&
      step.insert === 1 &&
      step.to === step.from + old.nodeSize &&
      step.gapFrom === step.from + 1 &&
      step.gapTo === step.to - 1 &&
      next.content.size === 0;
    return markupOnly ? step.from : null;
  }
  if (step instanceof ReplaceStep) {
    // A leaf (an image, a line) gets new attributes as a copy of itself put in its place.
    const { from, to, slice } = step as ReplaceStep & { from: number; to: number };
    const old = doc.nodeAt(from);
    const next = slice.content.firstChild;
    return old?.isLeaf &&
      !old.isText &&
      next?.isLeaf &&
      old.type === next.type &&
      to === from + old.nodeSize &&
      slice.content.childCount === 1 &&
      slice.openStart === 0 &&
      slice.openEnd === 0 &&
      sameMarks(old.marks, next.marks) &&
      !old.eq(next)
      ? from
      : null;
  }
  return null;
}

/** Attributes whose change is layout, not content (a column's width dragged): made directly. */
const LAYOUT = new Set(['colwidth']);

/**
 * A node's markup changed in suggesting mode: the change is made, and the node remembers what it
 * was (or keeps what it remembered already); back to that, the suggestion goes. Your own new node
 * is just changed. False: it can't be a suggestion (the node carries another kind of suggestion).
 */
function suggestMarkup(
  out: Transaction,
  pos: number,
  next: PMNode,
  author: SuggestionAuthor,
  id: () => string,
  time: number,
): boolean {
  const old = out.doc.nodeAt(pos);
  if (!old || !carries(old) || !carries(next)) return false;
  const schema = out.doc.type.schema;
  const apply = (value: unknown) =>
    out.setNodeMarkup(pos, next.type, { ...next.attrs, suggestion: value }, next.marks);
  const existing = blockSuggestion(old.attrs.suggestion);
  const was = markup(old);
  const now = markup(next);
  const own =
    old.marks.some((m) => m.type.name === 'suggestion_insert' && m.attrs.author === author.id) ||
    ((existing?.change === 'insert' || existing?.change === 'split') &&
      existing.author === author.id) ||
    around(out.doc, pos, author.id).own;
  // Layout (a column's width) and your own new node: made as it is.
  if (own || (was.type === now.type && differ(schema, was, now).every((k) => LAYOUT.has(k)))) {
    apply(old.attrs.suggestion);
    return true;
  }
  if (existing && existing.change !== 'block') return false;
  const before = existing?.before ?? was;
  const same = before.type === now.type && differ(schema, before, now).length === 0;
  apply(
    same
      ? null
      : {
          id: existing?.id ?? id(),
          author: author.id,
          name: author.name,
          time,
          change: 'block',
          before,
        },
  );
  return true;
}

/**
 * Lifts a list item one level (out of its list, or out of a nested list into the one around it) or
 * takes a quote's content out of it. Returns where the lifted node's content starts now, or null if
 * it can't be lifted.
 */
function liftOnce(tr: Transform, pos: number): number | null {
  const node = tr.doc.nodeAt(pos);
  if (!node || node.isLeaf) return null;
  const start = tr.steps.length;
  const item = tr.doc.type.schema.nodes.list_item;
  if (node.type === item && item) {
    const state = EditorState.create({
      doc: tr.doc,
      selection: TextSelection.near(tr.doc.resolve(pos + 1)),
    });
    let lifted = false;
    liftListItem(item)(state, (done) => {
      for (const step of done.steps) tr.step(step);
      lifted = true;
    });
    if (!lifted) return null;
  } else {
    const range = tr.doc.resolve(pos + 1).blockRange(tr.doc.resolve(pos + node.nodeSize - 1));
    const target = range && liftTarget(range);
    if (target === null || target === undefined) return null;
    tr.lift(range!, target);
  }
  return tr.mapping.slice(start).map(pos + 1, 1);
}

/** The list item or quote whose content starts at a position (after a lift), or null. */
function wrapperAt(doc: PMNode, contentStart: number): number | null {
  const $pos = doc.resolve(contentStart);
  return $pos.depth > 0 && contentStart === $pos.start() ? $pos.before() : null;
}

/** Lifts each node one level, the last first (positions before it stay). False if one can't be. */
function liftEach(tr: Transform, positions: readonly number[]): boolean {
  return [...positions].sort((a, b) => b - a).every((pos) => liftOnce(tr, pos) !== null);
}

/**
 * A change of lists or quotes as suggestions (the steps from `start` on made it in `out`): nodes put
 * into a list or a quote carry "wrap" (rejecting lifts them back), nodes taken out stay where they
 * were and carry "unwrap" (accepting takes them out). Taking out what is your own suggestion (a new
 * list item, a level you added) is just made. Null if it can't be a suggestion: what rejecting or
 * accepting would do has to give exactly the documents before and after.
 */
function suggestStructure(
  out: Transaction,
  start: number,
  before: PMNode,
  state: EditorState,
  author: SuggestionAuthor,
  id: () => string,
  time: number,
): Transaction | null {
  const found = trackers?.structure(before, out.doc);
  if (!found?.nodes.length) return null;
  const ownBy = (s: BlockSuggestion | null, ...changes: BlockSuggestion['change'][]) =>
    !!s && s.author === author.id && changes.includes(s.change);
  if (found.change === 'wrap') {
    const check = new Transform(out.doc);
    if (!liftEach(check, found.nodes) || !check.doc.eq(before)) return null;
    for (const pos of found.nodes) {
      const s = blockSuggestion(out.doc.nodeAt(pos)!.attrs.suggestion);
      if (ownBy(s, 'insert')) continue;
      if (s && !ownBy(s, 'wrap')) return null;
      out.setNodeAttribute(
        pos,
        'suggestion',
        nodeValue('wrap', s?.id ?? id(), author, time, (s?.depth ?? 0) + 1),
      );
    }
    return out;
  }
  // Taken out of a list or a quote: accepting has to give the document after.
  const check = new Transform(before);
  if (!liftEach(check, found.nodes) || !check.doc.eq(out.doc)) return null;
  const nodes = found.nodes.map((pos) => ({ pos, node: before.nodeAt(pos)! }));
  // Your own new list item (Enter in a list, then Enter again on the empty item), or a level you
  // added yourself (Tab, then Shift+Tab): the change is made.
  const ownNew = ({ node }: { node: PMNode }) => {
    const block = node.childCount === 1 ? node.firstChild! : null;
    // The item itself is new (Enter at the end of an item), or its paragraph is.
    const s = blockSuggestion(node.attrs.suggestion) ?? blockSuggestion(block?.attrs.suggestion);
    let ownText = true;
    block?.descendants((child) => {
      if (
        child.isInline &&
        !child.marks.some(
          (m) => m.type.name === 'suggestion_insert' && m.attrs.author === author.id,
        )
      )
        ownText = false;
      return ownText;
    });
    return !!block?.isTextblock && ownBy(s, 'split', 'insert') && ownText;
  };
  const ownLevel = ({ node }: { node: PMNode }) =>
    ownBy(blockSuggestion(node.attrs.suggestion), 'wrap');
  if (nodes.every((n) => ownNew(n) || ownLevel(n))) {
    const map = out.mapping.slice(start);
    for (const n of nodes) {
      const contentStart = map.map(n.pos + 1, 1);
      const wrapper = wrapperAt(out.doc, contentStart);
      const moved = wrapper === null ? null : out.doc.nodeAt(wrapper);
      if (ownLevel(n)) {
        const s = blockSuggestion(n.node.attrs.suggestion)!;
        // One level less; a list item taken out of its list altogether is gone with the level.
        if (moved?.type === n.node.type)
          out.setNodeAttribute(
            wrapper!,
            'suggestion',
            (s.depth ?? 1) > 1 ? nodeValue('wrap', s.id, author, s.time, s.depth! - 1) : null,
          );
        continue;
      }
      // A new paragraph out of the list: a new block, gone if the suggestion is rejected.
      const block = out.doc.nodeAt(contentStart);
      const s = (blockSuggestion(n.node.attrs.suggestion) ??
        blockSuggestion(n.node.firstChild!.attrs.suggestion))!;
      if (block?.isTextblock && moved?.type.name !== 'list_item')
        out.setNodeAttribute(contentStart, 'suggestion', nodeValue('insert', s.id, author, s.time));
    }
    return out;
  }
  // Otherwise the nodes stay where they are and carry the suggestion to take them out.
  const kept = state.tr;
  for (const step of out.steps.slice(0, start)) kept.step(step);
  if (!kept.doc.eq(before)) return null;
  for (const { pos, node } of nodes) {
    const s = blockSuggestion(node.attrs.suggestion);
    if (s && !ownBy(s, 'unwrap')) return null;
    kept.setNodeAttribute(
      pos,
      'suggestion',
      nodeValue('unwrap', s?.id ?? id(), author, time, (s?.depth ?? 0) + 1),
    );
  }
  return kept;
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

/**
 * Inserted content marked "inserted": its text gets the mark; a whole new node (a paragraph, a table,
 * a row, a column's cell, an image, a line) carries the suggestion itself, and what is inside it is
 * new with it. The nodes on the slice's open edges are
 * parts of nodes already there, not new ones.
 */
function withInsert(
  fragment: Fragment,
  mark: Mark,
  parent: PMNode['type'] | null,
  openStart: number,
  openEnd: number,
  value: () => BlockSuggestion,
): Fragment {
  const nodes: PMNode[] = [];
  fragment.forEach((node, _offset, index) => {
    if (node.isInline) {
      nodes.push(
        parent && !parent.allowsMarkType(mark.type) ? node : node.mark(mark.addToSet(node.marks)),
      );
      return;
    }
    const openLeft = index === 0 && openStart > 0;
    const openRight = index === fragment.childCount - 1 && openEnd > 0;
    if (!openLeft && !openRight && carries(node)) {
      nodes.push(
        node.type.create({ ...node.attrs, suggestion: value() }, node.content, node.marks),
      );
      return;
    }
    nodes.push(
      node.copy(
        withInsert(
          node.content,
          mark,
          node.type,
          openLeft ? openStart - 1 : 0,
          openRight ? openEnd - 1 : 0,
          value,
        ),
      ),
    );
  });
  return Fragment.from(nodes);
}

/**
 * Puts inserted content in, as the original step did: the same slice as one step. Fitting it in
 * again (Transform.replace) could build it differently (an empty image to complete a split figure).
 */
function insertAt(out: Transaction, at: number, slice: Slice): void {
  if (out.maybeStep(new ReplaceStep(at, at, slice)).failed) out.replace(at, at, slice);
}

/** A selection in another document: positions through `map`, a selected node stays selected. */
function mapSelection(selection: Selection, doc: PMNode, map: (pos: number) => number): Selection {
  if (selection instanceof NodeSelection) {
    const pos = map(selection.from);
    const node = doc.nodeAt(pos);
    if (node && NodeSelection.isSelectable(node)) return NodeSelection.create(doc, pos);
  }
  return TextSelection.between(
    doc.resolve(map(selection.anchor)),
    doc.resolve(map(selection.head)),
  );
}

/**
 * Turns a user's edit into a suggestion: what was deleted gets marked, what was inserted gets marked,
 * a node's new markup is remembered, a list or quote change is a suggestion on the item or the quote.
 * Your own insertion that isn't accepted yet is deleted for real (fixing a typo in your own
 * suggestion). An edit that can't be a suggestion isn't made: an empty transaction comes back, and
 * `onRefuse` is called.
 */
export function suggestTransaction(
  tr: Transaction,
  state: EditorState,
  author: SuggestionAuthor,
  onRefuse?: () => void,
): Transaction {
  if (!isUserEdit(tr)) return tr;
  const refuse = () => {
    onRefuse?.();
    return state.tr;
  };
  // A paragraph break typed or deleted: the block remembers it.
  const breaks = trackers?.breaks(tr, state, author);
  if (breaks) return breaks;
  const types = typesOf(state.schema);
  let out = state.tr;
  const time = Date.now();
  // One id for the node suggestions of one edit (a column is a cell in every row).
  let nodeId: string | null = null;
  const idFor = () => (nodeId ??= newId());
  // A position in the document of the original transaction (before step i) → a position in out.
  let toOut = (pos: number) => pos;
  let forwardDeleteEnd: number | null = null;
  // A selected node deleted (it stays, marked): the cursor goes after it.
  let afterDeleted: number | null = null;
  // Where the inserted content went (one step): the cursor keeps its place in it.
  let inserted: { at: number; from: number; size: number } | null = null;
  let movesPositions = false;
  // A deletion kept as a suggestion and a node's markup changed in one edit (merging table cells):
  // both together would leave a table that doesn't add up, so such an edit isn't a suggestion.
  let keptDeletion = false;
  let markupChanged = false;
  // Lists and quotes: their steps are made as they are, and what they did is worked out at the end,
  // from the document before them and after.
  let structureStart: number | null = null;
  let structureBefore: PMNode | null = null;

  for (let i = 0; i < tr.steps.length; i++) {
    const rawStep = tr.steps[i]!;
    const doc = tr.docs[i]!;
    if (rawStep instanceof AddMarkStep || rawStep instanceof RemoveMarkStep) {
      if (structureStart !== null) return refuse();
      // Formatting: marks don't move positions, here or in the original.
      const op = rawStep instanceof AddMarkStep ? 'add' : 'remove';
      suggestFormat(out, toOut(rawStep.from), toOut(rawStep.to), op, rawStep.mark, author, time);
      continue;
    }
    const markupAt = markupChange(rawStep, doc);
    if (markupAt !== null) {
      if (structureStart !== null || keptDeletion) return refuse();
      markupChanged = true;
      const next = (tr.docs[i + 1] ?? tr.doc).nodeAt(markupAt);
      if (!next || !suggestMarkup(out, toOut(markupAt), next, author, idFor, time)) return refuse();
      continue;
    }
    if (rawStep instanceof ReplaceAroundStep || structureStart !== null) {
      // A list or quote change: the steps are made as they are, in a document that is the same as
      // the original's so far.
      const touchesText =
        rawStep instanceof ReplaceStep &&
        (hasInline(doc.slice(rawStep.from, rawStep.to).content) ||
          hasInline(rawStep.slice.content));
      if (
        !trackers ||
        touchesText ||
        !(rawStep instanceof ReplaceAroundStep || rawStep instanceof ReplaceStep)
      )
        return refuse();
      if (structureStart === null) {
        if (!out.doc.eq(doc)) return refuse();
        structureStart = out.steps.length;
        structureBefore = out.doc;
      }
      if (out.maybeStep(rawStep).failed) return refuse();
      continue;
    }
    if (!(rawStep instanceof ReplaceStep)) return refuse();
    movesPositions = true;
    const step = rawStep as ReplaceStep & { from: number; to: number; slice: Slice };
    const outStart = out.steps.length;
    const prev = toOut;
    let from = prev(step.from);
    let to = Math.max(from, prev(step.to));
    // A whole node in the range stays, marked deleted.
    let keptWhole = false;

    // 1. Deletion: mark it; your own insertions are deleted for real. A whole node in the range (a
    // table, a row, an image, a line, an empty paragraph) carries the deletion.
    if (to > from) {
      const own: { from: number; to: number }[] = [];
      const plain: { from: number; to: number }[] = [];
      const whole: number[] = [];
      out.doc.nodesBetween(from, to, (node, pos) => {
        const start = Math.max(pos, from);
        const end = Math.min(pos + node.nodeSize, to);
        if (start >= end) return false;
        if (!node.isInline) {
          if (pos < from || pos + node.nodeSize > to) return true;
          const s = blockSuggestion(node.attrs.suggestion);
          if (s?.change === 'insert' && s.author === author.id) {
            own.push({ from: pos, to: pos + node.nodeSize });
            return false;
          }
          if (s?.change === 'delete') return false;
          // A node that carries another suggestion keeps it: what is inside it is marked instead.
          if (!carries(node) || s) return true;
          whole.push(pos);
          return false;
        }
        const here = around(out.doc, pos, author.id);
        if (here.deleted) return false;
        const mine =
          here.own ||
          node.marks.some((m) => m.type === types.insert && m.attrs.author === author.id);
        if (mine) own.push({ from: start, to: end });
        else if (!types.delete.isInSet(node.marks)) plain.push({ from: start, to: end });
        return false;
      });
      let deleteId: string | null = null;
      if (plain.length) {
        const first = plain[0]!;
        const mark =
          neighbourMark(out.doc, first.from, types.delete, author.id) ??
          neighbourMark(out.doc, plain[plain.length - 1]!.to, types.delete, author.id) ??
          types.delete.create({ id: newId(), author: author.id, name: author.name, time });
        for (const range of plain) out.addMark(range.from, range.to, mark);
        deleteId = mark.attrs.id as string;
      }
      for (const pos of whole) {
        out.setNodeAttribute(
          pos,
          'suggestion',
          nodeValue('delete', deleteId ?? idFor(), author, time),
        );
      }
      // From inside one text block to inside another: the break between them is deleted too, and
      // accepting joins what is left of the two (as deleting across them does outside suggesting mode).
      const $start = out.doc.resolve(from);
      const $end = out.doc.resolve(to);
      const last = $end.parent;
      if (
        $start.parent !== last &&
        $start.parent.isTextblock &&
        last.isTextblock &&
        $start.depth === $end.depth &&
        $end.start() > from &&
        carries(last) &&
        !last.attrs.suggestion &&
        !whole.includes($end.before())
      ) {
        out.setNodeAttribute($end.before(), 'suggestion', {
          id: deleteId ?? idFor(),
          author: author.id,
          name: author.name,
          time,
          change: 'join',
          depth: $end.depth - $start.sharedDepth(to),
        });
      }
      if (plain.length || whole.length) {
        keptDeletion = true;
        if (markupChanged) return refuse();
      }
      keptWhole = whole.length > 0;
      for (const range of own.sort((a, b) => b.from - a.from)) out.delete(range.from, range.to);
      const map = out.mapping.slice(outStart);
      from = map.map(from, 1);
      to = map.map(to, -1);
      const sel = state.selection;
      if (tr.steps.length === 1 && step.slice.size === 0) {
        // Delete (forward) with the cursor at the start: the cursor jumps over the marked text.
        if (sel.empty && sel.from === step.from && tr.selection.head === step.from) {
          forwardDeleteEnd = to;
        }
        // A selected node deleted (an image, a table): the cursor goes after it.
        if (sel instanceof NodeSelection && whole.includes(prev(sel.from))) {
          afterDeleted = map.map(prev(sel.to), 1);
        }
      }
    }

    // 2. Insertion goes after the marked deleted text, marked "inserted". If the cursor is
    // right before the deleted text (a word erased with Backspace, then typing), it goes after it too: "~~May~~ June".
    // The empty paragraph a deletion puts in place of the only block (a table deleted from a
    // document with nothing else): not needed while the deleted node stays.
    const filler =
      keptWhole &&
      step.slice.content.childCount === 1 &&
      !step.slice.openStart &&
      !!step.slice.content.firstChild!.isTextblock &&
      !step.slice.content.firstChild!.content.size;
    if (step.slice.size > 0 && !filler) {
      let at = to;
      // Inside your own new node (text typed into a table you inserted): part of it, as it is.
      if (around(out.doc, at, author.id).own) {
        const $in = out.doc.resolve(at);
        const ownBlock = $in.parent.isTextblock
          ? blockSuggestion($in.parent.attrs.suggestion)
          : null;
        insertAt(out, at, step.slice);
        // A break in your own new block: the block it makes is new as well (the same suggestion).
        if (ownBlock?.change === 'insert' && step.slice.openEnd > 0) {
          const $end = out.doc.resolve(at + step.slice.size);
          if ($end.parent.isTextblock && !$end.parent.attrs.suggestion)
            out.setNodeAttribute($end.before(), 'suggestion', ownBlock);
        }
        if (tr.steps.length === 1) inserted = { at, from: step.from, size: step.slice.size };
        const inverse = step.getMap().invert();
        const outMap = out.mapping.slice(outStart);
        toOut = (pos) => outMap.map(prev(inverse.map(pos, -1)), 1);
        continue;
      }
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
      // A node inserted with text shares the text's suggestion; nodes alone, the edit's.
      const nodeSuggestion = () =>
        nodeValue(
          'insert',
          hasInline(step.slice.content) ? (mark.attrs.id as string) : idFor(),
          author,
          time,
        );
      const content = withInsert(
        step.slice.content,
        mark,
        step.slice.openStart ? null : $at.parent.type,
        step.slice.openStart,
        step.slice.openEnd,
        nodeSuggestion,
      );
      insertAt(out, at, new Slice(content, step.slice.openStart, step.slice.openEnd));
      if (tr.steps.length === 1) inserted = { at, from: step.from, size: step.slice.size };
      // Put in a text block with blocks of its own (a line, pasted paragraphs, a new paragraph):
      // in the middle, the block after it is the second half of the one it went into, a new
      // paragraph break that rejecting joins again; at the end of the block, the last block is new
      // as a whole (with a new list item around it), and rejecting removes it.
      const { openStart, openEnd } = step.slice;
      if (openStart > 0 && openStart === openEnd && $at.parent.isTextblock) {
        const $end = out.doc.resolve(at + step.slice.size);
        const outer = $end.depth >= openEnd ? $end.before($end.depth - openEnd + 1) : -1;
        // At the end, and nothing that was there moved into the new block (an item's nested list
        // would): new as a whole; otherwise a break.
        const atEnd =
          $at.parentOffset === $at.parent.content.size &&
          outer >= 0 &&
          outer + out.doc.nodeAt(outer)!.nodeSize === at + step.slice.size + openEnd;
        const target = atEnd ? outer : $end.depth > 0 ? $end.before() : -1;
        const node = target >= 0 ? out.doc.nodeAt(target) : null;
        if ($end.parent.isTextblock && node && carries(node)) {
          out.setNodeAttribute(
            target,
            'suggestion',
            atEnd
              ? nodeValue('insert', mark.attrs.id as string, author, time)
              : {
                  id: mark.attrs.id,
                  author: author.id,
                  name: author.name,
                  time,
                  change: 'split',
                  depth: openEnd,
                },
          );
        }
      }
    }

    const inverse = step.getMap().invert();
    const outMap = out.mapping.slice(outStart);
    toOut = (pos) => outMap.map(prev(inverse.map(pos, -1)), 1);
  }

  // A list or quote change: on the item or the quote, or not a suggestion at all.
  if (structureStart !== null) {
    const done = suggestStructure(
      out,
      structureStart,
      structureBefore!,
      state,
      author,
      idFor,
      time,
    );
    if (!done) return refuse();
    if (done === out) {
      // Made as it is: the same positions as in the original transaction.
      out.setSelection(tr.selection.map(out.doc, out.mapping.slice(out.steps.length)));
    } else {
      // Not made: the selection stays where it was.
      out = done;
      out.setSelection(state.selection.map(out.doc, out.mapping));
    }
  } else if (!movesPositions) {
    // Formatting and markup only: positions are the same, the selection too (text, a node or everything).
    out.setSelection(tr.selection.map(out.doc, out.mapping.slice(out.steps.length)));
  } else if (forwardDeleteEnd !== null) {
    out.setSelection(TextSelection.create(out.doc, forwardDeleteEnd));
  } else if (afterDeleted !== null) {
    out.setSelection(Selection.near(out.doc.resolve(afterDeleted), 1));
  } else if (inserted) {
    const { at, from, size } = inserted;
    const { anchor, head, empty } = tr.selection;
    const inside = (pos: number) => pos >= from && pos <= from + size;
    if (empty && head === from + size) {
      // Typing: right after what was typed.
      out.setSelection(TextSelection.create(out.doc, at + size));
    } else if (inside(anchor) && inside(head)) {
      // Somewhere in what was inserted (the first cell of a new table): the same place in it.
      out.setSelection(mapSelection(tr.selection, out.doc, (pos) => pos - from + at));
    } else if (empty) {
      const $end = out.doc.resolve(at + size);
      out.setSelection(TextSelection.between($end, $end));
    } else out.setSelection(mapSelection(tr.selection, out.doc, toOut));
  } else {
    out.setSelection(mapSelection(tr.selection, out.doc, toOut));
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
    if (!node.isText) {
      // A suggestion the node carries: from…to is the whole node.
      const block = blockSuggestion(node.attrs.suggestion);
      if (block) {
        result.push({
          id: block.id,
          kind: block.change,
          author: { id: block.author, name: block.name },
          time: block.time,
          from: pos,
          to: pos + node.nodeSize,
          text: node.isLeaf ? (node.type.spec.leafText?.(node) ?? '') : node.textContent,
          node: node.type.name,
          ...(block.before ? { before: block.before } : {}),
          ...(block.depth ? { depth: block.depth } : {}),
        });
      }
      if (!node.isInline) return true;
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
 * A node's suggested type or style accepted (the node forgets what it was) or rejected (it gets
 * back its type and attributes; a type that can't hold what is in it now leaves it as it is).
 * Attributes it didn't remember (a column's widths) stay as they are.
 */
function resolveBlock(tr: Transaction, s: Suggestion, action: 'accept' | 'reject'): void {
  const pos = s.from;
  const node = tr.doc.nodeAt(pos);
  if (!node) return;
  const type = action === 'reject' ? tr.doc.type.schema.nodes[s.before!.type] : undefined;
  const $pos = tr.doc.resolve(pos);
  // What it was came from HTML or JSON too: the type has to fit here and hold what is in the node.
  if (
    type?.spec.attrs &&
    'suggestion' in type.spec.attrs &&
    $pos.parent.canReplaceWith($pos.index(), $pos.index() + 1, type) &&
    (node.isLeaf ? type.isLeaf : !type.isLeaf && type.validContent(node.content))
  ) {
    const attrs = Object.fromEntries(
      Object.entries(s.before!.attrs).filter(([key]) => key in type.spec.attrs!),
    );
    try {
      tr.setNodeMarkup(pos, type, { ...node.attrs, ...attrs, suggestion: null }, node.marks);
      return;
    } catch {
      // An attribute of the wrong kind (a number expected): the node stays as it is.
    }
  }
  tr.setNodeAttribute(pos, 'suggestion', null);
}

/**
 * Removes a whole node (a rejected insertion, an accepted deletion). If its parent can't be without
 * it, the parent goes too when it holds only this node (the last row takes the table with it); the
 * only block of the document or of a cell becomes an empty paragraph.
 */
function removeNode(tr: Transaction, pos: number): void {
  const node = tr.doc.nodeAt(pos);
  if (!node) return;
  const $pos = tr.doc.resolve(pos);
  let from = pos;
  let to = pos + node.nodeSize;
  for (let depth = $pos.depth; ; depth--) {
    const parent = $pos.node(depth);
    const index = $pos.index(depth);
    if (parent.canReplace(index, index + 1)) {
      tr.delete(from, to);
      return;
    }
    if (depth === 0 || parent.childCount > 1 || parent.type.spec.isolating) {
      const fill = parent.type.contentMatch.defaultType?.createAndFill();
      if (fill && parent.canReplace(index, index + 1, Fragment.from(fill)))
        tr.replaceWith(from, to, fill);
      return;
    }
    from = $pos.before(depth);
    to = $pos.after(depth);
  }
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
  // Suggestions a node carries. Some change the document's structure, after the text is done: a
  // rejected style gives the node its type back; a rejected new paragraph break and an accepted
  // deleted one join two blocks; a rejected new node and an accepted deletion remove it; a rejected
  // wrap and an accepted unwrap lift the node. The others just forget the suggestion.
  const removals: Suggestion[] = [];
  const pending: { s: Suggestion; op: 'join' | 'style' | 'lift' }[] = [];
  for (const s of chosen) {
    if (!s.node) continue;
    const reject = action === 'reject';
    // What deciding does to the node: nothing but forgetting the suggestion, or a change.
    const op =
      s.kind === 'block'
        ? reject && 'style'
        : s.kind === 'join'
          ? reject
            ? !!s.before && 'style'
            : 'join'
          : s.kind === 'split'
            ? reject && 'join'
            : s.kind === 'insert'
              ? reject && 'remove'
              : s.kind === 'delete'
                ? !reject && 'remove'
                : s.kind === 'wrap'
                  ? reject && 'lift'
                  : !reject && 'lift';
    if (!op) tr.setNodeAttribute(s.from, 'suggestion', null);
    else if (op === 'remove') removals.push(s);
    else pending.push({ s, op });
  }
  // Text, from the end, so positions ahead don't shift. A block whose text goes stays: a new or
  // deleted block carries its own suggestion, and a new paragraph break is a suggestion too.
  for (const s of [...chosen].sort((a, b) => b.from - a.from)) {
    if ((s.kind !== 'insert' && s.kind !== 'delete') || s.node) continue;
    if ((s.kind === 'insert') === (action === 'reject')) tr.delete(s.from, s.to);
    else tr.removeMark(s.from, s.to, s.kind === 'insert' ? types.insert : types.delete);
  }
  // The node at its place now (it may have gone with something around it), or null.
  const nodeNow = (s: Suggestion) => {
    const mapped = tr.mapping.mapResult(s.from, 1);
    const node = mapped.deleted ? null : tr.doc.nodeAt(mapped.pos);
    return node?.type.name === s.node ? mapped.pos : null;
  };
  for (const s of removals.sort((a, b) => b.from - a.from)) {
    const pos = nodeNow(s);
    if (pos !== null) removeNode(tr, pos);
  }
  // The structure: edits were made in some order (a style, then a list; a list, then Enter in it;
  // Enter, then a list) and are undone in the reverse one, which isn't recorded. So each pass makes
  // what can be made now (joins, then styles, then lifts), until nothing more can be; what still
  // can't is forgotten.
  const apply = ({ s, op }: (typeof pending)[number], last: boolean): boolean => {
    const pos = nodeNow(s);
    if (pos === null) return true;
    if (op === 'join') {
      const boundary = pos - ((s.depth ?? 1) - 1);
      if (!canJoin(tr.doc, boundary)) return false;
      try {
        tr.join(boundary, s.depth ?? 1);
      } catch {
        // A level inside doesn't join (a paragraph after an item's nested list): not now.
        return false;
      }
      return true;
    }
    if (op === 'style') {
      if (!last && !restorable(tr.doc, pos, s)) return false;
      resolveBlock(tr, { ...s, from: pos }, 'reject');
      return true;
    }
    if (liftOnce(new Transform(tr.doc), pos) === null) return false;
    tr.setNodeAttribute(pos, 'suggestion', null);
    let at: number | null = pos;
    for (let level = 0; level < (s.depth ?? 1) && at !== null; level++) {
      const contentStart = liftOnce(tr, at);
      at = contentStart === null ? null : wrapperAt(tr.doc, contentStart);
    }
    return true;
  };
  // One at a time: after each, the first that can be made in this order (a lift can make possible
  // a join that has to come before the next lift).
  const order = { join: 0, style: 1, lift: 2 } as const;
  const left = pending.sort((a, b) => order[a.op] - order[b.op] || b.s.from - a.s.from);
  for (let done = 0; done >= 0;) {
    done = left.findIndex((item) => apply(item, false));
    if (done >= 0) left.splice(done, 1);
  }
  for (const item of left) {
    if (item.op === 'style') apply(item, true);
    else {
      const pos = nodeNow(item.s);
      if (pos !== null) tr.setNodeAttribute(pos, 'suggestion', null);
    }
  }
  return tr;
}

/** Whether a node can get back the type and style it remembers, where it is now. */
function restorable(doc: PMNode, pos: number, s: Suggestion): boolean {
  const node = doc.nodeAt(pos);
  const type = s.before ? doc.type.schema.nodes[s.before.type] : undefined;
  if (!node || !type) return false;
  const $pos = doc.resolve(pos);
  return (
    $pos.parent.canReplaceWith($pos.index(), $pos.index() + 1, type) &&
    (node.isLeaf ? type.isLeaf : !type.isLeaf && type.validContent(node.content))
  );
}

/** The document without suggestions: as if all were accepted (accept) or all rejected (reject). */
export function suggestionsResult(editor: Editor, action: 'accept' | 'reject'): PMNode {
  return resolveSuggestions(editor.view.state, action).doc;
}

/**
 * Pasted or dropped content is new content of whoever pastes it: suggestions in it (from another
 * document, from a web page) are dropped, so nobody's name can be put on a suggestion they didn't make.
 */
function withoutSuggestions(fragment: Fragment): Fragment {
  const nodes: PMNode[] = [];
  fragment.forEach((node) => {
    const marks = node.marks.filter((m) => !m.type.name.startsWith('suggestion_'));
    if (node.isText) {
      nodes.push(node.mark(marks));
      return;
    }
    const attrs = node.attrs.suggestion != null ? { ...node.attrs, suggestion: null } : node.attrs;
    nodes.push(node.type.create(attrs, withoutSuggestions(node.content), marks));
  });
  return Fragment.from(nodes);
}

/** When an edit last couldn't be a suggestion, per editor (its notice isn't repeated right away). */
const refusedAt = new WeakMap<Editor, number>();

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
          transformPasted: (slice) =>
            new Slice(withoutSuggestions(slice.content), slice.openStart, slice.openEnd),
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
                // Text: on the text; a suggestion a node carries: on the node.
                (s.node ? Decoration.node : Decoration.inline)(s.from, s.to, {
                  title:
                    (s.kind === 'insert' || s.kind === 'split'
                      ? labels.inserted
                      : s.kind === 'delete' || s.kind === 'join'
                        ? labels.deleted
                        : labels.formatted
                    ).replace('{name}', s.author.name || labels.guest) +
                    (s.time ? ` · ${time.format(s.time)}` : ''),
                  // A whole node inserted or deleted: its text looks inserted or deleted, the node is outlined.
                  class:
                    s.node && (s.kind === 'insert' || s.kind === 'delete')
                      ? `nova-sugg-${s.kind} nova-sugg-node`
                      : `nova-sugg-${s.kind}`,
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
    return suggestTransaction(tr, state, author, () => {
      // Said at most every few seconds: a key held down shouldn't repeat it.
      const now = Date.now();
      if (now - (refusedAt.get(editor) ?? 0) < 3000) return;
      refusedAt.set(editor, now);
      editor.ui.notify(options.force ? labels.unsupported : labels.unsupportedDirect);
    });
  },
  load: () => import('./suggestions-ui'),
});
