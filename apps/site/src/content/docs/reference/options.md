---
title: Options
description: Every option accepted by createEditor().
---

```ts
import { createEditor, type EditorOptions } from '@novaprose/core';
```

All options except `element` are optional. Options are read when the editor is created; to change
them, destroy the editor and create a new one (framework packages: change the component `key`).
Exceptions with runtime setters are noted below.

## Content and behavior

| Option         | Type                 | Default | Description                                                                                 |
| -------------- | -------------------- | ------- | ------------------------------------------------------------------------------------------- |
| `element`      | `HTMLElement`        | —       | container to mount the editor into                                                          |
| `content`      | `string \| object`   | `''`    | initial HTML, or document JSON from `getJSON()`                                             |
| `editable`     | `boolean`            | `true`  | `false` for read-only; change later with `setEditable()`                                    |
| `disabled`     | `boolean`            | `false` | like a disabled form field: no editing, no focus, dimmed; change later with `setDisabled()` |
| `placeholder`  | `string`             | —       | shown while the document is empty                                                           |
| `onChange`     | `(editor) => void`   | —       | called after every content change                                                           |
| `setup`        | `(editor) => void`   | —       | runs before the UI renders; register custom controls here                                   |
| `contentStyle` | `string`             | —       | CSS for the text of this editor only (as `content_style`); also used when printing          |
| `contentCss`   | `string \| string[]` | —       | style sheet files for the text (as `content_css`); `await editor.ready` waits for them      |

## Interface

| Option          | Type                                          | Default                      | Description                                                                                                                   |
| --------------- | --------------------------------------------- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `toolbar`       | `string \| string[] \| false`                 | see below                    | toolbar controls; `false` hides the toolbar                                                                                   |
| `toolbarMode`   | `'sliding' \| 'wrap'`                         | `'sliding'`                  | what happens when the toolbar doesn't fit                                                                                     |
| `mode`          | `'classic' \| 'inline' \| 'distraction-free'` | `'classic'`                  | editor layout ([Modes](/guides/toolbar-and-menus/#modes))                                                                     |
| `menubar`       | `boolean \| string`                           | `false`                      | `true` for the standard menus, or a list such as `'edit insert format'`                                                       |
| `textPatterns`  | `boolean`                                     | `true`                       | shortcuts that react to typed characters: Markdown (`# `, `- `, ` ``` `) and typography (`--`, `...`); `false` turns them off |
| `menu`          | `Record<string, { title, items }>`            | —                            | add or override menus                                                                                                         |
| `statusbar`     | `boolean`                                     | `true`                       | element path and word count                                                                                                   |
| `resize`        | `boolean \| 'both'`                           | `false`                      | a resize handle in the status bar: `true` for height, `'both'` for height and width; works with the keyboard too              |
| `blockFormats`  | `{ label, block }[]`                          | paragraph, H1–H6, code block | items and order of the block list (the `blocks` button)                                                                       |
| `slashCommands` | `false \| SlashCommand[]`                     | built-in                     | `/` command menu; `false` to disable, an array to add commands                                                                |
| `language`      | `string`                                      | `'en'`                       | UI language ([Localization](/guides/localization/))                                                                           |
| `direction`     | `'ltr' \| 'rtl'`                              | by language                  | right-to-left interface and text ([Right-to-left languages](/guides/localization/#right-to-left-languages))                   |
| `translations`  | `Partial<Messages>`                           | —                            | override individual UI strings                                                                                                |

Default toolbar: see [Toolbar and menus](/guides/toolbar-and-menus/#toolbar).

## Formatting choices

| Option         | Type                                 | Description                        |
| -------------- | ------------------------------------ | ---------------------------------- |
| `fontFamilies` | `{ label: string; value: string }[]` | font family dropdown               |
| `fontSizes`    | `string[]`                           | font size dropdown, e.g. `'14px'`  |
| `lineHeights`  | `string[]`                           | line height dropdown, e.g. `'1.5'` |
| `colors`       | `string[]`                           | text and background color palettes |

## Formats and styles

| Option               | Type                                         | Description                                                                                                                          |
| -------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `formats`            | `Record<string, FormatSpec \| FormatSpec[]>` | named formats, as `formats` in TinyMCE: `{ note: { block: 'p', classes: 'note' } }`; apply with `editor.formatter.apply('note')`     |
| `styleFormats`       | `StyleFormat[]`                              | items of the Styles menu (the `styles` button): your formats, named formats and groups                                               |
| `styleFormatsMerge`  | `boolean`                                    | `true` adds `styleFormats` to the standard set instead of replacing it                                                               |
| `validClasses`       | `string[] \| true`                           | classes to keep in the HTML besides those of the formats; `true` keeps all. By default pasted clutter such as `MsoNormal` is dropped |
| `tableClassList`     | `{ title, value }[]`                         | table styles to choose from in the table properties (as `table_class_list`); your CSS defines their look                             |
| `tableCellClassList` | `{ title, value }[]`                         | cell styles to choose from in the cell properties (as `table_cell_class_list`)                                                       |

## Images and files

| Option            | Type                                                                 | Description                                                                                                                                                    |
| ----------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `uploadImage`     | `(file: File, progress: (percent) => void) => Promise<string>`       | upload handler ([Images](/guides/images/)); without it, images are embedded as `data:` URLs                                                                    |
| `filePicker`      | `({ type, value }) => Promise<{ url, text?, title?, alt? } \| null>` | your own file picker (as `file_picker_callback`): a Browse button next to the address field of the link, image and video dialogs; `null` when the user cancels |
| `filePickerTypes` | `('file' \| 'image' \| 'media')[]`                                   | which dialogs get Browse; all of them by default                                                                                                               |

## Content rules and paste

| Option                  | Type                                      | Description                                                                                                                         |
| ----------------------- | ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `validElements`         | `string`                                  | allow only these elements ([Content restrictions](/guides/content-restrictions/))                                                   |
| `invalidElements`       | `string`                                  | forbid these elements                                                                                                               |
| `validStyles`           | `string \| Record<string, string>`        | allowed CSS properties                                                                                                              |
| `extendedValidElements` | `string`                                  | keep extra elements and attributes ([Attributes and your own markup](/guides/content-restrictions/#attributes-and-your-own-markup)) |
| `customElements`        | `string`                                  | your own elements: `'product-card,~user-chip'` (`~` — inline)                                                                       |
| `pastePreprocess`       | `(html: string, editor) => string`        | change pasted HTML before parsing                                                                                                   |
| `pastePostprocess`      | `(fragment: HTMLElement, editor) => void` | change the parsed DOM before insertion                                                                                              |
| `pasteAsText`           | `boolean`                                 | paste plain text; toggle later with `setPasteAsText()`                                                                              |
| `pasteStyles`           | `'clean' \| 'keep'`                       | `'clean'` drops the source document's fonts, sizes and spacing on paste ([Pasting from Office](/guides/pasting-from-office/))       |

## Extensions

| Option               | Type                                        | Description                                                                                     |
| -------------------- | ------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `plugins`            | `(NovaPlugin \| string \| () => Promise)[]` | plugin objects, built-in names or lazy loaders ([Plugins](/guides/custom-buttons-and-plugins/)) |
| `pluginOptions`      | `Record<string, unknown>`                   | per-plugin settings, keyed by plugin name (for example `codesample: { languages, grammars }`)   |
| `prosemirrorPlugins` | `Plugin[]`                                  | raw ProseMirror plugins for low-level extensions                                                |
