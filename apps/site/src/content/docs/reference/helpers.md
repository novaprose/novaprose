---
title: Helper functions
description: Functions exported by @novaprose/core for your own toolbar, dialogs and integrations — reading the editor's state, commands with parameters, built-in dialogs, defaults to extend and text utilities.
---

Everything on this page is exported from `@novaprose/core`, and from the global `NovaProse` in the
CDN build. Functions that return a `Command` are ProseMirror commands: run them with
`editor.exec(command)` or as a step of [`editor.chain()`](/reference/api/#chains).

```ts
import { getStyle, setStyle } from '@novaprose/core';

editor.exec(setStyle('color', '#1a7f37'));
getStyle(editor.view.state, 'color'); // '#1a7f37'
```

## Reading the state

For your own toolbar: whether a button looks pressed, what a dropdown shows. Pass
`editor.view.state`.

| Function                                                             | Returns                                                                                                          |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `isCommandActive(state, name)`                                       | whether a named command is active (`'bold'`, `'h2'`, `'alignCenter'`…) — the same as `editor.isActive(name)`     |
| `isMarkActive(state, markType)`, `isNodeActive(state, type, attrs?)` | whether a mark or block type of the editor's schema (`editor.schema.marks.bold`) is active                       |
| `getActiveAlign(state)`                                              | the alignment of the selected blocks: `'left'`, `'center'`, `'right'` or `'justify'`                             |
| `getStyle(state, mark)`                                              | the current `'color'`, `'background'`, `'font_family'` or `'font_size'` at the start of the selection, or `null` |
| `getLineHeight(state)`                                               | the line height of the selected paragraphs, or `null`                                                            |
| `getLinkAt(state)`                                                   | `{ href, title, target }` of the link at the cursor, or `null`                                                   |
| `getSelectedImage(state)`                                            | the selected image — in a line or with a caption — and its attributes, or `null`                                 |
| `isInTable(state)`, `hasHeaderRow(state)`, `hasHeaderColumn(state)`  | whether the cursor is in a table, and whether the table has a header row or column                               |
| `getSearchState(state)`                                              | find and replace: the query and its options, the matches, the index of the current one                           |

In React and Vue, [`useEditorState`](/guides/headless/) calls them for you and re-renders when the
result changes.

## Commands with parameters

| Function                                                           | Does                                                                                                                                                                                                            |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `setStyle(mark, value)`                                            | sets `'color'`, `'background'`, `'font_family'` or `'font_size'` on the selection (`null` removes it); with an empty selection, for the next typed text                                                         |
| `setLineHeight(value)`                                             | the line height of the selected paragraphs and headings (`null` resets it)                                                                                                                                      |
| `setLink(href, { title?, target? })`, `removeLink()`               | adds, updates or removes the link on the selection                                                                                                                                                              |
| `applyLink({ href, text?, title?, target? })`                      | like `setLink`, and replaces the link's text when `text` differs, keeping its other formatting                                                                                                                  |
| `insertImage(src, alt?)`                                           | inserts an image in place of the selection                                                                                                                                                                      |
| `setImageAttrs(attrs)`                                             | changes `alt`, `title`, `width`, `height` or `align` of the selected image                                                                                                                                      |
| `insertTable(rows, cols, withHeader?)`                             | inserts a table and puts the cursor in its first cell                                                                                                                                                           |
| `tableCommands.<name>`                                             | `addRowBefore`, `addRowAfter`, `deleteRow`, `addColumnBefore`, `addColumnAfter`, `deleteColumn`, `mergeCells`, `splitCell`, `toggleHeaderRow`, `toggleHeaderColumn`, `deleteTable` — after `await editor.ready` |
| `setCellBackground(color)`                                         | the background of the selected cells (`null` removes it)                                                                                                                                                        |
| `setSearch({ query, caseSensitive, wholeWord })`, `findNext(dir?)` | find without the built-in bar; `findNext(-1)` goes back                                                                                                                                                         |
| `replaceCurrent(text)`, `replaceAll(text)`, `clearSearch`          | replace the current match or all of them (one undo step), clear the search                                                                                                                                      |

```ts
import { insertTable, tableCommands } from '@novaprose/core';

editor.exec(insertTable(3, 4, true));
await editor.ready; // table editing loads right after the editor is created
editor.exec(tableCommands.addRowAfter);
```

## Built-in dialogs and views

For buttons of your own that open what the built-in ones do:

| Function                                                   | Opens or does                                                                                               |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `openLinkDialog(editor)`                                   | the link dialog for the selection                                                                           |
| `openImageDialog(editor)`, `openImageAltDialog(editor)`    | the insert image dialog; the alternative text of the selected image                                         |
| `uploadImages(editor, files, pos?)`                        | inserts image files and uploads them with your `uploadImage` handler, showing a preview meanwhile           |
| `setImageWidthFraction(editor, fraction)`                  | the selected image's width as a share of the text width (`0.5`), keeping its proportions; `null` — original |
| `openPreview(editor)`, `openSourceCode(editor)`            | the preview; the HTML source editor                                                                         |
| `openHelp(editor)`                                         | the keyboard shortcuts                                                                                      |
| `toggleFullscreen(editor, value?)`, `isFullscreen(editor)` | the full-screen mode                                                                                        |
| `printContent(editor)`                                     | prints the document as it looks in the editor ([Pages and printing](/guides/pages-and-printing/))           |

## Defaults to extend

```ts
import { createEditor, DEFAULT_MENUS, defaultFontSizes, defaultToolbar } from '@novaprose/core';

createEditor({
  element,
  toolbar: `${defaultToolbar} | mybutton`,
  fontSizes: [...defaultFontSizes, '48px'],
  menu: { ...DEFAULT_MENUS, tools: { title: 'Tools', items: 'searchreplace | code' } },
  menubar: 'file edit view insert format tools',
});
```

| Value                                                           | What it is                                                                                                |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `defaultToolbar`                                                | the default toolbar                                                                                       |
| `DEFAULT_MENUS`, `DEFAULT_MENUBAR`                              | the standard menus and their order                                                                        |
| `defaultFontFamilies`, `defaultFontSizes`, `defaultLineHeights` | the lists of the font, size and line height controls (options `fontFamilies`, `fontSizes`, `lineHeights`) |
| `defaultColors`                                                 | the color palette (option `colors`)                                                                       |
| `defaultSlashCommands`                                          | the "/" commands (option `slashCommands` adds to them)                                                    |
| `icons`                                                         | the built-in SVG icons by name, for your buttons in the same style                                        |

## Text and URLs

| Function                                    | Does                                                                                     |
| ------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `countWords(text)`                          | counts words the way the status bar does                                                 |
| `htmlToPlainText(html)`                     | plain text from HTML, keeping paragraphs                                                 |
| `normalizeUrl(input)`                       | `example.com` → `https://example.com`, `a@b.com` → `mailto:a@b.com`                      |
| `isSafeLinkUrl(url)`, `isSafeImageUrl(url)` | the editor's URL allowlist — apply it on your server too ([Security](/guides/security/)) |
| `formatHTML(html)`                          | HTML with line breaks after block tags, as in the source view                            |

## For plugins and integrations

| Export                                                                             | Use                                                                                                                                 |
| ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `definePlugin(plugin)`, `registerPlugin(name, plugin)`, `isPluginRegistered(name)` | define a plugin; register it, or a function that loads it, for `plugins: ['name']` ([Plugins](/guides/custom-buttons-and-plugins/)) |
| `defineNodeView(...)`                                                              | draw a node with your own code ([Node views](/guides/node-views/))                                                                  |
| `schema`, `createSchema(extensions)`                                               | the base document schema; a schema with your nodes and marks                                                                        |
| `REMOTE_CHANGE_META`                                                               | set it on transactions from a collaborator, so they fire `change` but not `input`                                                   |
| `createCommentStore(threads, onChange)`, `sanitizeThread(data)`                    | the in-memory comment store; turning stored data into a safe thread — for your own `CommentStore` ([Comments](/guides/comments/))   |
| `getPluginMessages()`                                                              | every plugin string by language, as a template for translators ([Localization](/guides/localization/))                              |
