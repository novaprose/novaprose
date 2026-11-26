import { NodeSelection } from 'prosemirror-state';
import { afterEach, describe, expect, it } from 'vitest';
import { createEditor, type Editor } from '../src';
import { getSelectedImage, openImageAltDialog, setImageAttrs } from '../src/image';

let editor: Editor | null = null;

function mount(content: string) {
  const element = document.createElement('div');
  document.body.append(element);
  editor = createEditor({ element, content });
  return editor;
}

/** Selects the first image as a node. */
function selectImage(e: Editor) {
  let pos = -1;
  e.view.state.doc.descendants((node, p) => {
    if (pos < 0 && node.type.name === 'image') pos = p;
  });
  e.view.dispatch(e.view.state.tr.setSelection(NodeSelection.create(e.view.state.doc, pos)));
}

afterEach(() => {
  editor?.destroy();
  editor = null;
  document.body.innerHTML = '';
});

describe('images: size and alignment', () => {
  it.each([
    '<p><img src="https://a.io/x.png" width="320" height="200"></p>',
    '<p><img src="https://a.io/x.png" style="float: left; margin: 0 1em 1em 0;"></p>',
    '<p><img src="https://a.io/x.png" style="float: right; margin: 0 0 1em 1em;"></p>',
    '<p><img src="https://a.io/x.png" style="display: block; margin-left: auto; margin-right: auto;"></p>',
  ])('keeps %s', (html) => {
    expect(mount(html).getHTML()).toBe(html);
  });

  it('reads the size from style and the align attribute (old HTML)', () => {
    expect(
      mount(
        '<p><img src="https://a.io/x.png" style="width: 100px; height: 50px" align="right"></p>',
      ).getHTML(),
    ).toBe(
      '<p><img src="https://a.io/x.png" width="100" height="50" style="float: right; margin: 0 0 1em 1em;"></p>',
    );
  });

  it('drops invalid sizes', () => {
    expect(mount('<p><img src="https://a.io/x.png" width="100%" height="-5"></p>').getHTML()).toBe(
      '<p><img src="https://a.io/x.png"></p>',
    );
  });

  it('renders the NodeView with resize handles', () => {
    const e = mount('<p><img src="https://a.io/x.png" width="320" height="200"></p>');
    const wrapper = e.view.dom.querySelector('.nova-image')!;
    expect(wrapper.querySelectorAll('.nova-image-handle')).toHaveLength(4);
    expect(wrapper.querySelector('img')!.style.width).toBe('320px');
    selectImage(e);
    expect(wrapper.classList.contains('is-selected')).toBe(true);
  });

  it('setImageAttrs changes the alignment and keeps the image selected', () => {
    const e = mount('<p>a<img src="https://a.io/x.png">b</p>');
    selectImage(e);
    e.exec(setImageAttrs({ align: 'center' }));
    expect(e.getHTML()).toContain('style="display: block; margin-left: auto; margin-right: auto;"');
    expect(getSelectedImage(e.view.state)).not.toBeNull();
    expect(e.view.dom.querySelector<HTMLElement>('.nova-image')!.dataset.align).toBe('center');
  });

  it('setImageAttrs without a selected image gives false', () => {
    const e = mount('<p>a</p>');
    expect(e.exec(setImageAttrs({ align: 'left' }))).toBe(false);
  });

  it('the alt text dialog saves alt and title', async () => {
    const e = mount('<p><img src="https://a.io/x.png"></p>');
    selectImage(e);
    openImageAltDialog(e);
    const dialog = e.root.querySelector<HTMLFormElement>('.nova-dialog')!;
    const [alt, title] = dialog.querySelectorAll<HTMLInputElement>('input');
    alt!.value = 'A cat on the window sill';
    title!.value = 'Tom';
    dialog.requestSubmit();
    await new Promise((r) => setTimeout(r, 0));
    expect(e.getHTML()).toBe(
      '<p><img src="https://a.io/x.png" alt="A cat on the window sill" title="Tom"></p>',
    );
  });

  it('the image context toolbar is registered', () => {
    const e = mount('<p>a</p>');
    const names = e.ui.registry.getContextToolbars().map(([name]) => name);
    expect(names).toContain('image');
  });
});
