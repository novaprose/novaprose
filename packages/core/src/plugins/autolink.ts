import { InputRule, inputRules } from 'prosemirror-inputrules';
import type { EditorState, Transaction } from 'prosemirror-state';
import { Plugin, Selection } from 'prosemirror-state';
import { marksOf } from '../commands';
import { definePlugin } from '../plugins';
import { isSafeLinkUrl } from '../url';

/**
 * The autolink plugin:
 * - an address or an e-mail becomes a link when a space is typed after it or Enter is pressed;
 * - pasting an address over selected text makes that text a link (as in Google Docs).
 * `plugins: ['autolink']`.
 */

// An address at the end of the text (group 1) and the trailing punctuation after it (group 2): in "see https://x.com."
// the period isn't part of the link.
const URL_AT_END =
  /(?:^|[\s(])((?:https?:\/\/|www\.)[^\s<>"]*[^\s<>".,;:!?)\]'"]|[\w.+-]+@[\w-]+(?:\.[\w-]+)+)([.,;:!?)\]'"]*)$/i;
const SINGLE_URL = /^(?:https?:\/\/|www\.)\S+$|^mailto:\S+$/i;

function toHref(text: string): string {
  if (/^www\./i.test(text)) return `https://${text}`;
  if (/^[\w.+-]+@/.test(text)) return `mailto:${text}`;
  return text;
}

/** Makes a link of the address ending at position end (if there is one and it isn't a link yet). */
function linkifyBefore(state: EditorState, tr: Transaction, end: number): boolean {
  const $end = state.doc.resolve(end);
  if (!$end.parent.isTextblock || $end.parent.type.spec.code) return false;
  const textBefore = $end.parent.textBetween(0, $end.parentOffset, undefined, '￼');
  const match = textBefore.match(URL_AT_END);
  if (!match) return false;
  const text = match[1]!;
  const to = end - match[2]!.length;
  const from = to - text.length;
  const link = marksOf(state).link;
  if (state.doc.rangeHasMark(from, to, link)) return false;
  const href = toHref(text);
  if (!isSafeLinkUrl(href)) return false;
  tr.addMark(from, to, link.create({ href }));
  return true;
}

export default definePlugin({
  name: 'autolink',
  prosemirrorPlugins: (editor) => [
    inputRules({
      rules: [
        // A space after an address: the address becomes a link and the space itself is inserted.
        new InputRule(/\S\s$/, (state, match, start, end) => {
          if (!editor.isAllowed('link')) return null;
          const tr = state.tr;
          const urlEnd = start + match[0].length - 1;
          if (!linkifyBefore(state, tr, urlEnd)) return null;
          return tr.insertText(match[0].slice(-1), end).removeStoredMark(marksOf(state).link);
        }),
      ],
    }),
    new Plugin({
      /**
       * Enter after an address. The core keymap handles Enter before plugins, so we look
       * at the result: the cursor is at the start of a new block, and the previous block ends with an address.
       */
      appendTransaction(transactions, _old, state) {
        if (!editor.isAllowed('link') || !transactions.some((tr) => tr.docChanged)) return null;
        const { $from, empty } = state.selection;
        if (!empty || $from.parentOffset !== 0 || $from.depth < 1) return null;
        // The end of the previous text block, including in a neighboring list item or cell.
        const prev = Selection.findFrom(state.doc.resolve($from.before()), -1, true);
        if (!prev || !prev.empty || prev.$from.parentOffset !== prev.$from.parent.content.size)
          return null;
        const tr = state.tr;
        return linkifyBefore(state, tr, prev.from) ? tr : null;
      },
    }),
    new Plugin({
      props: {
        handlePaste(view, event) {
          const { state } = view;
          if (state.selection.empty || !editor.isAllowed('link')) return false;
          const text = (event.clipboardData?.getData('text/plain') ?? '').trim();
          if (!SINGLE_URL.test(text)) return false;
          const href = toHref(text);
          if (!isSafeLinkUrl(href)) return false;
          const { from, to } = state.selection;
          const link = marksOf(state).link;
          view.dispatch(
            state.tr.removeMark(from, to, link).addMark(from, to, link.create({ href })),
          );
          return true;
        },
      },
    }),
  ],
});
