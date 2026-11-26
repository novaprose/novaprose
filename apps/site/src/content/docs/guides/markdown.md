---
title: Markdown
description: Load Markdown into the editor and export the document as Markdown.
---

Markdown support is a separate import, `@novaprose/core/markdown` (about 46 KB gzip with the
parser), so editors that don't need it don't download it.

```ts
import { createEditor } from '@novaprose/core';
import { markdownToHTML, toMarkdown } from '@novaprose/core/markdown';

const editor = createEditor({ element });

editor.setContent(markdownToHTML('# Release notes\n\n* faster\n* safer'));
editor.insertContent(markdownToHTML('**Note:** see [docs](https://novaprose.com).'));

const markdown = toMarkdown(editor); // or toMarkdown(doc) for a ProseMirror node
```

## What is supported

CommonMark plus GitHub-style tables and `~~strikethrough~~`: headings, paragraphs, bold, italic,
inline code, links with titles, images, bulleted and numbered lists (with a start number), nested
lists, quotes, code blocks with a language, horizontal lines and line breaks.

`markdownToHTML(markdown, { linkify, breaks })`:

- `linkify` (default `true`) — turn `https://…` addresses into links;
- `breaks` (default `false`) — treat a single line break as `<br>`, as chat apps do.

## Export rules

- **Formatting Markdown can't express is dropped, the text is kept:** underline, colors, fonts,
  sub/superscript, page breaks. Merge tags become `{{key}}`, mentions become `@Name`.
- **Tables** become GitHub tables. The first row is the header row; a cell's paragraphs are joined
  with a space and `|` is escaped.
- **Stable output.** Exporting, importing and exporting again gives the same Markdown. This is
  checked by property-based tests on tens of thousands of random documents every night.
- An address that was **not** a link stays plain text on the way back (its punctuation is escaped,
  e.g. `example\.com`), so saving never turns text into links.

Known limitation: bold or italic directly next to punctuation, such as `**{text**`, may lose that
formatting on import under CommonMark's emphasis rules. The text itself is never lost.

## Security

Raw HTML inside Markdown is not interpreted — `<script>` arrives as visible text. The result goes
through the same schema as any other content, so `javascript:` links and unsafe images are dropped
exactly as for HTML.
