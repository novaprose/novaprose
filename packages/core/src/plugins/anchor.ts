import { icons } from '../ui/icons';
import { NodeSelection } from 'prosemirror-state';
import { definePlugin } from '../plugins';
import { textField } from '../ui/dialog';
import { h } from '../ui/dom';
import { pickLabels } from './shared';

/**
 * Плагин anchor: якорь `<a id="…"></a>` для ссылок вида `#раздел`. `plugins: ['anchor']`.
 * Добавляет узел в схему, поэтому подключается сразу (не лениво).
 */

const ICON = icons.anchor;

export const LABELS = {
  en: {
    title: 'Anchor',
    id: 'ID',
    hint: 'Letters, digits, “-”, “_”, “.”; must start with a letter. Link to it with #ID.',
    invalid: 'Use letters, digits, “-”, “_” or “.”, starting with a letter',
    save: 'Save',
  },
  ru: {
    title: 'Якорь',
    id: 'Идентификатор',
    hint: 'Латинские буквы, цифры, «-», «_», «.»; начинается с буквы. Ссылка на якорь — #идентификатор.',
    invalid: 'Только латинские буквы, цифры, «-», «_» или «.», первая — буква',
    save: 'Сохранить',
  },
};

/** Безопасный идентификатор: без пробелов и кавычек, не похожий на код (защита от DOM clobbering тоже). */
const ID_RE = /^[A-Za-z][\w.-]{0,63}$/;

export default definePlugin({
  name: 'anchor',
  toolbar: 'anchor',
  nodes: {
    anchor: {
      group: 'inline',
      inline: true,
      atom: true,
      selectable: true,
      attrs: { id: {} },
      parseDOM: [
        {
          tag: 'a[id]:not([href])',
          getAttrs: (dom) => {
            const id = (dom as HTMLElement).getAttribute('id') ?? '';
            return ID_RE.test(id) ? { id } : false;
          },
        },
        {
          tag: 'a[name]:not([href])',
          getAttrs: (dom) => {
            const id = (dom as HTMLElement).getAttribute('name') ?? '';
            return ID_RE.test(id) ? { id } : false;
          },
        },
      ],
      // Документ мог прийти из JSON — идентификатор проверяем и на выходе.
      toDOM: (node) => ['a', { id: ID_RE.test(node.attrs.id as string) ? node.attrs.id : null }],
    },
  },
  setup(editor) {
    const labels = pickLabels(editor, 'anchor', LABELS);
    const selectedAnchor = () => {
      const { selection } = editor.view.state;
      return selection instanceof NodeSelection && selection.node.type.name === 'anchor'
        ? selection
        : null;
    };

    const open = () => {
      const current = selectedAnchor();
      const field = textField({
        label: labels.id,
        hint: labels.hint,
        value: (current?.node.attrs.id as string | undefined) ?? '',
      });
      editor.ui.openDialog({
        title: labels.title,
        body: h('div', { className: 'nova-form' }, field.el),
        submitLabel: labels.save,
        onSubmit: () => {
          const id = field.input.value.trim();
          if (!ID_RE.test(id)) return labels.invalid;
          const { state, dispatch } = editor.view;
          const type = editor.schema.nodes.anchor!;
          const sel = selectedAnchor();
          if (sel) dispatch(state.tr.setNodeMarkup(sel.from, undefined, { id }));
          else dispatch(state.tr.replaceSelectionWith(type.create({ id }), false).scrollIntoView());
          return true;
        },
      });
    };

    editor.ui.registry.addToggleButton('anchor', {
      icon: ICON,
      tooltip: labels.title,
      isActive: () => selectedAnchor() !== null,
      isEnabled: (e) => e.isEditable(),
      onAction: open,
    });
    editor.ui.registry.addMenuItem('anchor', { text: labels.title, icon: ICON, onAction: open });
  },
});
