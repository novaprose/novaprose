import type { Editor } from '../editor';
import { definePlugin } from '../plugins';
import { icons } from '../ui/icons';
import { openSourceCode } from '../ui/views';
import { pickLabels } from './shared';

/**
 * The advcode plugin (the enhanced code editor, named as in TinyMCE): the Source code button opens
 * the HTML in a code editor (CodeMirror) instead of a plain text field: colors for HTML, CSS and
 * JavaScript, matching brackets, folding, several cursors, search and replace, tags closed as you
 * type, a larger or smaller text and full screen. `plugins: ['advcode']`.
 *
 * The code editor (CodeMirror with its HTML, CSS and JavaScript grammars, ~190 KB gzip in the CDN
 * build) loads when it is first opened, not with the page.
 */

export const LABELS = {
  en: {
    find: 'Find and replace',
    smaller: 'Smaller text',
    larger: 'Larger text',
    wrap: 'Wrap long lines',
    fullscreen: 'Full screen',
    failed: 'The code editor couldn’t load: the plain one opened instead.',
  },
};

export interface AdvCodeOptions {
  /** Lay the HTML out with one block per line and nested ones indented (yes). */
  prettify?: boolean;
  /** Wrap long lines (yes). */
  wrap?: boolean;
  /** The text size, in pixels (14). */
  fontSize?: number;
}

export type AdvCodeLabels = typeof LABELS.en;

export default definePlugin({
  name: 'advcode',
  setup(editor: Editor) {
    const labels = pickLabels(editor, 'advcode', LABELS);
    const open = (e: Editor) => {
      void import('./advcode-editor').then(
        (module) => module.openCodeEditor(e, labels),
        (error: unknown) => {
          // Offline or blocked: the plain source view, so the HTML can still be edited.
          console.warn('[nova] advcode: failed to load the code editor', error);
          e.ui.notify({ text: labels.failed, type: 'warning' });
          openSourceCode(e);
        },
      );
    };
    editor.ui.registry.addButton('code', {
      icon: icons.sourceCode,
      tooltip: editor.ui.t('sourceCode'),
      onAction: open,
    });
  },
});
