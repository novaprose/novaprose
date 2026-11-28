import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEditor, listSuggestions, resolveSuggestions, type Editor } from '../src';
import type { AiRequest } from '../src/plugins/ai';
import { locate, readFindings, runReview } from '../src/plugins/ai-review';

/** AI review: the model's remarks, each with its reason; a fix becomes a suggestion where the words are. */

const editors: Editor[] = [];
afterEach(() => {
  editors.splice(0).forEach((e) => e.destroy());
  document.body.innerHTML = '';
});

const AUTHOR = { id: 'ai', name: 'AI' };

async function mount(
  content: string,
  answer: string | ((request: AiRequest) => string),
  { editable = true } = {},
) {
  const element = document.createElement('div');
  document.body.append(element);
  const request = vi.fn(async function* (r: AiRequest) {
    const text = typeof answer === 'string' ? answer : answer(r);
    // Streams in small pieces: a finding is read only once it is complete.
    for (let i = 0; i < text.length; i += 7) yield text.slice(i, i + 7);
  });
  const editor = createEditor({
    element,
    content,
    editable,
    plugins: ['suggestions', 'ai'],
    pluginOptions: { ai: { request } },
  });
  editors.push(editor);
  await editor.ready;
  return { editor, request };
}

const finding = (block: number, quote: string, fix: string, why: string) =>
  `<finding block="${block}"><quote>${quote}</quote><fix>${fix}</fix><why>${why}</why></finding>\n`;

describe('reading the answer', () => {
  it('reads complete findings only, from where it stopped', () => {
    const answer = finding(1, 'teh', 'the', 'Typo.') + '<finding block="2"><quote>half';
    const first = readFindings(answer);
    expect(first.findings).toEqual([{ block: 1, quote: 'teh', fix: 'the', why: 'Typo.' }]);
    const more = readFindings(
      `${answer} done</quote><fix></fix><why>Vague.</why></finding>`,
      first.end,
    );
    expect(more.findings).toEqual([{ block: 2, quote: 'half done', fix: '', why: 'Vague.' }]);
  });

  it('skips a finding without a quote; tolerates spacing and attribute quotes', () => {
    const { findings } = readFindings(
      "<finding block=3><why>No quote.</why></finding>\n<finding block='4'>\n  <quote> a\n b </quote>\n  <fix>c</fix>\n</finding>",
    );
    expect(findings).toEqual([{ block: 4, quote: 'a b', fix: 'c', why: '' }]);
  });

  it('finds the quoted words exactly, or with other spacing and case', () => {
    expect(locate('We recieve it', 'recieve')).toEqual({ index: 3, length: 7 });
    expect(locate('The  Big   dog', 'big dog')).toEqual({ index: 5, length: 9 });
    expect(locate('Nothing here', 'missing')).toBeNull();
  });
});

describe('a review in the document', () => {
  it('each fix becomes its own suggestion, also two in one paragraph; a remark has none', async () => {
    const { editor, request } = await mount(
      '<p>We recieve teh results tomorrow.</p><p>The plan is good.</p>',
      finding(1, 'recieve', 'receive', 'Spelling.') +
        finding(1, 'teh', 'the', 'Spelling.') +
        finding(2, 'good', '', 'Say what exactly is good.'),
    );
    const seen: string[] = [];
    const result = await runReview(editor, 'Find mistakes.', AUTHOR, new AbortController().signal, {
      onFinding: (f) => seen.push(f.quote),
    });
    expect(result.status).toBe('done');
    expect(seen).toEqual(['recieve', 'teh', 'good']);
    const [receive, the, good] = result.findings;
    expect(receive!.ids.length).toBeGreaterThan(0);
    expect(the!.ids.length).toBeGreaterThan(0);
    expect(receive!.ids).not.toEqual(the!.ids);
    expect(good!.ids).toEqual([]);
    expect(good!.from).not.toBeNull();
    // The request went as a review, with the rules for the answer.
    const sent = request.mock.calls[0]![0];
    expect(sent.action).toBe('review');
    expect(sent.text).toContain('<block id="1">We recieve teh results tomorrow.</block>');
    expect(sent.rules.join(' ')).toContain('<finding block="N">');
    // Accepting one remark's fix applies that one only.
    editor.view.dispatch(resolveSuggestions(editor.view.state, 'accept', the!.ids));
    editor.view.dispatch(resolveSuggestions(editor.view.state, 'reject', receive!.ids));
    expect(editor.getHTML()).toBe(
      '<p>We recieve the results tomorrow.</p><p>The plan is good.</p>',
    );
  });

  it('a misquoted remark is listed without a place; a read-only document gets remarks, no edits', async () => {
    const { editor } = await mount(
      '<p>We recieve it.</p>',
      finding(1, 'nonexistent words', 'x', 'Misquoted.') +
        finding(1, 'recieve', 'receive', 'Spelling.'),
      { editable: false },
    );
    const result = await runReview(editor, 'Find mistakes.', AUTHOR, new AbortController().signal);
    expect(result.findings.map((f) => [f.quote, f.from === null, f.ids.length])).toEqual([
      ['nonexistent words', true, 0],
      ['recieve', false, 0],
    ]);
    expect(listSuggestions(editor.view.state.doc)).toEqual([]);
  });

  it('words someone changed while the model was writing are left alone', async () => {
    let edited = false;
    const { editor } = await mount('<p>We recieve it.</p>', () => {
      if (!edited) {
        edited = true;
        // The user retypes the word before the answer arrives.
        const { state } = editor.view;
        const at = state.doc.textContent.indexOf('recieve') + 1;
        editor.view.dispatch(state.tr.insertText('get', at, at + 'recieve'.length));
      }
      return finding(1, 'recieve', 'receive', 'Spelling.');
    });
    const result = await runReview(editor, 'Find mistakes.', AUTHOR, new AbortController().signal);
    expect(result.findings[0]!.ids).toEqual([]);
    expect(editor.getHTML()).toBe('<p>We get it.</p>');
  });

  it('"NO PROBLEMS" is an answer; anything else unreadable is said so', async () => {
    const clean = await mount('<p>Fine text.</p>', 'NO PROBLEMS');
    const none = await runReview(clean.editor, 'x', AUTHOR, new AbortController().signal);
    expect([none.findings.length, none.unmatched]).toEqual([0, false]);
    const odd = await mount('<p>Fine text.</p>', 'Looks great to me!');
    const unread = await runReview(odd.editor, 'x', AUTHOR, new AbortController().signal);
    expect(unread.unmatched).toBe(true);
  });
});
