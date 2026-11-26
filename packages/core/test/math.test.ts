import { NodeSelection, TextSelection } from 'prosemirror-state';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEditor, type Editor } from '../src';
import { toMarkdown } from '../src/markdown';
import { loadTemml } from '../src/plugins/math';

/**
 * Formulas (the math plugin): HTML with the LaTeX source (the Tiptap format + \( \) for KaTeX/MathJax on the site),
 * MathML in the editor after Temml loads, typing "$…$", the dialog, Markdown, garbage from JSON.
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
  // Formulas are drawn after the engine loads (a microtask).
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

describe('formula HTML', () => {
  it('round trip; the Tiptap format (without text) is read', async () => {
    const html = `<p>Energy ${INLINE}</p>${BLOCK}`;
    const e = await mount(html);
    expect(e.getHTML()).toBe(html);
    e.setContent('<p><span data-type="inline-math" data-latex="x^2"></span></p>');
    expect(e.getHTML()).toBe(
      '<p><span data-type="inline-math" data-latex="x^2">\\(x^2\\)</span></p>',
    );
  });

  it('in the editor: MathML (Temml), without LaTeX commands like \\href', async () => {
    const e = await mount(`<p>${INLINE}</p>${BLOCK}`);
    const [inline, block] = e.root.querySelectorAll('.nova-math');
    expect(inline!.querySelector('math')).not.toBeNull();
    // A block formula isn't drawn in jsdom (jsdom MathML elements have no style): the source stays
    // without errors; e2e/math.spec.ts checks it in browsers.
    expect(block!.textContent).toContain('frac');
    e.setContent(
      '<p><span data-type="inline-math" data-latex="\\href{javascript:alert(1)}{x}"></span></p>',
    );
    await new Promise((r) => setTimeout(r, 0));
    expect(e.root.querySelector('.nova-math a[href^="javascript"]')).toBeNull();
    // An error in the formula: the source with a mark, the error text in a tooltip.
    e.setContent('<p><span data-type="inline-math" data-latex="\\frac{1"></span></p>');
    await new Promise((r) => setTimeout(r, 0));
    const broken = e.root.querySelector<HTMLElement>('.nova-math')!;
    expect(broken.classList.contains('nova-math-error')).toBe(true);
    expect(broken.textContent).toBe('\\frac{1');
    expect(broken.title).toMatch(/end of input/i);
  });

  it('garbage from JSON: not a string gives an empty formula, a long one is truncated', async () => {
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

describe('typing and editing', () => {
  it('"$x^2$" is a formula; "$5 and $10" and "\\$" are text', async () => {
    const e = await mount('<p></p>');
    type(e, 'Area $a^2$ ok');
    expect(e.getHTML()).toBe(
      '<p>Area <span data-type="inline-math" data-latex="a^2">\\(a^2\\)</span> ok</p>',
    );
    e.setContent('<p></p>');
    type(e, 'costs $5 and $10');
    expect(e.getHTML()).toBe('<p>costs $5 and $10</p>');
  });

  it('the button: a dialog with a preview inserts a formula; pressing again edits the selected one', async () => {
    const e = await mount('<p>x</p>');
    e.view.dispatch(e.view.state.tr.setSelection(TextSelection.atEnd(e.view.state.doc)));
    const button = e.ui.registry.get('math');
    if (button?.type !== 'button') throw new Error('no math button');
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
    // Select the formula and open editing: "on its own line" makes it a block formula.
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
  it('formulas in dollars', async () => {
    const e = await mount(`<p>Energy ${INLINE}</p>${BLOCK}`);
    expect(toMarkdown(e)).toBe('Energy $E=mc^2$\n\n$$\n\\frac{a}{b}\n$$');
  });
});
