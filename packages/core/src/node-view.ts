import type { Node as PMNode } from 'prosemirror-model';
import type {
  EditorView,
  NodeView,
  NodeViewConstructor,
  ViewMutationRecord,
} from 'prosemirror-view';
import type { Editor } from './editor';

/**
 * Вид узла, нарисованный своим кодом — компонентом React, Vue или обычным DOM. Ядро берёт на себя
 * ProseMirror (редактируемое содержимое, выделение, мутации, события), отрисовщик — только разметку:
 *
 *   nodeViews: { callout: defineNodeView(() => ({ mount(dom, props) {…}, update(props) {…}, destroy() {…} })) }
 *
 * Обёртки фреймворков дают готовые отрисовщики: reactNodeView(Component), vueNodeView(Component).
 * На HTML документа вид не влияет: getHTML() и сервер берут toDOM схемы.
 */

export interface NodeViewProps {
  editor: Editor;
  /** Узел документа: `node.attrs`, `node.type.name`, `node.textContent`. */
  node: PMNode;
  /** Узел выделен целиком (щелчок по узлу без содержимого, выделение рамкой). */
  selected: boolean;
  /** Позиция узла в документе; undefined — узел уже удалён. */
  getPos(): number | undefined;
  /** Изменить атрибуты узла — одна правка, отменяется Ctrl+Z. */
  updateAttributes(attrs: Record<string, unknown>): void;
  /** Удалить узел. */
  deleteNode(): void;
  /**
   * Элемент редактируемого содержимого (у узлов с content, иначе null). Отрисовщик ставит его в
   * своё место разметки (компонент NodeViewContent); до этого он лежит прямо в корне вида.
   */
  contentDOM: HTMLElement | null;
}

export interface NodeViewRenderer {
  /** Нарисовать вид в элементе dom (он уже создан, в документ его вставит редактор). */
  mount(dom: HTMLElement, props: NodeViewProps): void;
  /** Узел, его атрибуты или выделение изменились. */
  update(props: NodeViewProps): void;
  /** Узел ушёл из документа (или редактор уничтожен). */
  destroy(): void;
}

export interface NodeViewOptions {
  /** Тег корня вида: по умолчанию div, у строчных узлов — span. */
  as?: string;
  /** Тег элемента содержимого: по умолчанию как у корня. */
  contentAs?: string;
  /** Класс корня вида. */
  className?: string;
  /**
   * Забирает ли вид событие у редактора. По умолчанию — события полей ввода, списков и кнопок
   * вида (вне содержимого): ввод в них не попадает в документ.
   */
  stopEvent?: (event: Event) => boolean;
}

/** Фабрика вида для NovaPlugin.nodeViews: ядро вызывает её со своим редактором. */
export type NodeViewFactory = (editor: Editor) => NodeViewConstructor;

/** Свои элементы управления вида — их события редактору не нужны. */
const CONTROLS = 'input, textarea, select, button, label, [data-node-view-control]';

function report(message: string, error: unknown): void {
  console.error(`[nova] ${message}`, error);
}

class RenderedNodeView implements NodeView {
  readonly dom: HTMLElement;
  readonly contentDOM: HTMLElement | null;
  private selected = false;
  private readonly renderer: NodeViewRenderer | null = null;

  constructor(
    private node: PMNode,
    private readonly view: EditorView,
    private readonly getPos: () => number | undefined,
    private readonly editor: Editor,
    create: (editor: Editor) => NodeViewRenderer,
    private readonly options: NodeViewOptions,
  ) {
    const tag = options.as ?? (node.isInline ? 'span' : 'div');
    this.dom = document.createElement(tag);
    this.dom.setAttribute('data-node-view', node.type.name);
    if (options.className) this.dom.className = options.className;
    this.contentDOM = node.isLeaf ? null : document.createElement(options.contentAs ?? tag);
    // До первой отрисовки содержимое — прямо в корне: ProseMirror ждёт его внутри dom.
    if (this.contentDOM) this.dom.append(this.contentDOM);
    try {
      this.renderer = create(editor);
      this.renderer.mount(this.dom, this.props());
    } catch (error) {
      // Сбой отрисовщика не ломает редактор: узел остаётся редактируемым, без своей разметки.
      report(`Node view for "${node.type.name}" failed to render`, error);
    }
  }

  private props(): NodeViewProps {
    return {
      editor: this.editor,
      node: this.node,
      selected: this.selected,
      getPos: () => this.getPos(),
      updateAttributes: (attrs) => this.updateAttributes(attrs),
      deleteNode: () => this.deleteNode(),
      contentDOM: this.contentDOM,
    };
  }

  private render(): void {
    try {
      this.renderer?.update(this.props());
    } catch (error) {
      report(`Node view for "${this.node.type.name}" failed to update`, error);
    }
  }

  private current(): { pos: number; node: PMNode } | null {
    const pos = this.getPos();
    const node = pos === undefined ? null : this.view.state.doc.nodeAt(pos);
    return node && pos !== undefined ? { pos, node } : null;
  }

  private updateAttributes(attrs: Record<string, unknown>): void {
    const target = this.current();
    if (!target) return;
    const { tr } = this.view.state;
    this.view.dispatch(tr.setNodeMarkup(target.pos, undefined, { ...target.node.attrs, ...attrs }));
  }

  private deleteNode(): void {
    const target = this.current();
    if (!target) return;
    this.view.dispatch(this.view.state.tr.delete(target.pos, target.pos + target.node.nodeSize));
  }

  update(node: PMNode): boolean {
    if (node.type !== this.node.type) return false;
    if (node === this.node) return true;
    this.node = node;
    this.render();
    return true;
  }

  selectNode(): void {
    this.selected = true;
    this.dom.classList.add('ProseMirror-selectednode');
    this.render();
  }

  deselectNode(): void {
    this.selected = false;
    this.dom.classList.remove('ProseMirror-selectednode');
    this.render();
  }

  stopEvent(event: Event): boolean {
    if (this.options.stopEvent) return this.options.stopEvent(event);
    const target = event.target;
    if (!(target instanceof Element) || this.contentDOM?.contains(target)) return false;
    // Перетаскивание и вставка — дело редактора; щелчки и ввод в своих полях вида — нет.
    if (event.type.startsWith('drag') || event.type === 'drop') return false;
    const control = target.closest(CONTROLS);
    return !!control && this.dom.contains(control);
  }

  ignoreMutation(mutation: ViewMutationRecord): boolean {
    // Узел без содержимого: внутри всё — разметка отрисовщика, редактору читать нечего.
    if (!this.contentDOM) return true;
    // Своя разметка вокруг содержимого (и перенос самого contentDOM в неё) — не правка документа.
    if (mutation.target === this.contentDOM && mutation.type === 'attributes') return true;
    return !this.contentDOM.contains(mutation.target);
  }

  destroy(): void {
    try {
      this.renderer?.destroy();
    } catch (error) {
      report(`Node view for "${this.node.type.name}" failed to clean up`, error);
    }
  }
}

/** Вид узла из своего отрисовщика (React, Vue, DOM): `create` вызывается для каждого узла. */
export function defineNodeView(
  create: (editor: Editor) => NodeViewRenderer,
  options: NodeViewOptions = {},
): NodeViewFactory {
  return (editor) => (node, view, getPos) =>
    new RenderedNodeView(node, view, getPos, editor, create, options);
}
