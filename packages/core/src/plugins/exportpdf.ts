import { definePlugin } from '../plugins';
import { download, WORD_ICON } from './exportword';
import { pickLabels } from './shared';

/**
 * The exportpdf plugin: the "Export to PDF" button and File menu item. The PDF is made from the same
 * document as printing: the sheet, margins, header and footer of page mode (pagelayout). Your server turns
 * that document into a file with headless Chrome (`pluginOptions.exportpdf.request`); without a server the
 * button opens the print dialog, where the browser offers "Save as PDF". `plugins: ['exportpdf']`.
 */

export const LABELS = {
  en: {
    export: 'Export to PDF',
    saveAsPdf: 'In the print dialog, choose “Save as PDF”.',
    working: 'Creating the PDF…',
    failed: 'Could not create the PDF file',
  },
};

/** What your server gets: the print document and the file name. */
export interface PdfRequest {
  /** A whole HTML page: the editor's text, its styles and the @page rule with the sheet, header and footer. */
  html: string;
  filename: string;
}

export interface ExportPdfOptions {
  /** The file name (document.pdf by default). */
  filename?: string;
  /**
   * Sends the print document to your server and returns the PDF: a Blob, bytes or a fetch Response.
   * On the server, headless Chrome: `await page.setContent(html); await page.pdf({ preferCSSPageSize: true })`
   * (a ready example: novaprose.com/guides/pages-and-printing/). Without it, the button opens the print dialog.
   */
  request?: (
    request: PdfRequest,
  ) =>
    | Promise<Blob | ArrayBuffer | Uint8Array | Response>
    | Blob
    | ArrayBuffer
    | Uint8Array
    | Response;
}

// A file with a "P" on it.
const icon = WORD_ICON('<path d="M10 18v-6h2.5a2 2 0 0 1 0 4H10"/>');

/** The server's answer as bytes. Anything that isn't a PDF (an error page, JSON) is an error. */
async function pdfBytes(answer: Blob | ArrayBuffer | Uint8Array | Response): Promise<Uint8Array> {
  let bytes: Uint8Array;
  if (typeof Response !== 'undefined' && answer instanceof Response) {
    if (!answer.ok) throw new Error(`the server answered ${answer.status}`);
    bytes = new Uint8Array(await answer.arrayBuffer());
  } else if (answer instanceof Uint8Array) bytes = answer;
  else if (answer instanceof ArrayBuffer) bytes = new Uint8Array(answer);
  else if (typeof Blob !== 'undefined' && answer instanceof Blob)
    bytes = new Uint8Array(await answer.arrayBuffer());
  else throw new Error('request() must return a Blob, bytes or a Response');
  const signature = String.fromCharCode(...bytes.subarray(0, 5));
  if (signature !== '%PDF-') throw new Error('the answer is not a PDF file');
  return bytes;
}

/** A safe file name ending in .pdf. */
export function pdfFilename(name: string | undefined): string {
  const safe = (name || 'document.pdf').replace(/[\\/:*?"<>|]/g, '_');
  return safe.toLowerCase().endsWith('.pdf') ? safe : `${safe}.pdf`;
}

export default definePlugin({
  name: 'exportpdf',
  toolbar: 'exportpdf',
  setup(editor) {
    const labels = pickLabels(editor, 'exportpdf', LABELS);
    const options = (editor.options.pluginOptions?.exportpdf ?? {}) as ExportPdfOptions;
    let running = false;
    const run = async () => {
      if (running) return;
      running = true;
      try {
        const printing = await import('../ui/print');
        if (typeof options.request !== 'function') {
          editor.ui.notify({ text: labels.saveAsPdf, type: 'info' });
          await printing.print(editor);
          return;
        }
        const filename = pdfFilename(options.filename);
        const notice = editor.ui.notify({ text: labels.working, type: 'info', timeout: 0 });
        try {
          const html = printing.printDocumentHtml(editor, filename.replace(/\.pdf$/i, ''));
          const bytes = await pdfBytes(await options.request({ html, filename }));
          download(bytes, filename, 'application/pdf');
        } finally {
          notice.close();
        }
      } catch (error) {
        console.error('[nova] exportpdf:', error);
        editor.ui.notify({ text: labels.failed, type: 'error' });
      } finally {
        running = false;
      }
    };
    editor.ui.registry.addButton('exportpdf', {
      icon,
      tooltip: labels.export,
      onAction: () => void run(),
    });
    editor.ui.registry.addMenuItem('exportpdf', {
      icon,
      text: labels.export,
      onAction: () => void run(),
    });
  },
});
