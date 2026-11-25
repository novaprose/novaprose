import { definePlugin } from '../plugins';
import { pickLabels } from './shared';

/**
 * Плагин visualblocks: показать границы блоков (абзацы, заголовки, списки, цитаты, таблицы)
 * с подписью тега — удобно разбирать вставленный текст. `plugins: ['visualblocks']`,
 * `pluginOptions: { visualblocks: { default: true } }` — включить сразу.
 */

const ICON =
  '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="3 3" aria-hidden="true"><rect x="3" y="4" width="18" height="6" rx="1"/><rect x="3" y="14" width="18" height="6" rx="1"/></svg>';
const LABELS = { en: { title: 'Show blocks' }, ru: { title: 'Показать блоки' } };

export default definePlugin({
  name: 'visualblocks',
  toolbar: 'visualblocks',
  setup(editor) {
    const { title } = pickLabels(editor, LABELS);
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
