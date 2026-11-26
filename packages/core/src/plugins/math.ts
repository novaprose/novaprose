import type { DOMOutputSpec, Node as PMNode, NodeSpec } from 'prosemirror-model';
import { NodeSelection, Plugin, PluginKey } from 'prosemirror-state';
import type { EditorView, NodeView } from 'prosemirror-view';
import type TemmlEngine from 'temml';
import type { Editor } from '../editor';
import { definePlugin } from '../plugins';
import css from './math.css?raw';
import { pickLabels } from './shared';

/**
 * The math plugin: LaTeX formulas inline (`$E=mc^2$`) and on their own line. `plugins: ['math']`.
 * The HTML holds the LaTeX source: `<span data-type="inline-math" data-latex="E=mc^2">\(E=mc^2\)</span>`
 * (the same format as Tiptap; KaTeX and MathJax on the site's page understand the text with \( \)). In the editor
 * the formula is drawn with MathML (Temml, ~58 KB gzip, loaded when the document has a formula):
 * the browser renders it itself, without fonts and styles.
 *
 * Here are the nodes and their view (needed from the first render); the dialog, `$…$` input and the button are in math-ui.ts.
 */

export const LABELS = { en: { empty: 'Formula' } };

/** The formula source: a string of reasonable length (HTML and JSON can bring anything). */
export function mathLatex(value: unknown): string {
  return typeof value === 'string' ? value.slice(0, 10_000) : '';
}

type Temml = typeof TemmlEngine;
let temml: Promise<Temml | null> | null = null;

/** Temml: one per page, loaded on first demand. */
export function loadTemml(): Promise<Temml | null> {
  temml ??= import('temml').then(
    (module) => module.default,
    (error: unknown) => {
      temml = null; // a network hiccup: the next formula tries again
      console.warn('[nova] math: could not load the formula renderer', error);
      return null;
    },
  );
  return temml;
}

/**
 * Draws a formula into an element. No trust in the LaTeX (`trust: false`): \href and the like don't work.
 * An error in the formula (or an engine failure) leaves the source in the element and the error text in the answer: how the error
 * shows is up to the caller (a tooltip on the formula, a line under the preview in the dialog).
 */
export function renderMath(
  engine: Temml,
  latex: string,
  target: HTMLElement,
  block: boolean,
): string | null {
  try {
    engine.render(latex, target, {
      displayMode: block,
      throwOnError: true,
      trust: false,
      annotate: true,
    });
    return null;
  } catch (error) {
    target.textContent = latex;
    return error instanceof Error ? error.message.replace(/^ParseError:\s*/, '') : String(error);
  }
}

function mathSpec(block: boolean): NodeSpec {
  const type = block ? 'block-math' : 'inline-math';
  const tag = block ? 'div' : 'span';
  return {
    ...(block ? { group: 'block' } : { group: 'inline', inline: true }),
    atom: true,
    selectable: true,
    draggable: true,
    attrs: { latex: { default: '' } },
    parseDOM: [
      {
        tag: `${tag}[data-type="${type}"]`,
        getAttrs: (dom) => ({ latex: mathLatex((dom as HTMLElement).getAttribute('data-latex')) }),
      },
    ],
    toDOM: (node): DOMOutputSpec => {
      const latex = mathLatex(node.attrs.latex);
      return [
        tag,
        { 'data-type': type, 'data-latex': latex },
        block ? `\\[${latex}\\]` : `\\(${latex}\\)`,
      ];
    },
    leafText: (node) =>
      block ? `$$${mathLatex(node.attrs.latex)}$$` : `$${mathLatex(node.attrs.latex)}$`,
  };
}

/** The formula view: the source until Temml loads, then MathML. A click edits it (math-ui). */
class MathView implements NodeView {
  dom: HTMLElement;
  private latex = '';

  constructor(
    private node: PMNode,
    private readonly view: EditorView,
    private readonly getPos: () => number | undefined,
    private readonly editor: Editor,
  ) {
    const block = node.type.name === 'math_block';
    this.dom = document.createElement(block ? 'div' : 'span');
    this.dom.className = `nova-math ${block ? 'nova-math-block' : 'nova-math-inline'}`;
    this.dom.contentEditable = 'false';
    this.dom.addEventListener('click', () => this.edit());
    this.render();
  }

  private render(): void {
    const latex = mathLatex(this.node.attrs.latex);
    if (latex === this.latex && this.dom.childNodes.length) return;
    this.latex = latex;
    const block = this.node.type.name === 'math_block';
    this.dom.classList.toggle('nova-math-empty', !latex.trim());
    // The source right away (visible without a network), the formula once the engine loads.
    this.dom.textContent = latex.trim() ? latex : '';
    if (!latex.trim()) return;
    void loadTemml().then((engine) => {
      if (!engine || this.latex !== latex) return;
      const error = renderMath(engine, latex, this.dom, block);
      // An error: the source with a wavy underline, the error text in a tooltip.
      this.dom.classList.toggle('nova-math-error', !!error);
      if (error) this.dom.title = error;
      else this.dom.removeAttribute('title');
    });
  }

  /** Selects the formula and opens editing (the math button is registered by the lazy part). */
  private edit(): void {
    const pos = this.getPos();
    if (pos === undefined || !this.editor.isEditable()) return;
    this.view.dispatch(
      this.view.state.tr.setSelection(NodeSelection.create(this.view.state.doc, pos)),
    );
    const button = this.editor.ui.registry.get('math');
    if (button?.type === 'button') button.onAction(this.editor);
  }

  update(node: PMNode): boolean {
    if (node.type !== this.node.type) return false;
    this.node = node;
    this.render();
    return true;
  }

  selectNode(): void {
    this.dom.classList.add('is-selected');
  }

  deselectNode(): void {
    this.dom.classList.remove('is-selected');
  }

  ignoreMutation(): boolean {
    return true;
  }
}

export default definePlugin({
  name: 'math',
  nodes: { math_inline: mathSpec(false), math_block: mathSpec(true) },
  prosemirrorPlugins: (editor) => [
    new Plugin({
      key: new PluginKey('nova-math'),
      props: {
        nodeViews: {
          math_inline: (node, view, getPos) => new MathView(node, view, getPos, editor),
          math_block: (node, view, getPos) => new MathView(node, view, getPos, editor),
        },
      },
    }),
  ],
  setup(editor) {
    editor.ui.addStyles('nova-math', css);
    // An empty formula shows a label in the interface language (it isn't in the document's HTML).
    const { empty } = pickLabels(editor, 'math', LABELS);
    editor.root.style.setProperty('--nova-math-empty', JSON.stringify(empty));
  },
  load: () => import('./math-ui'),
});
