import { TextSelection } from 'prosemirror-state';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEditor, listSuggestions, type Editor } from '../src';
import {
  languageTool,
  type SpellCheckMatch,
  type SpellCheckRequest,
} from '../src/plugins/spellchecker';

/** The spellchecker plugin with a pretend service: "teh" is misspelled, "a apple" is grammar. */

const editors: Editor[] = [];
afterEach(() => {
  editors.splice(0).forEach((e) => e.destroy());
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

function service() {
  const calls: SpellCheckRequest[] = [];
  const check = vi.fn(async (request: SpellCheckRequest): Promise<SpellCheckMatch[]> => {
    calls.push(request);
    const matches: SpellCheckMatch[] = [];
    for (const m of request.text.matchAll(/\bteh\b/g)) {
      matches.push({
        offset: m.index!,
        length: 3,
        kind: 'spelling',
        message: 'Possible spelling mistake.',
        replacements: ['the', 'ten'],
      });
    }
    for (const m of request.text.matchAll(/\ba apple\b/g)) {
      matches.push({ offset: m.index!, length: 7, kind: 'grammar', replacements: ['an apple'] });
    }
    return matches;
  });
  return { check, calls };
}

async function mount(
  content: string,
  options: Record<string, unknown> = {},
  plugins = ['spellchecker'],
) {
  const element = document.createElement('div');
  document.body.appendChild(element);
  const { check, calls } = service();
  const editor = createEditor({
    element,
    content,
    plugins,
    pluginOptions: { spellchecker: { check, ...options }, suggestions: { enabled: true } },
  });
  editors.push(editor);
  await editor.ready;
  return { editor, check, calls };
}

const marks = (editor: Editor) =>
  [...editor.view.dom.querySelectorAll<HTMLElement>('.nova-spell')].map(
    (el) => `${el.getAttribute('aria-invalid')}:${el.textContent}`,
  );

const settled = (editor: Editor, expected: string[]) =>
  vi.waitFor(() => expect(marks(editor)).toEqual(expected), { timeout: 3000 });

describe('the spellchecker plugin', () => {
  it('underlines spelling and grammar, with aria-invalid; one request for all paragraphs', async () => {
    const { editor, calls } = await mount('<p>I saw teh cat.</p><p>Eat a apple.</p><p>Fine.</p>');
    await settled(editor, ['spelling:teh', 'grammar:a apple']);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.text).toBe('I saw teh cat.\n\nEat a apple.\n\nFine.');
    expect(calls[0]!.language).toBe('auto');
    expect(editor.view.dom.getAttribute('spellcheck')).toBe('false');
  });

  it('only a changed paragraph is asked about again', async () => {
    const { editor, calls } = await mount('<p>I saw teh cat.</p><p>Second paragraph.</p>');
    await settled(editor, ['spelling:teh']);
    const end = editor.view.state.doc.content.size - 1;
    editor.view.dispatch(editor.view.state.tr.insertText(' And teh dog.', end));
    await settled(editor, ['spelling:teh', 'spelling:teh']);
    expect(calls.map((c) => c.text)).toEqual([
      'I saw teh cat.\n\nSecond paragraph.',
      'Second paragraph. And teh dog.',
    ]);
  });

  it('code is not checked', async () => {
    const { editor, calls } = await mount(
      '<pre><code>teh code</code></pre><p>Inline <code>teh</code> and teh.</p>',
    );
    await settled(editor, ['spelling:teh']);
    expect(calls[0]!.text).toBe('Inline teh and teh.');
    expect(editor.view.dom.querySelector('code .nova-spell')).toBeNull();
  });

  it('a click on a problem opens the bubble; a correction replaces the word', async () => {
    const { editor } = await mount('<p>I saw teh cat.</p>');
    await settled(editor, ['spelling:teh']);
    const pos = 7;
    editor.view.dispatch(
      editor.view.state.tr.setSelection(TextSelection.create(editor.view.state.doc, pos)),
    );
    editor.view.someProp('handleClick', (f) => f(editor.view, pos, new MouseEvent('click')));
    const bubble = await vi.waitFor(() => {
      const el = document.querySelector<HTMLElement>('.nova-spell-bubble');
      if (!el) throw new Error('no bubble');
      return el;
    });
    expect(bubble.getAttribute('aria-label')).toBe('Spelling: teh');
    expect(bubble.textContent).toContain('Possible spelling mistake.');
    [...bubble.querySelectorAll('button')].find((b) => b.textContent === 'the')!.click();
    expect(editor.getHTML()).toBe('<p>I saw the cat.</p>');
    expect(document.querySelector('.nova-spell-bubble')).toBeNull();
  });

  it('Alt+F7 goes to the next problem and puts focus on its first correction', async () => {
    const { editor } = await mount('<p>I saw teh cat.</p><p>Eat a apple.</p>');
    await settled(editor, ['spelling:teh', 'grammar:a apple']);
    editor.view.dom.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'F7', altKey: true, bubbles: true }),
    );
    const { from, to } = editor.view.state.selection;
    expect(editor.view.state.doc.textBetween(from, to)).toBe('teh');
    expect(document.activeElement?.textContent).toBe('the');
    // Escape closes the bubble.
    document.activeElement!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    );
    expect(document.querySelector('.nova-spell-bubble')).toBeNull();
  });

  it('Ignore all and Add to dictionary take a word out everywhere', async () => {
    const addToDictionary = vi.fn();
    const { editor } = await mount('<p>teh one</p><p>teh two</p>', { addToDictionary });
    await settled(editor, ['spelling:teh', 'spelling:teh']);
    editor.view.someProp('handleClick', (f) => f(editor.view, 2, new MouseEvent('click')));
    const bubble = await vi.waitFor(() => {
      const el = document.querySelector<HTMLElement>('.nova-spell-bubble');
      if (!el) throw new Error('no bubble');
      return el;
    });
    [...bubble.querySelectorAll('button')]
      .find((b) => b.textContent === 'Add to dictionary')!
      .click();
    expect(addToDictionary).toHaveBeenCalledWith('teh', 'auto');
    expect(marks(editor)).toEqual([]);
  });

  it('the ignore option: those words are never marked', async () => {
    const { editor, calls } = await mount('<p>teh cat, a apple</p>', { ignore: ['teh'] });
    await vi.waitFor(() => expect(calls).toHaveLength(1));
    await settled(editor, ['grammar:a apple']);
  });

  it('off: no underlines and the browser checks again; on: back without asking again', async () => {
    const { editor, calls } = await mount('<p>teh</p>');
    await settled(editor, ['spelling:teh']);
    const button = editor.ui.registry.get('spellchecker') as unknown as {
      onAction: (e: Editor) => void;
    };
    button.onAction(editor);
    expect(marks(editor)).toEqual([]);
    expect(editor.view.dom.getAttribute('spellcheck')).toBeNull();
    button.onAction(editor);
    await settled(editor, ['spelling:teh']);
    expect(calls).toHaveLength(1);
  });

  it('a language from the menu is used for the next check', async () => {
    const { editor, calls } = await mount('<p>teh</p>', {
      languages: [{ code: 'en-GB', name: 'English (UK)' }],
    });
    await settled(editor, ['spelling:teh']);
    const menu = editor.ui.registry.get('spellchecker') as unknown as {
      items: (e: Editor) => { id?: string; onSelect?: () => void }[];
    };
    menu.items(editor).find((item) => item.id === 'language-en-GB')!.onSelect!();
    await vi.waitFor(() => expect(calls.map((c) => c.language)).toEqual(['auto', 'en-GB']));
  });

  it('a strange answer from the service is not a crash; a failure says so once', async () => {
    const element = document.createElement('div');
    document.body.appendChild(element);
    const check = vi
      .fn()
      .mockResolvedValueOnce([
        null,
        { offset: 'x', length: 2 },
        { offset: -3, length: 2 },
        { offset: 0, length: 999 },
        { offset: 0, length: 3, replacements: [7, null, 'the'], message: { a: 1 } },
      ])
      .mockRejectedValue(new Error('down'));
    const editor = createEditor({
      element,
      content: '<p>teh</p>',
      plugins: ['spellchecker'],
      pluginOptions: { spellchecker: { check } },
    });
    editors.push(editor);
    const notify = vi.spyOn(editor.ui, 'notify');
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    await editor.ready;
    await settled(editor, ['spelling:teh']);
    editor.view.dispatch(editor.view.state.tr.insertText('x', 4));
    await vi.waitFor(() => expect(notify).toHaveBeenCalledTimes(1), { timeout: 3000 });
    editor.view.dispatch(editor.view.state.tr.insertText('y', 5));
    await new Promise((resolve) => setTimeout(resolve, 900));
    expect(notify).toHaveBeenCalledTimes(1);
  });

  it('in suggesting mode a correction is a suggestion', async () => {
    const { editor } = await mount('<p>I saw teh cat.</p>', {}, ['suggestions', 'spellchecker']);
    await settled(editor, ['spelling:teh']);
    editor.view.someProp('handleClick', (f) => f(editor.view, 7, new MouseEvent('click')));
    const bubble = await vi.waitFor(() => {
      const el = document.querySelector<HTMLElement>('.nova-spell-bubble');
      if (!el) throw new Error('no bubble');
      return el;
    });
    [...bubble.querySelectorAll('button')].find((b) => b.textContent === 'the')!.click();
    expect(listSuggestions(editor.view.state.doc).map((s) => [s.kind, s.text])).toEqual([
      ['delete', 'teh'],
      ['insert', 'the'],
    ]);
  });
});

describe('the LanguageTool adapter', () => {
  it('asks /v2/check and turns its answer into matches', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            matches: [
              {
                offset: 6,
                length: 3,
                message: 'Possible spelling mistake found.',
                replacements: [{ value: 'the' }, { value: 'tea' }],
                rule: { issueType: 'misspelling' },
              },
              {
                offset: 0,
                length: 1,
                message: 'Use “an”.',
                replacements: [{ value: 'an' }],
                rule: { issueType: 'grammar', category: { id: 'GRAMMAR' } },
              },
            ],
          }),
        ),
    );
    vi.stubGlobal('fetch', fetchMock);
    const check = languageTool({ url: 'https://lt.example.com/', headers: { 'X-Key': 'k' } });
    const matches = await check({
      text: 'a saw teh',
      language: 'en-US',
      signal: new AbortController().signal,
    });
    expect(matches).toEqual([
      {
        offset: 6,
        length: 3,
        message: 'Possible spelling mistake found.',
        replacements: ['the', 'tea'],
        kind: 'spelling',
      },
      { offset: 0, length: 1, message: 'Use “an”.', replacements: ['an'], kind: 'grammar' },
    ]);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://lt.example.com/v2/check');
    expect(init.method).toBe('POST');
    expect(String(init.body)).toBe('text=a+saw+teh&language=en-US');
    expect((init.headers as Record<string, string>)['X-Key']).toBe('k');
    vi.unstubAllGlobals();
  });
});
