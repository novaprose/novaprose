---
title: Word documents
description: Open .docx files in the editor and save documents as .docx — in the browser or on your server, without a conversion service.
---

The editor opens and saves Word documents (`.docx`) by itself: no conversion service, no upload
of the document anywhere. The same code runs on your server.

## Buttons

```ts
createEditor({
  element,
  plugins: ['importword', 'exportword'],
  pluginOptions: {
    exportword: { filename: 'contract.docx' },
  },
});
```

**Import from Word** (`importword`) opens a file and replaces the document with it — Ctrl+Z brings
the previous content back. **Export to Word** (`exportword`) downloads the document as a `.docx`.
Both are also added to the **File** menu.

| Plugin       | Option     | Description                                                        |
| ------------ | ---------- | ------------------------------------------------------------------ |
| `exportword` | `filename` | name of the downloaded file, `document.docx` by default            |
|              | `font`     | text font in Word, `Calibri` by default                            |
|              | `fontSize` | text size in points, `12` by default (as 16px in the editor)       |
| `importword` | `mode`     | `'replace'` (default) or `'insert'` — insert at the cursor instead |

With [page layout](/guides/pages-and-printing/) on, the sheet size and margins go both ways: the
exported document has the editor's sheet, and an imported document sets the editor's sheet to its
own. The page layout's [header and footer](/guides/pages-and-printing/#headers-footers-and-page-numbers)
go into the exported file as a Word header and footer, with page numbers as Word fields.

## From code

```ts
import { exportDocx, importDocx } from '@novaprose/core/docx';

const bytes = await exportDocx(editor); // Uint8Array of the .docx file
await importDocx(editor, file); // a File from <input type="file">, a Blob or bytes
```

The module (`@novaprose/core/docx`) is a separate import of about 10 KB gzip, loaded by the buttons
only when used.

## On the server

Export works from the saved JSON, import returns HTML — both without a DOM, in Node 18+:

```ts
import { exportDocx, fromDocx } from '@novaprose/core/docx';

const docx = await exportDocx(savedJson, {
  plugins: ['mentions'], // the editor's options that shape the document
  page: { size: 'A4', margins: 20 }, // sheet and margins, mm
  title: 'Contract',
});

const { html, page, warnings } = await fromDocx(uploadedBytes);
```

## What is converted

| In the editor                                                                               | In Word                                                            |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| headings, paragraphs, alignment, indents, line height                                       | headings (Heading 1–6 styles), paragraphs with the same formatting |
| bold, italic, underline, strikethrough, sub/superscript, color, highlight, font, size, code | the same character formatting                                      |
| links, links to headings                                                                    | hyperlinks, bookmarks                                              |
| bulleted and numbered lists, nesting, start number                                          | Word lists (real numbering, not typed numbers)                     |
| tables: merged cells, fill, column widths, header row                                       | Word tables with merged cells; the header repeats on each page     |
| images                                                                                      | pictures in the text (PNG, JPEG, GIF)                              |
| quotes, code blocks, horizontal lines, page breaks                                          | Quote and Code styles, a bottom border line, page breaks           |
| [suggested edits](/guides/suggested-edits/)                                                 | tracked changes, with author and date, both ways                   |
| page layout: sheet and margins                                                              | page setup                                                         |
| page layout: header, footer, `{page}` and `{pages}`                                         | header and footer with PAGE and NUMPAGES fields                    |

Imported documents bring the same back, plus footnotes (at the end of the document) and links
made with Word's HYPERLINK field. Tracked changes in an imported document become suggested edits,
with Word's author names and dates, when the editor has the `suggestions` plugin; otherwise they
are accepted. On the server, `fromDocx(bytes, { revisions: 'suggestions' })` keeps them.

## Limitations

- **Formulas** are exported as their LaTeX source; equations made in Word are imported as plain
  text.
- **Images from other sites** must allow cross-origin requests (CORS) to get into the exported file;
  otherwise their description is written instead. SVG and WebP images are not exported.
- Comments, headers and footers, text boxes and embedded objects are not converted yet.
- A checklist becomes ☐/☒ lines in Word (Word has no checklists in `.docx` without add-ins);
  importing such a file makes a checklist again.

The export is checked by opening the file in Microsoft Word, and the import by reading files that
Word itself saved.
