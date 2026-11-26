import type { Node as PMNode, NodeSpec } from 'prosemirror-model';
import { Plugin as PMPlugin } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';
import type { Editor } from '../editor';
import { definePlugin } from '../plugins';
import { pickLabels } from './shared';

/**
 * The mergetags plugin: template variables ("Client name", "Order number") that your server replaces
 * with values when printing or sending. In the text it is a non-editable chip, in HTML
 * `<span data-mergetag="client">Client name</span>` (the attribute name can be changed).
 *
 * `plugins: ['mergetags']`, the list in `pluginOptions.mergetags.list`. Insert them with the
 * `mergetags` button or by typing `{{`. Variables missing from the list aren't lost: they show by key.
 * This part is the node and how it looks in the editor; the menu and typing `{{` are in mergetags-ui.ts.
 */

export interface MergeTag {
  /** The key your server sees: 'client', 'order.number'. */
  key: string;
  /** The label in the editor: 'Client name'. */
  label: string;
}

export interface MergeTagGroup {
  title: string;
  items: MergeTag[];
}

export interface MergeTagsOptions {
  /** Variables, as a list or in groups. */
  list?: (MergeTag | MergeTagGroup)[];
  /** The HTML attribute holding the key. Default 'data-mergetag'. */
  attribute?: string;
}

export const LABELS = {
  en: {
    insert: 'Insert variable',
    search: 'Variables',
    empty: 'No variables found',
    unknown: 'Unknown variable',
  },
};

/** A key without spaces and quotes: it goes into an attribute and to your server. */
const KEY_RE = /^[\w.:-]{1,100}$/;
/** The attribute: only data-* (it can't be named onclick or href). */
const ATTR_RE = /^data-[a-z0-9-]{1,40}$/;

export function optionsOf(editor: Editor): MergeTagsOptions {
  return (editor.options.pluginOptions?.mergetags as MergeTagsOptions | undefined) ?? {};
}

function attributeOf(editor: Editor): string {
  const attribute = optionsOf(editor).attribute ?? 'data-mergetag';
  if (ATTR_RE.test(attribute)) return attribute;
  console.warn(
    `[nova] mergetags: attribute "${attribute}" must look like data-name; using data-mergetag`,
  );
  return 'data-mergetag';
}

export const isGroup = (entry: MergeTag | MergeTagGroup): entry is MergeTagGroup =>
  Array.isArray((entry as MergeTagGroup).items);

export function flatList(editor: Editor): MergeTag[] {
  return (optionsOf(editor).list ?? []).flatMap((entry) =>
    isGroup(entry) ? entry.items : [entry],
  );
}

function labelFor(editor: Editor, key: string): string | undefined {
  return flatList(editor).find((tag) => tag.key === key)?.label;
}

function buildNodes(editor: Editor): Record<string, NodeSpec> {
  const attribute = attributeOf(editor);
  return {
    mergetag: {
      group: 'inline',
      inline: true,
      atom: true,
      selectable: true,
      draggable: true,
      // The chip's own style (color, background, weight) is its look, not the formatting of the text around it.
      ignoreStyles: true,
      attrs: { key: {}, label: { default: '' } },
      parseDOM: [
        {
          tag: `span[${attribute}]`,
          // Above marks and styles: a variable is a whole node, not a span with formatting.
          priority: 60,
          getAttrs: (dom) => {
            const el = dom as HTMLElement;
            const key = el.getAttribute(attribute) ?? '';
            if (!KEY_RE.test(key)) return false;
            return { key, label: labelFor(editor, key) ?? el.textContent?.trim() ?? key };
          },
        },
      ],
      // The document may come from JSON: the key is checked on output too.
      toDOM: (node) => {
        const key = KEY_RE.test(node.attrs.key as string) ? (node.attrs.key as string) : '';
        // JSON comes from outside: the label may be a number or null, it is output as a string.
        const label =
          node.attrs.label == null || node.attrs.label === '' ? key : String(node.attrs.label);
        return ['span', { [attribute]: key, contenteditable: 'false' }, label];
      },
    },
  };
}

/** The view in the editor: a chip with the label from the list (the label in the HTML may be outdated). */
class MergeTagView {
  readonly dom: HTMLElement;

  constructor(
    private node: PMNode,
    private readonly editor: Editor,
    private readonly unknownTitle: string,
  ) {
    this.dom = document.createElement('span');
    this.dom.className = 'nova-mergetag';
    this.dom.contentEditable = 'false';
    this.render();
  }

  private render(): void {
    const key = this.node.attrs.key as string;
    const known = labelFor(this.editor, key);
    this.dom.textContent = known ?? ((this.node.attrs.label as string) || key);
    this.dom.dataset.key = key;
    const list = optionsOf(this.editor).list;
    // The key isn't in the list: highlighted but not removed, so the template loses no data.
    const unknown = !!list?.length && known === undefined;
    this.dom.classList.toggle('is-unknown', unknown);
    this.dom.title = unknown ? `${this.unknownTitle}: ${key}` : key;
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

  stopEvent(): boolean {
    return false;
  }

  ignoreMutation(): boolean {
    return true;
  }
}

export default definePlugin({
  name: 'mergetags',
  toolbar: 'mergetags',
  nodes: buildNodes,
  prosemirrorPlugins: (editor) => {
    const labels = pickLabels(editor, 'mergetags', LABELS);
    return [
      new PMPlugin({
        props: {
          nodeViews: {
            mergetag: (node: PMNode, _view: EditorView) =>
              new MergeTagView(node, editor, labels.unknown),
          },
        },
      }),
    ];
  },
  load: () => import('./mergetags-ui'),
});
