import { definePlugin } from '../plugins';

/**
 * The autoresize plugin: the editor's height follows the text within minHeight…maxHeight;
 * beyond that the editor scrolls inside and the toolbar stays in place.
 * `plugins: ['autoresize']`, `pluginOptions: { autoresize: { minHeight: 200, maxHeight: 600 } }`.
 */

export interface AutoresizeOptions {
  /** The minimum height of the text area, px. */
  minHeight?: number;
  /** The maximum height of the text area, px (no limit by default). */
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
