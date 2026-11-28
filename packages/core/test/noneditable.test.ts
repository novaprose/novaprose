import { NodeSelection, TextSelection } from 'prosemirror-state';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEditor, createRenderer, type Editor, type EditorOptions } from '../src';

/** Locked content (the noneditable plugin): kept as one piece, nothing inside changes. */

const editors: Editor[] = [];
afterEach(() => {
  editors.splice(0).forEach((e) => e.destroy());
  document.body.innerHTML = '';
});

function make(content: string, options: Partial<EditorOptions> = {}): Editor {
  const element = document.createElement('div');
  document.body.append(element);
  const editor = createEditor({ element, content, plugins: ['noneditable'], ...options });
  editors.push(editor);
  return editor;
}

/** The position just inside the first node whose text includes `text`. */
function inside(editor: Editor, text: string): number {
  let found = -1;
  editor.view.state.doc.descendants((node, pos) => {
    if (found < 0 && node.isText && node.text!.includes(text))
      found = pos + node.text!.indexOf(text);
    return found < 0;
  });
  if (found < 0) throw new Error(`no "${text}"`);
  return found;
}

/** The start and end of the first block whose text includes `text`. */
function blockOf(editor: Editor, text: string): { from: number; to: number } {
  const $pos = editor.view.state.doc.resolve(inside(editor, text));
  return { from: $pos.before(1), to: $pos.after(1) };
}

describe('noneditable: the HTML stays as it was', () => {
  for (const html of [
    '<p class="mceNonEditable">Locked paragraph</p>',
    '<h2 class="mceNonEditable">Locked heading</h2>',
    '<div class="mceNonEditable"><p>Locked <strong>block</strong></p><p>second</p></div>',
    '<section contenteditable="false"><p>attribute</p></section>',
    '<p>Hello <span class="mceNonEditable">{{name}}</span>, welcome.</p>',
    '<div class="mceNonEditable"><p>frame</p><div class="mceEditable"><p>island</p></div></div>',
    '<p contenteditable="false">Dear <span contenteditable="true">name</span>,</p>',
    '<table class="mceNonEditable"><tbody><tr><td><p>locked cell</p></td></tr></tbody></table>',
    '<ul class="mceNonEditable"><li><p>locked item</p></li></ul>',
  ]) {
    it(html, () => {
      expect(make(html).getHTML()).toBe(html);
    });
  }

  it('contenteditable="true" outside locked content is not kept (the published page would be editable)', () => {
    expect(
      make('<p contenteditable="true">x</p><div contenteditable="true"><p>y</p></div>').getHTML(),
    ).toBe('<p>x</p><p>y</p>');
  });

  it('the classes are settings, as noneditable_class and editable_class', () => {
    const editor = make(
      '<div class="locked"><p>frame</p><p class="field">field</p></div><p class="mceNonEditable">default class is off</p>',
      { pluginOptions: { noneditable: { noneditableClass: 'locked', editableClass: 'field' } } },
    );
    expect(editor.getHTML()).toBe(
      '<div class="locked"><p>frame</p><p class="field">field</p></div><p>default class is off</p>',
    );
  });

  it('the server renders the same HTML', async () => {
    const html =
      '<div class="mceNonEditable"><p>frame</p><div class="mceEditable"><p>island</p></div></div>';
    const renderer = createRenderer({ plugins: ['noneditable'] });
    expect(await renderer.sanitize(html)).toBe(html);
    expect(renderer.html(make(html).getJSON())).toBe(html);
  });
});

describe('noneditable: nothing inside locked content changes', () => {
  it('typing and deleting inside are refused; the whole piece can go', () => {
    const editor = make('<p>before</p><p class="mceNonEditable">Locked</p><p>after</p>');
    const initial = editor.getHTML();
    const { state } = editor.view;
    editor.view.dispatch(state.tr.insertText('X', inside(editor, 'ocked')));
    editor.view.dispatch(
      editor.view.state.tr.delete(inside(editor, 'ocked'), inside(editor, 'ked')),
    );
    // From the paragraph before into the locked one: refused too.
    editor.view.dispatch(editor.view.state.tr.delete(inside(editor, 'ore'), inside(editor, 'ked')));
    expect(editor.getHTML()).toBe(initial);
    const locked = blockOf(editor, 'Locked');
    editor.view.dispatch(editor.view.state.tr.delete(locked.from, locked.to));
    expect(editor.getHTML()).toBe('<p>before</p><p>after</p>');
    editor.exec('undo');
    expect(editor.getHTML()).toBe(initial);
  });

  it("a locked block's type and attributes don't change either", () => {
    const editor = make('<p class="mceNonEditable">Locked</p>');
    const { from } = blockOf(editor, 'Locked');
    const { state } = editor.view;
    editor.view.dispatch(state.tr.setNodeMarkup(from, state.schema.nodes.heading, { level: 1 }));
    editor.view.dispatch(editor.view.state.tr.setNodeAttribute(from, 'align', 'center'));
    expect(editor.getHTML()).toBe('<p class="mceNonEditable">Locked</p>');
  });

  it('opened parts can be edited, but not past their edges', () => {
    const editor = make(
      '<div class="mceNonEditable"><p>frame</p><div class="mceEditable"><p>island</p></div></div>',
    );
    editor.view.dispatch(editor.view.state.tr.insertText('my ', inside(editor, 'island')));
    expect(editor.getHTML()).toContain('<p>my island</p>');
    // From the island into the frame: refused.
    editor.view.dispatch(
      editor.view.state.tr.delete(inside(editor, 'rame'), inside(editor, 'land')),
    );
    expect(editor.getHTML()).toBe(
      '<div class="mceNonEditable"><p>frame</p><div class="mceEditable"><p>my island</p></div></div>',
    );
  });

  it('an inline field opened in a locked paragraph can be typed in', () => {
    const editor = make(
      '<p contenteditable="false">Dear <span contenteditable="true">name</span>,</p>',
    );
    editor.view.dispatch(
      editor.view.state.tr.insertText('Ann', inside(editor, 'name'), inside(editor, 'name') + 4),
    );
    editor.view.dispatch(editor.view.state.tr.insertText('X', inside(editor, 'Dear') + 1));
    expect(editor.getHTML()).toBe(
      '<p contenteditable="false">Dear <span contenteditable="true">Ann</span>,</p>',
    );
  });

  it('formatting across locked content formats what is around it', () => {
    const editor = make(
      '<p>one</p><p class="mceNonEditable">Locked <em>text</em></p><p>two <span class="mceNonEditable">{{var}}</span> end</p>',
    );
    editor.view.dispatch(
      editor.view.state.tr.setSelection(
        TextSelection.create(editor.view.state.doc, 1, editor.view.state.doc.content.size - 1),
      ),
    );
    editor.exec('bold');
    const bold =
      '<p><strong>one</strong></p><p class="mceNonEditable">Locked <em>text</em></p>' +
      '<p><strong>two <span class="mceNonEditable">{{var}}</span> end</strong></p>';
    expect(editor.getHTML()).toBe(bold);
    // Read again, the same: the bold around the locked piece doesn't move into it.
    const again = make(bold);
    expect(again.getHTML()).toBe(bold);
    // Taking it away doesn't take the locked text's own formatting.
    editor.exec('italic');
    editor.exec('italic');
    expect(editor.getHTML()).toContain('<p class="mceNonEditable">Locked <em>text</em></p>');
    editor.exec('undo');
    editor.exec('undo');
    editor.exec('undo');
    expect(editor.getHTML()).toBe(
      '<p>one</p><p class="mceNonEditable">Locked <em>text</em></p><p>two <span class="mceNonEditable">{{var}}</span> end</p>',
    );
  });

  it("a collaborator's change is applied as it is (the documents must not part)", () => {
    const editor = make('<p class="mceNonEditable">Locked</p>');
    const tr = editor.view.state.tr.insertText('X', inside(editor, 'ocked'));
    tr.setMeta('y-sync$', { isChangeOrigin: true });
    editor.view.dispatch(tr);
    expect(editor.getHTML()).toBe('<p class="mceNonEditable">LXocked</p>');
  });

  it('setContent and insertContent work around it', () => {
    const editor = make('<p class="mceNonEditable">Locked</p><p>x</p>');
    editor.setContent('<p>new</p><p class="mceNonEditable">other</p>');
    expect(editor.getHTML()).toBe('<p>new</p><p class="mceNonEditable">other</p>');
  });

  // Found by the shared-editor tests: a document that was one selected locked block refused
  // setContent (typing over the selected piece was refused, and setContent looked the same).
  it('a document that is one selected locked block can still be replaced', () => {
    const editor = make('<p class="mceNonEditable">Only</p>');
    editor.view.dispatch(
      editor.view.state.tr.setSelection(NodeSelection.create(editor.view.state.doc, 0)),
    );
    editor.setContent('<p>new</p>');
    expect(editor.getHTML()).toBe('<p>new</p>');
    editor.setContent({
      type: 'doc',
      content: [
        { type: 'paragraph', attrs: { lock: 'class' }, content: [{ type: 'text', text: 'L' }] },
      ],
    });
    editor.view.dispatch(
      editor.view.state.tr.setSelection(NodeSelection.create(editor.view.state.doc, 0)),
    );
    editor.view.dispatch(editor.view.state.tr.insertText('typed'));
    expect(editor.getHTML()).toBe('<p class="mceNonEditable">L</p>');
  });
});

describe('noneditable: selecting it', () => {
  it('a cursor placed inside selects the locked piece', () => {
    vi.useFakeTimers();
    const editor = make('<p>a</p><p class="mceNonEditable">Locked</p>');
    editor.view.dispatch(
      editor.view.state.tr.setSelection(
        TextSelection.create(editor.view.state.doc, inside(editor, 'ocked')),
      ),
    );
    const { selection } = editor.view.state;
    expect(selection).toBeInstanceOf(NodeSelection);
    expect((selection as NodeSelection).node.textContent).toBe('Locked');
    // Screen readers hear why typing does nothing there.
    vi.advanceTimersByTime(60);
    expect(editor.root.querySelector('.nova-announcer')?.textContent).toMatch(/Locked content/);
    vi.useRealTimers();
    // Typing or pasting while it is selected doesn't replace it: it goes only when deleted.
    editor.view.dispatch(editor.view.state.tr.insertText('X'));
    editor.insertContent('<p>pasted</p>');
    expect(editor.getHTML()).toBe('<p>a</p><p class="mceNonEditable">Locked</p>');
    editor.view.dispatch(editor.view.state.tr.deleteSelection());
    expect(editor.getHTML()).toBe('<p>a</p>');
  });

  it('a selection across more than the locked piece is replaced as a whole', () => {
    const editor = make('<p>a</p><p class="mceNonEditable">Locked</p><p>b</p>');
    const { doc } = editor.view.state;
    editor.view.dispatch(
      editor.view.state.tr.setSelection(TextSelection.create(doc, 1, doc.content.size - 1)),
    );
    editor.view.dispatch(editor.view.state.tr.insertText('new'));
    expect(editor.getHTML()).toBe('<p>new</p>');
  });

  it('Backspace after it and Delete before it select it first', () => {
    const editor = make(
      '<p class="mceNonEditable">Locked</p><p>after</p><p>before</p><p class="mceNonEditable">Second</p>',
    );
    const at = (pos: number) =>
      editor.view.dispatch(
        editor.view.state.tr.setSelection(TextSelection.create(editor.view.state.doc, pos)),
      );
    const press = (key: string) =>
      editor.view.dom.dispatchEvent(
        new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }),
      );
    at(inside(editor, 'after'));
    press('Backspace');
    expect((editor.view.state.selection as NodeSelection).node?.textContent).toBe('Locked');
    at(inside(editor, 'before') + 'before'.length);
    press('Delete');
    expect((editor.view.state.selection as NodeSelection).node?.textContent).toBe('Second');
    // Then Delete removes it whole.
    editor.view.dispatch(editor.view.state.tr.deleteSelection());
    expect(editor.getHTML()).not.toContain('Second');
  });

  it('in the editor, locked nodes are not editable and opened parts are', () => {
    const editor = make(
      '<div class="mceNonEditable"><p>frame</p><div class="mceEditable"><p>island</p></div></div><p>Hi <span class="mceNonEditable">x</span></p>',
    );
    const locked = editor.root.querySelectorAll('.nova-locked');
    expect([...locked].map((el) => el.getAttribute('contenteditable'))).toEqual(['false', 'false']);
    expect(editor.root.querySelector('.nova-unlocked')?.getAttribute('contenteditable')).toBe(
      'true',
    );
  });
});

describe('noneditable: JSON from outside', () => {
  it('a lock of the wrong type is no lock, and nothing crashes', () => {
    const editor = make('<p>x</p>');
    for (const lock of [7, {}, [], 'yes', null, true]) {
      editor.setContent({
        type: 'doc',
        content: [{ type: 'paragraph', attrs: { lock }, content: [{ type: 'text', text: 'a' }] }],
      });
      expect(editor.getHTML(), String(lock)).toBe('<p>a</p>');
    }
    editor.setContent({
      type: 'doc',
      content: [
        {
          type: 'noneditable',
          attrs: { tag: 'script', lock: 'class' },
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'b' }] }],
        },
      ],
    });
    expect(editor.getHTML()).toBe('<div class="mceNonEditable"><p>b</p></div>');
  });
});
