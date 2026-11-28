---
title: Editing the HTML
description: The Source code dialog, and the advcode plugin's code editor with colors, search, folding and full screen.
---

The **Source code** button (`code`) opens the document's HTML for editing. Saving reads it back
through the editor's schema, with the same cleanup and checks as any HTML the editor loads, so the
dialog can't put a script or a `javascript:` link into the document. With the `fullpagehtml` plugin
it shows the [whole page](/guides/full-page/), its head included.

## The code editor

With the `advcode` plugin, the same button opens the HTML in a code editor:

```ts
createEditor({ element, plugins: ['advcode'] });
```

- the HTML laid out with one block per line, nested ones indented, opened where the cursor is in
  the text;
- colors for HTML, and for CSS and JavaScript inside it;
- matching brackets and tags, folding (the arrows by the line numbers), tags closed as you type,
  several cursors (<kbd>Ctrl</kbd>+click), a rectangular selection (<kbd>Alt</kbd>+drag);
- search and replace: the magnifier, or <kbd>Ctrl</kbd>+<kbd>F</kbd>;
- a smaller or larger text, wrapped or long lines, and full screen, from the buttons above the
  code;
- the colors of the editor's theme, light or dark.

| Keys                                          | What they do                                       |
| --------------------------------------------- | -------------------------------------------------- |
| <kbd>Ctrl</kbd>+<kbd>F</kbd>                  | find and replace                                   |
| <kbd>Ctrl</kbd>+<kbd>D</kbd>                  | select the next occurrence of the selection        |
| <kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>G</kbd>   | go to a line                                       |
| <kbd>Ctrl</kbd>+<kbd>/</kbd>                  | comment the line out, or back in                   |
| <kbd>Alt</kbd>+<kbd>↑</kbd> / <kbd>↓</kbd>    | move the line up or down                           |
| <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>K</kbd> | delete the line                                    |
| <kbd>Ctrl</kbd>+<kbd>Space</kbd>              | suggest a tag or attribute                         |
| <kbd>Ctrl</kbd>+<kbd>S</kbd>                  | save and close                                     |
| <kbd>Esc</kbd>                                | close a search or several cursors; then the dialog |

On a Mac, <kbd>Cmd</kbd> takes the place of <kbd>Ctrl</kbd> (but not in <kbd>Ctrl</kbd>+<kbd>Space</kbd>). <kbd>Tab</kbd> moves to the buttons,
as everywhere else, so a keyboard never gets stuck in the code; <kbd>Ctrl</kbd>+<kbd>]</kbd> and
<kbd>Ctrl</kbd>+<kbd>[</kbd> indent.

The code editor ([CodeMirror](https://codemirror.net/)) loads when it is first opened, not with
the page. If it can't load (offline, say), the plain dialog opens instead.

```ts
pluginOptions: {
  advcode: {
    prettify: true, // lay the HTML out on lines (yes); false: only line breaks after blocks
    wrap: true, // wrap long lines (yes)
    fontSize: 14, // in pixels
  },
}
```

The layout is also a helper of its own: `prettyHTML(editor.getHTML())` gives the same lines, and
reading them back gives the same document.

## Coming from TinyMCE

`plugins: 'advcode'` with `tinymce.init()` works, and `mceCodeEditor` opens it.
`advcode_prettify_editor` is `prettify`, and `advcode_prettify_getcontent` lays out what
`getContent()` returns (as `getContent({ prettify: true })` does). `advcode_inline` isn't needed:
the code editor opens in a dialog with a full screen button.
