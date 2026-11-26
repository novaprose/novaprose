import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEditor, type Editor, type Revision } from '../src';

/** Version history: the list, viewing with differences, restoring, saving, security. */

const editors: Editor[] = [];
afterEach(() => {
  editors.splice(0).forEach((e) => e.destroy());
  document.body.innerHTML = '';
});

const REVISIONS: Revision[] = [
  { id: '1', createdAt: Date.UTC(2026, 10, 20, 9, 0), authors: ['Anna'], label: 'First draft' },
  { id: '2', createdAt: Date.UTC(2026, 10, 21, 9, 0), authors: ['Anna', 'Boris'] },
];
const CONTENT: Record<string, string | Record<string, unknown>> = {
  '1': '<h2>Plan</h2><p>The quick fox</p>',
  '2': {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text: 'click',
            marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }],
          },
        ],
      },
    ],
  },
};

async function mount(extra: Record<string, unknown> = {}) {
  const element = document.createElement('div');
  document.body.appendChild(element);
  const options = {
    list: vi.fn(async () => REVISIONS),
    load: vi.fn(async (revision: Revision) => CONTENT[revision.id]!),
    ...extra,
  };
  const editor = createEditor({
    element,
    content: '<h2>Plan</h2><p>The slow fox</p>',
    plugins: ['revisionhistory'],
    pluginOptions: { revisionhistory: options },
  });
  editors.push(editor);
  await editor.ready;
  return { editor, options };
}

const tick = () => new Promise((r) => setTimeout(r, 0));
const history = (editor: Editor) => editor.root.querySelector<HTMLElement>('.nova-history');
const open = async (editor: Editor) => {
  editor.root.querySelector<HTMLButtonElement>('[data-control="revisionhistory"]')!.click();
  await tick();
  await tick();
};
const item = (editor: Editor, id: string) =>
  editor.root.querySelector<HTMLButtonElement>(`.nova-history-item[data-revision="${id}"]`)!;

describe('version history', () => {
  it('the list: the current version and versions newest first, with authors and a name', async () => {
    const { editor } = await mount();
    await open(editor);
    const items = [...editor.root.querySelectorAll('.nova-history-item')];
    expect(items.map((el) => el.getAttribute('data-revision'))).toEqual(['current', '2', '1']);
    expect(items[1]!.textContent).toContain('Anna, Boris');
    expect(items[2]!.textContent).toContain('First draft');
    expect(items[0]!.getAttribute('aria-current')).toBe('true');
  });

  it('viewing a version with highlighted differences; restoring is an undoable edit', async () => {
    const onRestore = vi.fn();
    const { editor } = await mount({ onRestore });
    await open(editor);
    item(editor, '1').click();
    await tick();
    const preview = history(editor)!.querySelector('.nova-history-doc')!;
    expect(preview.textContent).toContain('The quick');
    expect(preview.querySelector('.nova-diff-added')?.textContent).toBe('quick');
    expect(preview.querySelector('.nova-diff-removed')?.textContent).toBe('slow');
    // Viewing is read only.
    expect(preview.getAttribute('contenteditable')).toBe('false');

    const restore = [...history(editor)!.querySelectorAll('button')].find(
      (b) => b.textContent === 'Restore this version',
    )!;
    expect(restore.disabled).toBe(false);
    restore.click();
    expect(editor.getHTML()).toBe('<h2>Plan</h2><p>The quick fox</p>');
    expect(onRestore).toHaveBeenCalledWith(REVISIONS[0]);
    expect(history(editor)).toBeNull();
    expect(editor.exec('undo')).toBe(true);
    expect(editor.getHTML()).toBe('<h2>Plan</h2><p>The slow fox</p>');
  });

  it('restoring is a separate undo step, even right after an edit (regression)', async () => {
    const { editor } = await mount();
    editor.setContent('<p>Edited just now</p>');
    await open(editor);
    item(editor, '1').click();
    await tick();
    [...history(editor)!.querySelectorAll('button')]
      .find((b) => b.textContent === 'Restore this version')!
      .click();
    editor.exec('undo');
    expect(editor.getHTML()).toBe('<p>Edited just now</p>');
  });

  it('the highlighting can be turned off; Esc closes the history', async () => {
    const { editor } = await mount();
    await open(editor);
    item(editor, '1').click();
    await tick();
    const toggle = history(editor)!.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
    toggle.checked = false;
    toggle.dispatchEvent(new Event('change'));
    expect(history(editor)!.querySelector('.nova-diff-added')).toBeNull();
    history(editor)!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(history(editor)).toBeNull();
  });

  it("a version's content goes through the same checks as regular content (JSON with javascript:)", async () => {
    const { editor } = await mount();
    await open(editor);
    item(editor, '2').click();
    await tick();
    const preview = history(editor)!.querySelector('.nova-history-doc')!;
    expect(preview.textContent).toContain('click');
    expect(preview.querySelector('a[href^="javascript"]')).toBeNull();
  });

  it('"Save version" calls save and updates the list; a loading error offers "Retry"', async () => {
    const save = vi.fn(async () => {});
    let fail = true;
    const list = vi.fn(async () => {
      if (fail) throw new Error('offline');
      return REVISIONS;
    });
    const { editor } = await mount({ save, list });
    await open(editor);
    const status = history(editor)!.querySelector('.nova-history-status')!;
    expect(status.textContent).toContain('Could not load the version history.');
    fail = false;
    status.querySelector('button')!.click();
    await tick();
    expect(editor.root.querySelectorAll('.nova-history-item')).toHaveLength(3);

    [...history(editor)!.querySelectorAll('button')]
      .find((b) => b.textContent === 'Save version')!
      .click();
    await tick();
    await tick();
    expect(save).toHaveBeenCalled();
    expect(list).toHaveBeenCalledTimes(3);
  });

  it('arrows move through the version list', async () => {
    const { editor, options } = await mount();
    await open(editor);
    item(editor, 'current').dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }),
    );
    await tick();
    expect(item(editor, '2').getAttribute('aria-current')).toBe('true');
    expect(options.load).toHaveBeenCalledWith(REVISIONS[1], editor);
  });
});
