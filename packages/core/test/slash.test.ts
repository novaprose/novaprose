import { TextSelection } from 'prosemirror-state';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEditor, defaultSlashCommands, type Editor } from '../src';
import dePack from '../src/i18n/packs/de';
import { createTranslator, registerLanguage } from '../src/i18n';
import { rankSlashCommands } from '../src/ui/slash';

// A language pack (not built into the core): registered the way a customer does it.
registerLanguage('de', dePack);

let editor: Editor | null = null;

function mount(
  content = '<p></p>',
  options: Parameters<typeof createEditor>[0] extends infer O ? Partial<O> : never = {},
) {
  const element = document.createElement('div');
  document.body.append(element);
  editor = createEditor({ element, content, ...options });
  editor.focus();
  return editor;
}

/** Types text at the end of the document (like keyboard input, through a transaction). */
function type(e: Editor, text: string) {
  const { state } = e.view;
  const end = state.doc.content.size - 1;
  e.view.dispatch(state.tr.setSelection(TextSelection.create(state.doc, end)).insertText(text));
}

const key = (e: Editor, k: string) =>
  e.view.dom.dispatchEvent(
    new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }),
  );

const list = (e: Editor) => e.root.querySelector<HTMLElement>('.nova-ac')!;
const flush = () => new Promise((r) => setTimeout(r, 0));

afterEach(() => {
  editor?.destroy();
  editor = null;
  document.body.innerHTML = '';
});

describe('rankSlashCommands', () => {
  const tEn = createTranslator('en');
  const tDe = createTranslator('de');
  const names = (q: string, t = tEn) =>
    rankSlashCommands(defaultSlashCommands, q, t).map((c) => c.name);

  it('an empty query lists all commands in order', () => {
    expect(names('')).toEqual(defaultSlashCommands.map((c) => c.name));
  });

  it('searches labels and keywords; the start beats the middle', () => {
    expect(names('head').slice(0, 3)).toEqual(['h1', 'h2', 'h3']);
    expect(names('h2')[0]).toBe('h2');
    expect(names('quote')).toEqual(['blockquote']);
    expect(names('zzz')).toEqual([]);
  });

  it('translated labels and English keywords work in a translated UI', () => {
    expect(names('übers', tDe).slice(0, 3)).toEqual(['h1', 'h2', 'h3']);
    expect(names('zit', tDe)).toEqual(['blockquote']);
    expect(names('quote', tDe)).toEqual(['blockquote']);
  });
});

describe('slash commands in the editor', () => {
  it('"/" shows the list, Enter runs the command and removes "/query"', async () => {
    const e = mount();
    type(e, '/hea');
    await flush();
    expect(list(e).hidden).toBe(false);
    // The list is linked to the field through aria-controls (aria-expanded isn't allowed on role=textbox).
    expect(e.view.dom.getAttribute('aria-controls')).toBe(list(e).id);
    expect(e.view.dom.hasAttribute('aria-expanded')).toBe(false);
    const options = [...list(e).querySelectorAll('[role="option"]')].map((o) => o.textContent);
    expect(options[0]).toContain('Heading 1');
    key(e, 'ArrowDown');
    key(e, 'Enter');
    expect(e.getHTML()).toBe('<h2></h2>');
    expect(list(e).hidden).toBe(true);
  });

  it('Escape closes it and doesn\'t open it again for the same "/"', async () => {
    const e = mount();
    type(e, '/');
    await flush();
    key(e, 'Escape');
    expect(list(e).hidden).toBe(true);
    type(e, 'q');
    await flush();
    expect(list(e).hidden).toBe(true);
    expect(e.getHTML()).toBe('<p>/q</p>');
  });

  it("doesn't fire in the middle of a word (addresses, fractions)", async () => {
    const e = mount();
    type(e, 'and/or');
    await flush();
    expect(list(e).hidden).toBe(true);
  });

  it('fires after a space', async () => {
    const e = mount();
    type(e, 'text /quo');
    await flush();
    expect(list(e).hidden).toBe(false);
  });

  it("doesn't fire in a code block", async () => {
    const e = mount('<pre><code></code></pre>');
    type(e, '/');
    await flush();
    expect(list(e).hidden).toBe(true);
  });

  it('an empty result shows the "nothing found" text', async () => {
    const e = mount();
    type(e, '/zzzz');
    await flush();
    expect(list(e).hidden).toBe(false);
    expect(list(e).textContent).toBe('No matching commands');
    // Enter with an empty list isn't intercepted: a regular line break.
    key(e, 'Enter');
    expect(e.getHTML()).toBe('<p>/zzzz</p><p></p>');
  });

  it('custom commands through the option, and turning it off', async () => {
    const run = vi.fn();
    const e = mount('<p></p>', {
      slashCommands: [{ name: 'sig', label: 'link', icon: '', keywords: ['signature'], run }],
    });
    type(e, '/signa');
    await flush();
    key(e, 'Enter');
    expect(run).toHaveBeenCalledWith(e);
    e.destroy();
    const off = mount('<p></p>', { slashCommands: false });
    expect(off.ui.registry.getAutocompleters()).toHaveLength(0);
  });
});
