import { NodeSelection, TextSelection } from 'prosemirror-state';
import { afterEach, describe, expect, it } from 'vitest';
import { createEditor, type Editor } from '../src';
import { getSelectedImage, setImageAttrs, toggleImageCaption } from '../src/image';
import { markdownToHTML, toMarkdown } from '../src/markdown';

/** Картинка с подписью: <figure><img><figcaption>. */

const editors: Editor[] = [];
afterEach(() => {
  editors.splice(0).forEach((e) => e.destroy());
  document.body.innerHTML = '';
});

function mount(content: string, options: Partial<Parameters<typeof createEditor>[0]> = {}) {
  const element = document.createElement('div');
  document.body.appendChild(element);
  const editor = createEditor({ element, content, ...options });
  editors.push(editor);
  return editor;
}

const SRC = 'https://example.com/cat.png';
const FIG = `<figure style="width: 320px;"><img src="${SRC}" alt="Cat" width="320" height="240"><figcaption>A <strong>cat</strong></figcaption></figure>`;

/** Выделить первую картинку (узлом). */
function selectImage(e: Editor) {
  let pos = -1;
  e.view.state.doc.descendants((node, p) => {
    if (pos < 0 && (node.type.name === 'image' || node.type.name === 'figure')) pos = p;
  });
  e.view.dispatch(e.view.state.tr.setSelection(NodeSelection.create(e.view.state.doc, pos)));
}

describe('HTML', () => {
  it.each([
    FIG,
    `<figure><img src="${SRC}"><figcaption></figcaption></figure>`,
    `<figure style="float: left; margin: 0 1em 1em 0; width: 200px;"><img src="${SRC}" width="200"><figcaption>left</figcaption></figure>`,
    `<figure style="display: block; margin-left: auto; margin-right: auto;"><img src="${SRC}"><figcaption>center</figcaption></figure>`,
  ])('туда-обратно без изменений: %s', (html) => {
    expect(mount(html).getHTML()).toBe(html);
  });

  it('figure без подписи получает пустую подпись', () => {
    expect(mount(`<figure><img src="${SRC}"></figure>`).getHTML()).toBe(
      `<figure><img src="${SRC}"><figcaption></figcaption></figure>`,
    );
  });

  it('figure с небезопасной картинкой не создаётся, текст подписи сохраняется', () => {
    const html = mount(
      '<figure><img src="javascript:alert(1)"><figcaption>text</figcaption></figure>',
    ).getHTML();
    expect(html).not.toContain('javascript');
    expect(html).not.toContain('<figure');
    expect(html).toContain('text');
  });

  it('figure без картинки (с цитатой) разбирается как обычное содержимое', () => {
    expect(mount('<figure><blockquote><p>quote</p></blockquote></figure>').getHTML()).toBe(
      '<blockquote><p>quote</p></blockquote>',
    );
  });
});

describe('включить и убрать подпись', () => {
  it('картинка одна в абзаце → figure, курсор в подписи', () => {
    const e = mount(`<p><img src="${SRC}" alt="Cat"></p>`);
    selectImage(e);
    expect(e.exec(toggleImageCaption)).toBe(true);
    expect(e.getHTML()).toBe(
      `<figure><img src="${SRC}" alt="Cat"><figcaption></figcaption></figure>`,
    );
    expect(e.view.state.selection.$from.parent.type.name).toBe('figcaption');
    e.view.dispatch(e.view.state.tr.insertText('Hello'));
    expect(e.getHTML()).toContain('<figcaption>Hello</figcaption>');
  });

  it('картинка среди текста → figure после абзаца, текст остаётся', () => {
    const e = mount(`<p>before <img src="${SRC}"> after</p>`);
    selectImage(e);
    e.exec(toggleImageCaption);
    expect(e.getHTML()).toBe(
      `<p>before &nbsp;after</p><figure><img src="${SRC}"><figcaption></figcaption></figure>`,
    );
  });

  it('убрать подпись: картинка в абзаце, текст подписи — абзацем ниже (не теряется)', () => {
    const e = mount(FIG);
    selectImage(e);
    e.exec(toggleImageCaption);
    expect(e.getHTML()).toBe(
      `<p><img src="${SRC}" alt="Cat" width="320" height="240"></p><p>A <strong>cat</strong></p>`,
    );
  });

  it('пустая подпись убирается без лишнего абзаца', () => {
    const e = mount(`<figure><img src="${SRC}"><figcaption></figcaption></figure>`);
    selectImage(e);
    e.exec(toggleImageCaption);
    expect(e.getHTML()).toBe(`<p><img src="${SRC}"></p>`);
  });
});

describe('редактирование', () => {
  /** Курсор в конце подписи. */
  const cursorInCaption = (e: Editor) => {
    let pos = 0;
    e.view.state.doc.descendants((node, p) => {
      if (node.type.name === 'figcaption') pos = p + node.nodeSize - 1;
    });
    e.view.dispatch(e.view.state.tr.setSelection(TextSelection.create(e.view.state.doc, pos)));
  };

  it('курсор в подписи — тулбар картинки знает о ней; выравнивание применяется к figure', () => {
    const e = mount(FIG);
    cursorInCaption(e);
    expect(getSelectedImage(e.view.state)?.node.type.name).toBe('figure');
    e.exec(setImageAttrs({ align: 'right' }));
    expect(e.getHTML()).toContain(
      '<figure style="float: right; margin: 0 0 1em 1em; width: 320px;">',
    );
  });

  it('Enter в подписи — новый абзац после картинки', () => {
    const e = mount(FIG);
    cursorInCaption(e);
    e.view.dom.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
    );
    e.view.dispatch(e.view.state.tr.insertText('next'));
    expect(e.getHTML()).toBe(`${FIG}<p>next</p>`);
  });

  it('удаление из тулбара работает и когда курсор в подписи', () => {
    const e = mount(`<p>a</p>${FIG}`, { toolbar: false });
    cursorInCaption(e);
    const image = getSelectedImage(e.view.state)!;
    e.view.dispatch(e.view.state.tr.delete(image.pos, image.pos + image.node.nodeSize));
    expect(e.getHTML()).toBe('<p>a</p>');
  });
});

describe('ограничения контента и Markdown', () => {
  it('validElements без figure: картинка и подпись — абзацами', () => {
    const e = mount(FIG, { validElements: 'p,img,strong' });
    expect(e.getHTML()).toBe(
      `<p><img src="${SRC}" alt="Cat" width="320" height="240"></p><p>A <strong>cat</strong></p>`,
    );
  });

  it('картинки запрещены — от figure остаётся текст подписи', () => {
    expect(mount(FIG, { validElements: 'p,strong' }).getHTML()).toBe(
      '<p>A <strong>cat</strong></p>',
    );
  });

  it('Markdown: картинка и подпись абзацем', () => {
    const e = mount(FIG);
    expect(toMarkdown(e)).toBe(`![Cat](${SRC})\n\nA **cat**`);
    e.setContent(markdownToHTML(toMarkdown(e)));
    expect(e.getHTML()).toContain('A <strong>cat</strong>');
  });

  it('JSON с мусором в атрибутах figure не роняет редактор', () => {
    const e = mount('<p>a</p>');
    e.setContent({
      type: 'doc',
      content: [
        {
          type: 'figure',
          attrs: { src: null, width: 'x', align: 7 },
          content: [{ type: 'figcaption' }],
        },
      ],
    });
    expect(() => e.getHTML()).not.toThrow();
    expect(e.getHTML()).not.toContain('src="null"');
  });
});
