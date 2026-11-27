import { TextSelection } from 'prosemirror-state';
import { undo } from 'prosemirror-history';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEditor, type Editor, type EditorOptions } from '../src';
import {
  changeCase,
  convertCase,
  ENGLISH_MINORS,
  titleCaseStarts,
  type TextCase,
} from '../src/plugins/casechange';

const editors: Editor[] = [];
afterEach(() => {
  for (const editor of editors.splice(0)) editor.destroy();
  vi.useRealTimers();
});

function mount(content: string, options: Partial<EditorOptions> = {}): Editor {
  const element = document.createElement('div');
  document.body.append(element);
  const editor = createEditor({ element, content, ...options });
  editors.push(editor);
  return editor;
}

function select(editor: Editor, from: number, to = from): void {
  const { state } = editor.view;
  editor.view.dispatch(state.tr.setSelection(TextSelection.create(state.doc, from, to)));
}

/** All the document's text selected, then the case changed the way the plugin does it. */
function convertAll(html: string, kind: TextCase, minors: string[] = ENGLISH_MINORS): string {
  const editor = mount(html);
  select(editor, 1, editor.view.state.doc.content.size - 1);
  const tr = changeCase(editor.view.state, kind, { locale: 'en', minors: new Set(minors) });
  if (tr) editor.view.dispatch(tr);
  return editor.getHTML();
}

const title = (text: string, minors = ENGLISH_MINORS) =>
  convertCase(text, 'title', 'en', 0, titleCaseStarts(text, new Set(minors)));

describe('Title Case rules', () => {
  it('keeps minor words in lower case, but not the first and the last word', () => {
    expect(title('the lord of the rings')).toBe('The Lord of the Rings');
    expect(title('what the world is made of')).toBe('What the World Is Made Of');
  });

  it('capitalizes the word after a colon or the end of a sentence', () => {
    expect(title('a tale of two cities: the beginning')).toBe(
      'A Tale of Two Cities: The Beginning',
    );
    expect(title('it ends. and then')).toBe('It Ends. And Then');
  });

  it('splits words at hyphens and keeps apostrophes inside a word', () => {
    expect(title('state-of-the-art design')).toBe('State-of-the-Art Design');
    expect(title("don't STOP believin'")).toBe("Don't Stop Believin'");
  });

  it('works for any alphabet and lowers the rest of each word', () => {
    expect(title('ΓΕΙΑ ΣΟΥ, κόσμε')).toBe('Γεια Σου, Κόσμε');
    expect(title('élan vital')).toBe('Élan Vital');
  });
});

describe('changing the case of the document', () => {
  it('UPPERCASE and lowercase keep the formatting letter by letter', () => {
    expect(convertAll('<p>Hello <strong>brave</strong> <em>World</em></p>', 'upper')).toBe(
      '<p>HELLO <strong>BRAVE</strong> <em>WORLD</em></p>',
    );
    expect(convertAll('<p>Hello <strong>BRAVE</strong> World</p>', 'lower')).toBe(
      '<p>hello <strong>brave</strong> world</p>',
    );
  });

  it('a word split by formatting is still one word for Title Case', () => {
    expect(convertAll('<p>the <strong>qu</strong>ick fox</p>', 'title')).toBe(
      '<p>The <strong>Qu</strong>ick Fox</p>',
    );
  });

  it('every paragraph starts and ends its own title', () => {
    expect(convertAll('<p>the end of</p><p>a story</p>', 'title')).toBe(
      '<p>The End Of</p><p>A Story</p>',
    );
  });

  it('leaves code alone: inline code and code blocks are case-sensitive', () => {
    expect(convertAll('<p>use <code>getHTML</code> now</p>', 'upper')).toBe(
      '<p>USE <code>getHTML</code> NOW</p>',
    );
    expect(convertAll('<p>intro</p><pre><code>const a = 1;</code></pre>', 'upper')).toBe(
      '<p>INTRO</p><pre><code>const a = 1;</code></pre>',
    );
  });

  it('a letter that changes length (ß → SS) keeps the rest in place', () => {
    expect(convertAll('<p>straße <em>nach</em> rom</p>', 'upper')).toBe(
      '<p>STRASSE <em>NACH</em> ROM</p>',
    );
  });

  it('the selection covers the changed text afterwards', () => {
    const editor = mount('<p>one two three</p>');
    select(editor, 5, 8);
    editor.view.dispatch(changeCase(editor.view.state, 'upper')!);
    expect(editor.getHTML()).toBe('<p>one TWO three</p>');
    const { from, to } = editor.view.state.selection;
    expect([from, to]).toEqual([5, 8]);
  });

  it('with the cursor in a word, that word changes and the cursor stays', () => {
    const editor = mount('<p>one two three</p>');
    select(editor, 6);
    editor.view.dispatch(changeCase(editor.view.state, 'upper')!);
    expect(editor.getHTML()).toBe('<p>one TWO three</p>');
    expect(editor.view.state.selection.from).toBe(6);
  });

  it('a cursor between words changes nothing', () => {
    const editor = mount('<p>one - two</p>');
    select(editor, 5);
    expect(changeCase(editor.view.state, 'upper')).toBeNull();
  });

  it('is one undo step', () => {
    const editor = mount('<p>Hello <strong>brave</strong> world</p>');
    select(editor, 1, editor.view.state.doc.content.size - 1);
    editor.view.dispatch(changeCase(editor.view.state, 'upper')!);
    undo(editor.view.state, editor.view.dispatch);
    expect(editor.getHTML()).toBe('<p>Hello <strong>brave</strong> world</p>');
  });
});

describe('the casechange plugin', () => {
  async function ready(content: string, options: Partial<EditorOptions> = {}): Promise<Editor> {
    const editor = mount(content, { plugins: ['casechange'], ...options });
    await editor.ready;
    return editor;
  }

  it('the button applies the case used last; menu items apply each case', async () => {
    const editor = await ready('<p>the lord of the rings</p>');
    const { registry } = editor.ui;
    select(editor, 1, editor.view.state.doc.content.size - 1);
    registry.getMenuItem('titlecase')!.onAction(editor);
    expect(editor.getHTML()).toBe('<p>The Lord of the Rings</p>');
    registry.getMenuItem('uppercase')!.onAction(editor);
    expect(editor.getHTML()).toBe('<p>THE LORD OF THE RINGS</p>');
    registry.getMenuItem('lowercase')!.onAction(editor);
    const button = registry.get('casechange');
    expect(button?.type).toBe('split');
    if (button?.type === 'split') button.onAction(editor);
    expect(editor.getHTML()).toBe('<p>the lord of the rings</p>');
  });

  it('says the new case to screen readers', async () => {
    vi.useFakeTimers();
    const editor = await ready('<p>word</p>');
    select(editor, 2);
    editor.ui.registry.getMenuItem('uppercase')!.onAction(editor);
    vi.advanceTimersByTime(60);
    expect(editor.root.querySelector('.nova-announcer')?.textContent).toBe('UPPERCASE');
  });

  it('pluginOptions.casechange.titleCaseMinors replaces the minor words', async () => {
    const editor = await ready('<p>the lord of the rings</p>', {
      pluginOptions: { casechange: { titleCaseMinors: ['of'] } },
    });
    select(editor, 1, editor.view.state.doc.content.size - 1);
    editor.ui.registry.getMenuItem('titlecase')!.onAction(editor);
    expect(editor.getHTML()).toBe('<p>The Lord of The Rings</p>');
  });

  it('outside English, Title Case capitalizes every word unless minor words are given', async () => {
    const editor = await ready('<p>das ende der welt</p>', { language: 'de' });
    select(editor, 1, editor.view.state.doc.content.size - 1);
    editor.ui.registry.getMenuItem('titlecase')!.onAction(editor);
    expect(editor.getHTML()).toBe('<p>Das Ende Der Welt</p>');
  });

  it('is disabled with the cursor outside a word and in a read-only editor', async () => {
    const editor = await ready('<p>one - two</p>');
    const item = editor.ui.registry.getMenuItem('uppercase')!;
    select(editor, 5);
    expect(item.isEnabled!(editor)).toBe(false);
    select(editor, 2);
    expect(item.isEnabled!(editor)).toBe(true);
    editor.setEditable(false);
    expect(item.isEnabled!(editor)).toBe(false);
  });
});
