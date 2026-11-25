import { icons } from '../ui/icons';
import { definePlugin } from '../plugins';
import { pickLabels } from './shared';

/**
 * Плагин pagebreak: разрыв страницы для печати и PDF —
 * `<div class="nova-pagebreak" style="break-after: page;"></div>`. `plugins: ['pagebreak']`.
 * Добавляет узел в схему, поэтому подключается сразу (не лениво).
 */

const ICON = icons.pageBreak;
const LABELS = { en: { title: 'Page break' }, ru: { title: 'Разрыв страницы' } };

export default definePlugin({
  name: 'pagebreak',
  toolbar: 'pagebreak',
  nodes: {
    pagebreak: {
      group: 'block',
      atom: true,
      selectable: true,
      parseDOM: [
        { tag: 'div.nova-pagebreak' },
        // Разрыв из других редакторов и Word: пустой блок с page-break-after / break-after.
        {
          tag: 'div',
          getAttrs: (dom) => {
            const el = dom as HTMLElement;
            const breaks = el.style.breakAfter === 'page' || el.style.pageBreakAfter === 'always';
            return breaks && !el.textContent?.trim() ? null : false;
          },
        },
      ],
      toDOM: () => ['div', { class: 'nova-pagebreak', style: 'break-after: page;' }],
    },
  },
  setup(editor) {
    const { title } = pickLabels(editor, LABELS);
    const insert = () => {
      const { state, dispatch } = editor.view;
      const type = editor.schema.nodes.pagebreak!;
      dispatch(state.tr.replaceSelectionWith(type.create()).scrollIntoView());
      editor.focus();
    };
    editor.ui.registry.addButton('pagebreak', {
      icon: ICON,
      tooltip: title,
      isEnabled: (e) => e.isEditable(),
      onAction: insert,
    });
    editor.ui.registry.addMenuItem('pagebreak', { text: title, icon: ICON, onAction: insert });
  },
});
