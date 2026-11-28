import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEditor, listSuggestions, resolveSuggestions, type Editor } from '../src';
import type { AiRequest } from '../src/plugins/ai';
import { runEdit } from '../src/plugins/ai-chat';
import { readBlockOps } from '../src/plugins/ai-structure';

/**
 * Structure in an AI edit: a block made a heading, a list item or a quote, a new block, a removed
 * one — each a suggestion, so rejecting everything gives the document back.
 */

const editors: Editor[] = [];
afterEach(() => {
  editors.splice(0).forEach((e) => e.destroy());
  document.body.innerHTML = '';
});

const AUTHOR = { id: 'ai', name: 'AI' };

async function edit(content: string, answer: string) {
  const element = document.createElement('div');
  document.body.append(element);
  const request = vi.fn(async function* (_r: AiRequest) {
    for (let i = 0; i < answer.length; i += 5) yield answer.slice(i, i + 5);
  });
  const editor = createEditor({
    element,
    content,
    plugins: ['suggestions', 'ai'],
    pluginOptions: { ai: { request } },
  });
  editors.push(editor);
  await editor.ready;
  const result = await runEdit(editor, 'Restructure.', AUTHOR, new AbortController().signal);
  return { editor, result, request };
}

const decide = (editor: Editor, action: 'accept' | 'reject') =>
  editor.view.dispatch(
    resolveSuggestions(
      editor.view.state,
      action,
      listSuggestions(editor.view.state.doc).map((s) => s.id),
    ),
  );

describe('reading the changes', () => {
  it('text, kinds, new blocks and removed ones; complete ones only', () => {
    const answer =
      '<block id="1">New text</block>\n<block id="2" type="h2">Title</block>\n' +
      '<block after="0" type="p">First</block>\n<block id="3" remove></block>\n<block id="4" remove/>\n' +
      '<block id="5" type="bullet">';
    const { ops, end } = readBlockOps(answer);
    expect(ops).toEqual([
      { op: 'text', id: 1, text: 'New text', kind: null },
      { op: 'text', id: 2, text: 'Title', kind: 'h2' },
      { op: 'insert', after: 0, text: 'First', kind: 'p' },
      { op: 'remove', id: 3 },
      { op: 'remove', id: 4 },
    ]);
    expect(readBlockOps(`${answer}item</block>`, end).ops).toEqual([
      { op: 'text', id: 5, text: 'item', kind: 'bullet' },
    ]);
  });
});

describe('structure as suggestions', () => {
  it('a paragraph made a heading, with its text', async () => {
    const { editor, result } = await edit(
      '<p>Quarterly report</p><p>Sales grew.</p>',
      '<block id="1" type="h2">Quarterly Report</block>',
    );
    expect(result.changed).toBe(1);
    decide(editor, 'accept');
    expect(editor.getHTML()).toBe('<h2>Quarterly Report</h2><p>Sales grew.</p>');
  });

  it('new blocks after a block and at the start keep their order', async () => {
    const original = '<p>Body.</p>';
    const { editor, result } = await edit(
      original,
      '<block after="0" type="h1">Title</block>\n<block after="1" type="p">One.</block>\n<block after="1" type="p">Two.</block>',
    );
    expect(result.changed).toBe(3);
    const reject = editor.getJSON();
    decide(editor, 'accept');
    expect(editor.getHTML()).toBe('<h1>Title</h1><p>Body.</p><p>One.</p><p>Two.</p>');
    editor.setContent(reject);
    decide(editor, 'reject');
    expect(editor.getHTML()).toBe(original);
  });

  it('a block removed stays until accepted', async () => {
    const original = '<p>Keep.</p><p>Drop.</p><p>Keep too.</p>';
    const { editor } = await edit(original, '<block id="2" remove></block>');
    expect(editor.getHTML()).toContain('Drop.');
    const reject = editor.getJSON();
    decide(editor, 'accept');
    expect(editor.getHTML()).toBe('<p>Keep.</p><p>Keep too.</p>');
    editor.setContent(reject);
    decide(editor, 'reject');
    expect(editor.getHTML()).toBe(original);
  });

  it('neighbours made bullets form one list; a quote wraps its block', async () => {
    const original =
      '<p>Intro:</p><p>Milk</p><p>Eggs</p><p>Bread</p><p>As they say, less is more.</p>';
    const { editor, result } = await edit(
      original,
      '<block id="2" type="bullet">Milk</block>\n<block id="3" type="bullet">Eggs</block>\n' +
        '<block id="4" type="bullet">Bread</block>\n<block id="5" type="quote">As they say, less is more.</block>',
    );
    expect(result.changed).toBe(4);
    const reject = editor.getJSON();
    decide(editor, 'accept');
    expect(editor.getHTML()).toBe(
      '<p>Intro:</p><ul><li><p>Milk</p></li><li><p>Eggs</p></li><li><p>Bread</p></li></ul>' +
        '<blockquote><p>As they say, less is more.</p></blockquote>',
    );
    editor.setContent(reject);
    decide(editor, 'reject');
    expect(editor.getHTML()).toBe(original);
  });

  it('a new item after a list item goes into that list', async () => {
    const { editor } = await edit(
      '<ul><li><p>One</p></li><li><p>Two</p></li></ul>',
      '<block after="1" type="bullet">One and a half</block>',
    );
    decide(editor, 'accept');
    expect(editor.getHTML()).toBe(
      '<ul><li><p>One</p></li><li><p>One and a half</p></li><li><p>Two</p></li></ul>',
    );
  });

  it('two items after the same item keep their order', async () => {
    const original = '<ul><li><p>One</p></li><li><p>Two</p></li></ul>';
    const { editor } = await edit(
      original,
      '<block after="1" type="bullet">A</block>\n<block after="1" type="bullet">B</block>',
    );
    const reject = editor.getJSON();
    decide(editor, 'accept');
    expect(editor.getHTML()).toBe(
      '<ul><li><p>One</p></li><li><p>A</p></li><li><p>B</p></li><li><p>Two</p></li></ul>',
    );
    editor.setContent(reject);
    decide(editor, 'reject');
    expect(editor.getHTML()).toBe(original);
  });

  it("a paragraph after a list's last item comes after the list; after a middle one, in its item", async () => {
    const original = '<ul><li><p>One</p></li><li><p>Two</p></li></ul>';
    const { editor, result } = await edit(
      original,
      '<block after="2" type="p">After the list.</block>\n<block after="1" type="p">A note.</block>',
    );
    expect(result.changed).toBe(2);
    const reject = editor.getJSON();
    decide(editor, 'accept');
    expect(editor.getHTML()).toBe(
      '<ul><li><p>One</p><p>A note.</p></li><li><p>Two</p></li></ul><p>After the list.</p>',
    );
    editor.setContent(reject);
    decide(editor, 'reject');
    expect(editor.getHTML()).toBe(original);
  });

  it('a quote after a quoted block joins that quote; a paragraph after it comes after the quote', async () => {
    const original = '<blockquote><p>Said.</p></blockquote>';
    const { editor } = await edit(
      original,
      '<block after="1" type="quote">Also said.</block>\n<block after="1" type="p">Outside.</block>',
    );
    const reject = editor.getJSON();
    decide(editor, 'accept');
    expect(editor.getHTML()).toBe(
      '<blockquote><p>Said.</p><p>Also said.</p></blockquote><p>Outside.</p>',
    );
    editor.setContent(reject);
    decide(editor, 'reject');
    expect(editor.getHTML()).toBe(original);
  });

  it('a new item next to a list of its kind joins it', async () => {
    const { editor } = await edit(
      '<p>Intro:</p><ul><li><p>One</p></li></ul><p>Outro.</p>',
      '<block after="1" type="bullet">Zero</block>\n<block after="2" type="bullet">Two</block>',
    );
    decide(editor, 'accept');
    expect(editor.getHTML()).toBe(
      '<p>Intro:</p><ul><li><p>Zero</p></li><li><p>One</p></li><li><p>Two</p></li></ul><p>Outro.</p>',
    );
  });

  it('before the first block: a heading before a list or a table, an item into the list', async () => {
    const list = await edit(
      '<ul><li><p>One</p></li></ul>',
      '<block after="0" type="h2">Title</block>\n<block after="0" type="p">Intro.</block>',
    );
    decide(list.editor, 'accept');
    expect(list.editor.getHTML()).toBe('<h2>Title</h2><p>Intro.</p><ul><li><p>One</p></li></ul>');

    const item = await edit(
      '<ul><li><p>One</p></li></ul>',
      '<block after="0" type="bullet">Zero</block>',
    );
    decide(item.editor, 'accept');
    expect(item.editor.getHTML()).toBe('<ul><li><p>Zero</p></li><li><p>One</p></li></ul>');

    const table = await edit(
      '<table><tbody><tr><td><p>Cell</p></td></tr></tbody></table>',
      '<block after="0" type="h2">Figures</block>',
    );
    decide(table.editor, 'accept');
    expect(table.editor.getHTML()).toMatch(/^<h2>Figures<\/h2><table[^>]*>.*<p>Cell<\/p>/);
  });

  it("a paragraph after a table's last cell comes after the table; after another cell, in it", async () => {
    const original = '<table><tbody><tr><td><p>A</p></td><td><p>B</p></td></tr></tbody></table>';
    const { editor } = await edit(
      original,
      '<block after="2" type="p">Below.</block>\n<block after="1" type="p">More of A.</block>',
    );
    const reject = editor.getJSON();
    decide(editor, 'accept');
    const html = editor.getHTML();
    expect(html).toMatch(/<p>A<\/p><p>More of A\.<\/p><\/td>/);
    expect(html).toMatch(/<\/table><p>Below\.<\/p>$/);
    editor.setContent(reject);
    decide(editor, 'reject');
    expect(editor.getHTML()).toBe(original);
  });

  it('a paragraph after an item the model added goes into that item', async () => {
    const { editor } = await edit(
      '<ul><li><p>One</p></li><li><p>Two</p></li></ul>',
      '<block after="1" type="bullet">A</block>\n<block after="1" type="p">About A.</block>',
    );
    decide(editor, 'accept');
    expect(editor.getHTML()).toBe(
      '<ul><li><p>One</p></li><li><p>A</p><p>About A.</p></li><li><p>Two</p></li></ul>',
    );
  });

  it('the request shows each block as the model should see it: its kind', async () => {
    const { request } = await edit(
      '<h2>Plan</h2><p>Steps:</p><ol><li><p>Ask</p></li></ol>',
      'NO CHANGES',
    );
    expect(request.mock.calls[0]![0].text).toBe(
      '<block id="1" type="h2">Plan</block>\n<block id="2">Steps:</block>\n<block id="3" type="number">Ask</block>',
    );
    expect(request.mock.calls[0]![0].rules.join(' ')).toContain('type="KIND" (h1 to h6, quote');
  });

  it('ids out of range and unknown kinds are left alone; the prompt explains the format', async () => {
    const { editor, result, request } = await edit(
      '<p>Only.</p>',
      '<block id="9" remove></block>\n<block after="7" type="p">x</block>\n<block id="1" type="table">Only.</block>',
    );
    expect(result.changed).toBe(0);
    expect(editor.getHTML()).toBe('<p>Only.</p>');
    expect(request.mock.calls[0]![0].rules.join(' ')).toContain('<block after="N" type="KIND">');
  });
});
