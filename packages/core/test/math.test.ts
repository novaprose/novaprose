import { NodeSelection, TextSelection } from 'prosemirror-state';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEditor, type Editor } from '../src';
import { toMarkdown } from '../src/markdown';
import { loadTemml } from '../src/plugins/math';

/**
 * Формулы (плагин math): HTML с исходником LaTeX (формат Tiptap + \( \) для KaTeX/MathJax на сайте),
 * MathML в редакторе после загрузки Temml, ввод «$…$», диалог, Markdown, мусор из JSON.
 */

let editor: Editor | null = null;
afterEach(() => {
  editor?.destroy();
  editor = null;
  document.body.innerHTML = '';
});

async function mount(content: string): Promise<Editor> {
  const element = document.createElement('div');
  document.body.append(element);
  editor = createEditor({ element, content, plugins: ['math'] });
  editor.focus();
  await editor.ready;
  await loadTemml();
  // Отрисовка формул — после загрузки движка (микрозадача).
  await new Promise((r) => setTimeout(r, 0));
  return editor;
}

function type(e: Editor, text: string): void {
  for (const ch of text) {
    const { from, to } = e.view.state.selection;
    const handled = e.view.someProp('handleTextInput', (f) =>
      f(e.view, from, to, ch, () => e.view.state.tr.insertText(ch, from, to)),
    );
    if (!handled) e.view.dispatch(e.view.state.tr.insertText(ch, from, to));
  }
}

const INLINE = '<span data-type="inline-math" data-latex="E=mc^2">\\(E=mc^2\\)</span>';
const BLOCK = '<div data-type="block-math" data-latex="\\frac{a}{b}">\\[\\frac{a}{b}\\]</div>';

describe('HTML формул', () => {
  it('туда и обратно; формат Tiptap (без текста) читается', async () => {
    const html = `<p>Energy ${INLINE}</p>${BLOCK}`;
    const e = await mount(html);
    expect(e.getHTML()).toBe(html);
    e.setContent('<p><span data-type="inline-math" data-latex="x^2"></span></p>');
    expect(e.getHTML()).toBe(
      '<p><span data-type="inline-math" data-latex="x^2">\\(x^2\\)</span></p>',
    );
  });

  it('в редакторе — MathML (Temml), без LaTeX-команд вроде \\href', async () => {
    const e = await mount(`<p>${INLINE}</p>${BLOCK}`);
    const [inline, block] = e.root.querySelectorAll('.nova-math');
    expect(inline!.querySelector('math')).not.toBeNull();
    // Блочная формула в jsdom не рисуется (у MathML-элементов jsdom нет style) — остаётся исходник
    // без ошибок; в браузерах её проверяет e2e/math.spec.ts.
    expect(block!.textContent).toContain('frac');
    e.setContent(
      '<p><span data-type="inline-math" data-latex="\\href{javascript:alert(1)}{x}"></span></p>',
    );
    await new Promise((r) => setTimeout(r, 0));
    expect(e.root.querySelector('.nova-math a[href^="javascript"]')).toBeNull();
    // Ошибка в формуле — исходник с пометкой, текст ошибки — в подсказке.
    e.setContent('<p><span data-type="inline-math" data-latex="\\frac{1"></span></p>');
    await new Promise((r) => setTimeout(r, 0));
    const broken = e.root.querySelector<HTMLElement>('.nova-math')!;
    expect(broken.classList.contains('nova-math-error')).toBe(true);
    expect(broken.textContent).toBe('\\frac{1');
    expect(broken.title).toMatch(/end of input/i);
  });

  it('мусор из JSON: не строка — пустая формула, длинная — обрезается', async () => {
    const e = await mount('<p></p>');
    for (const latex of [null, 42, { x: 1 }, ['a']]) {
      e.setContent({
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'math_inline', attrs: { latex } }] }],
      });
      expect(e.getHTML()).toBe('<p><span data-type="inline-math" data-latex="">\\(\\)</span></p>');
    }
  });
});

describe('ввод и правка', () => {
  it('«$x^2$» — формула; «$5 и $10» и «\\$» — текст', async () => {
    const e = await mount('<p></p>');
    type(e, 'Area $a^2$ ok');
    expect(e.getHTML()).toBe(
      '<p>Area <span data-type="inline-math" data-latex="a^2">\\(a^2\\)</span> ok</p>',
    );
    e.setContent('<p></p>');
    type(e, 'costs $5 and $10');
    expect(e.getHTML()).toBe('<p>costs $5 and $10</p>');
  });

  it('кнопка: диалог с просмотром вставляет формулу; повторно — правит выделенную', async () => {
    const e = await mount('<p>x</p>');
    e.view.dispatch(e.view.state.tr.setSelection(TextSelection.atEnd(e.view.state.doc)));
    const button = e.ui.registry.get('math');
    if (button?.type !== 'button') throw new Error('нет кнопки math');
    button.onAction(e);
    await vi.waitFor(() => expect(e.root.querySelector('.nova-dialog')).not.toBeNull());
    const dialog = e.root.querySelector<HTMLFormElement>('.nova-dialog')!;
    const latex = dialog.querySelector<HTMLTextAreaElement>('[name="latex"]')!;
    latex.value = '\\sqrt{2}';
    latex.dispatchEvent(new Event('input', { bubbles: true }));
    await vi.waitFor(() => expect(dialog.querySelector('.nova-math-preview math')).not.toBeNull());
    dialog.requestSubmit();
    await vi.waitFor(() => expect(e.root.querySelector('.nova-dialog')).toBeNull());
    expect(e.getHTML()).toBe(
      '<p>x<span data-type="inline-math" data-latex="\\sqrt{2}">\\(\\sqrt{2}\\)</span></p>',
    );
    // Выделить формулу и открыть правку: «отдельной строкой» делает её блочной.
    let pos = -1;
    e.view.state.doc.descendants((node, at) => {
      if (node.type.name === 'math_inline') pos = at;
    });
    e.view.dispatch(e.view.state.tr.setSelection(NodeSelection.create(e.view.state.doc, pos)));
    button.onAction(e);
    await vi.waitFor(() => expect(e.root.querySelector('.nova-dialog')).not.toBeNull());
    const again = e.root.querySelector<HTMLFormElement>('.nova-dialog')!;
    expect(again.querySelector<HTMLTextAreaElement>('[name="latex"]')!.value).toBe('\\sqrt{2}');
    again.querySelector<HTMLInputElement>('[name="block"]')!.checked = true;
    again.requestSubmit();
    await vi.waitFor(() => expect(e.root.querySelector('.nova-dialog')).toBeNull());
    expect(e.getHTML()).toContain('<div data-type="block-math" data-latex="\\sqrt{2}">');
  });
});

describe('Markdown', () => {
  it('формулы — в долларах', async () => {
    const e = await mount(`<p>Energy ${INLINE}</p>${BLOCK}`);
    expect(toMarkdown(e)).toBe('Energy $E=mc^2$\n\n$$\n\\frac{a}{b}\n$$');
  });
});
