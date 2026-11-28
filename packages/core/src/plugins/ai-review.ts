import { Mapping } from 'prosemirror-transform';
import type { Editor } from '../editor';
import { aiOptions, around, askModel, failureKind, MAX_DOCUMENT, type AiMessage } from './ai-core';
import { blockEditsTransaction, blocksText, editableBlocks, type TextSegment } from './ai-edit';
import { listSuggestions, OWN, suggestTransaction, type SuggestionAuthor } from './suggestions';

/**
 * AI review: the model reads the document (or the selected paragraphs) and lists the problems it
 * finds, each with a short explanation. A problem with a fix becomes a suggested edit right where
 * the quoted words are, so each one can be accepted or rejected on its own; a remark without a fix
 * points to its place. The model answers block by block, like the chat panel's Edit mode:
 * `<finding block="N"><quote>…</quote><fix>…</fix><why>…</why></finding>`.
 */

export interface Finding {
  /** The number of its block in the request (from 1). */
  block: number;
  /** The words of the block the problem is in, as the model quoted them. */
  quote: string;
  /** What goes in their place; '' for a remark without a fix. */
  fix: string;
  /** Why: one short sentence. */
  why: string;
  /** The suggestions that make the fix in the text (empty for a remark, or when it couldn't be made). */
  ids: string[];
  /** Where the quoted words were when the request was sent (for "Show"), or null when not found. */
  from: number | null;
  to: number | null;
}

export interface ReviewResult {
  findings: Finding[];
  status: 'done' | 'stopped' | 'tooLong' | 'notConfigured' | 'failed' | 'noText';
  /** The answer had neither findings nor "NO PROBLEMS": it couldn't be read. */
  unmatched: boolean;
}

/** The default request of a review (the panel's Review button). */
export const REVIEW_INSTRUCTION =
  'Find mistakes of spelling, grammar and punctuation, unclear or wordy sentences, repetitions and inconsistencies.';

// A finding's body can hold "<" (a < b), but not another <finding>: an unclosed one isn't read
// together with the next.
const FINDING_RE = /<finding\s+block=["']?(\d+)["']?\s*>((?:[^<]|<(?!\/?finding\b))*)<\/finding>/g;

function part(body: string, tag: string): string {
  const match = new RegExp(`<${tag}>((?:[^<]|<(?!/?${tag}>))*)</${tag}>`).exec(body);
  return match ? match[1]!.replace(/\s+/g, ' ').trim() : '';
}

/**
 * The complete findings of an answer, read from `start` (an answer is read again as it streams
 * in); `end` is where the reading stopped, the start for the next time.
 */
export function readFindings(
  answer: string,
  start = 0,
): { findings: Array<Pick<Finding, 'block' | 'quote' | 'fix' | 'why'>>; end: number } {
  const re = new RegExp(FINDING_RE.source, 'g');
  re.lastIndex = start;
  const findings: Array<Pick<Finding, 'block' | 'quote' | 'fix' | 'why'>> = [];
  let end = start;
  for (let match = re.exec(answer); match; match = re.exec(answer)) {
    end = re.lastIndex;
    const body = match[2]!;
    const quote = part(body, 'quote');
    if (!quote) continue;
    findings.push({
      block: Number(match[1]),
      quote,
      fix: part(body, 'fix'),
      why: part(body, 'why').slice(0, 300),
    });
  }
  return { findings, end };
}

/** Where the quoted words are in a block's text: exactly, or with any spacing and case. */
export function locate(text: string, quote: string): { index: number; length: number } | null {
  const exact = text.indexOf(quote);
  if (exact >= 0) return { index: exact, length: quote.length };
  const words = quote.split(/\s+/).filter(Boolean);
  if (!words.length) return null;
  const pattern = words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s+');
  const match = new RegExp(pattern, 'i').exec(text);
  return match ? { index: match.index, length: match[0].length } : null;
}

/**
 * Reviews the selected blocks (the whole document without a selection) as the instruction asks.
 * Each finding with a fix becomes a suggestion as soon as it arrives; `onFinding` hears of each.
 */
export async function runReview(
  editor: Editor,
  instruction: string,
  author: SuggestionAuthor,
  signal: AbortSignal,
  {
    messages = [],
    onFinding,
  }: { messages?: AiMessage[]; onFinding?: (finding: Finding) => void } = {},
): Promise<ReviewResult> {
  const { doc, selection } = editor.view.state;
  const whole = selection.empty;
  const blocks = editableBlocks(
    doc,
    whole ? 0 : selection.from,
    whole ? doc.content.size : selection.to,
  );
  const result: ReviewResult = { findings: [], status: 'done', unmatched: false };
  if (!blocks.length) {
    result.status = 'noText';
    return result;
  }
  const max = aiOptions(editor).maxDocument ?? MAX_DOCUMENT;
  if (blocks.reduce((sum, block) => sum + block.text.length, 0) > max) {
    result.status = 'tooLong';
    return result;
  }
  // Positions as they were sent → positions now (typing, collaborators, the review's own edits).
  const mapping = new Mapping();
  const off = editor.on('change', (_e, { transaction }) =>
    mapping.appendMapping(transaction.mapping),
  );
  let read = 0;
  const apply = (answer: string) => {
    const { findings, end } = readFindings(answer, read);
    read = end;
    for (const raw of findings) {
      const sent = blocks[raw.block - 1];
      const found = sent ? locate(sent.text, raw.quote) : null;
      const finding: Finding = { ...raw, ids: [], from: null, to: null };
      if (sent && found) {
        const chars = sent.chars.slice(found.index, found.index + found.length);
        finding.from = chars[0]!;
        finding.to = chars[chars.length - 1]! + 1;
        if (raw.fix !== '' && editor.isEditable())
          finding.ids = suggestFix(editor, sent, found, raw.fix, mapping, author);
      }
      result.findings.push(finding);
      onFinding?.(finding);
    }
  };
  let answer = '';
  try {
    const context = whole ? {} : around(doc, blocks[0]!.from, blocks[blocks.length - 1]!.to);
    answer = await askModel(
      editor,
      { action: 'review', instruction, text: blocksText(blocks, doc), ...context, messages },
      signal,
      apply,
    );
    if (signal.aborted) result.status = 'stopped';
  } catch (error) {
    if (!signal.aborted) console.error('[nova] ai:', error);
    result.status = signal.aborted ? 'stopped' : failureKind(error);
  } finally {
    off();
  }
  result.unmatched =
    result.status === 'done' &&
    !result.findings.length &&
    !!answer.trim() &&
    !/^\W*no problems\W*$/i.test(answer.trim());
  return result;
}

/**
 * A finding's fix as suggestions in place of the quoted words, if they are still there as they were
 * (someone may have changed them while the model was writing). Returns the suggestions' ids.
 */
function suggestFix(
  editor: Editor,
  block: TextSegment,
  found: { index: number; length: number },
  fix: string,
  mapping: Mapping,
  author: SuggestionAuthor,
): string[] {
  const text = block.text.slice(found.index, found.index + found.length);
  const chars = block.chars
    .slice(found.index, found.index + found.length)
    .map((pos) => mapping.map(pos, 1));
  const state = editor.view.state;
  const { doc } = state;
  // Every character where it was, in order, and the same character.
  const intact = chars.every(
    (pos, i) =>
      pos >= 0 &&
      pos < doc.content.size &&
      (i === 0 || pos > chars[i - 1]!) &&
      (text[i] === '\ufffc' || doc.textBetween(pos, pos + 1, '', '\ufffc') === text[i]),
  );
  if (!intact) return [];
  const segment: TextSegment = { from: chars[0]!, to: chars[chars.length - 1]! + 1, text, chars };
  const known = new Set(listSuggestions(doc).map((s) => s.id));
  const tr = blockEditsTransaction(state, [{ segment, text: fix }]);
  if (!tr.docChanged) return [];
  editor.view.dispatch(suggestTransaction(tr, state, author).setMeta(OWN, true));
  return [
    ...new Set(
      listSuggestions(editor.view.state.doc)
        .filter((s) => !known.has(s.id) && s.author.id === author.id)
        .map((s) => s.id),
    ),
  ];
}
