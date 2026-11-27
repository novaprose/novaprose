import { NodeSelection } from 'prosemirror-state';
import { definePlugin } from '../plugins';
import { textField } from '../ui/dialog';
import { h } from '../ui/dom';
import { attachFilePicker } from '../ui/file-picker';
import { icons } from '../ui/icons';
import { parseMediaUrl } from './media';
import { pickLabels } from './shared';
import { replaceSelectionWithBlock } from '../commands';

/** The lazy part of the media plugin: the "Video" dialog, the button and the menu item. */

const ICON = icons.media;

export const LABELS = {
  en: {
    title: 'Video',
    url: 'Video URL',
    hint: 'YouTube, Vimeo or a link to an .mp4 / .webm file',
    name: 'Title (for screen readers)',
    invalid: 'This video address is not supported',
    save: 'Insert',
  },
};

export default definePlugin({
  name: 'media-ui',
  requires: ['media'],
  setup(editor) {
    const labels = pickLabels(editor, 'media', LABELS);
    const selected = () => {
      const { selection } = editor.view.state;
      return selection instanceof NodeSelection && selection.node.type.name === 'media'
        ? selection
        : null;
    };

    const open = () => {
      const current = selected();
      const url = textField({
        label: labels.url,
        type: 'url',
        placeholder: 'https://',
        hint: labels.hint,
        value: (current?.node.attrs.src as string | undefined) ?? '',
      });
      const title = textField({
        label: labels.name,
        value: (current?.node.attrs.title as string | undefined) ?? '',
      });
      attachFilePicker(editor, url, 'media', (picked) => {
        if (picked.title) title.input.value = picked.title;
      });
      editor.ui.openDialog({
        title: labels.title,
        body: h('div', { className: 'nova-form' }, url.el, title.el),
        submitLabel: labels.save,
        onSubmit: () => {
          const source = parseMediaUrl(url.input.value);
          if (!source) return labels.invalid;
          const { state, dispatch } = editor.view;
          const attrs = { ...source, title: title.input.value.trim() };
          const sel = selected();
          if (sel)
            dispatch(state.tr.setNodeMarkup(sel.from, undefined, { ...sel.node.attrs, ...attrs }));
          else
            dispatch(
              replaceSelectionWithBlock(
                state.tr,
                editor.schema.nodes.media!.create(attrs),
              ).scrollIntoView(),
            );
          return true;
        },
      });
    };

    editor.ui.registry.addToggleButton('media', {
      icon: ICON,
      tooltip: labels.title,
      isActive: () => selected() !== null,
      isEnabled: (e) => e.isEditable(),
      onAction: open,
    });
    editor.ui.registry.addMenuItem('media', { text: labels.title, icon: ICON, onAction: open });
  },
});
