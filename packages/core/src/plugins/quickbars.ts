import { TextSelection } from 'prosemirror-state';
import type { Editor } from '../editor';
import { isSupportedImage, uploadImages } from '../image';
import { openLinkDialog } from '../link';
import { definePlugin } from '../plugins';
import { insertTable, isInTable } from '../table';
import { icons } from '../ui/icons';

/**
 * Quickbars: панели «по месту», как одноимённый плагин TinyMCE.
 * - над выделенным текстом — быстрое форматирование;
 * - на пустой строке — быстрая вставка (картинка, таблица).
 *
 * Настройки (pluginOptions.quickbars), false — выключить панель:
 *   { selection: 'bold italic | quicklink h2 h3 blockquote', insert: 'quickimage quicktable' }
 */
export interface QuickbarsOptions {
  selection?: string | false;
  insert?: string | false;
}

export const DEFAULT_SELECTION = 'bold italic underline | quicklink h2 h3 blockquote';
export const DEFAULT_INSERT = 'quickimage quicktable';

/** Выделен непустой текст (не ячейки таблицы, не картинка), и не в блоке кода. */
export function hasTextSelection(editor: Editor): boolean {
  const { selection } = editor.view.state;
  if (!(selection instanceof TextSelection) || selection.empty) return false;
  if (selection.$from.parent.type.spec.code) return false;
  return editor.view.state.doc.textBetween(selection.from, selection.to).trim().length > 0;
}

/** Курсор на пустой строке верхнего уровня (не в списке, таблице, цитате). */
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
        // Выделение текста в таблице: форматирование важнее панели таблицы.
        priority: 10,
      });
    }

    const insert = options.insert === undefined ? DEFAULT_INSERT : options.insert;
    if (insert) {
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
