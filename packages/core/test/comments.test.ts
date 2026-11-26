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

/** Comments: the model, anchors in HTML, undo, the discussion panel, security. */

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

describe('the comment store', () => {
  it('create, reply, edit, delete, resolve; onChange gets a snapshot', () => {
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

  it('outside data is checked: bad ids are dropped, the length is limited', () => {
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

describe('comment anchors in HTML', () => {
  it('HTML round trip without changes, overlapping threads included', () => {
    const html =
      '<p>Hello <span data-comment="t1">brave <span data-comment="t2">new</span></span><span data-comment="t2"> world</span></p>';
    const { editor } = mount(html);
    expect(editor.getHTML()).toBe(html);
    const again = mount(editor.getHTML()).editor;
    expect(again.getHTML()).toBe(html);
  });

  it('an invalid id and an editor without the plugin: the anchor markup is dropped, the text stays', () => {
    expect(mount('<p><span data-comment="a b">x</span></p>').editor.getHTML()).toBe('<p>x</p>');
    const element = document.createElement('div');
    document.body.appendChild(element);
    const plain = createEditor({ element, content: '<p><span data-comment="t1">x</span></p>' });
    editors.push(plain);
    expect(plain.getHTML()).toBe('<p>x</p>');
  });
});

describe('commenting', () => {
  it('select text → comment: an anchor in the HTML, a thread with the author, a highlight in the text', async () => {
    const { editor, comments } = mount('<p>The quick brown fox</p>');
    const id = await addComment(editor, 'quick brown', 'Too long?');
    expect(editor.getHTML()).toBe(`<p>The <span data-comment="${id}">quick brown</span> fox</p>`);
    const thread = comments.store.threads()[0]!;
    expect(thread.comments[0]).toMatchObject({ text: 'Too long?', author: { name: 'Anna' } });
    const highlight = editor.view.dom.querySelector('.nova-comment');
    expect(highlight?.textContent).toBe('quick brown');
    expect(highlight?.classList.contains('is-active')).toBe(true);
  });

  it("without a selection and in read-only mode you can't comment", () => {
    const { editor, comments } = mount('<p>Text</p>');
    expect(comments.startComment()).toBe(false);
    selectText(editor, 'Text');
    editor.setEditable(false);
    expect(comments.startComment()).toBe(false);
  });

  it("Ctrl+Z undoes text edits but doesn't remove the comment", async () => {
    const { editor } = mount('<p>Draft</p>');
    editor.view.dispatch(editor.view.state.tr.insertText(' text', 6));
    const id = await addComment(editor, 'Draft', 'Rename');
    expect(editor.exec('undo')).toBe(true);
    expect(editor.getHTML()).toBe(`<p><span data-comment="${id}">Draft</span></p>`);
  });

  it('while a comment is being written, text edits shift the pending selection', async () => {
    const { editor, comments } = mount('<p>abc target</p>');
    selectText(editor, 'target');
    comments.startComment();
    editor.view.dispatch(editor.view.state.tr.insertText('XYZ ', 1));
    await comments.openPanel();
    const id = comments.submitPending('note')!;
    expect(editor.getHTML()).toBe(`<p>XYZ abc <span data-comment="${id}">target</span></p>`);
  });

  it('Esc in the panel cancels a new comment', async () => {
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

describe('the discussion panel', () => {
  it('a reply from the panel (Ctrl+Enter), resolving hides the highlight, "reopen" brings it back', async () => {
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
    // The anchor stays in the HTML: the thread can be reopened.
    expect(editor.getHTML()).toContain(`data-comment="${id}"`);
    expect(panel(editor).querySelector(`[data-thread="${id}"]`)).toBeNull();
    comments.setResolved(id, false);
    expect(editor.view.dom.querySelector('.nova-comment')).not.toBeNull();
  });

  it('deleting a thread removes the anchor from the text', async () => {
    const { editor, comments } = mount('<p>Some text</p>');
    const id = await addComment(editor, 'text', 'x');
    const button = [...panel(editor).querySelectorAll<HTMLButtonElement>('button')].find(
      (b) => b.textContent === 'Delete thread',
    )!;
    button.click();
    expect(editor.getHTML()).toBe('<p>Some text</p>');
    expect(comments.store.threads().find((t) => t.id === id)).toBeUndefined();
  });

  it('the cursor in commented text opens the panel and highlights the thread', async () => {
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
    // Someone else's comment can't be edited or deleted.
    const buttons = [...card.querySelectorAll('button')].map((b) => b.textContent);
    expect(buttons).not.toContain('Edit');
    expect(buttons).not.toContain('Delete thread');
  });

  it('the panel is closed but the thread is active: a click in its text opens the panel again (regression)', async () => {
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

  it("typing inside a commented fragment doesn't open a closed panel", async () => {
    const { editor, comments } = mount('<p>One two</p>');
    await addComment(editor, 'two', 'note');
    comments.closePanel();
    editor.view.dispatch(editor.view.state.tr.insertText('x', 6));
    await new Promise((r) => setTimeout(r, 0));
    expect(comments.isPanelOpen()).toBe(false);
  });

  it('a second comment with the panel open shows the input field (regression)', async () => {
    const { editor, comments } = mount('<p>One two</p>');
    await addComment(editor, 'One', 'first');
    selectText(editor, 'two');
    comments.startComment();
    await new Promise((r) => setTimeout(r, 0));
    const input = panel(editor).querySelector('.nova-thread.is-new textarea');
    expect(input).not.toBeNull();
    expect(document.activeElement).toBe(input);
  });

  it('the comment text and the author name are output as text, not HTML', async () => {
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

  it('deleted commented text: the thread stays with a note', async () => {
    const { editor, comments } = mount('<p>Keep remove</p>');
    const id = await addComment(editor, 'remove', 'Why?');
    selectText(editor, 'remove');
    editor.view.dispatch(editor.view.state.tr.deleteSelection());
    comments.setActive(null);
    const card = panel(editor).querySelector(`[data-thread="${id}"]`)!;
    expect(card.classList.contains('is-orphan')).toBe(true);
    expect(card.textContent).toContain('The commented text was deleted');
  });

  it('the addcomment and showcomments buttons, saved threads and onChange', async () => {
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
