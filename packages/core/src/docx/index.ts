// Встроенные плагины по имени (plugins: ['mentions']) — и при импорте только этого входа (сервер).
import '../plugins/index';
import { Node as PMNode } from 'prosemirror-model';
import { createRenderer, type DocumentOptions } from '../document';
import type { Editor } from '../editor';
import { pageLayout } from '../plugins/pagelayout';
import { toDocx, type DocxExportOptions } from './export';
import { fromDocx, type DocxImportResult } from './import';

/**
 * Word (.docx): `@novaprose/core/docx`. Без сторонних библиотек и без DOM — экспорт и разбор
 * работают и в браузере, и на сервере (Node 18+). В редакторе — плагины exportword и importword.
 *
 *   const bytes = await exportDocx(editor);            // Uint8Array файла .docx
 *   await importDocx(editor, file);                    // файл из <input type="file">
 *   const bytes = await exportDocx(savedJson, { plugins: ['mentions'] }); // на сервере
 */

export { fromDocx, toDocx };
export type { DocxExportOptions, DocxImportResult };
export type { DocxImage } from './export';

function isEditor(source: unknown): source is Editor {
  return !!source && typeof source === 'object' && 'view' in source && 'getHTML' in source;
}

/**
 * A document → .docx. The source is an editor (the sheet and margins come from its page layout), a
 * ProseMirror document or saved JSON (with the options that shape the schema, as for an editor).
 */
export function exportDocx(
  source: Editor | PMNode | Record<string, unknown>,
  options: DocxExportOptions & DocumentOptions = {},
): Promise<Uint8Array> {
  if (isEditor(source))
    return toDocx(source.view.state.doc, { page: pageLayout(source)?.layout, ...options });
  if (source instanceof PMNode) return toDocx(source, options);
  return toDocx(createRenderer(options).doc(source), options);
}

export interface ImportDocxOptions {
  /** replace (default) — replace the content (Ctrl+Z brings it back); insert — insert at the cursor. */
  mode?: 'replace' | 'insert';
}

/** .docx → into the editor. The document's sheet and margins go to page layout (if it is active). */
export async function importDocx(
  editor: Editor,
  file: Blob | ArrayBuffer | Uint8Array,
  options: ImportDocxOptions = {},
): Promise<DocxImportResult> {
  const bytes =
    file instanceof Uint8Array
      ? file
      : new Uint8Array(file instanceof ArrayBuffer ? file : await file.arrayBuffer());
  const result = await fromDocx(bytes);
  if (options.mode === 'insert') editor.insertContent(result.html);
  else editor.setContent(result.html);
  if (result.page) pageLayout(editor)?.set(result.page);
  return result;
}
