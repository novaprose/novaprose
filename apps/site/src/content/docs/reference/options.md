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

| Option        | Type               | Default | Description                                               |
| ------------- | ------------------ | ------- | --------------------------------------------------------- |
| `element`     | `HTMLElement`      | —       | container to mount the editor into                        |
| `content`     | `string \| object` | `''`    | initial HTML, or document JSON from `getJSON()`           |
| `editable`    | `boolean`          | `true`  | `false` for read-only; change later with `setEditable()`  |
| `placeholder` | `string`           | —       | shown while the document is empty                         |
| `onChange`    | `(editor) => void` | —       | called after every content change                         |
| `setup`       | `(editor) => void` | —       | runs before the UI renders; register custom controls here |

## Interface

| Option          | Type                                          | Default     | Description                                                                                                 |
| --------------- | --------------------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------- |
| `toolbar`       | `string \| string[] \| false`                 | see below   | toolbar controls; `false` hides the toolbar                                                                 |
| `toolbarMode`   | `'sliding' \| 'wrap'`                         | `'sliding'` | what happens when the toolbar doesn't fit                                                                   |
| `mode`          | `'classic' \| 'inline' \| 'distraction-free'` | `'classic'` | editor layout ([Modes](/guides/toolbar-and-menus/#modes))                                                   |
| `menubar`       | `boolean \| string`                           | `false`     | `true` for the standard menus, or a list such as `'edit insert format'`                                     |
| `menu`          | `Record<string, { title, items }>`            | —           | add or override menus                                                                                       |
| `statusbar`     | `boolean`                                     | `true`      | element path and word count                                                                                 |
| `slashCommands` | `false \| SlashCommand[]`                     | built-in    | `/` command menu; `false` to disable, an array to add commands                                              |
| `language`      | `string`                                      | `'en'`      | UI language ([Localization](/guides/localization/))                                                         |
| `direction`     | `'ltr' \| 'rtl'`                              | by language | right-to-left interface and text ([Right-to-left languages](/guides/localization/#right-to-left-languages)) |
| `translations`  | `Partial<Messages>`                           | —           | override individual UI strings                                                                              |

Default toolbar: see [Toolbar and menus](/guides/toolbar-and-menus/#toolbar).

## Formatting choices

| Option         | Type                                 | Description                        |
| -------------- | ------------------------------------ | ---------------------------------- |
| `fontFamilies` | `{ label: string; value: string }[]` | font family dropdown               |
| `fontSizes`    | `string[]`                           | font size dropdown, e.g. `'14px'`  |
| `lineHeights`  | `string[]`                           | line height dropdown, e.g. `'1.5'` |
| `colors`       | `string[]`                           | text and background color palettes |

## Images

| Option        | Type                                                           | Description                                |
| ------------- | -------------------------------------------------------------- | ------------------------------------------ |
| `uploadImage` | `(file: File, progress: (percent) => void) => Promise<string>` | upload handler ([Images](/guides/images/)) |

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
| `pasteStyles`           | `'clean'                                  | 'keep'`                                                                                                                             | `'clean'` drops the source document's fonts, sizes and spacing on paste ([Pasting from Office](/guides/pasting-from-office/)) |

## Extensions

| Option               | Type                                        | Description                                                                                     |
| -------------------- | ------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `plugins`            | `(NovaPlugin \| string \| () => Promise)[]` | plugin objects, built-in names or lazy loaders ([Plugins](/guides/custom-buttons-and-plugins/)) |
| `pluginOptions`      | `Record<string, unknown>`                   | per-plugin settings, keyed by plugin name                                                       |
| `prosemirrorPlugins` | `Plugin[]`                                  | raw ProseMirror plugins for low-level extensions                                                |
