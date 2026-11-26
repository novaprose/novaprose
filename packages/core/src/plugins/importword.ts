import { definePlugin } from '../plugins';
import { h } from '../ui/dom';
import { WORD_ICON } from './exportword';
import { pickLabels } from './shared';

/**
 * Плагин importword: кнопка и пункт меню «Импорт из Word» — открыть файл .docx. По умолчанию
 * документ заменяет содержимое (Ctrl+Z вернёт прежнее); лист и поля — в режим страниц.
 * `plugins: ['importword']`. Разбор — @novaprose/core/docx, грузится при первом открытии.
 */

export const LABELS = {
  en: {
    import: 'Import from Word',
    failed: 'This file could not be opened. Choose a Word document (.docx).',
    partial: 'Imported. Some parts are not supported and were skipped.',
  },
};

export interface ImportWordOptions {
  /** replace (по умолчанию) — заменить содержимое; insert — вставить у курсора. */
  mode?: 'replace' | 'insert';
}

const icon = WORD_ICON('<path d="M12 12v6"/><path d="m9 15 3 3 3-3"/>');

export default definePlugin({
  name: 'importword',
  toolbar: 'importword',
  setup(editor) {
    const labels = pickLabels(editor, 'importword', LABELS);
    const options = (editor.options.pluginOptions?.importword ?? {}) as ImportWordOptions;
    const open = async (file: File) => {
      try {
        const { importDocx } = await import('../docx');
        const result = await importDocx(editor, file, { mode: options.mode });
        if (result.warnings.length) editor.ui.notify({ text: labels.partial, type: 'warning' });
        editor.focus();
      } catch (error) {
        console.error('[nova] importword:', error);
        editor.ui.notify({ text: labels.failed, type: 'error' });
      }
    };
    const choose = () => {
      if (!editor.isEditable()) return;
      const input = h('input', {
        type: 'file',
        accept: '.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });
      input.style.display = 'none';
      input.addEventListener('change', () => {
        const file = input.files?.[0];
        input.remove();
        if (file) void open(file);
      });
      editor.root.append(input);
      input.click();
    };
    editor.ui.registry.addButton('importword', {
      icon,
      tooltip: labels.import,
      onAction: choose,
      isEnabled: (e) => e.isEditable(),
    });
    editor.ui.registry.addMenuItem('importword', {
      icon,
      text: labels.import,
      onAction: choose,
      isEnabled: (e) => e.isEditable(),
    });
  },
});
