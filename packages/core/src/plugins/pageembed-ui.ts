import { NodeSelection } from 'prosemirror-state';
import { replaceSelectionWithBlock } from '../commands';
import { definePlugin } from '../plugins';
import { imageSize } from '../schema';
import { embeddableUrl, FIXED, pageEmbedOptions, ratioOf } from './pageembed';
import { pickLabels } from './shared';

/** The lazy part of the pageembed plugin: the "Embedded page" dialog, the button and the menu item. */

const ICON =
  '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 8h18"/><path d="m10 12-2 2 2 2"/><path d="m14 12 2 2-2 2"/></svg>';

export const LABELS = {
  en: {
    title: 'Embedded page',
    url: 'Page address',
    hint: 'Some sites don’t allow their pages to be shown on others.',
    name: 'Title (for screen readers)',
    nameHint: 'When empty, the site’s name is used.',
    size: 'Size',
    fixed: 'Fixed size',
    responsive: 'Full width, {ratio}',
    width: 'Width, px',
    height: 'Height, px',
    border: 'Show a border',
    scrolling: 'Show scroll bars',
    invalid: 'Enter the full address, starting with https://',
    notAllowed: 'Pages from this site can’t be embedded here.',
    insert: 'Insert',
    save: 'Save',
  },
};

export default definePlugin({
  name: 'pageembed-ui',
  requires: ['pageembed'],
  setup(editor) {
    const labels = pickLabels(editor, 'pageembed', LABELS);
    const settings = pageEmbedOptions(editor);
    const selected = () => {
      const { selection } = editor.view.state;
      return selection instanceof NodeSelection && selection.node.type.name === 'pageembed'
        ? selection
        : null;
    };
    const sizeLabel = (value: string, text?: string) => {
      if (text) return text;
      const ratio = ratioOf(value);
      return ratio ? labels.responsive.replace('{ratio}', `${ratio[0]}:${ratio[1]}`) : value;
    };

    const open = async () => {
      const current = selected()?.node.attrs;
      const preferred =
        settings.sizes.find((size) => ratioOf(size.value)?.join(':') === '16:9') ??
        settings.sizes[0];
      const size = current
        ? settings.sizes.some((s) => s.value === current.size)
          ? (current.size as string)
          : ''
        : (preferred?.value ?? '');
      const data = await editor.ui.dialog({
        title: labels.title,
        submitLabel: current ? labels.save : labels.insert,
        initialData: {
          src: typeof current?.src === 'string' ? current.src : '',
          title: typeof current?.title === 'string' ? current.title : '',
          size,
          width: imageSize(current?.width) ?? FIXED.width,
          height: imageSize(current?.height) ?? FIXED.height,
          border: current?.border === true,
          scrolling: current?.scrolling !== false,
        },
        fields: [
          {
            type: 'url',
            name: 'src',
            label: labels.url,
            required: true,
            hint: labels.hint,
            validate: (value) =>
              !embeddableUrl(value)
                ? labels.invalid
                : embeddableUrl(value, settings.allowUrl)
                  ? null
                  : labels.notAllowed,
          },
          { type: 'text', name: 'title', label: labels.name, hint: labels.nameHint },
          ...(settings.sizes.length
            ? [
                {
                  type: 'select' as const,
                  name: 'size',
                  label: labels.size,
                  options: [
                    { value: '', label: labels.fixed },
                    ...settings.sizes.map((s) => ({
                      value: s.value,
                      label: sizeLabel(s.value, s.text),
                    })),
                  ],
                },
              ]
            : []),
          {
            type: 'number',
            name: 'width',
            label: labels.width,
            min: 1,
            max: 10000,
            disabled: !!size,
          },
          {
            type: 'number',
            name: 'height',
            label: labels.height,
            min: 1,
            max: 10000,
            disabled: !!size,
          },
          { type: 'checkbox', name: 'border', label: labels.border },
          { type: 'checkbox', name: 'scrolling', label: labels.scrolling },
        ],
        // Width and height are for a fixed size only.
        onChange: (values, { name }, api) => {
          if (name !== 'size') return;
          api.setEnabled('width', !values.size);
          api.setEnabled('height', !values.size);
        },
      });
      if (!data) return;
      const src = embeddableUrl(data.src, settings.allowUrl);
      if (!src) return;
      const attrs = {
        src,
        size: typeof data.size === 'string' ? data.size : '',
        width: imageSize(String(data.width ?? '')) ?? FIXED.width,
        height: imageSize(String(data.height ?? '')) ?? FIXED.height,
        title: typeof data.title === 'string' ? data.title.trim().slice(0, 300) : '',
        border: data.border === true,
        scrolling: data.scrolling !== false,
      };
      const { state, dispatch } = editor.view;
      const sel = selected();
      if (sel)
        dispatch(state.tr.setNodeMarkup(sel.from, undefined, { ...sel.node.attrs, ...attrs }));
      else
        dispatch(
          replaceSelectionWithBlock(
            state.tr,
            editor.schema.nodes.pageembed!.create(attrs),
          ).scrollIntoView(),
        );
      editor.focus();
    };

    editor.ui.registry.addToggleButton('pageembed', {
      icon: ICON,
      tooltip: labels.title,
      isActive: () => selected() !== null,
      isEnabled: (e) => e.isEditable(),
      onAction: () => void open(),
    });
    editor.ui.registry.addMenuItem('pageembed', {
      text: labels.title,
      icon: ICON,
      onAction: () => void open(),
    });
  },
});
