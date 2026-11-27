---
title: Toolbar and menus
description: Configure the toolbar, menu bar, editor modes and keyboard access.
---

## Toolbar

The toolbar is a string of control names. `|` separates groups.

```ts
createEditor({
  element,
  toolbar: 'undo redo | blocks | bold italic underline | link image table | bullist numlist',
});
```

You can also pass an array of groups, or `false` to hide the toolbar and build your own UI with
[`editor.exec()`](/reference/api/) (the [React](/frameworks/react/) and [Vue](/frameworks/vue/)
packages include hooks for that).

When the toolbar does not fit, extra controls move into a **⋯** overflow menu
(`toolbarMode: 'sliding'`, the default). Use `toolbarMode: 'wrap'` to wrap onto several rows.
Controls are moved from the end, so put the most important groups first.

The default toolbar is:

```text
undo redo | blocks | bold italic underline strikethrough moreformats | forecolor backcolor |
link image table | bullist numlist | align lineheight outdent indent | fontfamily fontsize |
blockquote codeblock hr | removeformat | searchreplace preview code fullscreen help
```

### Built-in controls

| Group     | Controls                                                                                                                                                                                                                                                                           |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| History   | `undo` `redo`                                                                                                                                                                                                                                                                      |
| Blocks    | `blocks` `h1`…`h6` `blockquote` `codeblock` `hr`                                                                                                                                                                                                                                   |
| Text      | `bold` `italic` `underline` `strikethrough` `subscript` `superscript` `inlinecode` `moreformats` `removeformat`; with plugins: `casechange` `formatpainter` `permanentpen`                                                                                                         |
| Style     | `forecolor` `backcolor` `fontfamily` `fontsize` `lineheight`                                                                                                                                                                                                                       |
| Alignment | `align` `alignleft` `aligncenter` `alignright` `alignjustify` `indent` `outdent`                                                                                                                                                                                                   |
| Lists     | `bullist` `numlist`                                                                                                                                                                                                                                                                |
| Insert    | `link` `unlink` `image` `table` `insertdatetime` `template` (plugins)                                                                                                                                                                                                              |
| Tables    | `tableinsertrowbefore` `tableinsertrowafter` `tabledeleterow` `tableinsertcolbefore` `tableinsertcolafter` `tabledeletecol` `tablemergecells` `tablesplitcells` `tablerowheader` `tablecolheader` `tablecellbackground` `tableprops` `tablecellprops` `advtablesort` `tabledelete` |
| Images    | `imagealignleft` `imagealigncenter` `imagealignright` `imagesize` `imagealt` `imagedelete`                                                                                                                                                                                         |
| Tools     | `searchreplace` `pastetext` `code` `preview` `fullscreen` `help`; with plugins: `save` `cancel` `visualblocks` `visualchars`                                                                                                                                                       |

Table and image controls also appear in context toolbars when a table cell or an image is
selected.

**Tables** can be sorted by the column with the cursor (`advtablesort`: numbers numerically, text
in the editor's language, header rows stay on top). `tableprops` sets the table width (`100%`,
`600px`) and alignment; `tablecellprops` sets vertical alignment, header vs data cell and the column
width in pixels, which also works on touch screens. Wide tables scroll inside the editor on narrow
screens.

## Menu bar

```ts
createEditor({ element, menubar: true }); // File · Edit · View · Insert · Format · Table · Help
createEditor({ element, menubar: 'edit insert format' }); // only some menus
```

Override or add menus with `menu`:

```ts
createEditor({
  element,
  menubar: 'insert tools',
  menu: {
    insert: { title: 'Insert', items: 'image link | hr' },
    tools: { title: 'Tools', items: 'searchreplace code' },
  },
});
```

Menu items use the same names as toolbar controls, including your own buttons registered with
`editor.ui.registry.addButton()`.

## Modes

| `mode`               | What you get                                                                                                            |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `'classic'`          | a framed editor with the toolbar on top (default)                                                                       |
| `'inline'`           | no frame; the toolbar appears above the text while the editor has focus                                                 |
| `'distraction-free'` | no toolbar; formatting appears next to the selection (with the `quickbars` plugin), above the keyboard on touch screens |

```ts
createEditor({ element, mode: 'distraction-free', plugins: ['quickbars'] });
```

## Keyboard

| Shortcut         | Action                                                  |
| ---------------- | ------------------------------------------------------- |
| Alt+F10          | move focus to the toolbar                               |
| Alt+F9           | move focus to the menu bar                              |
| Ctrl+F9          | move focus to the context toolbar                       |
| Esc              | return focus to the text                                |
| Ctrl/Cmd+K       | insert or edit a link                                   |
| Ctrl/Cmd+F       | search and replace                                      |
| Ctrl/Cmd+Shift+F | fullscreen                                              |
| Alt+Shift+↑ / ↓  | move the block (paragraph, list item, table) up or down |
| Alt+0            | keyboard help                                           |

Markdown shortcuts while typing: `#` to `######` followed by a space for headings, `-` or `*` for
bullets, `1.` for numbered lists, `>` for a quote, three backticks and Space or Enter for a code
block (` ```js ` sets the language). Type `/` for slash commands.
