import type { Node as PMNode } from 'prosemirror-model';
import { TextSelection, type EditorState, type Transaction } from 'prosemirror-state';
import type { Editor } from '../editor';
import { definePlugin } from '../plugins';
import { icons } from '../ui/icons';
import type { MenuEntry } from '../ui/menu';
import { pickLabels } from './shared';

/**
 * The casechange plugin (named as in TinyMCE): lowercase, UPPERCASE and Title Case for the selected
 * text, or for the word at the cursor. The `casechange` button applies the case used last (lowercase at
 * first), its arrow lists all three; menu items `lowercase`, `uppercase`, `titlecase`. Code (inline and
 * blocks) is left alone: it is case-sensitive. Formatting stays as it was, letter by letter.
 *
 * Title Case keeps minor words in lower case (articles, coordinating conjunctions, short prepositions:
 * English rules), except the first and last word and the word after a colon or the end of a sentence.
 * Your own list: `pluginOptions.casechange.titleCaseMinors` (for TinyMCE, `casechange_title_case_minors`).
 */

export const LABELS = {
  en: {
    button: 'Change case',
    lower: 'lowercase',
    upper: 'UPPERCASE',
    title: 'Title Case',
  },
};

export interface CaseChangeOptions {
  /** Words that stay in lower case inside Title Case. By default, English minor words. */
  titleCaseMinors?: string[];
}

export type TextCase = 'lower' | 'upper' | 'title';

/** English minor words: articles, coordinating conjunctions, prepositions of up to four letters. */
export const ENGLISH_MINORS = [
  'a',
  'an',
  'the',
  'and',
  'but',
  'for',
  'nor',
  'or',
  'so',
  'yet',
  'as',
  'at',
  'by',
  'down',
  'from',
  'in',
  'into',
  'like',
  'near',
  'of',
  'off',
  'on',
  'onto',
  'out',
  'over',
  'past',
  'per',
  'than',
  'till',
  'to',
  'up',
  'upon',
  'via',
  'vs',
  'with',
];

const WORD_CHAR = /[\p{L}\p{N}\p{M}'’]/u;

/**
 * Which characters of `text` start a word that Title Case capitalizes. Words are split at anything
 * that isn't a letter, digit or apostrophe (a hyphen too: "Well-Known"); `\n` separates blocks.
 */
export function titleCaseStarts(text: string, minors: ReadonlySet<string>): Set<number> {
  const pattern = /[\p{L}\p{N}\p{M}]+(?:['’][\p{L}\p{N}\p{M}]+)*/gu;
  const words = [...text.matchAll(pattern)].map((match) => ({
    start: match.index!,
    end: match.index! + match[0].length,
    word: match[0],
  }));
  const starts = new Set<number>();
  words.forEach(({ start, end, word }, index) => {
    const before = index ? text.slice(words[index - 1]!.end, start) : '\n';
    const after = index < words.length - 1 ? text.slice(end, words[index + 1]!.start) : '\n';
    // The first word of a block or a sentence, the word after a colon, the last word of a block.
    const edge = /[\n:.!?]/.test(before) || after.includes('\n');
    if (edge || !minors.has(word.toLowerCase())) starts.add(start);
  });
  return starts;
}

/** The text in another case. `starts`: for Title Case, the positions whose letter goes up. */
export function convertCase(
  text: string,
  kind: TextCase,
  locale: string | undefined,
  offset = 0,
  starts?: ReadonlySet<number>,
): string {
  if (kind === 'lower') return text.toLocaleLowerCase(locale);
  if (kind === 'upper') return text.toLocaleUpperCase(locale);
  let out = '';
  let index = offset;
  for (const char of text) {
    out += starts?.has(index) ? char.toLocaleUpperCase(locale) : char.toLocaleLowerCase(locale);
    index += char.length;
  }
  return out;
}

interface Segment {
  from: number;
  to: number;
  node: PMNode;
  /** Where the segment's text starts in the joined text of the range. */
  offset: number;
}

/** The selection, or the word at the cursor; null when the cursor is not in a word. */
function targetRange(state: EditorState): { from: number; to: number } | null {
  const { selection } = state;
  if (!selection.empty) return { from: selection.from, to: selection.to };
  const { $from } = selection;
  if (!$from.parent.isTextblock) return null;
  const text = $from.parent.textBetween(0, $from.parent.content.size, undefined, '\ufffc');
  let start = $from.parentOffset;
  let end = start;
  while (start > 0 && WORD_CHAR.test(text[start - 1]!)) start--;
  while (end < text.length && WORD_CHAR.test(text[end]!)) end++;
  if (start === end) return null;
  return { from: $from.start() + start, to: $from.start() + end };
}

/** Changes the case of the selection (or of the word at the cursor) in one undo step. */
export function changeCase(
  state: EditorState,
  kind: TextCase,
  options: { locale?: string; minors?: ReadonlySet<string> } = {},
): Transaction | null {
  const range = targetRange(state);
  if (!range) return null;
  const segments: Segment[] = [];
  let joined = '';
  let lastBlock: PMNode | null = null;
  state.doc.nodesBetween(range.from, range.to, (node, pos, parent) => {
    if (node.isTextblock && node.type.spec.code) return false;
    if (!node.isInline) return true;
    if (parent !== lastBlock) {
      if (lastBlock) joined += '\n';
      lastBlock = parent;
    }
    const code = node.marks.some((mark) => mark.type.name === 'code' || mark.type.spec.code);
    if (!node.isText || code) {
      joined += ' ';
      return false;
    }
    const from = Math.max(pos, range.from);
    const to = Math.min(pos + node.nodeSize, range.to);
    if (from < to) {
      segments.push({ from, to, node, offset: joined.length });
      joined += node.text!.slice(from - pos, to - pos);
    }
    return false;
  });
  if (!segments.length) return null;
  const starts =
    kind === 'title' ? titleCaseStarts(joined, options.minors ?? new Set()) : undefined;
  const tr = state.tr;
  // From the end: earlier positions stay valid, even when a letter changes length (ß → SS).
  for (const segment of [...segments].reverse()) {
    const text = joined.slice(segment.offset, segment.offset + segment.to - segment.from);
    const changed = convertCase(text, kind, options.locale, segment.offset, starts);
    if (changed !== text) {
      tr.replaceWith(segment.from, segment.to, state.schema.text(changed, segment.node.marks));
    }
  }
  if (!tr.docChanged) return null;
  const { selection } = state;
  if (!selection.empty) {
    // A replaced range keeps its ends: the selection covers the new text (whole-document selection too).
    tr.setSelection(selection.map(tr.doc, tr.mapping));
  } else if (tr.doc.content.size === state.doc.content.size) {
    // The word at the cursor kept its length: the cursor stays between the same letters.
    tr.setSelection(TextSelection.create(tr.doc, selection.from));
  }
  return tr.scrollIntoView();
}

const CASES: readonly TextCase[] = ['lower', 'upper', 'title'];
const MENU_ITEMS: Record<TextCase, string> = {
  lower: 'lowercase',
  upper: 'uppercase',
  title: 'titlecase',
};

export default definePlugin({
  name: 'casechange',
  toolbar: 'casechange',
  setup(editor: Editor) {
    const labels = pickLabels(editor, 'casechange', LABELS);
    const options = (editor.options.pluginOptions?.casechange ?? {}) as CaseChangeOptions;
    const language = editor.options.language;
    const minors = new Set(
      (Array.isArray(options.titleCaseMinors)
        ? options.titleCaseMinors
        : !language || language.startsWith('en')
          ? ENGLISH_MINORS
          : []
      ).map((word) => String(word).toLowerCase()),
    );
    let lastUsed: TextCase = 'lower';

    const apply = (kind: TextCase) => {
      lastUsed = kind;
      const tr = changeCase(editor.view.state, kind, { locale: language, minors });
      if (tr) {
        editor.view.dispatch(tr);
        editor.ui.announce(labels[kind]);
      }
      editor.focus();
    };
    const isEnabled = (e: Editor) => e.isEditable() && targetRange(e.view.state) !== null;

    editor.ui.registry.addSplitButton('casechange', {
      icon: icons.caseChange,
      tooltip: labels.button,
      isEnabled,
      onAction: () => apply(lastUsed),
      items: () =>
        CASES.map<MenuEntry>((kind) => ({
          id: kind,
          label: labels[kind],
          active: kind === lastUsed,
          onSelect: () => apply(kind),
        })),
    });
    for (const kind of CASES) {
      editor.ui.registry.addMenuItem(MENU_ITEMS[kind], {
        text: labels[kind],
        isEnabled,
        onAction: () => apply(kind),
      });
    }
  },
});
