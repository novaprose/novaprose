import { TextSelection } from 'prosemirror-state';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createCommentStore,
  createEditor,
  getComments,
  sanitizeThread,
  type CommentThread,
  type Editor,
} from '../src';

/** Комментарии: модель, якоря в HTML, отмена, панель обсуждений, безопасность. */

const editors: Editor[] = [];
afterEach(() => {
  editors.splice(0).forEach((e) => e.destroy());
  document.body.innerHTML = '';
});

function mount(content: string, comments: Record<string, unknown> = {}) {
  const element = document.createElement('div');
  document.body.appendChild(element);
  const editor = createEditor({
    element,
    content,
    plugins: ['comments'],
    pluginOptions: { comments: { author: { id: 'u1', name: 'Anna' }, ...comments } },
  });
  editors.push(editor);
  return { editor, comments: getComments(editor)! };
}

function selectText(editor: Editor, text: string) {
  const { doc } = editor.view.state;
  let from = -1;
  doc.descendants((node, pos) => {
    if (from >= 0 || !node.isText) return;
    const index = node.text!.indexOf(text);
    if (index >= 0) from = pos + index;
  });
  if (from < 0) throw new Error(`text not found: ${text}`);
  editor.view.dispatch(
    editor.view.state.tr.setSelection(
      TextSelection.create(editor.view.state.doc, from, from + text.length),
    ),
  );
}

async function addComment(editor: Editor, text: string, body: string) {
  const comments = getComments(editor)!;
  selectText(editor, text);
  expect(comments.startComment()).toBe(true);
  await comments.openPanel();
  return comments.submitPending(body)!;
}

const panel = (editor: Editor) => editor.root.querySelector<HTMLElement>('.nova-comments')!;

describe('хранилище комментариев', () => {
  it('создание, ответ, правка, удаление, решение; onChange получает снимок', () => {
    const onChange = vi.fn();
    const store = createCommentStore([], onChange);
    const author = { id: 'u1', name: 'Anna' };
    store.createThread({
      id: 't1',
      createdAt: 1,
      comments: [{ id: 'c1', author, text: 'First', createdAt: 1 }],
    });
    store.reply('t1', { id: 'c2', author, text: 'Second', createdAt: 2 });
    store.editComment('t1', 'c2', 'Second, edited');
    expect(store.threads()[0]!.comments.map((c) => c.text)).toEqual(['First', 'Second, edited']);
    expect(store.threads()[0]!.comments[1]!.editedAt).toBeTypeOf('number');
    store.deleteComment('t1', 'c2');
    store.setResolved('t1', { by: author, at: 3 });
    expect(store.threads()[0]!.resolved?.by.name).toBe('Anna');
    expect(onChange).toHaveBeenCalledTimes(5);
    store.deleteThread('t1');
    expect(store.threads()).toEqual([]);
  });

  it('данные извне проверяются: плохие id отбрасываются, длина ограничена', () => {
    expect(sanitizeThread({ id: 'bad id"><img>', comments: [] })).toBeNull();
    const thread = sanitizeThread({
      id: 'ok',
      comments: [
        { id: 'c1', author: { id: 1, name: 'x'.repeat(500) }, text: 'y'.repeat(10_000) },
        { id: '<script>', text: 'dropped' },
      ],
    })!;
    expect(thread.comments).toHaveLength(1);
    expect(thread.comments[0]!.author.name).toHaveLength(80);
    expect(thread.comments[0]!.text).toHaveLength(5000);
  });
});

describe('якоря комментариев в HTML', () => {
  it('HTML туда-обратно без изменений, в том числе перекрывающиеся обсуждения', () => {
    const html =
      '<p>Hello <span data-comment="t1">brave <span data-comment="t2">new</span></span><span data-comment="t2"> world</span></p>';
    const { editor } = mount(html);
    expect(editor.getHTML()).toBe(html);
    const again = mount(editor.getHTML()).editor;
    expect(again.getHTML()).toBe(html);
  });

  it('недопустимый id и редактор без плагина — разметка якоря отбрасывается, текст остаётся', () => {
    expect(mount('<p><span data-comment="a b">x</span></p>').editor.getHTML()).toBe('<p>x</p>');
    const element = document.createElement('div');
    document.body.appendChild(element);
    const plain = createEditor({ element, content: '<p><span data-comment="t1">x</span></p>' });
    editors.push(plain);
    expect(plain.getHTML()).toBe('<p>x</p>');
  });
});

describe('комментирование', () => {
  it('выделить текст → комментарий: якорь в HTML, ветка с автором, подсветка в тексте', async () => {
    const { editor, comments } = mount('<p>The quick brown fox</p>');
    const id = await addComment(editor, 'quick brown', 'Too long?');
    expect(editor.getHTML()).toBe(`<p>The <span data-comment="${id}">quick brown</span> fox</p>`);
    const thread = comments.store.threads()[0]!;
    expect(thread.comments[0]).toMatchObject({ text: 'Too long?', author: { name: 'Anna' } });
    const highlight = editor.view.dom.querySelector('.nova-comment');
    expect(highlight?.textContent).toBe('quick brown');
    expect(highlight?.classList.contains('is-active')).toBe(true);
  });

  it('без выделения и в режиме только чтения комментировать нельзя', () => {
    const { editor, comments } = mount('<p>Text</p>');
    expect(comments.startComment()).toBe(false);
    selectText(editor, 'Text');
    editor.setEditable(false);
    expect(comments.startComment()).toBe(false);
  });

  it('Ctrl+Z отменяет правки текста, но не снимает комментарий', async () => {
    const { editor } = mount('<p>Draft</p>');
    editor.view.dispatch(editor.view.state.tr.insertText(' text', 6));
    const id = await addComment(editor, 'Draft', 'Rename');
    expect(editor.exec('undo')).toBe(true);
    expect(editor.getHTML()).toBe(`<p><span data-comment="${id}">Draft</span></p>`);
  });

  it('пока пишется комментарий, правки текста сдвигают отложенное выделение', async () => {
    const { editor, comments } = mount('<p>abc target</p>');
    selectText(editor, 'target');
    comments.startComment();
    editor.view.dispatch(editor.view.state.tr.insertText('XYZ ', 1));
    await comments.openPanel();
    const id = comments.submitPending('note')!;
    expect(editor.getHTML()).toBe(`<p>XYZ abc <span data-comment="${id}">target</span></p>`);
  });

  it('Esc в панели отменяет новый комментарий', async () => {
    const { editor, comments } = mount('<p>Text</p>');
    selectText(editor, 'Text');
    comments.startComment();
    await comments.openPanel();
    const input = panel(editor).querySelector('textarea')!;
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(comments.pending()).toBeNull();
    expect(editor.view.dom.querySelector('.nova-comment')).toBeNull();
  });
});

describe('панель обсуждений', () => {
  it('ответ из панели (Ctrl+Enter), решение скрывает подсветку, «открыть снова» возвращает', async () => {
    const { editor, comments } = mount('<p>Some text here</p>');
    const id = await addComment(editor, 'text', 'Question');
    const reply = panel(editor).querySelector<HTMLTextAreaElement>(
      `[data-thread="${id}"] textarea`,
    )!;
    reply.value = 'Answer';
    reply.dispatchEvent(new Event('input'));
    reply.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true }));
    expect(comments.store.threads()[0]!.comments.map((c) => c.text)).toEqual([
      'Question',
      'Answer',
    ]);

    comments.setResolved(id, true);
    expect(editor.view.dom.querySelector('.nova-comment')).toBeNull();
    // Якорь остаётся в HTML: обсуждение можно открыть снова.
    expect(editor.getHTML()).toContain(`data-comment="${id}"`);
    expect(panel(editor).querySelector(`[data-thread="${id}"]`)).toBeNull();
    comments.setResolved(id, false);
    expect(editor.view.dom.querySelector('.nova-comment')).not.toBeNull();
  });

  it('удаление обсуждения убирает якорь из текста', async () => {
    const { editor, comments } = mount('<p>Some text</p>');
    const id = await addComment(editor, 'text', 'x');
    const button = [...panel(editor).querySelectorAll<HTMLButtonElement>('button')].find(
      (b) => b.textContent === 'Delete thread',
    )!;
    button.click();
    expect(editor.getHTML()).toBe('<p>Some text</p>');
    expect(comments.store.threads().find((t) => t.id === id)).toBeUndefined();
  });

  it('курсор в прокомментированном тексте открывает панель и выделяет обсуждение', async () => {
    const threads: CommentThread[] = [
      {
        id: 't1',
        createdAt: 1,
        comments: [{ id: 'c1', author: { id: 'u2', name: 'Boris' }, text: 'Hi', createdAt: 1 }],
      },
    ];
    const { editor, comments } = mount('<p>Hello <span data-comment="t1">world</span></p>', {
      threads,
    });
    editor.view.dispatch(
      editor.view.state.tr.setSelection(TextSelection.create(editor.view.state.doc, 9)),
    );
    await new Promise((r) => setTimeout(r, 0));
    await comments.openPanel();
    expect(comments.active()).toBe('t1');
    expect(comments.isPanelOpen()).toBe(true);
    const card = panel(editor).querySelector('[data-thread="t1"]')!;
    expect(card.classList.contains('is-active')).toBe(true);
    // Чужой комментарий нельзя править или удалять.
    const buttons = [...card.querySelectorAll('button')].map((b) => b.textContent);
    expect(buttons).not.toContain('Edit');
    expect(buttons).not.toContain('Delete thread');
  });

  it('панель закрыта, а обсуждение активно: клик в его текст снова открывает панель (регрессия)', async () => {
    const { editor, comments } = mount('<p>One two</p>');
    await addComment(editor, 'two', 'note');
    comments.closePanel();
    editor.view.dispatch(
      editor.view.state.tr.setSelection(TextSelection.create(editor.view.state.doc, 6)),
    );
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    expect(comments.isPanelOpen()).toBe(true);
  });

  it('набор текста внутри прокомментированного фрагмента не открывает закрытую панель', async () => {
    const { editor, comments } = mount('<p>One two</p>');
    await addComment(editor, 'two', 'note');
    comments.closePanel();
    editor.view.dispatch(editor.view.state.tr.insertText('x', 6));
    await new Promise((r) => setTimeout(r, 0));
    expect(comments.isPanelOpen()).toBe(false);
  });

  it('второй комментарий при открытой панели показывает поле ввода (регрессия)', async () => {
    const { editor, comments } = mount('<p>One two</p>');
    await addComment(editor, 'One', 'first');
    selectText(editor, 'two');
    comments.startComment();
    await new Promise((r) => setTimeout(r, 0));
    const input = panel(editor).querySelector('.nova-thread.is-new textarea');
    expect(input).not.toBeNull();
    expect(document.activeElement).toBe(input);
  });

  it('текст комментария и имя автора выводятся как текст, не как HTML', async () => {
    const { editor, comments } = mount('<p>x</p>', {
      threads: [
        {
          id: 't1',
          createdAt: 1,
          comments: [
            {
              id: 'c1',
              author: { id: 'evil', name: '<img src=x onerror=alert(1)>' },
              text: '<script>alert(1)</script>',
              createdAt: 1,
            },
          ],
        },
      ],
    });
    await comments.openPanel();
    const el = panel(editor);
    expect(el.querySelector('img, script')).toBeNull();
    expect(el.textContent).toContain('<script>alert(1)</script>');
    expect(el.textContent).toContain('<img src=x onerror=alert(1)>');
  });

  it('удалённый прокомментированный текст: обсуждение остаётся с пометкой', async () => {
    const { editor, comments } = mount('<p>Keep remove</p>');
    const id = await addComment(editor, 'remove', 'Why?');
    selectText(editor, 'remove');
    editor.view.dispatch(editor.view.state.tr.deleteSelection());
    comments.setActive(null);
    const card = panel(editor).querySelector(`[data-thread="${id}"]`)!;
    expect(card.classList.contains('is-orphan')).toBe(true);
    expect(card.textContent).toContain('The commented text was deleted');
  });

  it('кнопки addcomment и showcomments, сохранённые ветки и onChange', async () => {
    const onChange = vi.fn();
    const { editor, comments } = mount('<p>Text</p>', { onChange });
    expect(editor.root.querySelector('[data-control="addcomment"]')).not.toBeNull();
    expect(editor.root.querySelector('[data-control="showcomments"]')).not.toBeNull();
    await addComment(editor, 'Text', 'Saved');
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0]![0][0].comments[0].text).toBe('Saved');
    comments.closePanel();
    expect(panel(editor).hidden).toBe(true);
  });
});
