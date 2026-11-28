import { TextSelection } from 'prosemirror-state';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEditor, type Editor } from '../src';
import type { AiOptions, AiRequest } from '../src/plugins/ai';
import { listSuggestions, suggestionsResult } from '../src/plugins/suggestions';

/**
 * The AI chat panel: questions about the document (Ask), an answer into the text as a suggestion
 * (Insert, Replace selection), and edits of the whole document block by block (Edit) applied as
 * suggestions as they stream in.
 */

let editor: Editor | null = null;
afterEach(() => {
  editor?.destroy();
  editor = null;
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

async function mount(content: string, ai: AiOptions = {}): Promise<Editor> {
  const element = document.createElement('div');
  document.body.append(element);
  editor = createEditor({
    element,
    content,
    plugins: ['suggestions', 'ai'],
    pluginOptions: { ai },
  });
  await editor.ready;
  return editor;
}

async function openChat(e: Editor): Promise<HTMLElement> {
  const button = e.ui.registry.get('aichat');
  if (button?.type !== 'button') throw new Error('no aichat button');
  button.onAction(e);
  await vi.waitFor(() => expect(e.root.querySelector('.nova-ai-chat')).not.toBeNull());
  return e.root.querySelector<HTMLElement>('.nova-ai-chat')!;
}

function send(panel: HTMLElement, text: string): void {
  const input = panel.querySelector<HTMLTextAreaElement>('.nova-ai-input')!;
  input.value = text;
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
}

const buttons = (panel: HTMLElement, label: string) =>
  [...panel.querySelectorAll<HTMLButtonElement>('button')].filter((b) => b.textContent === label);
const button = (panel: HTMLElement, label: string) => buttons(panel, label).at(-1)!;
const lastAnswer = (panel: HTMLElement) =>
  [...panel.querySelectorAll<HTMLElement>('.nova-ai-msg-assistant')].at(-1)!;

const accepted = (e: Editor) => {
  const doc = suggestionsResult(e, 'accept');
  return doc.textBetween(0, doc.content.size, '\n\n');
};

function select(e: Editor, from: number, to: number): void {
  e.view.dispatch(e.view.state.tr.setSelection(TextSelection.create(e.view.state.doc, from, to)));
}

function editMode(panel: HTMLElement): void {
  const radio = panel.querySelector<HTMLInputElement>('input[value="edit"]')!;
  radio.checked = true;
  radio.dispatchEvent(new Event('change'));
}

describe('the AI chat: Ask', () => {
  it('a question with the document as context; the answer appears in the panel', async () => {
    const request = vi.fn(async (_r: AiRequest) => 'It is about foxes.');
    const e = await mount('<h2>Foxes</h2><p>The quick brown fox.</p>', { request });
    const panel = await openChat(e);
    expect(panel.querySelector('.nova-ai-scope')!.textContent).toBe('Context: the whole document');
    // The message box has focus once the panel opens.
    await vi.waitFor(() =>
      expect(document.activeElement).toBe(panel.querySelector('.nova-ai-input')),
    );
    send(panel, 'What is this about?');
    await vi.waitFor(() =>
      expect(lastAnswer(panel).querySelector('.nova-ai-text')!.textContent).toBe(
        'It is about foxes.',
      ),
    );
    const r = request.mock.calls[0]![0];
    expect(r).toMatchObject({
      action: 'chat',
      instruction: 'What is this about?',
      text: '',
      document: 'Foxes\n\nThe quick brown fox.',
      messages: [],
    });
    expect(r.prompt).toContain('<document>\nFoxes\n\nThe quick brown fox.\n</document>');
    expect(r.prompt.endsWith("The user's message: What is this about?")).toBe(true);
    expect(r.rules.join(' ')).toContain("language of the user's message");
    expect(panel.querySelector('.nova-ai-msg-user')!.textContent).toContain('What is this about?');
    // The document didn't change: answers go into the text only when asked to.
    expect(listSuggestions(e.view.state.doc)).toEqual([]);
  });

  it('a follow-up question carries the conversation; the selection is sent with it', async () => {
    const answers = ['First answer.', 'Second answer.'];
    const request = vi.fn(async (_r: AiRequest) => answers.shift()!);
    const e = await mount('<p>Alpha beta gamma.</p>', { request });
    const panel = await openChat(e);
    send(panel, 'One?');
    await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(1));
    await vi.waitFor(() => expect(button(panel, 'Insert')).toBeDefined());
    select(e, 1, 6);
    expect(panel.querySelector('.nova-ai-scope')!.textContent).toBe('Context: the selected text');
    send(panel, 'Two?');
    await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(2));
    expect(request.mock.calls[1]![0]).toMatchObject({
      text: 'Alpha',
      messages: [
        { role: 'user', text: 'One?' },
        { role: 'assistant', text: 'First answer.' },
      ],
    });
    expect(request.mock.calls[1]![0].prompt).toContain(
      '<conversation>\nUser: One?\n\nAssistant: First answer.\n</conversation>',
    );
    expect(request.mock.calls[1]![0].prompt).toContain('<selection>\nAlpha\n</selection>');
  });

  it('Insert: the answer as a suggestion — a new paragraph after the one with the cursor', async () => {
    const e = await mount('<p>Intro.</p><p>Tail.</p>', {
      request: async () => 'A new paragraph.\n\nAnd another.',
    });
    const panel = await openChat(e);
    e.view.dispatch(e.view.state.tr.setSelection(TextSelection.create(e.view.state.doc, 7)));
    send(panel, 'Write more');
    await vi.waitFor(() => expect(button(panel, 'Insert')).toBeDefined());
    button(panel, 'Insert').click();
    expect(accepted(e)).toBe('Intro.\n\nA new paragraph.\n\nAnd another.\n\nTail.');
    expect(listSuggestions(e.view.state.doc).every((s) => s.author.name === 'AI')).toBe(true);
    // Rejecting leaves the document as it was.
    const doc = suggestionsResult(e, 'reject');
    expect(doc.textBetween(0, doc.content.size, '\n\n')).toBe('Intro.\n\nTail.');
  });

  it('Replace selection rewrites the selected words only; it needs a selection', async () => {
    const e = await mount('<p>The quick brown fox.</p>', { request: async () => 'quick red' });
    const panel = await openChat(e);
    send(panel, 'Another color');
    await vi.waitFor(() => expect(button(panel, 'Replace selection')).toBeDefined());
    expect(button(panel, 'Replace selection').disabled).toBe(true);
    select(e, 5, 16);
    expect(button(panel, 'Replace selection').disabled).toBe(false);
    button(panel, 'Replace selection').click();
    expect(accepted(e)).toBe('The quick red fox.');
    expect(listSuggestions(e.view.state.doc).map((s) => [s.kind, s.text])).toEqual([
      ['delete', 'brown'],
      ['insert', 'red'],
    ]);
  });

  it('Stop cancels the answer; New chat starts over', async () => {
    let signal: AbortSignal | undefined;
    const e = await mount('<p>Text</p>', {
      async *request(r) {
        signal = r.signal;
        yield 'Partial';
        await new Promise((resolve) => r.signal.addEventListener('abort', resolve));
      },
    });
    const panel = await openChat(e);
    send(panel, 'Go');
    await vi.waitFor(() => expect(lastAnswer(panel).textContent).toContain('Partial'));
    expect(button(panel, 'Send').hidden).toBe(true);
    button(panel, 'Stop').click();
    expect(signal!.aborted).toBe(true);
    await vi.waitFor(() => expect(lastAnswer(panel).textContent).toContain('Stopped.'));
    expect(button(panel, 'Send').hidden).toBe(false);
    button(panel, 'New chat').click();
    expect(panel.querySelectorAll('.nova-ai-msg')).toHaveLength(0);
    expect(panel.querySelector<HTMLElement>('.nova-ai-empty')!.hidden).toBe(false);
  });

  it('without a connected model: a message in the conversation', async () => {
    const e = await mount('<p>Text</p>');
    const panel = await openChat(e);
    send(panel, 'Hello?');
    await vi.waitFor(() =>
      expect(lastAnswer(panel).querySelector('.nova-ai-error')!.textContent).toBe(
        'AI is not connected to this editor.',
      ),
    );
  });

  it('while focus is in the panel the selection stays visible in the text', async () => {
    const e = await mount('<p>Alpha beta</p>', { request: async () => '' });
    const panel = await openChat(e);
    select(e, 1, 6);
    panel.querySelector<HTMLTextAreaElement>('.nova-ai-input')!.focus();
    panel.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    expect(e.view.dom.querySelector('.nova-ai-context')?.textContent).toBe('Alpha');
    panel.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: e.view.dom }));
    expect(e.view.dom.querySelector('.nova-ai-context')).toBeNull();
  });
});

describe('the AI chat and code blocks', () => {
  it('Insert with the cursor in code puts the answer after the block; Replace is off for code', async () => {
    const e = await mount('<pre><code>let x = 1;</code></pre>', { request: async () => 'A note.' });
    const panel = await openChat(e);
    e.view.dispatch(e.view.state.tr.setSelection(TextSelection.create(e.view.state.doc, 4)));
    send(panel, 'Explain');
    await vi.waitFor(() => expect(button(panel, 'Insert')).toBeDefined());
    select(e, 1, 6);
    expect(button(panel, 'Replace selection').disabled).toBe(true);
    e.view.dispatch(e.view.state.tr.setSelection(TextSelection.create(e.view.state.doc, 4)));
    button(panel, 'Insert').click();
    expect(accepted(e)).toBe('let x = 1;\n\nA note.');
  });

  it('Edit with only code selected: no request, the panel says why', async () => {
    const request = vi.fn(async () => 'NO CHANGES');
    const e = await mount('<p>Text</p><pre><code>let x = 1;</code></pre>', { request });
    const panel = await openChat(e);
    editMode(panel);
    select(e, 8, 14);
    send(panel, 'Fix it');
    await vi.waitFor(() =>
      expect(lastAnswer(panel).textContent).toContain("There's no text to change here"),
    );
    expect(request).not.toHaveBeenCalled();
  });
});

describe('the AI chat: Edit', () => {
  it('the whole document goes as numbered blocks; changed blocks come back as suggestions', async () => {
    const request = vi.fn(async (_r: AiRequest) => '<block id="2">The quick red fox.</block>');
    const e = await mount('<h2>Title</h2><p>The quick brown fox.</p><p>Last one.</p>', {
      request,
    });
    const panel = await openChat(e);
    editMode(panel);
    expect(panel.querySelector('.nova-ai-scope')!.textContent).toBe('Changes: the whole document');
    send(panel, 'Use another color');
    await vi.waitFor(() =>
      expect(lastAnswer(panel).textContent).toContain('Paragraphs with suggested changes: 1'),
    );
    const r = request.mock.calls[0]![0];
    expect(r).toMatchObject({
      action: 'edit',
      instruction: 'Use another color',
      text: [
        '<block id="1">Title</block>',
        '<block id="2">The quick brown fox.</block>',
        '<block id="3">Last one.</block>',
      ].join('\n'),
      before: '',
      after: '',
    });
    expect(r.rules.join(' ')).toContain('NO CHANGES');
    expect(listSuggestions(e.view.state.doc).map((s) => [s.kind, s.text])).toEqual([
      ['delete', 'brown'],
      ['insert', 'red'],
    ]);
    // Accept all from the panel: the document as the model wrote it, and the panel says so.
    button(panel, 'Accept all').click();
    expect(e.getHTML()).toBe('<h2>Title</h2><p>The quick red fox.</p><p>Last one.</p>');
    await vi.waitFor(() =>
      expect(lastAnswer(panel).textContent).toContain('All changes reviewed.'),
    );
  });

  it('a suggestion of the empty panel sends a ready instruction; Reject all restores the text', async () => {
    const request = vi.fn(async () => '<block id="1">Teh cat.</block><block id="2">A dog.</block>');
    const e = await mount('<p>Teh cat.</p><p>A dgo.</p>', { request });
    const panel = await openChat(e);
    editMode(panel);
    button(panel, 'Fix spelling and grammar').click();
    await vi.waitFor(() => expect(button(panel, 'Reject all')).toBeDefined());
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        instruction: 'Fix spelling, grammar and punctuation. Change nothing else.',
      }),
    );
    expect(panel.querySelector('.nova-ai-msg-user')!.textContent).toContain(
      'Fix spelling and grammar',
    );
    // Block 1 came back unchanged: only block 2 has suggestions.
    expect(lastAnswer(panel).textContent).toContain('Paragraphs with suggested changes: 1');
    button(panel, 'Reject all').click();
    expect(e.getHTML()).toBe('<p>Teh cat.</p><p>A dgo.</p>');
  });

  it('blocks apply as they stream in; a block someone changed meanwhile is left alone', async () => {
    let release: () => void = () => {};
    const e = await mount('<p>One.</p><p>Two.</p><p>Three.</p>', {
      async *request() {
        yield '<block id="1">One!</block>\n';
        await new Promise<void>((resolve) => (release = resolve));
        yield '<block id="3">Three!</block><block id="2">Two!</block>';
      },
    });
    const panel = await openChat(e);
    editMode(panel);
    send(panel, 'Exclaim');
    await vi.waitFor(() => expect(listSuggestions(e.view.state.doc).length).toBeGreaterThan(0));
    expect(lastAnswer(panel).textContent).toContain('Paragraphs changed so far: 1');
    // Someone edits the third paragraph before the model's version of it arrives.
    const third = e.view.state.doc.content.size - 1;
    e.view.dispatch(e.view.state.tr.insertText(' Edited', third));
    release();
    await vi.waitFor(() => expect(button(panel, 'Accept all')).toBeDefined());
    expect(lastAnswer(panel).textContent).toContain('Paragraphs with suggested changes: 2');
    expect(lastAnswer(panel).textContent).toContain(
      'Left as they are (changed while AI was writing): 1',
    );
    expect(accepted(e)).toBe('One!\n\nTwo!\n\nThree. Edited');
  });

  it('with a selection only the selected paragraphs go, with the text around them', async () => {
    const request = vi.fn(async (_r: AiRequest) => 'NO CHANGES');
    const e = await mount('<p>Before.</p><p>Middle one.</p><p>After.</p>', { request });
    const panel = await openChat(e);
    editMode(panel);
    select(e, 11, 14);
    expect(panel.querySelector('.nova-ai-scope')!.textContent).toBe(
      'Changes: the selected paragraphs',
    );
    send(panel, 'Improve');
    await vi.waitFor(() =>
      expect(lastAnswer(panel).textContent).toContain('AI found nothing to change.'),
    );
    expect(request.mock.calls[0]![0]).toMatchObject({
      text: '<block id="1">Middle one.</block>',
      before: 'Before.\n\n',
      after: '\n\nAfter.',
    });
  });

  it("an answer without blocks can't be matched; a document over maxDocument isn't sent", async () => {
    const request = vi.fn(async () => 'Here is the improved text: Hello.');
    const e = await mount('<p>Hello there.</p>', { request, maxDocument: 1000 });
    const panel = await openChat(e);
    editMode(panel);
    send(panel, 'Improve');
    await vi.waitFor(() =>
      expect(lastAnswer(panel).textContent).toContain("AI's answer didn't match the document."),
    );
    expect(e.getHTML()).toBe('<p>Hello there.</p>');

    e.setContent(`<p>${'word '.repeat(300)}</p>`);
    send(panel, 'Improve');
    await vi.waitFor(() =>
      expect(lastAnswer(panel).textContent).toContain('The document is too long for one request'),
    );
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('a read-only editor: no Edit mode and no Insert', async () => {
    const e = await mount('<p>Text</p>', { request: async () => 'Answer.' });
    const panel = await openChat(e);
    send(panel, 'Q?');
    await vi.waitFor(() => expect(button(panel, 'Insert')).toBeDefined());
    e.setEditable(false);
    expect(panel.querySelector<HTMLInputElement>('input[value="edit"]')!.disabled).toBe(true);
    expect(button(panel, 'Insert').disabled).toBe(true);
    expect(button(panel, 'Copy').disabled).toBe(false);
  });
});

function reviewMode(panel: HTMLElement): void {
  const radio = panel.querySelector<HTMLInputElement>('input[value="review"]')!;
  radio.checked = true;
  radio.dispatchEvent(new Event('change'));
}

const remark = (block: number, quote: string, fix: string, why: string) =>
  `<finding block="${block}"><quote>${quote}</quote><fix>${fix}</fix><why>${why}</why></finding>\n`;

describe('the AI chat: Review', () => {
  it('lists the remarks with reasons; each fix is accepted or rejected on its own', async () => {
    const request = vi.fn(
      async (_r: AiRequest) =>
        remark(1, 'recieve', 'receive', 'Spelling.') +
        remark(1, 'teh', 'the', 'Spelling.') +
        remark(2, 'good', '', 'Say what exactly is good.'),
    );
    const e = await mount('<p>We recieve teh results.</p><p>The plan is good.</p>', { request });
    const panel = await openChat(e);
    reviewMode(panel);
    expect(panel.querySelector('.nova-ai-scope')!.textContent).toBe('Review: the whole document');
    expect(panel.querySelector<HTMLTextAreaElement>('.nova-ai-input')!.placeholder).toContain(
      'What should AI check?',
    );
    button(panel, 'Review the document').click();
    await vi.waitFor(() => expect(lastAnswer(panel).textContent).toContain('Remarks: 3'));
    expect(request.mock.calls[0]![0].action).toBe('review');
    const items = () => [...lastAnswer(panel).querySelectorAll<HTMLElement>('.nova-ai-finding')];
    expect(items().map((item) => item.textContent)).toEqual([
      expect.stringContaining('recieve → receiveSpelling.'),
      expect.stringContaining('teh → theSpelling.'),
      // <q> draws its quotation marks itself (CSS): the text is the words.
      expect.stringContaining('goodSay what exactly is good.'),
    ]);
    expect(items()[2]!.textContent).toContain('No change proposed');
    // The second fix accepted, the first rejected, from the panel.
    const inItem = (index: number, label: string) =>
      [...items()[index]!.querySelectorAll('button')].find((b) => b.textContent === label)!;
    inItem(1, 'Accept').click();
    inItem(0, 'Reject').click();
    expect(e.getHTML()).toBe('<p>We recieve the results.</p><p>The plan is good.</p>');
    await vi.waitFor(() => expect(items()[0]!.textContent).toContain('Reviewed'));
    // Show: a remark without a fix selects its words in the text.
    inItem(2, 'Show in the text').click();
    const { from, to } = e.view.state.selection;
    expect(e.view.state.doc.textBetween(from, to)).toBe('good');
    // The conversation goes on with the remarks in it.
    send(panel, 'Thanks');
    await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(2));
    expect(request.mock.calls[1]![0].messages.at(-1)!.text).toContain('"recieve" → "receive"');
  });

  it('Accept all takes every open fix; a lost quote and "no remarks" are said so', async () => {
    const request = vi
      .fn<(r: AiRequest) => Promise<string>>()
      .mockResolvedValueOnce(
        remark(1, 'Teh', 'The', 'Spelling.') +
          remark(2, 'dgo', 'dog', 'Spelling.') +
          remark(2, 'not in the text', 'x', 'Misquoted.'),
      )
      .mockResolvedValueOnce('NO PROBLEMS')
      .mockResolvedValueOnce('Looks fine!');
    const e = await mount('<p>Teh cat.</p><p>A dgo.</p>', { request });
    const panel = await openChat(e);
    reviewMode(panel);
    send(panel, 'Check spelling');
    await vi.waitFor(() => expect(button(panel, 'Accept all')).toBeDefined());
    expect(lastAnswer(panel).textContent).toContain('Not found in the text');
    button(panel, 'Accept all').click();
    expect(e.getHTML()).toBe('<p>The cat.</p><p>A dog.</p>');
    send(panel, 'Again');
    await vi.waitFor(() => expect(lastAnswer(panel).textContent).toContain('AI has no remarks.'));
    send(panel, 'Once more');
    await vi.waitFor(() =>
      expect(lastAnswer(panel).textContent).toContain("couldn't be read as a list of remarks"),
    );
  });

  it('a read-only document can be reviewed: remarks, no fixes in the text', async () => {
    const request = vi.fn(async () => remark(1, 'Teh', 'The', 'Spelling.'));
    const e = await mount('<p>Teh cat.</p>', { request });
    e.setEditable(false);
    const panel = await openChat(e);
    reviewMode(panel);
    expect(panel.querySelector<HTMLInputElement>('input[value="review"]')!.disabled).toBe(false);
    button(panel, 'Check clarity').click();
    await vi.waitFor(() => expect(lastAnswer(panel).textContent).toContain('Remarks: 1'));
    expect(listSuggestions(e.view.state.doc)).toEqual([]);
    expect(e.getHTML()).toBe('<p>Teh cat.</p>');
  });
});
