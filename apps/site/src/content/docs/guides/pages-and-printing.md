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

| Option        | Values                                                                                       |
| ------------- | -------------------------------------------------------------------------------------------- |
| `size`        | `'A4'` (default), `'A3'`, `'A5'`, `'A6'`, `'Letter'`, `'Legal'` or `{ width, height }` in mm |
| `orientation` | `'portrait'` or `'landscape'`                                                                |
| `margins`     | in mm: one number for all sides or `{ top, right, bottom, left }`; default 20                |

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

## Printing and PDF

**File → Print** (or `printContent(editor)`) prints what the editor shows: formulas, highlighted
code and your own [node views](/guides/node-views/) included, with your page's styles and the
editor's `contentStyle` / `contentCss`. With page layout on, the printout uses the same sheet and
margins, so pages break where the editor shows the lines. To get a PDF, choose **Save as PDF** in the
print dialog.

Parts of your node views that should not be printed (buttons, lists) can be hidden with
`@media print { … }` in your CSS.

### PDF on the server

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
    @page { size: 210mm 297mm; margin: 20mm; }
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
