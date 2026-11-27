import { TextSelection } from 'prosemirror-state';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEditor, listSuggestions, type Editor } from '../src';
import { registerPluginMessages, getPluginMessages } from '../src/i18n';
import { PANEL, suggestionsInSelection } from '../src/plugins/suggestions-ui';
import { suggestionCards } from '../src/plugins/suggestions-panel';

/** The suggestions panel: cards, the author filter, accept and reject, the Review menu, previews. */

const editors: Editor[] = [];
afterEach(() => {
  editors.splice(0).forEach((e) => e.destroy());
  document.body.innerHTML = '';
});

const ins = (id: string, author: string, name: string, text: string, time = 1_700_000_000_000) =>
  `<ins data-suggestion="${id}" data-author="${author}" data-name="${name}" data-time="${time}">${text}</ins>`;
const del = (id: string, author: string, name: string, text: string, time = 1_700_000_000_000) =>
  `<del data-suggestion="${id}" data-author="${author}" data-name="${name}" data-time="${time}">${text}</del>`;

/** Ann replaced "May" with "June"; Bob inserted "very "; Ann deleted "old". */
const CONTENT =
  `<p>Ship in ${del('d1', 'ann', 'Ann', 'May')}${ins('i1', 'ann', 'Ann', 'June')}.</p>` +
  `<p>A ${ins('i2', 'bob', 'Bob', 'very ')}good ${del('d2', 'ann', 'Ann', 'old')} plan.</p>`;

async function mount(content = CONTENT, options: Record<string, unknown> = {}) {
  const element = document.createElement('div');
  document.body.appendChild(element);
  const editor = createEditor({
    element,
    content,
    plugins: ['suggestions'],
    pluginOptions: { suggestions: { author: { id: 'me', name: 'Me' }, ...options } },
  });
  editors.push(editor);
  await editor.ready;
  return editor;
}

async function openPanel(editor: Editor): Promise<HTMLElement> {
  await editor.ui.sidebar.show(PANEL);
  const panel = await vi.waitFor(() => {
    const el = editor.root.querySelector<HTMLElement>('.nova-sugg-panel');
    if (!el) throw new Error('no panel yet');
    return el;
  });
  return panel;
}

const cardTexts = (panel: HTMLElement) =>
  [...panel.querySelectorAll('.nova-sugg-card')].map((card) =>
    [
      card.querySelector('.nova-sugg-author')!.textContent,
      card.querySelector('.nova-sugg-summary')!.textContent,
    ].join(': '),
  );

const button = (panel: HTMLElement, text: string) =>
  [...panel.querySelectorAll('button')].find((b) => b.textContent === text)!;

describe('suggestion cards', () => {
  it('a deletion right before an insertion by the same author is one replacement', async () => {
    const editor = await mount();
    const cards = suggestionCards(editor.view.state.doc);
    expect(cards.map((c) => [c.kind, c.author.name, c.removed, c.added])).toEqual([
      ['replace', 'Ann', 'May', 'June'],
      ['insert', 'Bob', '', 'very '],
      ['delete', 'Ann', 'old', ''],
    ]);
    expect(cards[0]!.ids).toEqual(['d1', 'i1']);
  });

  it("one suggestion over two paragraphs is one card; another author's insertion is not a replacement", async () => {
    const editor = await mount(
      `<p>${ins('i1', 'ann', 'Ann', 'first')}</p><p>${ins('i1', 'ann', 'Ann', 'second')}</p>` +
        `<p>${del('d1', 'ann', 'Ann', 'x')}${ins('i2', 'bob', 'Bob', 'y')}</p>`,
    );
    const cards = suggestionCards(editor.view.state.doc);
    expect(cards.map((c) => [c.kind, c.added || c.removed])).toEqual([
      ['insert', 'first second'],
      ['delete', 'x'],
      ['insert', 'y'],
    ]);
  });
});

describe('the suggestions panel', () => {
  it('lists every suggestion with its author; the filter shows one person', async () => {
    const editor = await mount();
    const panel = await openPanel(editor);
    expect(cardTexts(panel)).toEqual([
      'Ann: ReplacedMayJune',
      'Bob: Insertedvery',
      'Ann: Deletedold',
    ]);
    const select = panel.querySelector('select')!;
    expect([...select.options].map((o) => o.textContent)).toEqual([
      'All authors (3)',
      'Ann (2)',
      'Bob (1)',
    ]);
    select.value = 'ann';
    select.dispatchEvent(new Event('change'));
    expect(cardTexts(panel)).toEqual(['Ann: ReplacedMayJune', 'Ann: Deletedold']);
  });

  it("Accept shown takes one author's suggestions only; the filter then says there are none left", async () => {
    const editor = await mount();
    const announce = vi.spyOn(editor.ui, 'announce');
    const panel = await openPanel(editor);
    const select = panel.querySelector('select')!;
    select.value = 'ann';
    select.dispatchEvent(new Event('change'));
    button(panel, 'Accept shown').click();
    expect(editor.getHTML()).toBe(
      `<p>Ship in June.</p><p>A ${ins('i2', 'bob', 'Bob', 'very ')}good &nbsp;plan.</p>`,
    );
    expect(announce).toHaveBeenCalledWith('Suggestions accepted: 2');
    expect(panel.querySelector('.nova-sugg-empty')!.textContent).toBe('No suggestions from Ann');
    expect(button(panel, 'Accept shown').disabled).toBe(true);
    // Everyone again: Bob's suggestion is still there.
    select.value = '';
    select.dispatchEvent(new Event('change'));
    expect(cardTexts(panel)).toEqual(['Bob: Insertedvery']);
  });

  it('Reject on a card rejects its suggestions; focus goes to the card that took its place', async () => {
    const editor = await mount();
    const panel = await openPanel(editor);
    const reject = panel.querySelectorAll<HTMLButtonElement>('.nova-sugg-reject')[0]!;
    reject.focus();
    reject.click();
    expect(listSuggestions(editor.view.state.doc).map((s) => s.id)).toEqual(['i2', 'd2']);
    expect(editor.getHTML()).toContain('<p>Ship in May.</p>');
    expect(document.activeElement?.textContent).toBe('Insertedvery');
  });

  it('a click on a card selects its suggestion in the text', async () => {
    const editor = await mount();
    const panel = await openPanel(editor);
    panel.querySelectorAll<HTMLButtonElement>('.nova-sugg-summary')[1]!.click();
    const { from, to } = editor.view.state.selection;
    expect(editor.view.state.doc.textBetween(from, to)).toBe('very ');
    expect(panel.querySelectorAll('.nova-sugg-card')[1]!.getAttribute('aria-current')).toBe('true');
  });

  it('without the right to review there are no buttons; read only, they are off', async () => {
    const reviewer = await mount(CONTENT, { canReview: false });
    const panel = await openPanel(reviewer);
    expect(panel.querySelectorAll('.nova-sugg-accept, .nova-sugg-reject')).toHaveLength(0);
    expect(button(panel, 'Accept shown')).toBeUndefined();

    const readOnly = await mount();
    readOnly.setEditable(false);
    const other = await openPanel(readOnly);
    expect(
      [...other.querySelectorAll<HTMLButtonElement>('.nova-sugg-accept')].every((b) => b.disabled),
    ).toBe(true);
    expect(button(other, 'Accept shown').disabled).toBe(true);
  });

  it('a suggested format: "Formatted", the text, and the formatting it got and lost', async () => {
    const editor = await mount(
      '<p><strong><span data-suggestion="f1" data-format="[{&quot;type&quot;:&quot;italic&quot;}]" data-author="ann" data-name="Ann">word</span></strong></p>',
    );
    const panel = await openPanel(editor);
    expect(cardTexts(panel)).toEqual(['Ann: Formattedword+Bold −Italic']);
    panel.querySelector<HTMLButtonElement>('.nova-sugg-reject')!.click();
    expect(editor.getHTML()).toBe('<p><em>word</em></p>');
  });

  it('suggestions from JSON with odd attributes are listed, not a crash', async () => {
    const element = document.createElement('div');
    document.body.appendChild(element);
    const editor = createEditor({
      element,
      plugins: ['suggestions'],
      content: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'odd',
                marks: [
                  {
                    type: 'suggestion_insert',
                    attrs: { id: '"><x', author: 7, name: { a: 1 }, time: 'never' },
                  },
                ],
              },
            ],
          },
        ],
      },
    });
    editors.push(editor);
    await editor.ready;
    const panel = await openPanel(editor);
    expect(panel.querySelectorAll('.nova-sugg-card')).toHaveLength(1);
    expect(panel.querySelector('.nova-sugg-card time')).toBeNull();
  });
});

describe('the Review menu', () => {
  it('accepts or rejects the suggestions in the selection only', async () => {
    const editor = await mount();
    const { state } = editor.view;
    // "very good" in the second paragraph: Bob's insertion, not Ann's deletion after it.
    const start = state.doc.firstChild!.nodeSize + 3;
    editor.view.dispatch(state.tr.setSelection(TextSelection.create(state.doc, start, start + 9)));
    expect(suggestionsInSelection(editor.view.state)).toEqual(['i2']);
    const menu = editor.ui.registry.get('reviewsuggestions') as unknown as {
      items: () => { id?: string; disabled?: boolean; onSelect?: () => void }[];
    };
    const item = menu.items().find((entry) => entry.id === 'accept-selection')!;
    expect(item.disabled).toBe(false);
    item.onSelect!();
    expect(listSuggestions(editor.view.state.doc).map((s) => s.id)).toEqual(['d1', 'i1', 'd2']);
  });

  it('previews the text with every suggestion accepted or rejected, without changing it', async () => {
    const editor = await mount();
    const before = editor.getHTML();
    const menu = editor.ui.registry.get('reviewsuggestions') as unknown as {
      items: () => { id?: string; onSelect?: () => void }[];
    };
    menu.items().find((entry) => entry.id === 'preview-final')!.onSelect!();
    const dialog = await vi.waitFor(() => {
      const el = document.querySelector<HTMLElement>('.nova-preview');
      if (!el) throw new Error('no preview');
      return el;
    });
    expect(dialog.textContent).toBe('Ship in June.A very good  plan.');
    expect(editor.getHTML()).toBe(before);
  });
});

describe('plugin strings', () => {
  it('a plugin and its lazy part add up their strings under one name', () => {
    registerPluginMessages('demo-two-parts', { en: { one: 'One' } });
    registerPluginMessages('demo-two-parts', { en: { two: 'Two' } });
    expect(getPluginMessages()['demo-two-parts']!.en).toEqual({ one: 'One', two: 'Two' });
  });
});
