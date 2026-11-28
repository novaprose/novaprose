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

When the toolbar does not fit, `toolbarMode` decides what happens to the groups that don't:

| `toolbarMode`          | What happens                                                                           |
| ---------------------- | -------------------------------------------------------------------------------------- |
| `'floating'` (default) | they open from **⋯** in a panel over the text                                          |
| `'sliding'`            | they open from **⋯** in a strip under the toolbar, which moves the text down           |
| `'scrolling'`          | the toolbar is one row that scrolls sideways (a swipe, Shift+wheel), for touch screens |
| `'wrap'`               | the toolbar wraps onto several rows                                                    |

Groups move from the end, so put the most important ones first. From the keyboard every control
stays reachable: **⋯** opens the panel or the strip (<kbd>Esc</kbd> closes it), and in a scrolling
toolbar the focused control scrolls into view.

## Your own typing shortcuts

Typed shortcuts are on by default: `# ` makes a heading, `- ` a list, `> ` a quote, ` ``` ` a
code block, `--` a dash. `textPatterns: false` turns them off (for people who dictate or type those
characters as text). A list of your own replaces them; there are three kinds:

```ts
createEditor({
  element,
  textPatterns: [
    // At the start of a block, when a space follows (or Enter: trigger: 'enter').
    { start: '#', format: 'h1' },
    { start: '1.', command: 'orderedList' },
    { start: '- ', command: 'bulletList', trigger: 'enter' },
    // Between two markers, when a space or Enter follows the end one.
    { start: '*', end: '*', format: 'italic' },
    { start: '**', end: '**', format: 'bold' },
    // A replacement, when a space or Enter follows it (text, or HTML through the schema).
    { start: '(c)', replacement: '©' },
  ],
});
```

`format` is one of your [formats](/reference/options/) or a built-in one (`bold`, `italic`,
`underline`, `strikethrough`, `code`, `subscript`, `superscript`, `p`, `h1`–`h6`,
`blockquote`, `pre`); `command` is a [named command](/reference/api/#commands) or a function that gets the
editor and `value`. `textPatternsLookup` adds patterns on every attempt, from the text before the
cursor: `({ text }) => (text.endsWith('@today') ? [{ start: '@today', replacement: today }] : [])`.
Nothing fires in code. The longest start is tried first, so `**` wins over `*`.

The default toolbar is:

```text
undo redo | blocks | bold italic underline strikethrough moreformats | forecolor backcolor |
link image table | bullist numlist | align lineheight outdent indent | fontfamily fontsize |
blockquote codeblock hr | removeformat | searchreplace preview code fullscreen help
```

### Built-in controls

| Group      | Controls                                                                                                                                                                                                                                                                                                              |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| History    | `undo` `redo`                                                                                                                                                                                                                                                                                                         |
| Blocks     | `blocks` `h1`…`h6` `blockquote` `codeblock` `hr`                                                                                                                                                                                                                                                                      |
| Text       | `bold` `italic` `underline` `strikethrough` `subscript` `superscript` `inlinecode` `moreformats` `removeformat`; with plugins: `casechange` `formatpainter` `permanentpen`                                                                                                                                            |
| Style      | `forecolor` `backcolor` `fontfamily` `fontsize` `lineheight`                                                                                                                                                                                                                                                          |
| Alignment  | `align` `alignleft` `aligncenter` `alignright` `alignjustify` `indent` `outdent`                                                                                                                                                                                                                                      |
| Lists      | `bullist` `numlist`                                                                                                                                                                                                                                                                                                   |
| Insert     | `link` `unlink` `image` `media` `pageembed` `table` `insertdatetime` `template` `footnotes` `footnotesupdate` (plugins)                                                                                                                                                                                               |
| Tables     | `tableinsertrowbefore` `tableinsertrowafter` `tabledeleterow` `tableinsertcolbefore` `tableinsertcolafter` `tabledeletecol` `tablemergecells` `tablesplitcells` `tablerowheader` `tablecolheader` `tablecellbackground` `tableprops` `tablecellprops` `advtablesort` `advtablerownumbering` (plugin) `tabledelete`    |
| Images     | `imagealignleft` `imagealigncenter` `imagealignright` `imagesize` `imagealt` `imagedelete`; with the editimage plugin `rotateleft` `rotateright` `flipv` `fliph` `editimage`                                                                                                                                          |
| Link cards | `linkcardopen` `linkcardunwrap` `linkcarddelete` (the mediaembed plugin)                                                                                                                                                                                                                                              |
| Tools      | `searchreplace` `pastetext` `code` `preview` `fullscreen` `help`; with plugins: `save` `cancel` `fullpagehtml` `visualblocks` `visualchars` `spellchecker` `spellcheckdialog` `autocorrect` `capitalization` `typography` `linkchecker` `a11ycheck` `emailpreview` `aidialog` `aishortcuts` `aichat` `aiautocomplete` |

Table, image and link card controls also appear in context toolbars when a table cell, an image or
a card is selected.

**Tables** can be sorted by the column with the cursor (`advtablesort`: numbers numerically, text
in the editor's language, header rows stay on top); the `advtable` plugin adds sorting by any column
or row and a column of row numbers (see [Tables](/guides/tables/)). `tableprops` sets the table width (`100%`,
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

A **Tools** menu is ready but not in the default bar: `menubar: 'file edit view insert format tools
table help'` shows it, with the items of the plugins you use — spell check, autocorrect and
capitalization, typography, the accessibility checker.

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
