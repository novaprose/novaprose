---
title: Whole HTML pages
description: Edit a whole HTML document with the fullpagehtml plugin. Its title, meta tags, style sheets, doctype and body attributes are kept, and Document properties edits them.
---

The editor usually holds the content of a page: what goes inside `<body>`. With the `fullpagehtml`
plugin it holds a whole HTML document: the doctype, the `<head>` with its title, meta tags and style
sheets, and the attributes of `<html>` and `<body>` are kept around the content. Use it for
newsletters, landing pages and any HTML file your users edit as a whole.

```ts
createEditor({ element, plugins: ['fullpagehtml'], content: savedPage });
```

`getHTML()` then gives the whole page (laid out here for reading):

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Spring newsletter</title>
    <meta name="description" content="What is new this spring" />
    <style>
      h1 {
        color: #333333;
      }
    </style>
  </head>
  <body style="background-color: #fafafa; color: #222222">
    <h1>Hello</h1>
    <p>Text</p>
  </body>
</html>
```

## Reading and writing

- `setContent(html)` with a whole page (a doctype, `<html>`, `<head>` or `<body>`) replaces the page
  too. HTML that is only content keeps the page as it is.
- `getHTML({ fullPage: false })` and `setContent(html, { fullPage: false })` work with the content
  only: the head stays.
- The page is part of the document: `getJSON()` keeps it, undo brings back the previous one, and the
  [server renderer](/guides/server-rendering/) writes the same page from JSON with
  `createRenderer({ plugins: ['fullpagehtml'] })`. Its `html(json, { fullPage: false })` gives only
  the content.
- The **Source code** view shows the whole page and takes it back; `hideInSourceView: true` shows
  only the content.

## Document properties

The **Document properties** button, also in the **File** menu, edits what the head says about the
page:

| Tab                 | Field              | In the page                                                       |
| ------------------- | ------------------ | ----------------------------------------------------------------- |
| About the page      | Title              | `<title>`                                                         |
|                     | Description        | `<meta name="description">`                                       |
|                     | Keywords           | `<meta name="keywords">`                                          |
|                     | Author             | `<meta name="author">`                                            |
| Language and search | Language           | `lang` on `<html>`: screen readers read the page in this language |
|                     | Search engines     | `<meta name="robots">` with `noindex`, `nofollow` or both         |
|                     | Character encoding | `<meta charset>`                                                  |

A change is one undo step, and the rest of the head (style sheets, other meta tags) stays as it is.

## Settings

```ts
pluginOptions: {
  fullpagehtml: {
    title: 'Untitled',
    encoding: 'UTF-8',
    bodyStyle: 'font-family: Georgia, serif; color: #222222',
  },
}
```

| Option             | Meaning                                                                 |
| ------------------ | ----------------------------------------------------------------------- |
| `doctype`          | the doctype of a page that has none (`<!DOCTYPE html>`)                 |
| `title`            | the title of a page that has none                                       |
| `encoding`         | the encoding a page declares when it declares none, as `<meta charset>` |
| `bodyStyle`        | the body's style for a page whose body has none                         |
| `hideInSourceView` | the Source code view shows only the content                             |

The settings fill in what a page doesn't say; they never change what it does say.

## What is kept, and what isn't

The page is checked when it is read, when a document arrives as JSON, and every time it is written.

Kept:

- the doctype (HTML5, HTML 4 and XHTML ones), and `lang`, `dir` and the XHTML namespace on `<html>`;
- `<title>`; `<meta>` with a charset, or with a name or property and its content;
- `<link>` to style sheets, icons, and alternate or canonical pages, over `http(s)` or a relative
  address; `<style>`;
- on `<body>`: `class`, `dir`, `lang`, and a style of colors, fonts, sizes and spacing. On old pages,
  `bgcolor` and `text` become that style.

Never kept: scripts, `<noscript>`, `<base>`, a `<meta>` that refreshes the page or sets a cookie,
event handlers (`onload`), `javascript:` and `data:` addresses, comments (Outlook's conditional ones
too) and anything else in the head.

Style sheets are kept as written, and nothing in one can close its `<style>` element. They aren't
applied in the editor, which shows the content in its own style. If people you don't trust write
the pages, keep in mind that their style sheets style the whole page wherever you show it: show such
pages in a sandboxed frame or on a domain of their own.

## With other plugins

- [Suggested edits](/guides/suggested-edits/): in suggesting mode Document properties can't change
  the page, since a change to the head can't be a suggestion. Loading a page with `setContent` works
  as always.
- [Collaboration](/guides/collaboration/): the head isn't shared between participants yet; it stays
  with the editor that loaded it. Keep the head on your server and the content in the shared
  document.
- Email: `emailHTML()` and **Email preview** take the content and build their own email around it.
- Word and Markdown export the content.

## Coming from TinyMCE

`plugins: 'fullpagehtml'` with `tinymce.init()` works: `getContent()` and `setContent()` give and
take the whole page, and `{ fullpagehtml: false }` only the body's content.
`fullpagehtml_default_doctype`, `fullpagehtml_default_title`, `fullpagehtml_default_encoding`,
`fullpagehtml_default_body_style` and `fullpagehtml_hide_in_source_view` map to the settings above,
and `mceFullPageHtmlProperties` opens Document properties.
