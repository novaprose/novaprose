import { TextSelection } from 'prosemirror-state';
import type { Editor } from '../editor';
import { isSupportedImage, uploadImages } from '../image';
import { openLinkDialog } from '../link';
import { definePlugin } from '../plugins';
import { insertTable, isInTable } from '../tables';
import { icons } from '../ui/icons';

/**
 * Quickbars: toolbars in place, like the TinyMCE plugin of the same name.
 * - above selected text — quick formatting;
 * - on an empty line — quick insert (image, table).
 *
 * Options (pluginOptions.quickbars), false turns a bar off:
 *   { selection: 'bold italic | quicklink h2 h3 blockquote', insert: 'quickimage quicktable' }
 */
export interface QuickbarsOptions {
  selection?: string | false;
  insert?: string | false;
}

export const DEFAULT_SELECTION = 'bold italic underline | quicklink h2 h3 blockquote';
export const DEFAULT_INSERT = 'quickimage quicktable';

/** Non-empty text is selected (not table cells, not an image), and not in a code block. */
export function hasTextSelection(editor: Editor): boolean {
  const { selection } = editor.view.state;
  if (!(selection instanceof TextSelection) || selection.empty) return false;
  if (selection.$from.parent.type.spec.code) return false;
  return editor.view.state.doc.textBetween(selection.from, selection.to).trim().length > 0;
}

/** The cursor is on an empty top-level line (not in a list, a table, a quote). */
export function isOnEmptyLine(editor: Editor): boolean {
  const { selection } = editor.view.state;
  if (!selection.empty) return false;
  const { $from } = selection;
  return (
    $from.depth === 1 &&
    $from.parent.type === editor.schema.nodes.paragraph &&
    $from.parent.content.size === 0 &&
    !isInTable(editor.view.state)
  );
}

function pickImage(editor: Editor): void {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/png,image/jpeg,image/gif,image/webp,image/avif';
  input.addEventListener('change', () => {
    const files = [...(input.files ?? [])].filter(isSupportedImage);
    if (files.length) uploadImages(editor, files);
  });
  input.click();
}

export default definePlugin({
  name: 'quickbars',
  setup(editor) {
    const { registry, t } = editor.ui;
    const options = (editor.options.pluginOptions?.quickbars ?? {}) as QuickbarsOptions;

    registry.addButton('quicklink', {
      icon: icons.link,
      tooltip: t('link'),
      shortcut: 'Mod-k',
      onAction: (e) => openLinkDialog(e),
    });
    registry.addButton('quickimage', {
      icon: icons.image,
      tooltip: t('image'),
      onAction: (e) => pickImage(e),
    });
    registry.addButton('quicktable', {
      icon: icons.table,
      tooltip: t('table.insert'),
      onAction: (e) => e.exec(insertTable(2, 2)),
    });

    const selection = options.selection === undefined ? DEFAULT_SELECTION : options.selection;
    if (selection) {
      registry.addContextToolbar('quickbars-selection', {
        label: t('quickbars.selection'),
        predicate: hasTextSelection,
        items: selection,
        position: 'selection',
        placement: 'top-start',
        // Text selected in a table: formatting matters more than the table toolbar.
        priority: 10,
      });
    }

    // On a touch screen the insert toolbar isn't shown: it would pop up on every empty line
    // (and on a new line right by the keyboard it would cover it). Image and table are in the toolbar.
    const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
    const insert = options.insert === undefined ? DEFAULT_INSERT : options.insert;
    if (insert && !coarse) {
      registry.addContextToolbar('quickbars-insert', {
        label: t('quickbars.insert'),
        predicate: isOnEmptyLine,
        items: insert,
        position: 'selection',
        placement: 'bottom-start',
      });
    }
  },
});
