---
title: Pages and printing
description: Edit on a sheet of the real paper size, see where each page ends, and print or save a PDF that matches.
---

For documents that end up on paper — contracts, invoices, print forms — the editor can show the
text on a sheet of the real size with the real margins, mark where each page ends, and print with
exactly the same sheet.

## Page layout

```ts
createEditor({
  element,
  plugins: ['pagelayout', 'pagebreak'],
  pluginOptions: {
    pagelayout: { size: 'A4', orientation: 'portrait', margins: 20 },
  },
});
```

| Option               | Values                                                                                       |
| -------------------- | -------------------------------------------------------------------------------------------- |
| `size`               | `'A4'` (default), `'A3'`, `'A5'`, `'A6'`, `'Letter'`, `'Legal'` or `{ width, height }` in mm |
| `orientation`        | `'portrait'` or `'landscape'`                                                                |
| `margins`            | in mm: one number for all sides or `{ top, right, bottom, left }`; default 20                |
| `header`, `footer`   | text in the top and bottom margins: a string (centered) or `{ left, center, right }`         |
| `differentFirstPage` | `true` for a title page without header and footer                                            |

The text is laid out on a white sheet of that width, with the margins as padding, so lines wrap
exactly as they will on paper. A dashed line with the page number shows where each new page starts;
a page break (the [`pagebreak`](/guides/custom-buttons-and-plugins/#built-in-plugins) plugin) starts
a new page. The sheet stays white in the dark theme, like paper.

On a screen narrower than the sheet (phones), the sheet becomes a regular text field: lines wrap
differently there, so page lines are not shown.

### Changing the sheet and counting pages

```ts
import { pageLayout } from '@novaprose/core';

const pages = pageLayout(editor)!; // undefined without the pagelayout plugin
pages.set({ size: 'A5', margins: { top: 10, bottom: 15 } }); // the rest is kept
pages.onChange(() => console.log(pages.pages)); // e.g. warn when a one-page form overflows
```

`pages.layout` gives the current sheet in millimetres. `pages.pages` is the number of pages, or
`null` while it can't be counted (before the first measurement, or on a narrow screen).

### Headers, footers and page numbers

```ts
pluginOptions: {
  pagelayout: {
    size: 'A4',
    header: { left: 'ACME Ltd.', right: 'Contract No. 42' },
    footer: 'Page {page} of {pages}',
    differentFirstPage: true, // the title page has no header and footer
  },
},
```

`{page}` and `{pages}` become the page number and the number of pages. The text is plain, one line,
in small grey letters, in the middle of the margin, so leave a margin of at least 12 mm for it.
Change it later with `pageLayout(editor).set({ footer: … })`.

- **Printing** puts the header and footer on every page in Chrome and Edge. Firefox and Safari don't
  support CSS page margin boxes yet and print the pages without them.
- **PDF files** made by a headless Chrome (below) have them on every page.
- **Word files** from [`exportword`](/guides/word/) get a real Word header and footer; page numbers
  are Word fields, so they stay right when the document is edited in Word.
- **On screen** the sheet is one long page, so the editor shows the header in the top margin of the
  first page and the footer in the bottom margin of the last one, with their page numbers.

## Printing and PDF

**File → Print** (or `printContent(editor)`) prints what the editor shows: formulas, highlighted
code and your own [node views](/guides/node-views/) included, with your page's styles and the
editor's `contentStyle` / `contentCss`. With page layout on, the printout uses the same sheet and
margins, so pages break where the editor shows the lines. To get a PDF, choose **Save as PDF** in the
print dialog.

Parts of your node views that should not be printed (buttons, lists) can be hidden with
`@media print { … }` in your CSS.

### A PDF file from the button

The `exportpdf` plugin adds **Export to PDF** to the toolbar and the File menu. It sends your server
the same document the editor prints — the text, its styles, the sheet, the header and the footer —
as one HTML page, and downloads the PDF your server returns. Without `request` the button opens the
print dialog, where the user chooses **Save as PDF**.

```ts
createEditor({
  element,
  plugins: ['pagelayout', 'exportpdf'],
  pluginOptions: {
    pagelayout: { size: 'A4', footer: 'Page {page} of {pages}' },
    exportpdf: {
      filename: 'contract.pdf',
      // Return the PDF: a fetch Response, a Blob or bytes.
      request: ({ html, filename }) =>
        fetch('/api/pdf', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ html, filename }),
        }),
    },
  },
});
```

On the server a headless Chrome prints that page, for example with Node, Express and Playwright:

```ts
import express from 'express';
import { chromium } from 'playwright';

// Where the document's images, fonts and style sheets may come from.
const ALLOWED = ['https://your-site.example/'];
const browser = await chromium.launch();
const app = express();

app.post('/api/pdf', yourAuthentication, express.json({ limit: '20mb' }), async (req, res) => {
  // The HTML comes from a browser: no scripts, and no requests anywhere but your own addresses,
  // so it can't reach your internal network.
  const context = await browser.newContext({ javaScriptEnabled: false });
  await context.route('**/*', (route) => {
    const url = route.request().url();
    if (url.startsWith('data:') || ALLOWED.some((origin) => url.startsWith(origin)))
      return route.continue();
    return route.abort();
  });
  try {
    const page = await context.newPage();
    await page.setContent(String(req.body.html), { waitUntil: 'networkidle', timeout: 20_000 });
    const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
    res.type('application/pdf').send(pdf);
  } catch {
    res.status(500).end();
  } finally {
    await context.close();
  }
});
```

`preferCSSPageSize` takes the sheet from the document's `@page` rule, so the PDF has the editor's
pages, header and footer. Puppeteer works the same way (`page.setContent`, `page.pdf`).

### PDF on the server without the editor

To make PDFs without a person at the screen (emails, archives), render the saved document on the
server and print it with a headless browser. The page size and margins go into `@page`:

```ts
import { renderHTML } from '@novaprose/core';
import { chromium } from 'playwright';

const html = renderHTML(savedJson, { plugins: ['pagebreak'] });
const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent(`<!doctype html>
  <style>
    @page { size: 210mm 297mm; margin: 20mm;
      @bottom-center { content: "Page " counter(page) " of " counter(pages); } }
    body { font: 16px/1.6 system-ui, sans-serif; }
    .nova-pagebreak { break-after: page; }
  </style>
  ${html}`);
const pdf = await page.pdf({ preferCSSPageSize: true });
await browser.close();
```

Use the same fonts and styles as in the editor ([`contentCss`](/reference/options/)) to get the same
line breaks. See [Rendering on the server](/guides/server-rendering/) for the options that shape
the HTML.
