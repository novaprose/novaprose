---
title: Pasting from Word, Google Docs and Excel
description: How NovaProse cleans up content pasted from office apps, and how to control it.
---

Users paste from Word, Google Docs and spreadsheets all the time. Office apps put a lot of
internal markup on the clipboard: conditional comments, `mso-*` styles, fake lists built from
indented paragraphs, styles hidden in CSS classes. NovaProse recognizes the source and turns it
into clean HTML — built in and free, no extra plugin.

| Source                 | What you get                                                                                                                                               |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Word for Windows / Mac | real nested `<ul>`/`<ol>` lists (including numbering that starts at 3), headings, tables with merged cells and shading, highlights, links, sub/superscript |
| Word for the web       | lists split into separate blocks are merged back with correct nesting; no stray non-breaking spaces                                                        |
| Google Docs            | headings, bold/italic from styles, nested lists, tables with cell colors, links without the `google.com/url?q=` redirect                                   |
| Excel, Google Sheets   | tables with bold headers, cell colors and right-aligned numbers                                                                                            |
| LibreOffice, web pages | same cleanup of styles and structure                                                                                                                       |

Copying and pasting **inside** the editor is never cleaned, so all formatting is kept.

## Clean or keep styles

By default (`pasteStyles: 'clean'`) NovaProse keeps everything that carries meaning — bold,
italic, underline, strikethrough, colors, highlights, alignment, lists, tables, links — and drops
the source document's look: font family, font size, line spacing, margins, and the default black
text color. Pasted text then looks like the rest of your page.

To keep fonts and sizes as well:

```ts
createEditor({ element, pasteStyles: 'keep' });
```

Pasting into an empty paragraph keeps the first pasted paragraph as it was (for example a centered
title stays centered). Pasting into the middle of text continues the current paragraph, as in
Word.

## Custom processing

`pastePreprocess` receives the raw clipboard HTML before cleanup; `pastePostprocess` receives the
cleaned DOM right before it enters the document:

```ts
createEditor({
  element,
  pastePreprocess: (html) => html.replaceAll('Confidential', ''),
  pastePostprocess: (root) =>
    root.querySelectorAll('table').forEach((t) => t.classList.add('pasted')),
});
```

Whatever you return still goes through the document schema and the URL allowlist, so the hooks
can't introduce unsafe content.

## Images from Word

Word for Windows and Mac refers to images in its clipboard HTML by local `file:///` paths, which
browsers can't load. NovaProse reads the images from the RTF part of the same clipboard (PNG and
JPEG) and inserts them in their place. Vector images (WMF/EMF) can't be displayed by browsers and
are skipped.

With [`uploadImage`](/guides/images/) configured, pasted and dropped images that arrive embedded
(Word, other apps, web pages with `data:` images) are uploaded to your server automatically and
replaced with the returned URL. If the upload fails, the image stays embedded and the user sees a
notification — nothing is lost.

## Known limits

- Footnotes are kept as their reference text (for example `[1]`); the footnote text itself is not
  pasted.
- Numbered headings keep their number as text.
- Images are matched by order; if Word's HTML and RTF contain a different number of images, they
  are skipped rather than guessed.

If you have a document that doesn't paste well, send it to **hello@novaprose.com** — real-world
samples become part of our test suite.

## Loading

The Office cleanup is a separate chunk that loads in the background as soon as the editor is
created. A paste from the clipboard in the first milliseconds simply waits for it. If you paste
**programmatically** (`editor.view.pasteHTML(...)`) right after creating the editor, wait for
`await editor.ready` first.
