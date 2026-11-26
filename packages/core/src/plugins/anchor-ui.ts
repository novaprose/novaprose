import { NodeSelection } from 'prosemirror-state';
import { ELEMENT_ID_RE } from '../element-id';
import { definePlugin } from '../plugins';
import { textField } from '../ui/dialog';
import { h } from '../ui/dom';
import { icons } from '../ui/icons';
import { pickLabels } from './shared';

/** Ленивая часть плагина anchor: диалог «Якорь», кнопка и пункт меню. */

export const LABELS = {
  en: {
    title: 'Anchor',
    id: 'ID',
    hint: 'Letters, digits, “-”, “_”, “.”; must start with a letter. Link to it with #ID.',
    invalid: 'Use letters, digits, “-”, “_” or “.”, starting with a letter',
    save: 'Save',
  },
};

export default definePlugin({
  name: 'anchor-ui',
  requires: ['anchor'],
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
          if (!ELEMENT_ID_RE.test(id)) return labels.invalid;
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
      icon: icons.anchor,
      tooltip: labels.title,
      isActive: () => selectedAnchor() !== null,
      isEnabled: (e) => e.isEditable(),
      onAction: open,
    });
    editor.ui.registry.addMenuItem('anchor', {
      text: labels.title,
      icon: icons.anchor,
      onAction: open,
    });
  },
});
