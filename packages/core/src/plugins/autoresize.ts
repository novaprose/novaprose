import { definePlugin } from '../plugins';

/**
 * Плагин autoresize: высота редактора следует за текстом в пределах minHeight…maxHeight;
 * дальше — прокрутка внутри редактора, а тулбар остаётся на месте.
 * `plugins: ['autoresize']`, `pluginOptions: { autoresize: { minHeight: 200, maxHeight: 600 } }`.
 */

export interface AutoresizeOptions {
  /** Минимальная высота области текста, px. */
  minHeight?: number;
  /** Максимальная высота области текста, px (по умолчанию — без ограничения). */
  maxHeight?: number;
}

export default definePlugin({
  name: 'autoresize',
  setup(editor) {
    const { minHeight, maxHeight } = (editor.options.pluginOptions?.autoresize ??
      {}) as AutoresizeOptions;
    const content = editor.root.querySelector<HTMLElement>('.nova-content');
    if (!content) return;
    editor.root.classList.add('nova-autoresize');
    if (minHeight !== undefined)
      editor.root.style.setProperty('--nova-min-height', `${minHeight}px`);
    if (maxHeight !== undefined) content.style.maxHeight = `${maxHeight}px`;
    return () => {
      editor.root.classList.remove('nova-autoresize');
      editor.root.style.removeProperty('--nova-min-height');
      content.style.removeProperty('max-height');
    };
  },
});
