import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEditor, getComments, sanitizeThread, type Editor } from '../src';
import { PANEL } from '../src/plugins/suggestions-ui';

/** Discussing a suggestion on its card (with the comments plugin): replies, and resolving with it. */

const editors: Editor[] = [];
afterEach(() => {
  editors.splice(0).forEach((e) => e.destroy());
  document.body.innerHTML = '';
});

const ins = (id: string, text: string) =>
  `<ins data-suggestion="${id}" data-author="ann" data-name="Ann" data-time="1700000000000">${text}</ins>`;
const del = (id: string, text: string) =>
  `<del data-suggestion="${id}" data-author="ann" data-name="Ann" data-time="1700000000000">${text}</del>`;

/** Ann replaced "May" with "June" and inserted "very ". */
const CONTENT = `<p>Ship in ${del('d1', 'May')}${ins('i1', 'June')}.</p><p>A ${ins('i2', 'very ')}good plan.</p>`;

async function mount(plugins = ['suggestions', 'comments']) {
  const element = document.createElement('div');
  document.body.appendChild(element);
  const editor = createEditor({
    element,
    content: CONTENT,
    plugins,
    pluginOptions: {
      suggestions: { author: { id: 'me', name: 'Me' } },
      comments: { author: { id: 'me', name: 'Me' } },
    },
  });
  editors.push(editor);
  await editor.ready;
  await editor.ui.sidebar.show(PANEL);
  const panel = await vi.waitFor(() => {
    const el = editor.root.querySelector<HTMLElement>('.nova-sugg-panel');
    if (!el) throw new Error('no panel yet');
    return el;
  });
  return { editor, panel };
}

const cards = (panel: HTMLElement) => [...panel.querySelectorAll<HTMLElement>('.nova-sugg-card')];
const buttonIn = (root: HTMLElement, text: string) =>
  [...root.querySelectorAll('button')].find((b) => b.textContent === text)!;
const replies = (card: HTMLElement) =>
  [...card.querySelectorAll('.nova-sugg-reply')].map(
    (reply) =>
      `${reply.querySelector('.nova-sugg-reply-author')!.textContent}: ${reply.querySelector('.nova-sugg-reply-text')!.textContent}`,
  );

function write(panel: HTMLElement, text: string) {
  const input = panel.querySelector<HTMLTextAreaElement>('.nova-sugg-reply-input')!;
  input.value = text;
  input.dispatchEvent(new Event('input'));
  return input;
}

describe('discussing a suggestion', () => {
  it('a comment on a card starts a thread linked to the suggestion; replies follow it', async () => {
    const { editor, panel } = await mount();
    const store = getComments(editor)!.store;
    buttonIn(cards(panel)[0]!, 'Comment').click();
    const input = panel.querySelector<HTMLTextAreaElement>('.nova-sugg-reply-input')!;
    expect(document.activeElement).toBe(input);
    expect(input.getAttribute('aria-label')).toBe('Add a comment…');
    write(panel, 'Why June?');
    buttonIn(cards(panel)[0]!, 'Comment').click();
    expect(store.threads()).toMatchObject([
      {
        suggestion: 'd1',
        resolved: null,
        comments: [{ text: 'Why June?', author: { name: 'Me' } }],
      },
    ]);
    expect(replies(cards(panel)[0]!)).toEqual(['Me: Why June?']);
    // Focus goes back to the button, which now replies.
    expect(document.activeElement).toBe(buttonIn(cards(panel)[0]!, 'Reply'));
    buttonIn(cards(panel)[0]!, 'Reply').click();
    write(panel, 'The launch moved.');
    // Ctrl+Enter sends too.
    panel
      .querySelector('.nova-sugg-reply-input')!
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true }));
    expect(replies(cards(panel)[0]!)).toEqual(['Me: Why June?', 'Me: The launch moved.']);
    expect(store.threads()).toHaveLength(1);
    // The other card has no discussion yet.
    expect(replies(cards(panel)[1]!)).toEqual([]);
  });

  it('a draft survives a redraw (a collaborator edits meanwhile); Escape closes the box', async () => {
    const { editor, panel } = await mount();
    buttonIn(cards(panel)[1]!, 'Comment').click();
    const input = write(panel, 'Half a thought');
    input.setSelectionRange(4, 4);
    input.dispatchEvent(new Event('select'));
    editor.view.dispatch(editor.view.state.tr.insertText('!', 1));
    const again = panel.querySelector<HTMLTextAreaElement>('.nova-sugg-reply-input')!;
    expect(again).not.toBe(input);
    expect(again.value).toBe('Half a thought');
    expect(document.activeElement).toBe(again);
    expect(again.selectionStart).toBe(4);
    again.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(panel.querySelector('.nova-sugg-reply-input')).toBeNull();
    expect(document.activeElement).toBe(buttonIn(cards(panel)[1]!, 'Comment'));
    // An empty reply isn't sent.
    buttonIn(cards(panel)[1]!, 'Comment').click();
    buttonIn(cards(panel)[1]!, 'Comment').click();
    expect(getComments(editor)!.store.threads()).toEqual([]);
  });

  it('accepting or rejecting the suggestion resolves its discussion', async () => {
    const { editor, panel } = await mount();
    const store = getComments(editor)!.store;
    for (const index of [0, 1]) {
      buttonIn(cards(panel)[index]!, 'Comment').click();
      write(panel, `About ${index}`);
      buttonIn(cards(panel)[index]!, 'Comment').click();
    }
    buttonIn(cards(panel)[0]!, 'Accept').click();
    expect(editor.getHTML()).toContain('Ship in June.');
    const resolved = () =>
      store.threads().map((t) => [t.suggestion, t.resolved ? t.resolved.by.name : null]);
    expect(resolved()).toEqual([
      ['d1', 'Me'],
      ['i2', null],
    ]);
    buttonIn(cards(panel)[0]!, 'Reject').click();
    expect(resolved()).toEqual([
      ['d1', 'Me'],
      ['i2', 'Me'],
    ]);
  });

  it('the discussions are not in the comments panel', async () => {
    const { editor, panel } = await mount();
    buttonIn(cards(panel)[0]!, 'Comment').click();
    write(panel, 'Why June?');
    buttonIn(cards(panel)[0]!, 'Comment').click();
    await getComments(editor)!.openPanel();
    const comments = await vi.waitFor(() => {
      const el = editor.root.querySelector<HTMLElement>('.nova-comments');
      if (!el) throw new Error('no comments panel yet');
      return el;
    });
    expect(comments.textContent).not.toContain('Why June?');
  });

  it('your own reply can be deleted; the last one takes the thread with it', async () => {
    const { editor, panel } = await mount();
    const store = getComments(editor)!.store;
    buttonIn(cards(panel)[0]!, 'Comment').click();
    write(panel, 'One');
    buttonIn(cards(panel)[0]!, 'Comment').click();
    buttonIn(cards(panel)[0]!, 'Reply').click();
    write(panel, 'Two');
    buttonIn(cards(panel)[0]!, 'Reply').click();
    const remove = () =>
      cards(panel)[0]!.querySelector<HTMLButtonElement>('.nova-sugg-reply-delete')!;
    remove().click();
    expect(replies(cards(panel)[0]!)).toEqual(['Me: Two']);
    remove().click();
    expect(store.threads()).toEqual([]);
    expect(buttonIn(cards(panel)[0]!, 'Comment')).toBeTruthy();
  });

  it('without the comments plugin the cards have no discussion', async () => {
    const { panel } = await mount(['suggestions']);
    expect(panel.querySelector('.nova-sugg-discussion')).toBeNull();
  });

  it('a thread from outside keeps a valid suggestion link and drops a bad one', () => {
    const base = { id: 't1', createdAt: 1, comments: [] };
    expect(sanitizeThread({ ...base, suggestion: 'd1' })?.suggestion).toBe('d1');
    expect(sanitizeThread({ ...base, suggestion: '"><img src=x>' })).not.toHaveProperty(
      'suggestion',
    );
    expect(sanitizeThread({ ...base, suggestion: 42 })).not.toHaveProperty('suggestion');
  });
});
