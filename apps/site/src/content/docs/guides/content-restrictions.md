---
title: Content restrictions
description: Limit which elements and styles users can enter, like TinyMCE valid_elements.
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
  `<strong>`. Attribute lists in `[...]` are accepted but not enforced yet.
- Toolbar buttons and menu items for forbidden content are hidden automatically. To check from
  your own UI, call `editor.isAllowed('table')`.
- The rules work on the document model, so pasting crafted HTML cannot bypass them.

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
