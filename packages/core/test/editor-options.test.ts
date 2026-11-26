import { TextSelection } from 'prosemirror-state';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEditor, type Editor, type EditorOptions } from '../src';

/** Parity options: blockFormats (block_formats), disabled, resize. */

let editor: Editor | null = null;
afterEach(() => {
  editor?.destroy();
  editor = null;
  document.body.innerHTML = '';
});

function mount(content = '<p>text</p>', options: Partial<EditorOptions> = {}) {
  const element = document.createElement('div');
  document.body.appendChild(element);
  editor = createEditor({ element, content, ...options });
  return editor;
}

const control = (e: Editor, name: string) =>
  e.root.querySelector<HTMLButtonElement>(`[data-control="${name}"]`)!;

describe('blockFormats', () => {
  it('the blocks menu shows only the given items, in the given order and with their own labels', () => {
    const e = mount('<h3>x</h3>', {
      blockFormats: [
        { label: 'Subheading', block: 'h3' },
        { label: 'Text', block: 'p' },
        { label: 'Unknown', block: 'h9' as 'h1' },
      ],
    });
    e.view.dispatch(e.view.state.tr.setSelection(TextSelection.create(e.view.state.doc, 1)));
    const blocks = control(e, 'blocks');
    expect(blocks.textContent).toContain('Subheading');
    blocks.click();
    const items = [...e.root.querySelectorAll<HTMLButtonElement>('.nova-menu-item')];
    expect(items.map((i) => i.dataset.id)).toEqual(['h3', 'paragraph']);
    expect(items[0]!.textContent).toContain('Subheading');
    items[1]!.click();
    expect(e.getHTML()).toBe('<p>x</p>');
  });
});

describe('disabled', () => {
  it("a disabled editor can't be edited, is out of the Tab order, panels are inactive", () => {
    const e = mount('<p>text</p>', { disabled: true });
    expect(e.isDisabled()).toBe(true);
    expect(e.isEditable()).toBe(false);
    expect(e.view.dom.getAttribute('contenteditable')).toBe('false');
    expect(e.view.dom.getAttribute('tabindex')).toBe('-1');
    expect(e.root.getAttribute('aria-disabled')).toBe('true');
    expect(e.root.classList.contains('nova-disabled')).toBe(true);
    expect(control(e, 'bold').disabled).toBe(true);
  });

  it('setDisabled switches at runtime and reports editableChange; it doesn\'t lift "read only"', () => {
    const e = mount();
    let changes = 0;
    e.on('editableChange', () => changes++);
    e.setDisabled(true);
    expect(control(e, 'bold').disabled).toBe(true);
    e.setEditable(false);
    e.setDisabled(false);
    expect(changes).toBe(3);
    // Enabled again, but "read only" stays.
    expect(e.isEditable()).toBe(false);
    expect(e.root.hasAttribute('aria-disabled')).toBe(false);
    expect(e.view.dom.hasAttribute('tabindex')).toBe(false);
    e.setEditable(true);
    expect(e.isEditable()).toBe(true);
    expect(control(e, 'bold').disabled).toBe(false);
  });
});

describe('resize', () => {
  it('no handle by default', () => {
    const e = mount();
    expect(e.root.querySelector('.nova-resize-handle')).toBeNull();
  });

  it('the handle in the statusbar: works from the keyboard, changes the height, no less than the minimum', () => {
    const e = mount('<p>x</p>', { resize: true });
    const handle = e.root.querySelector<HTMLElement>('.nova-statusbar .nova-resize-handle')!;
    expect(handle.getAttribute('role')).toBe('separator');
    expect(handle.getAttribute('aria-label')).toBe('Resize editor');
    expect(handle.tabIndex).toBe(0);
    expect(handle.querySelector('svg')).not.toBeNull();
    handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    // jsdom doesn't compute layout (height 0), so the minimum applies.
    expect(e.root.style.height).toBe('100px');
    expect(e.root.style.width).toBe('');
  });

  it("'both' changes the width too", () => {
    const e = mount('<p>x</p>', { resize: 'both' });
    const handle = e.root.querySelector<HTMLElement>('.nova-resize-handle')!;
    expect(e.root.dataset.resize).toBe('both');
    handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(e.root.style.width).toBe('200px');
  });
});

describe('filePicker', () => {
  const flush = () => new Promise((r) => setTimeout(r, 0));
  const dialog = () => document.querySelector<HTMLElement>('[role="dialog"]')!;
  const browse = () => dialog().querySelector<HTMLButtonElement>('.nova-input-action');

  it('without filePicker there is no "Browse" button', () => {
    const e = mount();
    control(e, 'link').click();
    expect(browse()).toBeNull();
  });

  it('a link: "Browse" fills in the address, text and title; it gets the type and the current address', async () => {
    const picker = vi.fn(async () => ({
      url: 'https://cdn.example.com/a.pdf',
      text: 'Report',
      title: 'PDF',
    }));
    const e = mount('<p></p>', { filePicker: picker });
    control(e, 'link').click();
    const button = browse()!;
    expect(button.getAttribute('aria-label')).toBe('Browse');
    button.click();
    await flush();
    expect(picker).toHaveBeenCalledWith({ type: 'file', value: '' });
    const inputs = dialog().querySelectorAll<HTMLInputElement>('input.nova-input');
    expect(inputs[0]!.value).toBe('https://cdn.example.com/a.pdf');
    expect(inputs[1]!.value).toBe('Report');
    expect(inputs[2]!.value).toBe('PDF');
  });

  it('an image: type image, alt from the result; a refusal (null) changes nothing', async () => {
    const picker = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ url: 'https://cdn.example.com/a.png', alt: 'Cat' });
    const e = mount('<p></p>', { filePicker: picker });
    control(e, 'image').click();
    browse()!.click();
    await flush();
    const inputs = dialog().querySelectorAll<HTMLInputElement>('input.nova-input');
    expect(inputs[0]!.value).toBe('');
    browse()!.click();
    await flush();
    expect(picker).toHaveBeenLastCalledWith({ type: 'image', value: '' });
    expect(inputs[0]!.value).toBe('https://cdn.example.com/a.png');
    expect(inputs[1]!.value).toBe('Cat');
  });

  it('filePickerTypes: the button only on allowed fields', () => {
    const e = mount('<p></p>', { filePicker: () => null, filePickerTypes: ['image'] });
    control(e, 'link').click();
    expect(browse()).toBeNull();
  });
});

describe('insertContent', () => {
  const at = (e: Editor, text: string) => {
    let pos = -1;
    e.view.state.doc.descendants((node, p) => {
      if (pos < 0 && node.isText && node.text!.includes(text)) pos = p + node.text!.indexOf(text);
    });
    e.view.dispatch(e.view.state.tr.setSelection(TextSelection.create(e.view.state.doc, pos)));
  };

  it('text and marks go to the cursor, dangerous parts are cut out', () => {
    const e = mount('<p>ab</p>');
    at(e, 'b');
    expect(e.insertContent('<strong>X</strong><script>alert(1)</script>')).toBe(true);
    expect(e.getHTML()).toBe('<p>a<strong>X</strong>b</p>');
  });

  it('blocks go in as separate blocks', () => {
    const e = mount('<p>ab</p>');
    at(e, 'b');
    e.insertContent('<p>one</p><p>two</p>');
    expect(e.getHTML()).toBe('<p>a</p><p>one</p><p>two</p><p>b</p>');
  });

  it("a table with the cursor inside a table goes after it, cells aren't overwritten", () => {
    const e = mount('<table><tbody><tr><td><p>keep</p></td></tr></tbody></table><p>end</p>');
    at(e, 'keep');
    e.insertContent('<table><tbody><tr><td><p>new</p></td></tr></tbody></table>');
    expect(e.getHTML()).toBe(
      '<table><tbody><tr><td><p>keep</p></td></tr></tbody></table>' +
        '<table><tbody><tr><td><p>new</p></td></tr></tbody></table><p>end</p>',
    );
  });

  it('read only inserts nothing', () => {
    const e = mount('<p>a</p>', { editable: false });
    expect(e.insertContent('<p>x</p>')).toBe(false);
    expect(e.getHTML()).toBe('<p>a</p>');
  });
});
