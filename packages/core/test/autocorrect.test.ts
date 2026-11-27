import { TextSelection } from 'prosemirror-state';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEditor, listSuggestions, type Editor } from '../src';
import type { AutocorrectCorrection } from '../src/plugins/autocorrect';

/** The autocorrect plugin in an editor: typing, Backspace, undo, Enter, the menu and the options. */

const editors: Editor[] = [];
afterEach(() => {
  editors.splice(0).forEach((e) => e.destroy());
  document.body.innerHTML = '';
  localStorage.clear();
  vi.restoreAllMocks();
});

async function mount(
  content = '<p></p>',
  options: Record<string, unknown> = {},
  plugins: string[] = ['autocorrect'],
  more: Record<string, unknown> = {},
) {
  const element = document.createElement('div');
  document.body.appendChild(element);
  const editor = createEditor({
    element,
    content,
    plugins,
    pluginOptions: { autocorrect: options, ...more },
  });
  editors.push(editor);
  await editor.ready;
  // The cursor at the end of the text.
  const end = TextSelection.atEnd(editor.view.state.doc);
  editor.view.dispatch(editor.view.state.tr.setSelection(end));
  return editor;
}

/** Types text the way a keyboard does: each character through handleTextInput. */
async function type(e: Editor, text: string) {
  for (const ch of text) {
    const { from, to } = e.view.state.selection;
    const handled = e.view.someProp('handleTextInput', (f) =>
      f(e.view, from, to, ch, () => e.view.state.tr.insertText(ch, from, to)),
    );
    if (!handled) e.view.dispatch(e.view.state.tr.insertText(ch, from, to));
    // The correction comes right after the character is in the document.
    await Promise.resolve();
  }
}

function key(e: Editor, name: string, init: KeyboardEventInit = {}) {
  const event = new KeyboardEvent('keydown', {
    key: name,
    bubbles: true,
    cancelable: true,
    ...init,
  });
  e.view.dom.dispatchEvent(event);
  return event;
}

const text = (e: Editor) => e.view.state.doc.textContent;

describe('autocorrect plugin', () => {
  it('corrects a typo when the word ends, and tells screen readers', async () => {
    const e = await mount();
    const announce = vi.spyOn(e.ui, 'announce');
    await type(e, 'I saw teh cat');
    expect(text(e)).toBe('I saw the cat');
    expect(announce).toHaveBeenCalledWith('teh changed to the');
    await type(e, ' and i');
    expect(text(e)).toBe('I saw the cat and i');
    await type(e, '.');
    expect(text(e)).toBe('I saw the cat and I.');
  });

  it('Backspace right after a correction puts back what was typed, and the word is then left alone', async () => {
    const e = await mount();
    const announce = vi.spyOn(e.ui, 'announce');
    await type(e, 'teh ');
    expect(text(e)).toBe('the ');
    expect(e.view.dom.querySelector('.nova-autocorrected')?.textContent).toBe('the');
    const event = key(e, 'Backspace');
    expect(event.defaultPrevented).toBe(true);
    expect(text(e)).toBe('teh ');
    expect(announce).toHaveBeenLastCalledWith('teh put back');
    expect(e.view.dom.querySelector('.nova-autocorrected')).toBeNull();
    // A second Backspace is an ordinary one.
    expect(key(e, 'Backspace').defaultPrevented).toBe(false);
    await type(e, ' and teh ');
    expect(text(e)).toBe('teh  and teh ');
  });

  it('after anything else Backspace is Backspace again', async () => {
    const e = await mount();
    await type(e, 'teh c');
    expect(text(e)).toBe('the c');
    expect(key(e, 'Backspace').defaultPrevented).toBe(false);
    expect(e.view.dom.querySelector('.nova-autocorrected')).toBeNull();
  });

  it('Ctrl+Z right after a correction undoes only the correction', async () => {
    const e = await mount();
    await type(e, 'I saw teh ');
    expect(text(e)).toBe('I saw the ');
    e.exec('undo');
    expect(text(e)).toBe('I saw teh ');
    e.exec('redo');
    expect(text(e)).toBe('I saw the ');
  });

  it('Enter ends a word too; Ctrl+Z undoes the new paragraph, then the correction', async () => {
    const e = await mount();
    await type(e, 'I saw teh');
    key(e, 'Enter');
    expect(e.view.state.doc.firstChild!.textContent).toBe('I saw the');
    expect(e.view.state.doc.childCount).toBe(2);
    e.exec('undo');
    expect(e.getHTML()).toBe('<p>I saw the</p>');
    e.exec('undo');
    expect(e.getHTML()).toBe('<p>I saw teh</p>');
  });

  it('keeps the formatting of the word', async () => {
    const e = await mount('<p>I saw <strong>teh</strong></p>');
    // The space continues the bold text, as typing at its end does.
    await type(e, ' ');
    expect(e.getHTML()).toBe('<p>I saw <strong>the&nbsp;</strong></p>');
  });

  it('leaves code alone: a code block and inline code', async () => {
    const block = await mount('<pre><code>x</code></pre>');
    await type(block, ' teh ');
    expect(text(block)).toBe('x teh ');
    const inline = await mount('<p><code>teh</code></p>');
    await type(inline, ' ');
    expect(text(inline)).toBe('teh ');
  });

  it('capitalize: sentences start with a capital letter', async () => {
    const e = await mount('<p></p>', { capitalize: true });
    await type(e, 'hello world. this is it. teh end ');
    expect(text(e)).toBe('Hello world. This is it. The end ');
  });

  it('does not get in the way of autolink: the address still becomes a link', async () => {
    for (const plugins of [
      ['autocorrect', 'autolink'],
      ['autolink', 'autocorrect'],
    ]) {
      const e = await mount('<p></p>', {}, plugins);
      await type(e, 'see www.teh.com and teh ');
      expect(text(e), plugins.join()).toBe('see www.teh.com and the ');
      expect(e.getHTML(), plugins.join()).toContain('<a href="https://www.teh.com"');
    }
  });

  it('in suggesting mode the corrected word is still one suggestion of yours', async () => {
    const e = await mount('<p>Start</p>', {}, ['autocorrect', 'suggestions'], {
      suggestions: { enabled: true, author: { id: 'u1', name: 'Ann' } },
    });
    await type(e, ' teh ');
    expect(text(e)).toBe('Start the ');
    const suggestions = listSuggestions(e.view.state.doc);
    expect(suggestions.map((s) => [s.kind, s.text])).toEqual([['insert', ' the ']]);
  });

  it('the menu items and the button switch it, remember the choice and signal it', async () => {
    const e = await mount();
    const toggles: unknown[] = [];
    e.root.addEventListener('nova-autocorrect-toggle', (event) =>
      toggles.push((event as CustomEvent).detail),
    );
    const autocorrect = e.ui.registry.getMenuItem('autocorrect')!;
    const capitalization = e.ui.registry.getMenuItem('capitalization')!;
    expect(autocorrect.isActive!(e)).toBe(true);
    expect(capitalization.isActive!(e)).toBe(false);
    autocorrect.onAction(e);
    capitalization.onAction(e);
    expect(autocorrect.isActive!(e)).toBe(false);
    expect(capitalization.isActive!(e)).toBe(true);
    expect(toggles).toEqual([
      { feature: 'autocorrect', on: false },
      { feature: 'capitalize', on: true },
    ]);
    expect(JSON.parse(localStorage.getItem('novaprose-autocorrect')!)).toEqual({
      autocorrect: false,
      capitalize: true,
    });
    await type(e, 'teh end. teh ');
    expect(text(e)).toBe('Teh end. Teh ');
    // The next editor starts with the remembered choice, over its options.
    const next = await mount('<p></p>', { capitalize: false });
    expect(next.ui.registry.getMenuItem('capitalization')!.isActive!(next)).toBe(true);
  });

  it('remember: false keeps the choice out of storage; garbage in storage is ignored', async () => {
    localStorage.setItem('novaprose-autocorrect', '{"autocorrect":"no","capitalize":1}');
    const e = await mount('<p></p>', { remember: false });
    expect(e.ui.registry.getMenuItem('autocorrect')!.isActive!(e)).toBe(true);
    e.ui.registry.getMenuItem('autocorrect')!.onAction(e);
    expect(localStorage.getItem('novaprose-autocorrect')).toBe(
      '{"autocorrect":"no","capitalize":1}',
    );
    localStorage.setItem('novaprose-autocorrect', 'not json');
    const other = await mount();
    expect(other.ui.registry.getMenuItem('autocorrect')!.isActive!(other)).toBe(true);
  });

  it('the language: the built-in list is English; your corrections and ignored words apply anywhere', async () => {
    const german = await mount('<p></p>', {
      language: 'de-DE',
      replacements: { strasse: 'straße' },
      ignore: ['THe'],
    });
    await type(german, 'teh strasse THe ');
    expect(text(german)).toBe('teh straße THe ');
    // The spell checker's language counts too.
    const spell = await mount('<p></p>', {}, ['autocorrect'], {
      spellchecker: { language: 'fr', ignore: ['VMwares'] },
    });
    await type(spell, 'teh VMwares ');
    expect(text(spell)).toBe('teh VMwares ');
    // And the page's lang attribute.
    document.documentElement.lang = 'es';
    try {
      const page = await mount();
      await type(page, 'teh ');
      expect(text(page)).toBe('teh ');
    } finally {
      document.documentElement.lang = '';
    }
  });

  it('onCorrect hears each correction and each one taken back; its errors are contained', async () => {
    const seen: AutocorrectCorrection[] = [];
    const e = await mount('<p></p>', {
      capitalize: true,
      onCorrect: (c: AutocorrectCorrection) => {
        seen.push(c);
        if (c.reverted) throw new Error('boom');
      },
    });
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    await type(e, 'teh THe ');
    key(e, 'Backspace');
    expect(seen).toEqual([
      { word: 'teh', replacement: 'The', kind: 'typo', reverted: false },
      { word: 'THe', replacement: 'The', kind: 'capitals', reverted: false },
      { word: 'THe', replacement: 'The', kind: 'capitals', reverted: true },
    ]);
    expect(text(e)).toBe('The THe ');
    expect(error).toHaveBeenCalledOnce();
  });

  it('taking back a capital after a period learns the abbreviation', async () => {
    const e = await mount('<p></p>', { capitalize: true });
    await type(e, 'It is approx. ');
    await type(e, 'chap. ten ');
    expect(text(e)).toBe('It is approx. chap. Ten ');
    key(e, 'Backspace');
    expect(text(e)).toBe('It is approx. chap. ten ');
    await type(e, 'and chap. one ');
    expect(text(e)).toBe('It is approx. chap. ten and chap. one ');
  });

  it('a read-only editor is not changed', async () => {
    const e = await mount('<p>teh</p>');
    e.setEditable(false);
    key(e, 'Enter');
    expect(text(e)).toBe('teh');
  });
});
