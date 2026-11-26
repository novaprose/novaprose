import { TextSelection } from 'prosemirror-state';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEditor, getComments, getMentions, type Editor, type MentionUser } from '../src';

/** Упоминания: узел в тексте, поиск людей, «@» в комментариях, безопасность. */

const PEOPLE: MentionUser[] = [
  { id: 'u1', name: 'Anna Ivanova', description: 'Head of Sales' },
  { id: 'u2', name: 'Boris Petrov' },
  { id: 'bad id"><img>', name: 'Evil' },
];
const fetchPeople = (query: string) =>
  PEOPLE.filter((p) => p.name.toLowerCase().startsWith(query.toLowerCase()));

const editors: Editor[] = [];
afterEach(() => {
  editors.splice(0).forEach((e) => e.destroy());
  document.body.innerHTML = '';
});

function mount(
  content: string,
  pluginOptions: Record<string, unknown> = {},
  plugins = ['mentions'],
) {
  const element = document.createElement('div');
  document.body.appendChild(element);
  const editor = createEditor({
    element,
    content,
    plugins,
    pluginOptions: { mentions: { fetch: fetchPeople }, ...pluginOptions },
  });
  editors.push(editor);
  return editor;
}

const spec = (editor: Editor) =>
  editor.ui.registry.getAutocompleters().find(([name]) => name === 'mentions')![1];

describe('упоминания в тексте', () => {
  it('HTML туда-обратно без изменений; getMentions — кто упомянут', () => {
    const html =
      '<p>Ask <span data-mention="u1">@Anna Ivanova</span> and <span data-mention="u2">@Boris Petrov</span>, <span data-mention="u1">@Anna Ivanova</span></p>';
    const editor = mount(html);
    expect(editor.getHTML()).toBe(html);
    expect(getMentions(editor)).toEqual([
      { id: 'u1', name: 'Anna Ivanova' },
      { id: 'u2', name: 'Boris Petrov' },
    ]);
  });

  it('«@» ищет людей: негодные id отброшены, выбор вставляет упоминание и пробел', async () => {
    const onMention = vi.fn();
    const editor = mount('<p>Hi</p>', { mentions: { fetch: fetchPeople, onMention } });
    await editor.ready;
    const items = await spec(editor).fetch('', editor);
    expect(items.map((i) => i.label)).toEqual(['Anna Ivanova', 'Boris Petrov']);
    expect(items[0]!.detail).toBe('Head of Sales');

    const end = editor.view.state.doc.content.size - 1;
    const tr = editor.view.state.tr.insertText(' @an', end);
    editor.view.dispatch(tr.setSelection(TextSelection.create(tr.doc, end + 4)));
    const to = editor.view.state.selection.from;
    spec(editor).onSelect(items[0]!, { from: to - 3, to }, editor);
    expect(editor.getHTML()).toBe('<p>Hi <span data-mention="u1">@Anna Ivanova</span>&nbsp;</p>');
    expect(onMention).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'u1', name: 'Anna Ivanova' }),
      editor,
    );
  });

  it('id и имя проверяются и при выводе (документ из JSON)', () => {
    const editor = mount('<p></p>');
    editor.setContent({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'mention', attrs: { id: 'x" onclick="alert(1)', name: '<img src=x>' } },
          ],
        },
      ],
    });
    const html = editor.getHTML();
    expect(html).not.toContain('onclick');
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img src=x&gt;');
  });

  it('без плагина упоминание становится обычным текстом', () => {
    const editor = mount('<p><span data-mention="u1">@Anna</span></p>', {}, []);
    expect(editor.getHTML()).toBe('<p>@Anna</p>');
  });
});

describe('«@» в комментариях', () => {
  async function commentEditor(onMention = vi.fn()) {
    const editor = mount(
      '<p>Plan text</p>',
      {
        comments: { author: { id: 'me', name: 'Me' }, onMention },
      },
      ['comments', 'mentions'],
    );
    const comments = getComments(editor)!;
    editor.view.dispatch(
      editor.view.state.tr.setSelection(TextSelection.create(editor.view.state.doc, 1, 5)),
    );
    comments.startComment();
    await comments.openPanel();
    await new Promise((r) => setTimeout(r, 0));
    const textarea = editor.root.querySelector<HTMLTextAreaElement>('.nova-comments textarea')!;
    return { editor, comments, textarea, onMention };
  }

  const typeInto = async (textarea: HTMLTextAreaElement, value: string) => {
    textarea.value = value;
    textarea.setSelectionRange(value.length, value.length);
    textarea.dispatchEvent(new Event('input'));
    await new Promise((r) => setTimeout(r, 0));
  };
  const key = (textarea: HTMLTextAreaElement, k: string, init: KeyboardEventInit = {}) =>
    textarea.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, ...init }));

  it('список людей, стрелки и Enter; упомянутые сохраняются и получают уведомление', async () => {
    const { editor, comments, textarea, onMention } = await commentEditor();
    expect(textarea.getAttribute('role')).toBe('combobox');
    await typeInto(textarea, 'Please check @');
    const options = editor.root.querySelectorAll('.nova-mention-option');
    expect([...options].map((o) => o.textContent)).toEqual([
      'AIAnna IvanovaHead of Sales',
      'BPBoris Petrov',
    ]);
    expect(textarea.getAttribute('aria-expanded')).toBe('true');
    key(textarea, 'ArrowDown');
    key(textarea, 'Enter');
    expect(textarea.value).toBe('Please check @Boris Petrov ');
    expect(textarea.getAttribute('aria-expanded')).toBe('false');

    key(textarea, 'Enter', { ctrlKey: true });
    const comment = comments.store.threads()[0]!.comments[0]!;
    expect(comment.mentions).toEqual([{ id: 'u2', name: 'Boris Petrov' }]);
    expect(onMention).toHaveBeenCalledWith(
      expect.objectContaining({ users: [{ id: 'u2', name: 'Boris Petrov' }] }),
    );
    // В тексте комментария имя выделено.
    expect(editor.root.querySelector('.nova-comment-mention')?.textContent).toBe('@Boris Petrov');
  });

  it('выбранного, но стёртого из текста человека не уведомляем; Esc закрывает только список', async () => {
    const { editor, comments, textarea, onMention } = await commentEditor();
    await typeInto(textarea, '@an');
    key(textarea, 'Enter');
    await typeInto(textarea, '@bo');
    key(textarea, 'Escape');
    expect(comments.pending()).not.toBeNull();
    expect(editor.root.querySelector('.nova-mention-list')!.hasAttribute('hidden')).toBe(true);
    await typeInto(textarea, 'never mind');
    key(textarea, 'Enter', { ctrlKey: true });
    expect(comments.store.threads()[0]!.comments[0]!.mentions).toBeUndefined();
    expect(onMention).not.toHaveBeenCalled();
  });
});
