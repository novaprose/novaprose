import type { DOMOutputSpec, Node as PMNode, NodeSpec, ResolvedPos } from 'prosemirror-model';
import { Plugin, PluginKey, TextSelection, type Transaction } from 'prosemirror-state';
import type { EditorView, NodeView } from 'prosemirror-view';
import type { Editor } from '../editor';
import { definePlugin } from '../plugins';
import { h, icon } from '../ui/dom';
import { icons } from '../ui/icons';
import css from './accordion.css?raw';
import { pickLabels } from './shared';

/**
 * Плагин accordion: раскрывающиеся блоки — заголовок и содержимое, которое сворачивается
 * (`<details><summary>`), как у TinyMCE (`accordion`) и Tiptap (Details). `plugins: ['accordion']`.
 *
 * Здесь — узлы и их вид в редакторе со стрелкой (нужны с первой отрисовки); кнопка, команды и
 * клавиши — ленивой частью accordion-ui.ts.
 */

/** Подписи (ленивая часть берёт их отсюда: ключи переводов — accordion.*). */
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
   * Состояние при загрузке HTML: как в разметке (`inherited`, по умолчанию), все свёрнуты
   * (`collapsed`) или все раскрыты (`expanded`). Как `details_initial_state` у TinyMCE.
   */
  initialState?: AccordionState;
  /**
   * Атрибут `open` в getHTML: как в редакторе (`inherited`, по умолчанию), всегда свёрнуто или
   * всегда раскрыто. Как `details_serialized_state` у TinyMCE.
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
      // Из JSON может прийти что угодно: свёрнут только явный false.
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
      // Только как заголовок раскрывающегося блока; <summary> где-то ещё — просто текст.
      parseDOM: [{ tag: 'summary', context: 'details/' }],
      toDOM: (): DOMOutputSpec => ['summary', 0],
    },
  };
}

export interface Found {
  node: PMNode;
  pos: number;
}

/** Самый внутренний раскрывающийся блок вокруг позиции. */
export function detailsAround($pos: ResolvedPos): Found | null {
  for (let depth = $pos.depth; depth > 0; depth--) {
    const node = $pos.node(depth);
    if (node.type.name === 'details') return { node, pos: $pos.before(depth) };
  }
  return null;
}

export const isOpen = (node: PMNode) => node.attrs.open !== false;

/** Конец текста заголовка (позиция курсора после последнего символа). */
export const summaryEnd = (details: Found) =>
  details.pos + 2 + details.node.firstChild!.content.size;

/** Свернуть или раскрыть: это вид, а не правка — в историю отмены не попадает. */
export function setOpen(tr: Transaction, details: Found, open: boolean): Transaction {
  return tr.setNodeAttribute(details.pos, 'open', open).setMeta('addToHistory', false);
}

/** Отрисовка: рамка, стрелка-кнопка и содержимое (заголовок + блоки). */
class DetailsView implements NodeView {
  dom: HTMLElement;
  contentDOM: HTMLElement;
  private readonly toggle: HTMLButtonElement;

  constructor(
    private node: PMNode,
    view: EditorView,
    getPos: () => number | undefined,
    private readonly labels: (typeof LABELS)['en'],
  ) {
    this.toggle = h('button', {
      type: 'button',
      className: 'nova-details-toggle',
      contentEditable: 'false',
      // Не в порядке Tab (Tab выводит из редактора); с клавиатуры — Ctrl/Cmd+Enter в заголовке.
      tabIndex: -1,
    }) as HTMLButtonElement;
    this.toggle.append(icon(icons.chevronDown));
    // Кнопка не забирает фокус у текста.
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
            details: (node, view, getPos) => new DetailsView(node, view, getPos, labels),
          },
        },
      }),
    ];
  },
  setup(editor) {
    editor.ui.addStyles('nova-accordion', css);
    // Приглашение в пустом заголовке — через CSS-переменную (в HTML документа его нет).
    const { summary } = pickLabels(editor, 'accordion', LABELS);
    editor.root.style.setProperty('--nova-summary-placeholder', JSON.stringify(summary));
  },
  load: () => import('./accordion-ui'),
});
