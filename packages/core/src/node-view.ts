import type { Node as PMNode } from 'prosemirror-model';
import type {
  EditorView,
  NodeView,
  NodeViewConstructor,
  ViewMutationRecord,
} from 'prosemirror-view';
import type { Editor } from './editor';

/**
 * A node drawn by your own code — a React or Vue component, or plain DOM. The core takes care of
 * ProseMirror (editable content, selection, mutations, events); the renderer only draws markup:
 *
 *   nodeViews: { callout: defineNodeView(() => ({ mount(dom, props) {…}, update(props) {…}, destroy() {…} })) }
 *
 * The framework wrappers provide ready renderers: reactNodeView(Component), vueNodeView(Component).
 * A view doesn't change the document's HTML: getHTML() and the server use the schema's toDOM.
 */

export interface NodeViewProps {
  editor: Editor;
  /** The document node: `node.attrs`, `node.type.name`, `node.textContent`. */
  node: PMNode;
  /** The whole node is selected (a click on a node without content, or a selection around it). */
  selected: boolean;
  /** The node's position in the document; undefined when the node is already gone. */
  getPos(): number | undefined;
  /** Change the node's attributes — one edit, undone with Ctrl+Z. */
  updateAttributes(attrs: Record<string, unknown>): void;
  /** Delete the node. */
  deleteNode(): void;
  /**
   * The element of the editable content (for nodes with content, null otherwise). The renderer puts
   * it in its place in the markup (the NodeViewContent component); until then it sits in the view's root.
   */
  contentDOM: HTMLElement | null;
}

export interface NodeViewRenderer {
  /** Draw the view in the dom element (already created; the editor inserts it into the document). */
  mount(dom: HTMLElement, props: NodeViewProps): void;
  /** The node, its attributes or the selection changed. */
  update(props: NodeViewProps): void;
  /** The node left the document (or the editor was destroyed). */
  destroy(): void;
}

export interface NodeViewOptions {
  /** Tag of the view's root: div by default, span for inline nodes. */
  as?: string;
  /** Tag of the content element: the same as the root's by default. */
  contentAs?: string;
  /** Class of the view's root. */
  className?: string;
  /**
   * Whether the view takes an event away from the editor. By default it takes events of the view's
   * inputs, lists and buttons (outside the content), so typing in them doesn't reach the document.
   */
  stopEvent?: (event: Event) => boolean;
}

/** A view factory for NovaPlugin.nodeViews: the core calls it with its editor. */
export type NodeViewFactory = (editor: Editor) => NodeViewConstructor;

/** The view's own controls: the editor doesn't need their events. */
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
    // Before the first render the content sits right in the root: ProseMirror expects it inside dom.
    if (this.contentDOM) this.dom.append(this.contentDOM);
    try {
      this.renderer = create(editor);
      this.renderer.mount(this.dom, this.props());
    } catch (error) {
      // A renderer failure doesn't break the editor: the node stays editable, without its own markup.
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
    // Drag and drop and paste are the editor's business; clicks and typing in the view's own fields aren't.
    if (event.type.startsWith('drag') || event.type === 'drop') return false;
    const control = target.closest(CONTROLS);
    return !!control && this.dom.contains(control);
  }

  ignoreMutation(mutation: ViewMutationRecord): boolean {
    // A node without content: everything inside is the renderer's markup, the editor has nothing to read.
    if (!this.contentDOM) return true;
    // Its own markup around the content (and moving contentDOM itself into it) isn't a document edit.
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

/** A node view from your own renderer (React, Vue, DOM): `create` is called for each node. */
export function defineNodeView(
  create: (editor: Editor) => NodeViewRenderer,
  options: NodeViewOptions = {},
): NodeViewFactory {
  return (editor) => (node, view, getPos) =>
    new RenderedNodeView(node, view, getPos, editor, create, options);
}
