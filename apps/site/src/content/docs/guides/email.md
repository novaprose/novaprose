---
title: Email
description: Turn the editor's content into email HTML that looks the same in Gmail, Outlook and Apple Mail — styles inline, markup email clients understand, a preview and a size check.
---

Email clients ignore much of what a web page relies on: Gmail and Outlook drop or ignore style
sheets, and Outlook draws with Word's engine. `@novaprose/core/email` turns the editor's content into
HTML they show the way the editor does:

- **Styles inline.** The editor's look (built-in email styles) and your content styles
  (`contentCss`, `contentStyle`) go into each element's `style` attribute, with the cascade a browser
  uses: specificity, order, `!important` and the element's own style decide which value wins.
- **Markup email clients understand.** A video becomes a link to its page, a collapsible block is
  shown open, checklist items get ☑ and ☐, relative links and images become absolute.
- **A whole email, if you want one.** A doctype and a centered column that Outlook keeps too,
  preview text for the inbox, and your `@media` rules in the head for the clients that read them.

Template tags such as `{{first_name}}` and `{{unsubscribe_url}}` stay as they are, for your email
service to replace — see [Merge tags](/guides/merge-tags/).

## Email preview

With the `email` plugin, the **Email preview** button (`emailpreview`) shows the content as an
email client will, on a desktop or a phone screen, with its size: Gmail cuts off emails over 102 KB,
and the preview warns when this one is larger. **Copy the email** copies it to paste into a mail
client with its formatting; **Copy the HTML code** copies the whole email for an email service.

```ts
createEditor({
  element,
  plugins: ['email', 'mergetags'],
  toolbar: 'undo redo | bold italic link | mergetags | emailpreview',
  pluginOptions: {
    email: {
      css: 'a { color: #7c3aed; }',
      document: { width: 600, preheader: 'This month at Acme' },
    },
  },
});
```

The preview shows the email in a sandboxed frame: scripts can't run in it, and it can't reach the
page.

## In your code

```ts
import { emailHTML } from '@novaprose/core/email';

const html = await emailHTML(editor, {
  document: { title: 'Product news', preheader: 'What’s new this month' },
});
await fetch('/api/send', { method: 'POST', body: JSON.stringify({ html }) });
```

Without `document`, `emailHTML` returns the content alone, for a mail composer or your own email
template. `pluginOptions.email` holds the defaults for both the preview and `emailHTML`.

On a server, `toEmailHTML` turns stored content into email HTML with a DOM such as
[jsdom](https://github.com/jsdom/jsdom):

```ts
import { createRenderer } from '@novaprose/core';
import { toEmailHTML } from '@novaprose/core/email';
import { JSDOM } from 'jsdom';

globalThis.DOMParser = new JSDOM('').window.DOMParser;

const html = toEmailHTML(createRenderer().html(savedJson), {
  css: brandCss,
  baseUrl: 'https://example.com/',
  document: { title: 'Product news' },
});
```

| Option           | Description                                                                                                                             |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `css`            | more CSS to put inline, after the editor's content styles                                                                               |
| `baseStyles`     | the built-in email styles — fonts, tables with borders, quotes, code, images that fit; `true` by default, and your styles override them |
| `selectorFilter` | which selectors are put inline: a substring, a `RegExp` or a function                                                                   |
| `fileFilter`     | which `contentCss` files are read, by their address                                                                                     |
| `baseUrl`        | relative links and images become absolute against it; the page's address by default                                                     |
| `document`       | `true`, or `{ title, preheader, width, background, contentBackground, lang, dir }`: a whole email instead of the content alone          |

## What goes inline

- Structural selectors work (`li:first-child`, `td > :last-child`); states and pseudo-elements
  (`:hover`, `::before`) don't exist in an email and are skipped.
- `body`, `html` and `:root` rules style the email's wrapper, or with `document` its column.
- Custom properties (`var(--brand)`) are replaced by their values: email clients don't know them.
- `@media` and `@font-face` can't go inline: in a whole email they go to its head, for the clients
  that read it.

## What changes for email clients

| In the editor                    | In the email                          |
| -------------------------------- | ------------------------------------- |
| a video (YouTube, Vimeo, a file) | a link to its page                    |
| a collapsible block              | shown open, its title in bold         |
| a checklist                      | ☑ and ☐ before the items              |
| a formula                        | its TeX                               |
| a page break                     | removed                               |
| relative links and images        | absolute                              |
| an image with a width in pixels  | also a `width` attribute, for Outlook |

Accept or reject [suggested edits](/guides/suggested-edits/) before sending: otherwise the email
shows them as inserted and deleted text.

## Coming from TinyMCE

With `tinymce.init()`, `plugins: 'inlinecss'` works: `editor.plugins.inlinecss.getContent()`
resolves to `{ html }`, the content with its styles inline, and fires the `InlineCSS` event.
`inlinecss_selector_filter` and `inlinecss_file_filter` filter what goes inline. Rules from
`content_css` and `content_style` apply, `content_style` last; `!important` and the specificity of
selectors count as in a browser, and the built-in email styles apply under yours. Add
`emailpreview` to the toolbar for the preview.
