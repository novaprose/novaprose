import { definePlugin } from '../plugins';
import { h } from '../ui/dom';
import { pickLabels } from './shared';

/**
 * Плагин exportword: кнопка и пункт меню «Экспорт в Word» — документ скачивается файлом .docx
 * (лист и поля — из режима страниц). `plugins: ['exportword']`. Сам экспорт — @novaprose/core/docx,
 * он грузится при первом нажатии.
 */

export const LABELS = {
  en: { export: 'Export to Word', failed: 'Could not create the Word file' },
};

export interface ExportWordOptions {
  /** The file name (document.docx by default). */
  filename?: string;
  /** Text font in Word (Calibri by default) and size in points (12). */
  font?: string;
  fontSize?: number;
}

export const WORD_ICON = (arrow: string) =>
  `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>${arrow}</svg>`;

const icon = WORD_ICON('<path d="M12 18v-6"/><path d="m9 15 3-3 3 3"/>');

/** Скачать байты файлом. */
export function download(bytes: Uint8Array, filename: string, type: string): void {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type }));
  const link = h('a', { href: url, download: filename });
  link.style.display = 'none';
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export default definePlugin({
  name: 'exportword',
  toolbar: 'exportword',
  setup(editor) {
    const labels = pickLabels(editor, 'exportword', LABELS);
    const options = (editor.options.pluginOptions?.exportword ?? {}) as ExportWordOptions;
    const run = async () => {
      try {
        const { exportDocx } = await import('../docx');
        const bytes = await exportDocx(editor, { font: options.font, fontSize: options.fontSize });
        const name = (options.filename || 'document.docx').replace(/[\\/:*?"<>|]/g, '_');
        download(
          bytes,
          name.toLowerCase().endsWith('.docx') ? name : `${name}.docx`,
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        );
      } catch (error) {
        console.error('[nova] exportword:', error);
        editor.ui.notify({ text: labels.failed, type: 'error' });
      }
    };
    editor.ui.registry.addButton('exportword', {
      icon,
      tooltip: labels.export,
      onAction: () => void run(),
    });
    editor.ui.registry.addMenuItem('exportword', {
      icon,
      text: labels.export,
      onAction: () => void run(),
    });
  },
});
