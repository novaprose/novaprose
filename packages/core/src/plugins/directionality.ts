import { icons } from '../ui/icons';
import type { Command } from 'prosemirror-state';
import { nodesOf } from '../commands';
import type { Editor } from '../editor';
import { definePlugin } from '../plugins';
import type { TextDirection } from '../schema';
import { pickLabels } from './shared';

/**
 * Плагин directionality: направление текста абзацев и заголовков (`dir="rtl"` / `dir="ltr"`) —
 * для арабского, иврита, фарси. Кнопки `ltr` и `rtl`; повторное нажатие снимает направление.
 * `plugins: ['directionality']`.
 */

const ICONS = {
  ltr: icons.ltr,
  rtl: icons.rtl,
};
export const LABELS = {
  en: { ltr: 'Left to right', rtl: 'Right to left' },
  ru: { ltr: 'Слева направо', rtl: 'Справа налево' },
};

function currentDir(editor: Editor): TextDirection | null {
  return (editor.view.state.selection.$from.parent.attrs.dir as TextDirection | null) ?? null;
}

function setDir(dir: TextDirection | null): Command {
  return (state, dispatch) => {
    const { paragraph, heading } = nodesOf(state);
    const tr = state.tr;
    let applicable = false;
    state.doc.nodesBetween(state.selection.from, state.selection.to, (node, pos) => {
      if (node.type !== paragraph && node.type !== heading) return true;
      applicable = true;
      tr.setNodeMarkup(pos, undefined, { ...node.attrs, dir });
      return false;
    });
    if (!applicable) return false;
    dispatch?.(tr);
    return true;
  };
}

export default definePlugin({
  name: 'directionality',
  toolbar: 'ltr rtl',
  setup(editor) {
    const labels = pickLabels(editor, 'directionality', LABELS);
    for (const dir of ['ltr', 'rtl'] as const) {
      const isActive = () => currentDir(editor) === dir;
      const onAction = () => {
        editor.exec(setDir(isActive() ? null : dir));
        editor.focus();
      };
      editor.ui.registry.addToggleButton(dir, {
        icon: ICONS[dir],
        tooltip: labels[dir],
        isActive,
        isEnabled: (e) => e.can(setDir(dir)),
        onAction,
      });
      editor.ui.registry.addToggleMenuItem(dir, {
        text: labels[dir],
        icon: ICONS[dir],
        isActive,
        onAction,
      });
    }
  },
});
