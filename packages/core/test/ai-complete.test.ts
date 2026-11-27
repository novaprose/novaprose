import { TextSelection } from 'prosemirror-state';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEditor, type Editor } from '../src';
import type { AiRequest } from '../src/plugins/ai';
import { completionText } from '../src/plugins/ai-complete';

/**
 * AI autocomplete: after a pause at the end of a paragraph the model's continuation shows in grey;
 * Tab accepts it, typing its own letters keeps the rest, anything else hides it. It is never part
 * of the document until accepted.
 */

let editor: Editor | null = null;
afterEach(() => {
  vi.useRealTimers();
  editor?.destroy();
  editor = null;
  document.body.innerHTML = '';
});

async function mount(
  content: string,
  request: (r: AiRequest) => Promise<string>,
  autocomplete: boolean | { delay?: number } = true,
): Promise<Editor> {
  const element = document.createElement('div');
  document.body.append(element);
  editor = createEditor({
    element,
    content,
    plugins: ['suggestions', 'ai'],
    pluginOptions: { ai: { request, autocomplete } },
  });
  await editor.ready;
  // jsdom has no real focus for the text; autocomplete works only in a focused editor.
  editor.view.hasFocus = () => true;
  vi.useFakeTimers();
  return editor;
}

/** Typing: a user's transaction at the cursor. */
function type(e: Editor, text: string): void {
  e.view.dispatch(e.view.state.tr.insertText(text));
}

function toEnd(e: Editor): void {
  e.view.dispatch(e.view.state.tr.setSelection(TextSelection.atEnd(e.view.state.doc)));
}

/** The suggestion's text (without the Tab key hint), or undefined when none is shown. */
const ghost = (e: Editor) =>
  e.view.dom.querySelector('.nova-ai-ghost')?.textContent?.replace(/Tab$/, '');

function key(e: Editor, name: string): void {
  e.view.dom.dispatchEvent(
    new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true }),
  );
}

describe('AI autocomplete', () => {
  it('a pause at the end of a paragraph: the continuation in grey; Tab accepts it', async () => {
    const request = vi.fn(async (_r: AiRequest) => 'ld, how are you?');
    const e = await mount('<p>Hello</p>', request);
    const announce = vi.spyOn(e.ui, 'announce');
    toEnd(e);
    type(e, ' wor');
    await vi.advanceTimersByTimeAsync(600);
    expect(request).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(200);
    expect(request).toHaveBeenCalledOnce();
    const r = request.mock.calls[0]![0];
    expect(r).toMatchObject({ action: 'complete', text: '', before: 'Hello wor', after: '' });
    expect(r.prompt).toContain('<before>\nHello wor\n</before>');
    expect(ghost(e)).toBe('ld, how are you?');
    // Hidden from screen readers, so announced once (the label ends the sentence itself).
    expect(announce).toHaveBeenCalledWith('Suggestion: ld, how are you. Press Tab to accept.');
    // Only shown: not in the document, not in the HTML.
    expect(e.getHTML()).toBe('<p>Hello wor</p>');
    key(e, 'Tab');
    expect(e.getHTML()).toBe('<p>Hello world, how are you?</p>');
    expect(ghost(e)).toBeUndefined();
  });

  it("typing the suggestion's own letters keeps the rest; other letters and Esc hide it", async () => {
    const e = await mount('<p>Good morning</p>', async () => ' to you all');
    toEnd(e);
    type(e, '!');
    await vi.advanceTimersByTimeAsync(700);
    expect(ghost(e)).toBe(' to you all');
    type(e, ' t');
    expect(ghost(e)).toBe('o you all');
    type(e, 'x');
    expect(ghost(e)).toBeUndefined();
    await vi.advanceTimersByTimeAsync(700);
    expect(ghost(e)).toBe(' to you all');
    key(e, 'Escape');
    expect(ghost(e)).toBeUndefined();
    expect(e.getHTML()).toBe('<p>Good morning! tx</p>');
  });

  it('no request in the middle of a paragraph, in code, with too little text, or when turned off', async () => {
    const request = vi.fn(async () => 'more');
    const e = await mount('<p>Hi</p><pre><code>let value</code></pre><p>Middle text</p>', request);
    // Too little text.
    e.view.dispatch(e.view.state.tr.setSelection(TextSelection.create(e.view.state.doc, 3)));
    type(e, '!');
    await vi.advanceTimersByTimeAsync(1000);
    // In a code block.
    e.view.dispatch(e.view.state.tr.setSelection(TextSelection.create(e.view.state.doc, 15)));
    type(e, 's');
    await vi.advanceTimersByTimeAsync(1000);
    // In the middle of a paragraph.
    const doc = e.view.state.doc;
    e.view.dispatch(e.view.state.tr.setSelection(TextSelection.create(doc, doc.content.size - 5)));
    type(e, 'x');
    await vi.advanceTimersByTimeAsync(1000);
    expect(request).not.toHaveBeenCalled();
    // Turned off with the aiautocomplete toggle.
    toEnd(e);
    const toggle = e.ui.registry.get('aiautocomplete');
    if (toggle?.type !== 'button') throw new Error('no aiautocomplete toggle');
    expect(toggle.isActive?.(e)).toBe(true);
    toggle.onAction(e);
    expect(toggle.isActive?.(e)).toBe(false);
    type(e, '.');
    await vi.advanceTimersByTimeAsync(1000);
    expect(request).not.toHaveBeenCalled();
  });

  it('an answer that arrives after the author typed on is dropped', async () => {
    let answer: (text: string) => void = () => {};
    const e = await mount(
      '<p>Dear team</p>',
      () => new Promise<string>((resolve) => (answer = resolve)),
    );
    toEnd(e);
    type(e, ',');
    await vi.advanceTimersByTimeAsync(700);
    type(e, ' I');
    answer(' we did it');
    await vi.advanceTimersByTimeAsync(0);
    expect(ghost(e)).toBeUndefined();
  });

  it('without the autocomplete option there is no toggle and no request', async () => {
    const element = document.createElement('div');
    document.body.append(element);
    const request = vi.fn(async () => 'x');
    editor = createEditor({
      element,
      content: '<p>Hello there</p>',
      plugins: ['suggestions', 'ai'],
      pluginOptions: { ai: { request } },
    });
    await editor.ready;
    expect(editor.ui.registry.get('aiautocomplete')).toBeUndefined();
  });
});

describe("the model's continuation", () => {
  it('its first line, without a space the text already has, quotes taken off', () => {
    expect(completionText('ld, how are you?\nSecond line', 'Hello wor')).toBe('ld, how are you?');
    expect(completionText('  next words  ', 'Hello ')).toBe('next words');
    expect(completionText(' next words', 'Hello')).toBe(' next words');
    expect(completionText('"quoted words"', 'Say ')).toBe('quoted words');
    expect(completionText('\n\nlater line', 'A')).toBe('later line');
    expect(completionText('   ', 'A')).toBe('');
    expect(completionText(`${'word '.repeat(60)}`, 'A ').length).toBeLessThanOrEqual(200);
  });
});
