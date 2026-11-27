import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEditor, type Editor } from '../src';
import { exportDocx } from '../src/docx';
import { unzip } from '../src/docx/zip';
import { pdfFilename, type PdfRequest } from '../src/plugins/exportpdf';
import { fillBand, resolveBand, resolvePageLayout } from '../src/plugins/pagelayout';
import type * as Printing from '../src/ui/print';
import { marginBoxContent, print, printCss, printDocumentHtml } from '../src/ui/print';

/**
 * Headers, footers and page numbers of page mode: the settings, printing through CSS page margin boxes,
 * Word files, and the PDF export that sends the print document to your server.
 */

// The print dialog can't open in jsdom: print() is replaced, the rest of the module is real.
vi.mock('../src/ui/print', async (original) => ({
  ...(await original<typeof Printing>()),
  print: vi.fn(async () => {}),
}));

const editors: Editor[] = [];
afterEach(() => {
  for (const editor of editors.splice(0)) editor.destroy();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function mount(content: string, options: Record<string, unknown> = {}): Editor {
  const element = document.createElement('div');
  document.body.append(element);
  const editor = createEditor({ element, content, ...options });
  editors.push(editor);
  return editor;
}

const text = (bytes: Uint8Array | undefined) => new TextDecoder().decode(bytes);

function wellFormed(xml: string): void {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  expect(doc.getElementsByTagName('parsererror')).toHaveLength(0);
}

describe('header and footer settings', () => {
  it('a string is centered, parts go left, center and right, and garbage gives nothing', () => {
    expect(resolveBand('Report')).toEqual({ left: '', center: 'Report', right: '' });
    expect(resolveBand({ left: 'ACME', right: 'Page {page}' })).toEqual({
      left: 'ACME',
      center: '',
      right: 'Page {page}',
    });
    expect(resolveBand('  two\n lines  ')).toEqual({ left: '', center: 'two lines', right: '' });
    expect(resolveBand('x'.repeat(500))!.center).toHaveLength(200);
    for (const garbage of [undefined, null, 42, '', '   ', {}, { left: 7 }, ['a']])
      expect(resolveBand(garbage)).toBeNull();

    const layout = resolvePageLayout({ header: 'Report', differentFirstPage: true });
    expect(layout.header?.center).toBe('Report');
    expect(layout.footer).toBeNull();
    expect(layout.differentFirstPage).toBe(true);
    expect(resolvePageLayout({ differentFirstPage: 'yes' as never }).differentFirstPage).toBe(
      false,
    );
  });

  it('{page} and {pages} become numbers in the preview', () => {
    expect(fillBand('Page {page} of {pages}', 2, 5)).toBe('Page 2 of 5');
  });
});

describe('printing', () => {
  it('margin box content: text in quotes, page counters, and escapes that keep the text inside', () => {
    expect(marginBoxContent('Page {page} of {pages}')).toBe(
      '"Page " counter(page) " of " counter(pages)',
    );
    expect(marginBoxContent('{page}')).toBe('counter(page)');
    expect(marginBoxContent('He said "hi" \\ </style>')).toBe(
      '"He said \\22 hi\\22  \\5c  \\3c /style\\3e "',
    );
  });

  it('the @page rule carries the header and footer; with a title page the first page has none', () => {
    const css = printCss(
      resolvePageLayout({
        header: { left: 'ACME', right: 'Contract 42' },
        footer: 'Page {page} of {pages}',
        differentFirstPage: true,
      }),
    );
    expect(css).toContain('@top-left { content: "ACME";');
    expect(css).toContain('@top-right { content: "Contract 42";');
    expect(css).toContain('@bottom-center { content: "Page " counter(page) " of " counter(pages);');
    expect(css).not.toMatch(/@top-center \{ content: "/);
    expect(css).toMatch(/@page :first \{[^]*@top-left \{ content: none; \}/);

    expect(printCss(resolvePageLayout({}))).not.toMatch(/@(top|bottom)-/);
    expect(printCss(undefined)).toContain('@page { margin: 20mm; }');
  });

  it('the print document as one HTML page for a PDF server: <base>, the text and the @page rule', async () => {
    const editor = mount('<p>Hello</p>', {
      plugins: ['pagelayout'],
      pluginOptions: { pagelayout: { footer: 'Page {page}' } },
    });
    await editor.ready;
    const html = printDocumentHtml(editor, 'Report');
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain(`<base href="${document.baseURI}">`);
    expect(html).toContain('<title>Report</title>');
    expect(html).toContain('<p>Hello</p>');
    expect(html).toContain('@bottom-center { content: "Page " counter(page);');
  });
});

describe('Word', () => {
  it('header and footer parts with PAGE and NUMPAGES fields; a title page without them', async () => {
    const editor = mount('<p>Hello</p>', {
      plugins: ['pagelayout'],
      pluginOptions: {
        pagelayout: {
          header: 'Report',
          footer: { right: 'Page {page} of {pages}' },
          differentFirstPage: true,
        },
      },
    });
    await editor.ready;
    const files = await unzip(await exportDocx(editor));
    const documentXml = text(files.get('word/document.xml'));
    expect(documentXml).toMatch(
      /<w:sectPr><w:headerReference w:type="default" r:id="rId\d+"\/><w:footerReference w:type="default" r:id="rId\d+"\/><w:pgSz /,
    );
    expect(documentXml).toContain('<w:titlePg/></w:sectPr>');
    const rels = text(files.get('word/_rels/document.xml.rels'));
    expect(rels).toMatch(/Type="[^"]+\/header" Target="header1\.xml"/);
    expect(rels).toMatch(/Type="[^"]+\/footer" Target="footer1\.xml"/);
    const types = text(files.get('[Content_Types].xml'));
    expect(types).toContain(
      '<Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>',
    );
    expect(types).toContain(
      '<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>',
    );
    const header = text(files.get('word/header1.xml'));
    expect(header).toContain('<w:t xml:space="preserve">Report</w:t>');
    const footer = text(files.get('word/footer1.xml'));
    expect(footer).toContain('<w:fldSimple w:instr=" PAGE ">');
    expect(footer).toContain('<w:fldSimple w:instr=" NUMPAGES ">');
    for (const xml of [documentXml, header, footer, rels, types]) wellFormed(xml);
  });

  it('without a header and footer the file has neither', async () => {
    const editor = mount('<p>Hello</p>', { plugins: ['pagelayout'] });
    await editor.ready;
    const files = await unzip(await exportDocx(editor));
    expect(files.has('word/header1.xml')).toBe(false);
    expect(text(files.get('word/document.xml'))).not.toContain('headerReference');
  });
});

describe('the exportpdf plugin', () => {
  function stubDownloads() {
    const blobs: Blob[] = [];
    vi.stubGlobal(
      'URL',
      Object.assign(URL, {
        createObjectURL: (blob: Blob) => (blobs.push(blob), 'blob:test'),
        revokeObjectURL: () => {},
      }),
    );
    const names: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      names.push(this.download);
    });
    return { blobs, names };
  }

  const press = (editor: Editor) => {
    const button = editor.ui.registry.get('exportpdf');
    if (button?.type !== 'button') throw new Error('no exportpdf button');
    button.onAction(editor);
  };

  it('sends the print document to your server and downloads the PDF it returns', async () => {
    const requests: PdfRequest[] = [];
    const editor = mount('<p>Hello</p>', {
      plugins: ['pagelayout', 'exportpdf'],
      pluginOptions: {
        pagelayout: { footer: 'Page {page}' },
        exportpdf: {
          filename: 'report',
          request: async (request: PdfRequest) => {
            requests.push(request);
            return new Blob(['%PDF-1.7\n%test'], { type: 'application/pdf' });
          },
        },
      },
    });
    await editor.ready;
    const { blobs, names } = stubDownloads();
    press(editor);
    await vi.waitFor(() => expect(names).toEqual(['report.pdf']));
    expect(requests).toHaveLength(1);
    expect(requests[0]!.filename).toBe('report.pdf');
    expect(requests[0]!.html).toContain('@bottom-center { content: "Page " counter(page);');
    expect(blobs[0]!.type).toBe('application/pdf');
  });

  it('an answer that is not a PDF is an error: nothing is downloaded and the user is told', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const editor = mount('<p>Hello</p>', {
      plugins: ['exportpdf'],
      pluginOptions: {
        exportpdf: { request: async () => new Response('{"error":"quota"}', { status: 200 }) },
      },
    });
    await editor.ready;
    const { names } = stubDownloads();
    press(editor);
    await vi.waitFor(() =>
      expect(editor.root.querySelector('.nova-notifications')?.textContent).toContain(
        'Could not create the PDF file',
      ),
    );
    expect(names).toEqual([]);
  });

  it('without a server the button opens the print dialog and says to choose "Save as PDF"', async () => {
    const editor = mount('<p>Hello</p>', { plugins: ['exportpdf'] });
    await editor.ready;
    press(editor);
    await vi.waitFor(() => expect(print).toHaveBeenCalledWith(editor));
    expect(editor.root.querySelector('.nova-notifications')?.textContent).toContain('Save as PDF');
  });

  it('file names are safe and end in .pdf', () => {
    expect(pdfFilename(undefined)).toBe('document.pdf');
    expect(pdfFilename('report')).toBe('report.pdf');
    expect(pdfFilename('a/b:c')).toBe('a_b_c.pdf');
    expect(pdfFilename('Q3.PDF')).toBe('Q3.PDF');
  });
});
