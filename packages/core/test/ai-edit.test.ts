import { TextSelection } from 'prosemirror-state';
import { afterEach, describe, expect, it } from 'vitest';
import { createEditor, type Editor } from '../src';
import { paragraphs, rangeText, suggestInsert, suggestRewrite } from '../src/plugins/ai-edit';
import { listSuggestions, suggestionsResult } from '../src/plugins/suggestions';

/**
 * Правки ИИ предложениями: меняются только изменённые слова, оформление остаётся, принять всё —
 * получится ответ модели, отклонить всё — исходный текст.
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

/** Весь текст документа (от начала первого блока до конца последнего). */
function rewriteAll(e: Editor, text: string): void {
  const { doc } = e.view.state;
  e.view.dispatch(suggestRewrite(e.view.state, 0, doc.content.size, text, AI));
}

const textOf = (e: Editor, action: 'accept' | 'reject') =>
  suggestionsResult(e, action).textBetween(0, suggestionsResult(e, action).content.size, '\n\n');

describe('правки ИИ — предложениями', () => {
  it('меняется только изменённое слово; принять — ответ модели, отклонить — исходное', () => {
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

  it('оформление неизменённых слов сохраняется; новое слово — с оформлением места', () => {
    const e = mount('<p>Hello <strong>bold</strong> <em>world</em></p>');
    rewriteAll(e, 'Hello bold planet');
    const accepted = suggestionsResult(e, 'accept');
    const html = e.getHTML();
    expect(html).toContain('<strong>bold</strong>');
    expect(accepted.textContent).toBe('Hello bold planet');
    // «planet» встал на место «world» и взял его курсив.
    expect(html).toMatch(/<em>(?:(?!<\/em>).)*<ins[^>]*>planet<\/ins>/);
  });

  it('несколько абзацев: по порядку; лишние — в последний, недостающие — пустые', () => {
    const e = mount('<p>One two</p><p>Three four</p>');
    rewriteAll(e, 'One too\n\nThree four\n\nFive');
    expect(textOf(e, 'accept')).toBe('One too\n\nThree four Five');
    e.setContent('<p>A b</p><p>C d</p><p>E f</p>');
    rewriteAll(e, 'A b');
    // Абзацы, весь текст которых удалён, при принятии уходят целиком — без пустых строк.
    expect(textOf(e, 'accept')).toBe('A b');
    expect(textOf(e, 'reject')).toBe('A b\n\nC d\n\nE f');
  });

  it('упоминание (атом) не тронуто, если ИИ его сохранил', () => {
    const e = mount('<p>Ask <span data-mention="u1">@Anna</span> now</p>');
    const { doc } = e.view.state;
    expect(rangeText(doc, 0, doc.content.size)).toBe('Ask @Anna now');
    rewriteAll(e, 'Ask @Anna today');
    expect(e.getHTML()).toContain('<span data-mention="u1">@Anna</span>');
    expect(listSuggestions(e.view.state.doc).map((c) => c.text)).toEqual(['now', 'today']);
  });

  it('вставка у курсора — предложением, абзацы — новыми абзацами', () => {
    const e = mount('<p>Start.</p>');
    e.view.dispatch(e.view.state.tr.setSelection(TextSelection.atEnd(e.view.state.doc)));
    const pos = e.view.state.selection.from;
    e.view.dispatch(suggestInsert(e.view.state, pos, ' Next sentence.\n\nNew paragraph.', AI));
    expect(textOf(e, 'accept')).toBe('Start. Next sentence.\n\nNew paragraph.');
    expect(listSuggestions(e.view.state.doc).every((c) => c.kind === 'insert')).toBe(true);
    // Отклонить — ровно исходный текст: новый абзац не остаётся пустой строкой.
    expect(textOf(e, 'reject')).toBe('Start.');
  });

  it('пересказ — новым абзацем после блока; отклонить — исходный текст', () => {
    const e = mount('<p>Long text.</p><p>Next.</p>');
    const end = e.view.state.doc.resolve(2).end();
    e.view.dispatch(suggestInsert(e.view.state, end, 'Summary.', AI, { newParagraph: true }));
    expect(textOf(e, 'accept')).toBe('Long text.\n\nSummary.\n\nNext.');
    expect(textOf(e, 'reject')).toBe('Long text.\n\nNext.');
  });

  it('посреди абзаца ответ встаёт в этот же абзац, с пробелами по краям; отклонить — исходное', () => {
    const e = mount('<p>Hello world</p>');
    // Перед «world»: абзацы ответа — одной вставкой, пробел перед словом после неё.
    e.view.dispatch(suggestInsert(e.view.state, 7, 'big\n\nwide', AI));
    expect(textOf(e, 'accept')).toBe('Hello big wide world');
    expect(textOf(e, 'reject')).toBe('Hello world');
    // Сразу после «Hello»: пробел перед вставкой.
    e.setContent('<p>Hello world</p>');
    e.view.dispatch(suggestInsert(e.view.state, 6, 'there', AI));
    expect(textOf(e, 'accept')).toBe('Hello there world');
  });

  it('ответ модели → абзацы', () => {
    expect(paragraphs('  a\nb \r\n\r\n c  ')).toEqual(['a b', 'c']);
    expect(paragraphs('')).toEqual(['']);
  });
});
