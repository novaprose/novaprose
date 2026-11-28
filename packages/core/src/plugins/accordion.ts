import type { DOMOutputSpec, Node as PMNode, NodeSpec, ResolvedPos } from 'prosemirror-model';
import { Plugin, PluginKey, TextSelection, type Transaction } from 'prosemirror-state';
import type { EditorView, NodeView } from 'prosemirror-view';
import type { Editor } from '../editor';
import { definePlugin } from '../plugins';
import { h, icon, type IconSource } from '../ui/dom';
import { icons } from '../ui/icons';
import css from './accordion.css?raw';
import { pickLabels } from './shared';

/**
 * The accordion plugin: collapsible blocks with a title and content that folds away
 * (`<details><summary>`), as in TinyMCE (`accordion`) and Tiptap (Details). `plugins: ['accordion']`.
 *
 * Here are the nodes and their view in the editor with an arrow (needed from the first render); the button, commands and
 * keys are in the lazy part, accordion-ui.ts.
 */

/** Labels (the lazy part takes them from here: translation keys are accordion.*). */
export const LABELS = {
  en: {
    accordion: 'Accordion',
    summary: 'Summary',
    expand: 'Expand',
    collapse: 'Collapse',
  },
};

export type AccordionState = 'inherited' | 'collapsed' | 'expanded';

export interface AccordionOptions {
  /**
   * The state when HTML is loaded: as in the markup (`inherited`, default), all collapsed
   * (`collapsed`) or all expanded (`expanded`). Like `details_initial_state` in TinyMCE.
   */
  initialState?: AccordionState;
  /**
   * The `open` attribute in getHTML: as in the editor (`inherited`, default), always collapsed or
   * always expanded. Like `details_serialized_state` in TinyMCE.
   */
  serializedState?: AccordionState;
}

function accordionNodes(editor: Editor): Record<string, NodeSpec> {
  const options = (editor.options.pluginOptions?.accordion ?? {}) as AccordionOptions;
  const initial = options.initialState ?? 'inherited';
  const serialized = options.serializedState ?? 'inherited';
  return {
    details: {
      group: 'block',
      content: 'details_summary block+',
      defining: true,
      // JSON can bring anything: only an explicit false means collapsed.
      attrs: { open: { default: true } },
      parseDOM: [
        {
          tag: 'details',
          getAttrs: (dom) => ({
            open:
              initial === 'inherited'
                ? (dom as HTMLElement).hasAttribute('open')
                : initial === 'expanded',
          }),
        },
      ],
      toDOM: (node): DOMOutputSpec => {
        const open =
          serialized === 'inherited' ? node.attrs.open !== false : serialized === 'expanded';
        return ['details', open ? { open: '' } : {}, 0];
      },
    },
    details_summary: {
      content: 'inline*',
      defining: true,
      isolating: true,
      // Only as the title of a collapsible block; a <summary> anywhere else is just text.
      parseDOM: [{ tag: 'summary', context: 'details/' }],
      toDOM: (): DOMOutputSpec => ['summary', 0],
    },
  };
}

export interface Found {
  node: PMNode;
  pos: number;
}

/** The innermost collapsible block around a position. */
export function detailsAround($pos: ResolvedPos): Found | null {
  for (let depth = $pos.depth; depth > 0; depth--) {
    const node = $pos.node(depth);
    if (node.type.name === 'details') return { node, pos: $pos.before(depth) };
  }
  return null;
}

export const isOpen = (node: PMNode) => node.attrs.open !== false;

/** The end of the title text (the cursor position after the last character). */
export const summaryEnd = (details: Found) =>
  details.pos + 2 + details.node.firstChild!.content.size;

/** Collapsing or expanding is a view change, not an edit: it doesn't go into the undo history. */
export function setOpen(tr: Transaction, details: Found, open: boolean): Transaction {
  return tr.setNodeAttribute(details.pos, 'open', open).setMeta('addToHistory', false);
}

/** Rendering: the frame, the arrow button and the content (title + blocks). */
class DetailsView implements NodeView {
  dom: HTMLElement;
  contentDOM: HTMLElement;
  private readonly toggle: HTMLButtonElement;

  constructor(
    private node: PMNode,
    view: EditorView,
    getPos: () => number | undefined,
    private readonly labels: (typeof LABELS)['en'],
    iconSource: IconSource,
  ) {
    this.toggle = h('button', {
      type: 'button',
      className: 'nova-details-toggle',
      contentEditable: 'false',
      // Not in the Tab order (Tab leaves the editor); from the keyboard it is Ctrl/Cmd+Enter in the title.
      tabIndex: -1,
    }) as HTMLButtonElement;
    this.toggle.append(icon(icons.chevronDown, iconSource));
    // The button doesn't take focus from the text.
    this.toggle.addEventListener('mousedown', (event) => event.preventDefault());
    this.toggle.addEventListener('click', () => {
      const pos = getPos();
      if (pos === undefined) return;
      const current = view.state.doc.nodeAt(pos);
      if (current?.type.name !== 'details') return;
      const details = { node: current, pos };
      const open = isOpen(current);
      const tr = setOpen(view.state.tr, details, !open);
      const { from } = view.state.selection;
      if (open && from > summaryEnd(details) && from < pos + current.nodeSize) {
        tr.setSelection(TextSelection.create(tr.doc, summaryEnd(details)));
      }
      view.dispatch(tr);
    });
    this.contentDOM = h('div', { className: 'nova-details-content' });
    this.dom = h('div', { className: 'nova-details' }, this.toggle, this.contentDOM);
    this.sync();
  }

  private sync(): void {
    const open = isOpen(this.node);
    this.dom.classList.toggle('nova-details-open', open);
    this.toggle.setAttribute('aria-expanded', String(open));
    this.toggle.setAttribute('aria-label', open ? this.labels.collapse : this.labels.expand);
  }

  update(node: PMNode): boolean {
    if (node.type !== this.node.type) return false;
    this.node = node;
    this.sync();
    return true;
  }

  stopEvent(event: Event): boolean {
    return event.target instanceof Node && this.toggle.contains(event.target);
  }

  ignoreMutation(mutation: MutationRecord | { type: 'selection'; target: Node }): boolean {
    return mutation.type !== 'selection' && !this.contentDOM.contains(mutation.target);
  }
}

export default definePlugin({
  name: 'accordion',
  nodes: accordionNodes,
  prosemirrorPlugins: (editor) => {
    const labels = pickLabels(editor, 'accordion', LABELS);
    return [
      new Plugin({
        key: new PluginKey('nova-accordion'),
        props: {
          nodeViews: {
            details: (node, view, getPos) =>
              new DetailsView(node, view, getPos, labels, editor.ui.registry),
          },
        },
      }),
    ];
  },
  setup(editor) {
    editor.ui.addStyles('nova-accordion', css);
    // The prompt in an empty title goes through a CSS variable (it isn't in the document's HTML).
    const { summary } = pickLabels(editor, 'accordion', LABELS);
    editor.root.style.setProperty('--nova-summary-placeholder', JSON.stringify(summary));
  },
  load: () => import('./accordion-ui'),
});
