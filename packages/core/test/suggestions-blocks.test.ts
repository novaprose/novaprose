import { TextSelection } from 'prosemirror-state';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEditor, listSuggestions, resolveSuggestions, type Editor } from '../src';
import { blockSuggestion } from '../src/plugins/suggestions';
import { PANEL } from '../src/plugins/suggestions-ui';

/** A block's type and style as suggestions: a heading instead of a paragraph, alignment, indent. */

const editors: Editor[] = [];
afterEach(() => {
  editors.splice(0).forEach((e) => e.destroy());
  document.body.innerHTML = '';
});

async function mount(content: string, enabled = true) {
  const element = document.createElement('div');
  document.body.appendChild(element);
  const editor = createEditor({
    element,
    content,
    plugins: ['suggestions'],
    pluginOptions: { suggestions: { author: { id: 'ann', name: 'Ann' }, enabled } },
  });
  editors.push(editor);
  await editor.ready;
  // The cursor in the first block.
  editor.view.dispatch(
    editor.view.state.tr.setSelection(TextSelection.create(editor.view.state.doc, 1)),
  );
  return editor;
}

/** HTML without the suggestion's random id and time. */
const html = (e: Editor) =>
  e
    .getHTML()
    .replace(/ data-suggestion="[^"]*"/g, ' data-suggestion')
    .replace(/ data-time="\d+"/g, '');

const decide = (e: Editor, action: 'accept' | 'reject') =>
  e.view.dispatch(resolveSuggestions(e.view.state, action));

describe('block suggestions', () => {
  it('a paragraph made a heading in suggesting mode remembers it was a paragraph', async () => {
    const e = await mount('<p>Title</p><p>Text</p>');
    e.exec('h2');
    expect(html(e)).toBe(
      '<h2 data-suggestion data-before="{&quot;type&quot;:&quot;paragraph&quot;,&quot;attrs&quot;:{&quot;align&quot;:null,&quot;lineHeight&quot;:null,&quot;dir&quot;:null,&quot;indent&quot;:0,&quot;class&quot;:null}}" data-author="ann" data-name="Ann">Title</h2><p>Text</p>',
    );
    const [s] = listSuggestions(e.view.state.doc);
    expect(s).toMatchObject({ kind: 'block', author: { id: 'ann', name: 'Ann' }, text: 'Title' });
    expect(s!.before!.type).toBe('paragraph');
    // The block is drawn with the author's bar.
    expect(e.view.dom.querySelector('h2')!.className).toContain('nova-sugg-block');
  });

  it('reject gives the block back its type and style; accept keeps the new one', async () => {
    const rejected = await mount('<p style="text-align: center;">Title</p>');
    rejected.exec('h2');
    decide(rejected, 'reject');
    expect(rejected.getHTML()).toBe('<p style="text-align: center;">Title</p>');
    const accepted = await mount('<p>Title</p>');
    accepted.exec('h2');
    decide(accepted, 'accept');
    expect(accepted.getHTML()).toBe('<h2>Title</h2>');
    expect(listSuggestions(accepted.view.state.doc)).toEqual([]);
  });

  it('alignment and indent are suggestions too; going back to how it was takes it away', async () => {
    const e = await mount('<p>Text</p>');
    e.exec('alignCenter');
    expect(listSuggestions(e.view.state.doc).map((s) => s.kind)).toEqual(['block']);
    e.exec('alignLeft');
    // Left is the default: back to null alignment? Then the suggestion goes with it.
    const after = listSuggestions(e.view.state.doc);
    if (e.view.state.doc.firstChild!.attrs.align === null) expect(after).toEqual([]);
    e.exec('indent');
    e.exec('outdent');
    e.exec('alignCenter');
    e.exec('alignCenter');
    decide(e, 'reject');
    expect(e.getHTML()).toBe('<p>Text</p>');
  });

  it('two changes in a row keep the original: rejecting goes back to the paragraph', async () => {
    const e = await mount('<p>Title</p>');
    e.exec('h2');
    const id = listSuggestions(e.view.state.doc)[0]!.id;
    e.exec('h3');
    const [s] = listSuggestions(e.view.state.doc);
    expect(s!.id).toBe(id);
    expect(s!.before!.type).toBe('paragraph');
    decide(e, 'reject');
    expect(e.getHTML()).toBe('<p>Title</p>');
  });

  it('outside suggesting mode a change of style is made directly', async () => {
    const e = await mount('<p>Title</p>', false);
    e.exec('h2');
    expect(e.getHTML()).toBe('<h2>Title</h2>');
  });

  it('undo takes the suggested change away with the change itself', async () => {
    const e = await mount('<p>Title</p>');
    e.exec('h2');
    e.exec('undo');
    expect(e.getHTML()).toBe('<p>Title</p>');
  });

  it('HTML with a block suggestion loads and comes back the same; the panel shows the card', async () => {
    const saved =
      '<h2 data-suggestion="s1" data-before="{&quot;type&quot;:&quot;paragraph&quot;,&quot;attrs&quot;:{}}" data-author="bob" data-name="Bob" data-time="1700000000000">Plan</h2>';
    const e = await mount(saved);
    expect(e.getHTML()).toBe(saved);
    await e.ui.sidebar.show(PANEL);
    const card = await vi.waitFor(() => {
      const el = e.root.querySelector<HTMLElement>('.nova-sugg-card');
      if (!el) throw new Error('no card yet');
      return el;
    });
    expect(card.querySelector('.nova-sugg-summary')!.textContent).toBe(
      'FormattedPlanParagraph → Heading 2',
    );
    [...card.querySelectorAll('button')].find((b) => b.textContent === 'Reject')!.click();
    expect(e.getHTML()).toBe('<p>Plan</p>');
  });

  it('a block suggestion from JSON or HTML can be anything: garbage is dropped, nothing breaks', async () => {
    for (const value of [
      42,
      'x',
      { id: '"><img src=x>', before: { type: 'paragraph' } },
      { id: 's1', before: 'not json' },
      { id: 's1', before: { type: 'Paragraph<script>' } },
      { id: 's1', before: { type: 'paragraph', attrs: { onclick: 'x', style: { a: 1 } } } },
    ]) {
      const clean = blockSuggestion(value);
      if (clean) expect(Object.keys(clean.before.attrs)).not.toContain('style');
    }
    const e = await mount('<p></p>');
    e.setContent({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          attrs: { suggestion: { id: '<x>', before: {} } },
          content: [{ type: 'text', text: 'a' }],
        },
        {
          type: 'heading',
          attrs: { level: 2, suggestion: 'nope' },
          content: [{ type: 'text', text: 'b' }],
        },
        {
          type: 'paragraph',
          attrs: { suggestion: { id: 's2', before: { type: 'no_such_node', attrs: {} } } },
          content: [{ type: 'text', text: 'c' }],
        },
      ],
    });
    expect(e.getHTML()).toContain('<p>a</p><h2>b</h2>');
    // An unknown type to go back to: reject leaves the block and drops the suggestion.
    decide(e, 'reject');
    expect(e.getHTML()).toBe('<p>a</p><h2>b</h2><p>c</p>');
  });

  it('an attacker-made data-before only restores plain attributes the block has', async () => {
    const e = await mount(
      '<h2 data-suggestion="s1" data-before="{&quot;type&quot;:&quot;paragraph&quot;,&quot;attrs&quot;:{&quot;class&quot;:&quot;x&quot;,&quot;onclick&quot;:&quot;alert(1)&quot;,&quot;align&quot;:&quot;center&quot;}}">T</h2>',
    );
    decide(e, 'reject');
    // A paragraph's attributes only (a class token is checked on output like any other); no handler.
    expect(e.getHTML()).toBe('<p class="x" style="text-align: center;">T</p>');
  });
});
