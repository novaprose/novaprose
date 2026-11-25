import { keymap } from 'prosemirror-keymap';
import { definePlugin } from '../plugins';
import { insertText, pickLabels } from './shared';

/** Плагин nonbreaking: неразрывный пробел (кнопка и Ctrl/Cmd+Shift+Space). `plugins: ['nonbreaking']`. */

const NBSP = String.fromCharCode(0xa0);
const ICON =
  '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9v5h16V9"/></svg>';
const LABELS = { en: { title: 'Nonbreaking space' }, ru: { title: 'Неразрывный пробел' } };

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
    const { title } = pickLabels(editor, LABELS);
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
