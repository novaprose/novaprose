import type { NodeType } from 'prosemirror-model';
import type { EditorState } from 'prosemirror-state';
import { nodesOf } from '../commands';
import type { Editor } from '../editor';
import { definePlugin } from '../plugins';
import { BULLET_STYLES, ORDERED_STYLES } from '../schema';
import type { ButtonSpec } from '../ui/registry';
import { pickLabels } from './shared';

/**
 * The advlist plugin: bullet styles (disc, circle, square) and numbering styles (1, a, A, i, I, α).
 * The `bullist` and `numlist` buttons become split buttons: the main part toggles the list,
 * the arrow picks the style. `plugins: ['advlist']`; the style sets come from `pluginOptions.advlist`
 * (`bullets`, `numbers`, like advlist_bullet_styles / advlist_number_styles).
 */

export interface AdvlistOptions {
  bullets?: (typeof BULLET_STYLES)[number][];
  numbers?: (typeof ORDERED_STYLES)[number][];
}

export const LABELS = {
  en: {
    disc: 'Default',
    circle: 'Circle',
    square: 'Square',
    decimal: 'Default (1, 2, 3)',
    'lower-alpha': 'Lower alpha (a, b, c)',
    'upper-alpha': 'Upper alpha (A, B, C)',
    'lower-roman': 'Lower roman (i, ii, iii)',
    'upper-roman': 'Upper roman (I, II, III)',
    'lower-greek': 'Lower greek (α, β, γ)',
  },
};

/** The nearest list of the right type around the selection. */
function findList(
  state: EditorState,
  type: NodeType,
): { pos: number; attrs: Record<string, unknown> } | null {
  const { $from } = state.selection;
  for (let depth = $from.depth; depth > 0; depth--) {
    const node = $from.node(depth);
    if (node.type === type) return { pos: $from.before(depth), attrs: node.attrs };
  }
  return null;
}

function applyStyle(
  editor: Editor,
  kind: 'bullet_list' | 'ordered_list',
  style: string,
  fallback: string,
): void {
  const type = () => nodesOf(editor.view.state)[kind];
  // Not in a list of this type: create the list first, then set the style.
  if (!findList(editor.view.state, type()))
    editor.exec(kind === 'bullet_list' ? 'bulletList' : 'orderedList');
  const list = findList(editor.view.state, type());
  if (!list) return;
  const { state, dispatch } = editor.view;
  dispatch(
    state.tr.setNodeMarkup(list.pos, undefined, {
      ...list.attrs,
      listStyle: style === fallback ? null : style,
    }),
  );
  editor.focus();
}

export default definePlugin({
  name: 'advlist',
  setup(editor) {
    const labels = pickLabels(editor, 'advlist', LABELS);
    const options = (editor.options.pluginOptions?.advlist ?? {}) as AdvlistOptions;
    const lists = [
      {
        control: 'bullist',
        kind: 'bullet_list',
        styles: options.bullets ?? [...BULLET_STYLES],
        fallback: 'disc',
      },
      {
        control: 'numlist',
        kind: 'ordered_list',
        styles: options.numbers ?? [...ORDERED_STYLES],
        fallback: 'decimal',
      },
    ] as const;

    for (const { control, kind, styles, fallback } of lists) {
      const base = editor.ui.registry.get(control) as ButtonSpec | undefined;
      if (!base || base.type !== 'button') continue;
      const { type: _type, ...button } = base;
      void _type;
      editor.ui.registry.addSplitButton(control, {
        ...button,
        items: (e) => {
          const list = findList(e.view.state, nodesOf(e.view.state)[kind]);
          const current = (list?.attrs.listStyle as string | null) ?? (list ? fallback : null);
          return styles.map((style) => ({
            id: style,
            label: labels[style],
            active: current === style,
            onSelect: () => applyStyle(e, kind, style, fallback),
          }));
        },
      });
    }
  },
});
