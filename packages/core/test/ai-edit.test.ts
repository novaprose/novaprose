import { TextSelection } from 'prosemirror-state';
import { afterEach, describe, expect, it } from 'vitest';
import { createEditor, type Editor } from '../src';
import {
  blockEditsTransaction,
  blocksText,
  blockText,
  currentBlock,
  editableBlocks,
  paragraphs,
  rangeText,
  suggestInsert,
  suggestRewrite,
} from '../src/plugins/ai-edit';
import { readBlockOps } from '../src/plugins/ai-structure';
import { listSuggestions, suggestionsResult } from '../src/plugins/suggestions';

/**
 * AI edits as suggestions: only the changed words change, formatting stays; accepting everything
 * gives the model's answer, rejecting everything gives the original text.
 */

let editor: Editor | null = null;
afterEach(() => {
  editor?.destroy();
  editor = null;
  document.body.innerHTML = '';
});

const AI = { id: 'ai', name: 'AI' };

function mount(content: string): Editor {
  const element = document.createElement('div');
  document.body.append(element);
  editor = createEditor({ element, content, plugins: ['suggestions', 'mentions'] });
  return editor;
}

/** All the text of the document (from the start of the first block to the end of the last one). */
function rewriteAll(e: Editor, text: string): void {
  const { doc } = e.view.state;
  e.view.dispatch(suggestRewrite(e.view.state, 0, doc.content.size, text, AI));
}

const textOf = (e: Editor, action: 'accept' | 'reject') =>
  suggestionsResult(e, action).textBetween(0, suggestionsResult(e, action).content.size, '\n\n');

describe('AI edits as suggestions', () => {
  it("only the changed word changes; accepting gives the model's answer, rejecting the original", () => {
    const e = mount('<p>The quick brown fox jumps</p>');
    rewriteAll(e, 'The quick red fox jumps');
    const changes = listSuggestions(e.view.state.doc);
    expect(changes.map((c) => [c.kind, c.text, c.author.name])).toEqual([
      ['delete', 'brown', 'AI'],
      ['insert', 'red', 'AI'],
    ]);
    expect(textOf(e, 'accept')).toBe('The quick red fox jumps');
    expect(textOf(e, 'reject')).toBe('The quick brown fox jumps');
  });

  it('formatting of unchanged words is kept; a new word takes the formatting of its place', () => {
    const e = mount('<p>Hello <strong>bold</strong> <em>world</em></p>');
    rewriteAll(e, 'Hello bold planet');
    const accepted = suggestionsResult(e, 'accept');
    const html = e.getHTML();
    expect(html).toContain('<strong>bold</strong>');
    expect(accepted.textContent).toBe('Hello bold planet');
    // "planet" took the place of "world" along with its italic.
    expect(html).toMatch(/<em>(?:(?!<\/em>).)*<ins[^>]*>planet<\/ins>/);
  });

  it('several paragraphs: in order; extra ones go into the last, missing ones become empty', () => {
    const e = mount('<p>One two</p><p>Three four</p>');
    rewriteAll(e, 'One too\n\nThree four\n\nFive');
    expect(textOf(e, 'accept')).toBe('One too\n\nThree four Five');
    e.setContent('<p>A b</p><p>C d</p><p>E f</p>');
    rewriteAll(e, 'A b');
    // Paragraphs whose whole text was deleted go entirely when accepted, leaving no empty lines.
    expect(textOf(e, 'accept')).toBe('A b');
    expect(textOf(e, 'reject')).toBe('A b\n\nC d\n\nE f');
  });

  it("a mention (an atom) isn't touched if the AI kept it", () => {
    const e = mount('<p>Ask <span data-mention="u1">@Anna</span> now</p>');
    const { doc } = e.view.state;
    expect(rangeText(doc, 0, doc.content.size)).toBe('Ask @Anna now');
    rewriteAll(e, 'Ask @Anna today');
    expect(e.getHTML()).toContain('<span data-mention="u1">@Anna</span>');
    expect(listSuggestions(e.view.state.doc).map((c) => c.text)).toEqual(['now', 'today']);
  });

  it('insertion at the cursor as a suggestion, paragraphs as new paragraphs', () => {
    const e = mount('<p>Start.</p>');
    e.view.dispatch(e.view.state.tr.setSelection(TextSelection.atEnd(e.view.state.doc)));
    const pos = e.view.state.selection.from;
    e.view.dispatch(suggestInsert(e.view.state, pos, ' Next sentence.\n\nNew paragraph.', AI));
    expect(textOf(e, 'accept')).toBe('Start. Next sentence.\n\nNew paragraph.');
    // The text is an insertion, the new paragraph's break a new paragraph break.
    const all = listSuggestions(e.view.state.doc);
    expect(all.every((c) => c.kind === 'insert' || c.kind === 'split')).toBe(true);
    // Rejecting gives exactly the original text: the new paragraph doesn't remain as an empty line.
    expect(textOf(e, 'reject')).toBe('Start.');
  });

  it('a summary as a new paragraph after the block; rejecting gives the original text', () => {
    const e = mount('<p>Long text.</p><p>Next.</p>');
    const end = e.view.state.doc.resolve(2).end();
    e.view.dispatch(suggestInsert(e.view.state, end, 'Summary.', AI, { newParagraph: true }));
    expect(textOf(e, 'accept')).toBe('Long text.\n\nSummary.\n\nNext.');
    expect(textOf(e, 'reject')).toBe('Long text.\n\nNext.');
  });

  it('in the middle of a paragraph the answer goes into that paragraph with spaces at the edges; rejecting gives the original', () => {
    const e = mount('<p>Hello world</p>');
    // Before "world": the answer's paragraphs as one insertion, a space before the word after it.
    e.view.dispatch(suggestInsert(e.view.state, 7, 'big\n\nwide', AI));
    expect(textOf(e, 'accept')).toBe('Hello big wide world');
    expect(textOf(e, 'reject')).toBe('Hello world');
    // Right after "Hello": a space before the insertion.
    e.setContent('<p>Hello world</p>');
    e.view.dispatch(suggestInsert(e.view.state, 6, 'there', AI));
    expect(textOf(e, 'accept')).toBe('Hello there world');
  });

  it("the model's answer → paragraphs", () => {
    expect(paragraphs('  a\nb \r\n\r\n c  ')).toEqual(['a b', 'c']);
    expect(paragraphs('')).toEqual(['']);
  });
});

describe('edits block by block', () => {
  it('whole blocks of the range; code blocks and empty paragraphs are left out', () => {
    const e = mount(
      '<h2>Title</h2><p></p><pre><code>let x</code></pre><ul><li><p>Item</p></li></ul>',
    );
    const { doc } = e.view.state;
    const all = editableBlocks(doc, 0, doc.content.size);
    expect(all.map((b) => b.text)).toEqual(['Title', 'Item']);
    expect(blocksText(all)).toBe('<block id="1">Title</block>\n<block id="2">Item</block>');
    // With the document, each block that isn't a plain paragraph says its kind.
    expect(blocksText(all, doc)).toBe(
      '<block id="1" type="h2">Title</block>\n<block id="2" type="bullet">Item</block>',
    );
    // A selection inside a block takes the whole block.
    expect(editableBlocks(doc, 3, 4).map((b) => b.text)).toEqual(['Title']);
  });

  it('the kinds the model sees: paragraphs plain, cells, quotes, numbered items', () => {
    const e = mount(
      '<p>Plain</p><blockquote><p>Quoted</p></blockquote><ol><li><p>First</p><p>More</p></li></ol>' +
        '<table><tbody><tr><td><p>Cell</p></td></tr></tbody></table>',
    );
    const { doc } = e.view.state;
    expect(blocksText(editableBlocks(doc, 0, doc.content.size), doc)).toBe(
      [
        '<block id="1">Plain</block>',
        '<block id="2" type="quote">Quoted</block>',
        '<block id="3" type="number">First</block>',
        // The second paragraph of an item is the item's own paragraph, not another item.
        '<block id="4">More</block>',
        '<block id="5" type="cell">Cell</block>',
      ].join('\n'),
    );
  });

  it('reads complete blocks as they stream in, from where it stopped', () => {
    const texts = (answer: string, start?: number) => {
      const { ops, end } = readBlockOps(answer, start);
      return { ops: ops.map((op) => (op.op === 'text' ? [op.id, op.text] : op)), end };
    };
    const first = texts('<block id="2">New two</block>\n<block id="5">Fi');
    expect(first.ops).toEqual([[2, 'New two']]);
    const answer = '<block id="2">New two</block>\n<block id="5">Five < six</block>';
    const next = texts(answer, first.end);
    expect(next.ops).toEqual([[5, 'Five < six']]);
    expect(next.end).toBe(answer.length);
    // An unclosed block doesn't swallow the next one; quotes around the id are optional.
    expect(texts("<block id=1>a <block id='3'>c</block>").ops).toEqual([[3, 'c']]);
    expect(texts('NO CHANGES').ops).toEqual([]);
  });

  it("a block's new text: no paragraph breaks, edges like the original's", () => {
    expect(blockText('Hello world', '\nHello there\n')).toBe('Hello there');
    expect(blockText('A b', 'A\r\n\r\nb')).toBe('A b');
    expect(blockText('one\ntwo', 'one\ntoo')).toBe('one\ntoo');
  });

  it('only the changed words of a block change; its line break stays a line break', () => {
    const e = mount('<p>Line one<br>line two</p><p>Other</p>');
    const { state } = e.view;
    const [block] = editableBlocks(state.doc, 0, state.doc.content.size);
    expect(block!.text).toBe('Line one\nline two');
    e.view.dispatch(blockEditsTransaction(state, [{ segment: block!, text: 'Line 1\nline two' }]));
    expect(e.getHTML()).toBe('<p>Line 1<br>line two</p><p>Other</p>');
    // A new line break in the answer becomes a line break, not a newline inside the text.
    const [again] = editableBlocks(e.view.state.doc, 0, 3);
    e.view.dispatch(
      blockEditsTransaction(e.view.state, [{ segment: again!, text: 'Line\n1\nline two' }]),
    );
    expect(e.getHTML()).toBe('<p>Line<br>1<br>line two</p><p>Other</p>');
  });

  it('a block changed since it was sent is not found again', () => {
    const e = mount('<p>Alpha</p><p>Beta</p>');
    const { doc } = e.view.state;
    const [, beta] = editableBlocks(doc, 0, doc.content.size);
    expect(currentBlock(doc, beta!.from, 'Beta')?.text).toBe('Beta');
    expect(currentBlock(doc, beta!.from, 'Gamma')).toBeNull();
    expect(currentBlock(doc, beta!.from + 1, 'Beta')).toBeNull();
    expect(currentBlock(doc, 999, 'Beta')).toBeNull();
  });
});
