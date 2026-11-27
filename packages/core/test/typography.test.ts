import { TextSelection } from 'prosemirror-state';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEditor, listSuggestions, type Editor } from '../src';

/** The typography plugin in an editor: the whole text or the selection, code left alone, one undo. */

const editors: Editor[] = [];
afterEach(() => {
  editors.splice(0).forEach((e) => e.destroy());
  document.body.innerHTML = '';
  localStorage.clear();
});

async function mount(content: string, options: Record<string, unknown> = {}, more = {}) {
  const element = document.createElement('div');
  document.body.appendChild(element);
  const editor = createEditor({
    element,
    content,
    plugins: ['typography', ...((more as { plugins?: string[] }).plugins ?? [])],
    pluginOptions: { typography: { language: 'en-US', ...options }, ...more },
  });
  editors.push(editor);
  await editor.ready;
  return editor;
}

const run = (e: Editor) => e.ui.registry.getMenuItem('typography')!.onAction(e);

describe('typography plugin', () => {
  it('enhances the whole text, keeps formatting, and is one undo step', async () => {
    const e = await mount(
      '<p>"Hello," she <strong>said...</strong></p><p>It\'s 10x20 -- (c) 2026</p>',
    );
    const notify = vi.spyOn(e.ui, 'notify');
    run(e);
    expect(e.getHTML()).toBe('<p>“Hello,” she <strong>said…</strong></p><p>It’s 10×20—© 2026</p>');
    expect(notify).toHaveBeenCalledWith('Typography: 7 changes');
    e.exec('undo');
    expect(e.getHTML()).toBe(
      '<p>"Hello," she <strong>said...</strong></p><p>It\'s 10x20 -- (c) 2026</p>',
    );
    // Nothing to do: it says so.
    run(e);
    run(e);
    expect(notify).toHaveBeenLastCalledWith('The typography is already fine');
  });

  it('with a selection, only the selection changes', async () => {
    const e = await mount('<p>"one" and "two"</p>');
    e.view.dispatch(e.view.state.tr.setSelection(TextSelection.create(e.view.state.doc, 1, 6)));
    run(e);
    expect(e.getHTML()).toBe('<p>“one” and "two"</p>');
  });

  it('leaves code, links you ignore and text suggested for deletion alone', async () => {
    const e = await mount(
      '<p>Run <code>a -> b...</code> and "go"</p><pre><code>"x" -- y</code></pre>' +
        '<p><a href="https://x.com">"link"</a> "text"</p>',
      { ignore: ['link'] },
    );
    run(e);
    expect(e.getHTML()).toBe(
      '<p>Run <code>a -&gt; b...</code> and “go”</p><pre><code>"x" -- y</code></pre>' +
        '<p><a href="https://x.com">"link"</a> “text”</p>',
    );
  });

  it('the language: from the option, the menu (remembered), or the content language', async () => {
    const e = await mount('<p>"Hallo"</p>', { language: 'de' });
    run(e);
    expect(e.getHTML()).toBe('<p>„Hallo“</p>');
    // The menu picks French and applies it.
    const split = e.ui.registry.get('typography') as unknown as {
      items: (editor: Editor) => { id?: string; label?: string; onSelect?: () => void }[];
    };
    e.setContent('<p>"Bonjour"</p>');
    split.items(e).find((item) => item.id === 'language-fr')!.onSelect!();
    expect(e.getHTML()).toBe('<p>«&nbsp;Bonjour&nbsp;»</p>');
    expect(JSON.parse(localStorage.getItem('novaprose-typography')!)).toEqual({ language: 'fr' });
    // The next editor starts in French.
    const next = await mount('<p>"Salut"</p>', { language: 'en-US' });
    run(next);
    expect(next.getHTML()).toBe('<p>«&nbsp;Salut&nbsp;»</p>');
    // Without options: the spell checker's language, then the page's.
    localStorage.clear();
    const spell = await mount(
      '<p>"Hej"</p>',
      { language: undefined },
      {
        spellchecker: { language: 'sv' },
      },
    );
    run(spell);
    expect(spell.getHTML()).toBe('<p>”Hej”</p>');
  });

  it('rules can be turned off', async () => {
    const e = await mount('<p>"a" -- b...</p>', { rules: { quotes: false, ellipsis: false } });
    run(e);
    expect(e.getHTML()).toBe('<p>"a"—b...</p>');
  });

  it('in suggesting mode the changes are suggestions', async () => {
    const e = await mount(
      '<p>"Hi"</p>',
      {},
      {
        plugins: ['suggestions'],
        suggestions: { enabled: true, author: { id: 'ann', name: 'Ann' } },
      },
    );
    run(e);
    expect(
      listSuggestions(e.view.state.doc)
        .map((s) => s.kind)
        .sort(),
    ).toEqual(['delete', 'delete', 'insert', 'insert']);
  });

  it('a read-only editor is not changed', async () => {
    const e = await mount('<p>"Hi"</p>');
    e.setEditable(false);
    run(e);
    expect(e.getHTML()).toBe('<p>"Hi"</p>');
  });
});
