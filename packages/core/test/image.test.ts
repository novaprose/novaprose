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

/** Выделить первую картинку как узел. */
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

describe('картинки: размер и выравнивание', () => {
  it.each([
    '<p><img src="https://a.io/x.png" width="320" height="200"></p>',
    '<p><img src="https://a.io/x.png" style="float: left; margin: 0 1em 1em 0;"></p>',
    '<p><img src="https://a.io/x.png" style="float: right; margin: 0 0 1em 1em;"></p>',
    '<p><img src="https://a.io/x.png" style="display: block; margin-left: auto; margin-right: auto;"></p>',
  ])('сохраняет %s', (html) => {
    expect(mount(html).getHTML()).toBe(html);
  });

  it('читает размер из style и align-атрибута (старый HTML)', () => {
    expect(
      mount(
        '<p><img src="https://a.io/x.png" style="width: 100px; height: 50px" align="right"></p>',
      ).getHTML(),
    ).toBe(
      '<p><img src="https://a.io/x.png" width="100" height="50" style="float: right; margin: 0 0 1em 1em;"></p>',
    );
  });

  it('отбрасывает невалидные размеры', () => {
    expect(mount('<p><img src="https://a.io/x.png" width="100%" height="-5"></p>').getHTML()).toBe(
      '<p><img src="https://a.io/x.png"></p>',
    );
  });

  it('рендерит NodeView с маркерами ресайза', () => {
    const e = mount('<p><img src="https://a.io/x.png" width="320" height="200"></p>');
    const wrapper = e.view.dom.querySelector('.nova-image')!;
    expect(wrapper.querySelectorAll('.nova-image-handle')).toHaveLength(4);
    expect(wrapper.querySelector('img')!.style.width).toBe('320px');
    selectImage(e);
    expect(wrapper.classList.contains('is-selected')).toBe(true);
  });

  it('setImageAttrs меняет выравнивание и сохраняет выделение картинки', () => {
    const e = mount('<p>a<img src="https://a.io/x.png">b</p>');
    selectImage(e);
    e.exec(setImageAttrs({ align: 'center' }));
    expect(e.getHTML()).toContain('style="display: block; margin-left: auto; margin-right: auto;"');
    expect(getSelectedImage(e.view.state)).not.toBeNull();
    expect(e.view.dom.querySelector<HTMLElement>('.nova-image')!.dataset.align).toBe('center');
  });

  it('setImageAttrs без выделенной картинки — false', () => {
    const e = mount('<p>a</p>');
    expect(e.exec(setImageAttrs({ align: 'left' }))).toBe(false);
  });

  it('диалог alt-текста сохраняет alt и title', async () => {
    const e = mount('<p><img src="https://a.io/x.png"></p>');
    selectImage(e);
    openImageAltDialog(e);
    const dialog = e.root.querySelector<HTMLFormElement>('.nova-dialog')!;
    const [alt, title] = dialog.querySelectorAll<HTMLInputElement>('input');
    alt!.value = 'Кот на окне';
    title!.value = 'Барсик';
    dialog.requestSubmit();
    await new Promise((r) => setTimeout(r, 0));
    expect(e.getHTML()).toBe(
      '<p><img src="https://a.io/x.png" alt="Кот на окне" title="Барсик"></p>',
    );
  });

  it('контекстный тулбар картинки зарегистрирован', () => {
    const e = mount('<p>a</p>');
    const names = e.ui.registry.getContextToolbars().map(([name]) => name);
    expect(names).toContain('image');
  });
});
