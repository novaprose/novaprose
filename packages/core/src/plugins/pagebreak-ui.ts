import { definePlugin } from '../plugins';
import { icons } from '../ui/icons';
import { pickLabels } from './shared';

/** Ленивая часть плагина pagebreak: кнопка и пункт меню «Разрыв страницы». */

export const LABELS = { en: { title: 'Page break' } };

export default definePlugin({
  name: 'pagebreak-ui',
  requires: ['pagebreak'],
  setup(editor) {
    const { title } = pickLabels(editor, 'pagebreak', LABELS);
    const insert = () => {
      const { state, dispatch } = editor.view;
      const type = editor.schema.nodes.pagebreak!;
      dispatch(state.tr.replaceSelectionWith(type.create()).scrollIntoView());
      editor.focus();
    };
    editor.ui.registry.addButton('pagebreak', {
      icon: icons.pageBreak,
      tooltip: title,
      isEnabled: (e) => e.isEditable(),
      onAction: insert,
    });
    editor.ui.registry.addMenuItem('pagebreak', {
      text: title,
      icon: icons.pageBreak,
      onAction: insert,
    });
  },
});
