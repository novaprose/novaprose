---
title: Content restrictions
description: Limit which elements, attributes and styles users can enter, or keep your own markup — like TinyMCE valid_elements and extended_valid_elements.
---

Restrict content to what your product can display. The rules apply everywhere: typing, keyboard
shortcuts, paste, drag-and-drop and `setContent()`.

```ts
createEditor({
  element,
  // Allow only these elements:
  validElements: 'p,strong/b,em/i,a[href],ul,ol,li',
  // …or allow everything except these:
  invalidElements: 'img,table,h1',
  // Allowed CSS properties, globally or per element:
  validStyles: 'color,text-align',
  // validStyles: { '*': 'color', img: 'float' },
});
```

- `validElements` uses the familiar TinyMCE syntax: `strong/b` means that `<b>` is converted to
  `<strong>`.
- Toolbar buttons and menu items for forbidden content are hidden automatically. To check from
  your own UI, call `editor.isAllowed('table')`.
- The rules work on the document model, so pasting crafted HTML cannot bypass them.

## Attributes and your own markup

Content from another system often carries markup the editor doesn't create itself: heading ids for a
table of contents, `data-*` attributes, callout `<div class="…">` blocks, icon fonts
(`<i class="fa fa-star"></i>`), `<abbr>`, or your own custom elements. By default the editor drops
what it doesn't know. Rules for elements and attributes keep it — or restrict attributes further.

They are a separate import (about 3 KB gzip), so the editor stays small for everyone else:

```ts
import { createEditor, registerHtmlRules } from '@novaprose/core';
import { htmlRules } from '@novaprose/core/html-rules';

registerHtmlRules(htmlRules); // once per page

createEditor({
  element,
  // Keep extra elements and attributes:
  extendedValidElements: 'h2[id],h3[id],div[class],i[class],abbr[title],a[href|rel|data-*]',
  // Your own elements: block by default, ~ for inline (like <span>):
  customElements: 'product-card,~user-chip',
});
```

With rules registered, an attribute list in `[...]` is the complete list for that element:

| Rule                     | Meaning                                                                |
| ------------------------ | ---------------------------------------------------------------------- |
| `a[href\|title]`         | links keep only `href` and `title` (`target`, classes are removed)     |
| `h2[id]`                 | headings keep their `id` (in `extendedValidElements`)                  |
| `@[id\|lang]`            | attributes allowed on every element                                    |
| `div[data-*]`            | any attribute starting with `data-`; `*` alone means any attribute     |
| `a[href\|target:_blank]` | always this value (all links open in a new tab, with `rel="noopener"`) |
| `img[src\|alt=]`         | default value when the attribute is missing                            |
| `ol[type<1?a?i]`         | only one of these values                                               |
| `abbr[!title]`           | required: without it the element is not kept (its text stays)          |

- An element listed **without** `[...]` keeps its standard attributes. `href` on links, `src` on
  images and `colspan`/`rowspan` on table cells are always kept.
- A rule in `extendedValidElements` replaces the element's attribute list, and adds the element to
  `validElements` if you use both.
- Classes on standard elements follow `validClasses`. If you allow `class` on a standard element (for
  example `p[class]`) and don't set `validClasses`, all classes are kept.
- `<div>`, `<section>`, `<details>` and other blocks keep their content: text directly inside stays
  text, paragraphs and lists inside stay as they are. Empty inline elements such as icons are kept as
  a single unit you can delete but not type into.
- `<i>`, `<b>`, `<span>` and `<mark>` become separate elements only when they carry allowed
  attributes: `i[class]` keeps `<i class="fa fa-star"></i>`, while a plain `<i>` is still italic.
- Markdown export keeps the text of these elements.

### Security

Rules can't make content unsafe. `<script>`, `<iframe>`, `<style>`, forms, `<svg>` and similar
elements are never allowed (a console warning names the rule; for video use the `media` plugin). Event
handlers (`onclick`…), `srcdoc`, `formaction` and `contenteditable` are never kept, even with `*`.
Links and image sources are checked, and unsafe CSS is dropped. This applies to HTML and to JSON
documents loaded with `setContent()`. Property-based tests check it on thousands of generated
documents with every rule set to "allow everything".

## Paste hooks

```ts
createEditor({
  element,
  // Change the pasted HTML string before it is parsed:
  pastePreprocess: (html) => html.replaceAll('&nbsp;', ' '),
  // Change the parsed DOM before it enters the document:
  pastePostprocess: (fragment) => {
    fragment.querySelectorAll('[data-tracking]').forEach((node) => node.remove());
  },
  // Paste plain text only (users can toggle it with the `pastetext` control):
  pasteAsText: false,
});
```
