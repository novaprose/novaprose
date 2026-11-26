import type { Node as PMNode } from 'prosemirror-model';
import {
  Plugin,
  PluginKey,
  TextSelection,
  type Command,
  type EditorState,
  type Transaction,
} from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';

export interface SearchOptions {
  query: string;
  caseSensitive: boolean;
  wholeWord: boolean;
}

export interface SearchMatch {
  from: number;
  to: number;
}

export interface SearchState extends SearchOptions {
  matches: SearchMatch[];
  /** Index of the current match, or -1. */
  current: number;
}

/** An upper limit, so searching for "e" in a 500,000-character book doesn't freeze typing. */
export const MAX_MATCHES = 10000;
/** A placeholder character for embedded objects (an image, a line break): takes exactly one position. */
const LEAF = '￼';

export const searchKey = new PluginKey<SearchState>('nova-search');

const EMPTY: SearchState = {
  query: '',
  caseSensitive: false,
  wholeWord: false,
  matches: [],
  current: -1,
};

function buildRegExp({ query, caseSensitive, wholeWord }: SearchOptions): RegExp | null {
  if (!query) return null;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // \b in JS doesn't understand non-Latin scripts: word boundaries use Unicode classes.
  const source = wholeWord ? `(?<![\\p{L}\\p{N}_])${escaped}(?![\\p{L}\\p{N}_])` : escaped;
  return new RegExp(source, caseSensitive ? 'gu' : 'giu');
}

/**
 * All matches in the document. Inside a text block a letter and an inline object take one position
 * each, so an index in the block's text + (pos + 1) is the position in the document.
 */
export function findMatches(doc: PMNode, options: SearchOptions): SearchMatch[] {
  const re = buildRegExp(options);
  if (!re) return [];
  const matches: SearchMatch[] = [];
  doc.descendants((node, pos) => {
    if (matches.length >= MAX_MATCHES) return false;
    if (!node.isTextblock) return true;
    const text = node.textBetween(0, node.content.size, undefined, LEAF);
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) && matches.length < MAX_MATCHES) {
      if (m[0].length === 0) {
        re.lastIndex += 1;
        continue;
      }
      matches.push({ from: pos + 1 + m.index, to: pos + 1 + m.index + m[0].length });
    }
    return false;
  });
  return matches;
}

/** The first match at position pos or after it (wrapping around to the start). */
function indexFrom(matches: SearchMatch[], pos: number): number {
  if (!matches.length) return -1;
  const i = matches.findIndex((m) => m.from >= pos);
  return i < 0 ? 0 : i;
}

type Meta =
  { type: 'set'; options: SearchOptions } | { type: 'goto'; index: number } | { type: 'clear' };

export function searchPlugin(): Plugin<SearchState> {
  return new Plugin<SearchState>({
    key: searchKey,
    state: {
      init: () => EMPTY,
      apply(tr, value, _old, newState) {
        const meta = tr.getMeta(searchKey) as Meta | undefined;
        if (meta?.type === 'clear') return EMPTY;
        if (meta?.type === 'set') {
          const matches = findMatches(newState.doc, meta.options);
          return { ...meta.options, matches, current: indexFrom(matches, newState.selection.from) };
        }
        if (meta?.type === 'goto') return { ...value, current: meta.index };
        if (tr.docChanged && value.query) {
          // The document changed: recount, and the match nearest to the old one stays current.
          const matches = findMatches(newState.doc, value);
          const anchor = value.matches[value.current]?.from;
          const current = anchor === undefined ? -1 : indexFrom(matches, tr.mapping.map(anchor));
          return { ...value, matches, current };
        }
        return value;
      },
    },
    props: {
      decorations(state) {
        const search = searchKey.getState(state);
        if (!search?.matches.length) return null;
        return DecorationSet.create(
          state.doc,
          search.matches.map((m, i) =>
            Decoration.inline(m.from, m.to, {
              class:
                i === search.current
                  ? 'nova-search-match nova-search-current'
                  : 'nova-search-match',
            }),
          ),
        );
      },
    },
  });
}

export function getSearchState(state: EditorState): SearchState {
  return searchKey.getState(state) ?? EMPTY;
}

/** Set the query. The current match is the first one after the cursor. */
export function setSearch(options: SearchOptions): Command {
  return (state, dispatch) => {
    dispatch?.(state.tr.setMeta(searchKey, { type: 'set', options } satisfies Meta));
    return true;
  };
}

export const clearSearch: Command = (state, dispatch) => {
  dispatch?.(state.tr.setMeta(searchKey, { type: 'clear' } satisfies Meta));
  return true;
};

function gotoMatch(tr: Transaction, match: SearchMatch, index: number): Transaction {
  return tr
    .setMeta(searchKey, { type: 'goto', index } satisfies Meta)
    .setSelection(TextSelection.create(tr.doc, match.from, match.to))
    .scrollIntoView();
}

/** Go to the next (dir = 1) or previous (-1) match, wrapping around. */
export function findNext(dir: 1 | -1 = 1): Command {
  return (state, dispatch) => {
    const { matches, current } = getSearchState(state);
    if (!matches.length) return false;
    // The first jump goes to the "current" match if it hasn't been visited yet (the selection isn't on it).
    const onCurrent =
      current >= 0 &&
      state.selection.from === matches[current]!.from &&
      state.selection.to === matches[current]!.to;
    const index =
      onCurrent || current < 0
        ? (Math.max(current, 0) + dir + matches.length) % matches.length
        : current;
    if (dispatch) dispatch(gotoMatch(state.tr, matches[index]!, index));
    return true;
  };
}

/** Replace the current match and go to the next one. */
export function replaceCurrent(replacement: string): Command {
  return (state, dispatch) => {
    const { matches, current } = getSearchState(state);
    const match = matches[current];
    if (!match) return false;
    if (dispatch) {
      const tr = state.tr;
      const marks = state.doc.resolve(match.from).marksAcross(state.doc.resolve(match.to)) ?? [];
      if (replacement) tr.replaceWith(match.from, match.to, state.schema.text(replacement, marks));
      else tr.delete(match.from, match.to);
      const after = tr.mapping.map(match.to);
      dispatch(tr.setSelection(TextSelection.create(tr.doc, after)).scrollIntoView());
    }
    return true;
  };
}

/** Replace all matches in one transaction (one undo step). */
export function replaceAll(replacement: string): Command {
  return (state, dispatch) => {
    const { matches } = getSearchState(state);
    if (!matches.length) return false;
    if (dispatch) {
      const tr = state.tr;
      // From the end, so earlier positions don't shift.
      for (let i = matches.length - 1; i >= 0; i--) {
        const { from, to } = matches[i]!;
        const marks = state.doc.resolve(from).marksAcross(state.doc.resolve(to)) ?? [];
        if (replacement) tr.replaceWith(from, to, state.schema.text(replacement, marks));
        else tr.delete(from, to);
      }
      dispatch(tr.scrollIntoView());
    }
    return true;
  };
}
