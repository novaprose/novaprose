import { icons } from '../ui/icons';
import { definePlugin } from '../plugins';
import { pickLabels } from './shared';

/**
 * Плагин visualblocks: показать границы блоков (абзацы, заголовки, списки, цитаты, таблицы)
 * с подписью тега — удобно разбирать вставленный текст. `plugins: ['visualblocks']`,
 * `pluginOptions: { visualblocks: { default: true } }` — включить сразу.
 */

const ICON = icons.visualBlocks;
export const LABELS = { en: { title: 'Show blocks' } };

export default definePlugin({
  name: 'visualblocks',
  toolbar: 'visualblocks',
  setup(editor) {
    const { title } = pickLabels(editor, 'visualblocks', LABELS);
    const options = (editor.options.pluginOptions?.visualblocks ?? {}) as { default?: boolean };
    const isOn = () => editor.root.classList.contains('nova-visualblocks');
    const toggle = () => {
      editor.root.classList.toggle('nova-visualblocks');
      editor.updateUI();
      editor.focus();
    };
    if (options.default) editor.root.classList.add('nova-visualblocks');
    editor.ui.registry.addToggleButton('visualblocks', {
      icon: ICON,
      tooltip: title,
      isActive: isOn,
      onAction: toggle,
    });
    editor.ui.registry.addToggleMenuItem('visualblocks', {
      text: title,
      icon: ICON,
      isActive: isOn,
      onAction: toggle,
    });
    return () => editor.root.classList.remove('nova-visualblocks');
  },
});
