import type { DOMOutputSpec, Node as PMNode, NodeSpec } from 'prosemirror-model';
import { NodeSelection, Plugin, PluginKey } from 'prosemirror-state';
import type { EditorView, NodeView } from 'prosemirror-view';
import type TemmlEngine from 'temml';
import type { Editor } from '../editor';
import { definePlugin } from '../plugins';
import css from './math.css?raw';
import { pickLabels } from './shared';

/**
 * Плагин math: формулы LaTeX — в строке (`$E=mc^2$`) и отдельной строкой. `plugins: ['math']`.
 * В HTML — исходник LaTeX: `<span data-type="inline-math" data-latex="E=mc^2">\(E=mc^2\)</span>`
 * (тот же формат у Tiptap; текст с \( \) понимают KaTeX и MathJax на странице сайта). В редакторе
 * формула рисуется через MathML (Temml, ~58 КБ gzip, грузится, когда в документе есть формула):
 * браузер показывает её сам, без шрифтов и стилей.
 *
 * Здесь — узлы и их вид (нужны с первой отрисовки); диалог, ввод `$…$` и кнопка — math-ui.ts.
 */

export const LABELS = { en: { empty: 'Formula' } };

/** Исходник формулы: строка разумной длины (из HTML и JSON может прийти что угодно). */
export function mathLatex(value: unknown): string {
  return typeof value === 'string' ? value.slice(0, 10_000) : '';
}

type Temml = typeof TemmlEngine;
let temml: Promise<Temml | null> | null = null;

/** Temml — один на страницу, по первому требованию. */
export function loadTemml(): Promise<Temml | null> {
  temml ??= import('temml').then(
    (module) => module.default,
    (error: unknown) => {
      temml = null; // сеть моргнула — следующая формула попробует снова
      console.warn('[nova] math: could not load the formula renderer', error);
      return null;
    },
  );
  return temml;
}

/**
 * Нарисовать формулу в элемент. Без доверия к LaTeX (`trust: false`): \href и подобное не работают.
 * Ошибка в формуле (или сбой движка) — исходник в элементе и текст ошибки в ответе: вид ошибки
 * выбирает вызывающий (подсказка у формулы, строка под просмотром в диалоге).
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

/** Вид формулы: исходник, пока Temml не загрузился, затем MathML. Нажатие — правка (math-ui). */
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
    // Сразу — исходник (виден и без сети), формула — когда загрузится движок.
    this.dom.textContent = latex.trim() ? latex : '';
    if (!latex.trim()) return;
    void loadTemml().then((engine) => {
      if (!engine || this.latex !== latex) return;
      const error = renderMath(engine, latex, this.dom, block);
      // Ошибка — исходник с волнистой линией, текст ошибки — в подсказке.
      this.dom.classList.toggle('nova-math-error', !!error);
      if (error) this.dom.title = error;
      else this.dom.removeAttribute('title');
    });
  }

  /** Выделить формулу и открыть правку (кнопка math регистрируется ленивой частью). */
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
    // Пустая формула — подпись на языке интерфейса (в HTML документа её нет).
    const { empty } = pickLabels(editor, 'math', LABELS);
    editor.root.style.setProperty('--nova-math-empty', JSON.stringify(empty));
  },
  load: () => import('./math-ui'),
});
