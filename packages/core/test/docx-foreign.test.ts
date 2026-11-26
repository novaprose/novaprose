// @vitest-environment node
import {
  AlignmentType,
  Document,
  ExternalHyperlink,
  HeadingLevel,
  ImageRun,
  LevelFormat,
  Packer,
  PageOrientation,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalMergeType,
  WidthType,
} from 'docx';
import { describe, expect, it } from 'vitest';
import { fromDocx } from '../src/docx';

/**
 * Importing a file we didn't write: the docx library (Word and LibreOffice open its files).
 * Our own export and import could be wrong in the same way: here the author is independent.
 */

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAYAAAD0In+KAAAAEUlEQVR42mP8z8Dwn4EIwAgAJ/4D/c4Z6xcAAAAASUVORK5CYII=',
  'base64',
);

describe("importing another program's file (the docx library)", () => {
  it('headings, formatting, links, lists, a table, an image, the sheet', async () => {
    const doc = new Document({
      numbering: {
        config: [
          {
            reference: 'steps',
            levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', start: 1 }],
          },
        ],
      },
      sections: [
        {
          properties: {
            page: {
              size: { width: 11906, height: 8391, orientation: PageOrientation.LANDSCAPE },
              margin: { top: 567, right: 567, bottom: 567, left: 567 },
            },
          },
          children: [
            new Paragraph({ text: 'Quarterly report', heading: HeadingLevel.HEADING_1 }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({ text: 'Bold', bold: true }),
                new TextRun(' and '),
                new TextRun({ text: 'italic', italics: true }),
                new TextRun({ text: ' red', color: 'FF0000' }),
                new TextRun(' see '),
                new ExternalHyperlink({
                  link: 'https://novaprose.com',
                  children: [new TextRun({ text: 'site', style: 'Hyperlink' })],
                }),
              ],
            }),
            new Paragraph({ text: 'Point', bullet: { level: 0 } }),
            new Paragraph({ text: 'Sub-point', bullet: { level: 1 } }),
            new Paragraph({ text: 'First', numbering: { reference: 'steps', level: 0 } }),
            new Paragraph({ text: 'Second', numbering: { reference: 'steps', level: 0 } }),
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [
                new TableRow({
                  children: [
                    new TableCell({
                      children: [new Paragraph('A')],
                      verticalMerge: VerticalMergeType.RESTART,
                    }),
                    new TableCell({ children: [new Paragraph('B')] }),
                  ],
                }),
                new TableRow({
                  children: [
                    new TableCell({
                      children: [new Paragraph('')],
                      verticalMerge: VerticalMergeType.CONTINUE,
                    }),
                    new TableCell({ children: [new Paragraph('C')] }),
                  ],
                }),
                new TableRow({
                  children: [new TableCell({ children: [new Paragraph('Wide')], columnSpan: 2 })],
                }),
              ],
            }),
            new Paragraph({
              children: [
                new ImageRun({ type: 'png', data: PNG, transformation: { width: 40, height: 20 } }),
              ],
            }),
          ],
        },
      ],
    });
    const result = await fromDocx(new Uint8Array(await Packer.toBuffer(doc)));
    const { html } = result;
    expect(html).toContain('>Quarterly report</h1>');
    expect(html).toMatch(
      /<p style="text-align: center"><strong>Bold<\/strong> and <em>italic<\/em><span style="color: #ff0000"> red<\/span> see <a href="https:\/\/novaprose.com">site<\/a><\/p>/,
    );
    expect(html).toMatch(/<ul><li><p>Point<\/p><ul><li><p>Sub-point<\/p><\/li><\/ul><\/li><\/ul>/);
    expect(html).toContain('<ol><li><p>First</p></li><li><p>Second</p></li></ol>');
    expect(html).toMatch(/<td rowspan="2"[^>]*><p>A<\/p><\/td>/);
    expect(html).toMatch(/<td colspan="2"[^>]*><p>Wide<\/p><\/td>/);
    expect(html).toMatch(
      /<img src="data:image\/png;base64,[^"]+" alt="[^"]*" width="40" height="20">/,
    );
    expect(result.page).toEqual({
      size: 'A5',
      orientation: 'landscape',
      margins: { top: 10, right: 10, bottom: 10, left: 10 },
    });
  });
});

describe('a file saved by Microsoft Word itself', () => {
  /**
   * test/fixtures/docx/saved-by-word.docx is our export, opened and saved again by Word: its own
   * XML (styles, numbering, rsid, theme). The file properties (author) were removed from the archive,
   * and the text runs were later translated to English; Word's markup around them is untouched.
   */
  it('everything is in place: headings, formatting, links, lists, a table, revisions, the sheet', async () => {
    const { readFileSync } = await import('node:fs');
    const { fileURLToPath } = await import('node:url');
    const file = fileURLToPath(new URL('./fixtures/docx/saved-by-word.docx', import.meta.url));
    const { html, page, warnings } = await fromDocx(new Uint8Array(readFileSync(file)));
    expect(html).toContain('<h1 id="top">Word export check</h1>');
    expect(html).toContain(
      '<strong>bold</strong>, <em>italic</em>, <u>underlined</u>, <s>struck</s>',
    );
    expect(html).toContain('<span style="color: #e03e2d">red</span>');
    expect(html).toContain('<code>code</code>');
    expect(html).toContain(
      '<p style="text-align: center">A link to <a href="https://novaprose.com">the site</a> and <a href="#top">the top</a>.</p>',
    );
    expect(html).toContain(
      '<ul><li><p>Item</p><ul><li><p>Nested</p></li></ul></li><li><p>Second</p></li></ul>',
    );
    expect(html).toContain('<ol start="3"><li><p>Third</p></li><li><p>Fourth</p></li></ol>');
    expect(html).toContain(
      '<ul data-type="checklist"><li data-checked="true"><p>Done</p></li><li data-checked="false"><p>Not done</p></li></ul>',
    );
    expect(html).toMatch(/<td rowspan="2"[^>]*background-color: #dafbe1[^>]*><p>Merged<\/p><\/td>/);
    expect(html).toContain('<blockquote><p>Quote</p></blockquote>');
    expect(html).toContain('<hr>');
    // Revisions are accepted: the insertion stays, the deletion is gone.
    expect(html).toContain(
      'Edit: added and a formula <span data-type="inline-math" data-latex="E=mc^2">',
    );
    expect(html).not.toContain('deleted');
    expect(html).toContain(
      '<div class="nova-pagebreak" style="break-after: page;"></div><h2>Second page</h2>',
    );
    expect(html).not.toContain('<p></p>');
    expect(page).toEqual({
      size: 'A5',
      orientation: 'landscape',
      margins: { top: 12, right: 12, bottom: 12, left: 12 },
    });
    expect(warnings).toEqual([]);
  });
});
