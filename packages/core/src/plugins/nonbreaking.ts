import { icons } from '../ui/icons';
import { keymap } from 'prosemirror-keymap';
import { definePlugin } from '../plugins';
import { insertText, pickLabels } from './shared';

/** Плагин nonbreaking: неразрывный пробел (кнопка и Ctrl/Cmd+Shift+Space). `plugins: ['nonbreaking']`. */

const NBSP = String.fromCharCode(0xa0);
const ICON = icons.nonBreaking;
export const LABELS = { en: { title: 'Nonbreaking space' }, ru: { title: 'Неразрывный пробел' } };

export default definePlugin({
  name: 'nonbreaking',
  toolbar: 'nonbreaking',
  prosemirrorPlugins: () => [
    keymap({
      'Mod-Shift-Space': (state, dispatch) => {
        dispatch?.(state.tr.insertText(NBSP).scrollIntoView());
        return true;
      },
    }),
  ],
  setup(editor) {
    const { title } = pickLabels(editor, 'nonbreaking', LABELS);
    const spec = {
      icon: ICON,
      tooltip: title,
      shortcut: 'Mod-Shift-Space',
      isEnabled: () => editor.isEditable(),
      onAction: () => insertText(editor, NBSP),
    };
    editor.ui.registry.addButton('nonbreaking', spec);
    editor.ui.registry.addMenuItem('nonbreaking', {
      text: title,
      icon: ICON,
      onAction: spec.onAction,
    });
  },
});
