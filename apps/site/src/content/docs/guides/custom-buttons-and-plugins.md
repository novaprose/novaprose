---
title: Custom buttons and plugins
description: Add your own toolbar buttons, menu items, context toolbars and reusable plugins.
---

Built-in controls are registered through the same registry you use, so custom buttons behave like
native ones: keyboard navigation, tooltips, overflow menu, menus and themes all work.

## A button

Register buttons in `setup`, which runs before the toolbar is rendered:

```ts
createEditor({
  element,
  toolbar: 'bold italic | signature',
  setup: (editor) => {
    editor.ui.registry.addButton('signature', {
      text: 'Signature',
      tooltip: 'Insert signature',
      onAction: (e) => e.setContent(e.getHTML() + '<p>— Best regards</p>'),
    });
  },
});
```

| Field       | Description                                                            |
| ----------- | ---------------------------------------------------------------------- |
| `tooltip`   | tooltip and accessible label (required)                                |
| `text`      | button text, shown when there is no icon                               |
| `icon`      | an SVG string                                                          |
| `shortcut`  | shortcut shown in the tooltip, in ProseMirror format (`'Mod-Shift-s'`) |
| `onAction`  | `(editor) => void`                                                     |
| `isActive`  | `(editor) => boolean` — makes it a toggle button (`aria-pressed`)      |
| `isEnabled` | `(editor) => boolean` — disables the button when it returns `false`    |

Other control types: `addToggleButton`, `addMenuButton` (a dropdown list), `addSplitButton` (an
action plus a dropdown of options), `addPanelButton` (a popover with your own content),
`addMenuItem` and `addToggleMenuItem` for the menu bar. `addStyleFormats(items, { replace })` adds
items to the Styles menu (the `styles` button), after the configured ones or instead of them — the
`importcss` plugin uses it.

## A context toolbar

Show controls next to the selection when a condition is true:

```ts
editor.ui.registry.addContextToolbar('bold-tools', {
  predicate: (e) => e.isActive('bold'),
  items: 'italic underline | removeformat',
  label: 'Text tools',
  position: 'selection',
});
```

## A dialog

Describe the fields; the editor builds an accessible form: labels, hints, required fields, error
messages next to each field, focus on the first invalid one, Escape and focus return. On small screens
it opens as a bottom sheet.

```ts
const data = await editor.ui.dialog({
  title: 'Insert video',
  submitLabel: 'Insert',
  initialData: { size: 'm' },
  fields: [
    { type: 'url', name: 'src', label: 'Video URL', required: true, hint: 'YouTube or Vimeo' },
    { type: 'number', name: 'width', label: 'Width', min: 200 },
    {
      type: 'select',
      name: 'size',
      label: 'Size',
      options: [
        { value: 's', label: 'Small' },
        { value: 'm', label: 'Medium' },
      ],
    },
    { type: 'checkbox', name: 'autoplay', label: 'Autoplay' },
  ],
  // Return an error message (or false) to keep the dialog open; a promise blocks the buttons.
  onSubmit: async (data) => ((await isAllowed(data.src)) ? undefined : 'This site is not allowed'),
}); // the data, or null if the dialog was closed

if (data) insertVideo(editor, String(data.src)); // your function
```

Field types: `text`, `url`, `email`, `tel`, `number`, `textarea`, `select`, `checkbox`, `color`,
`file`, plus `message` (a note, `tone: 'info' | 'warning' | 'error'`) and `custom` (`render(api)` returns your
own element). Each field can have `hint`, `required`, `disabled` and `validate(value, data)`.
`onChange(data, { name }, api)` runs on every edit. `onSubmit`, `onChange` and `custom` fields get an `api`
with `getData`, `setData`, `setFieldError`, `setError`, `setEnabled`, `setBusy`, `focus` and `close`. Pass
`signal` (an `AbortSignal`) to close the dialog from outside. The dialog code (about 2.5 KB) loads the
first time a dialog opens.

**Tabs.** Pass `tabs` instead of `fields`; the data of all tabs comes back in one object. Tabs follow
the WAI-ARIA pattern (arrow keys, Home/End, mirrored in right-to-left mode). If a field on a hidden tab
is invalid, the dialog switches to that tab and focuses the field.

**Files.** A `file` field shows a drop zone with a Browse button and a list of chosen files that can be
removed one by one. Its value is an array of `File` objects; upload them yourself in `onSubmit`.

```ts
const data = await editor.ui.dialog({
  title: 'Attach files',
  tabs: [
    {
      title: 'Files',
      fields: [
        {
          type: 'file',
          name: 'files',
          label: 'Attachments',
          accept: 'image/*,.pdf', // like <input accept>
          multiple: true,
          maxSize: 10 * 1024 * 1024, // bytes, per file
          required: true,
        },
      ],
    },
    { title: 'Details', fields: [{ type: 'text', name: 'note', label: 'Note' }] },
  ],
  onSubmit: async (data) => upload(data.files as File[]), // your function
});
```

Files of other types or over `maxSize` are rejected with a message under the field.

## A sidebar

A panel next to the text (below it on narrow screens), like the comments panel. One sidebar is open at
a time. Its content is rendered on first open — you can load it lazily — and kept between openings.

```ts
editor.ui.registry.addSidebar('outline', {
  title: 'Outline',
  icon: '<svg viewBox="0 0 24 24">…</svg>',
  render: async (container, editor) => {
    const { renderOutline } = await import('./outline');
    return renderOutline(container, editor); // may return a cleanup function
  },
  onShow: (editor) => {},
  onHide: (editor) => {},
});
```

A toggle button with the sidebar's name is added for the toolbar (`toolbar: 'bold italic | outline'`)
unless you pass `button: false`. From code: `editor.ui.sidebar.show('outline', { focus: true })`,
`hide()`, `toggle(name)`, `active`. The panel has a heading and a close button, Escape closes it
and returns focus to the text.

## Plugin styles

Ship a plugin's CSS with its code: `editor.ui.addStyles(id, css)` adds it once per page (or shadow
root), no matter how many editors there are. It uses constructable stylesheets, so your Content
Security Policy doesn't need `'unsafe-inline'`. Use the `--nova-*` variables to follow the light and
dark themes.

```ts
editor.ui.addStyles('outline-plugin', '.outline-item { color: var(--nova-muted); }');
```

## A plugin

Package buttons and behavior into a plugin to reuse them across editors:

```ts
import { createEditor, definePlugin } from '@novaprose/core';

const wordLimit = definePlugin({
  name: 'wordlimit',
  toolbar: 'wordlimit', // added to the default toolbar unless the user sets their own
  setup(editor) {
    const off = editor.on('change', (e) => {
      const words = e.getText().split(/\s+/).filter(Boolean).length;
      e.root.classList.toggle('over-limit', words > 500);
    });
    editor.ui.registry.addButton('wordlimit', {
      text: 'Limit',
      tooltip: 'Word limit: 500',
      onAction: () => {},
    });
    return off; // cleanup on destroy
  },
});

createEditor({ element, plugins: [wordLimit] });
```

| Field                | Description                                                                                  |
| -------------------- | -------------------------------------------------------------------------------------------- |
| `name`               | unique name, also used in `requires` of other plugins                                        |
| `requires`           | plugins that must be set up first                                                            |
| `setup`              | register controls and listeners; may return a cleanup function                               |
| `toolbar`            | controls appended to the default toolbar                                                     |
| `prosemirrorPlugins` | `(editor) => Plugin[]` for low-level input handling and decorations                          |
| `nodeViews`          | `{ name: view }`: draw nodes with your own component — see [Node views](/guides/node-views/) |
| `load`               | `() => import(...)`: the rest of a plugin with nodes, loaded after the editor is created     |

### New content types

A plugin can add its own nodes (blocks or inline elements) and marks (inline formatting). Each
needs `parseDOM` to read HTML and `toDOM` to write it:

```ts
const callout = definePlugin({
  name: 'callout',
  nodes: {
    callout: {
      group: 'block',
      content: 'block+',
      attrs: { tone: { default: 'info' } },
      parseDOM: [{ tag: 'div.callout', getAttrs: (dom) => ({ tone: dom.dataset.tone ?? 'info' }) }],
      toDOM: (node) => ['div', { class: 'callout', 'data-tone': node.attrs.tone }, 0],
    },
  },
  marks: {
    kbd: { parseDOM: [{ tag: 'kbd' }], toDOM: () => ['kbd', 0] },
  },
});
```

Every editor has its own schema (`editor.schema`), so two editors on one page can use different
plugins. The output of your `toDOM` is still checked: event handler attributes, unsafe URLs and
CSS, and elements like `<script>` or `<style>` never reach `getHTML()`.

Plugins that add nodes or marks must be passed as objects, not lazy loaders, because the schema is
created together with the editor. To keep the page light, put only the nodes in that object and
move the rest (buttons, commands, key bindings) into a separate module named in `load`; it is
downloaded right after the editor is created and is part of `editor.ready`. Keep
[node views](/guides/node-views/) in the plugin object itself: they draw the document.

```ts
const callout = definePlugin({
  name: 'callout',
  nodes: { callout: calloutSpec },
  load: () => import('./callout-ui'), // definePlugin({ name: 'callout-ui', setup… })
});
```

### Loading plugins

Plugins can be passed as objects, by name, or as lazy loaders so they are only downloaded when
used:

```ts
createEditor({ element, plugins: [() => import('./my-heavy-plugin')] });
```

A plugin that throws during setup is reported in the console and skipped; the editor keeps
working. Wait for all plugins with `await editor.ready` (it also covers the table editing
chunk: `tableCommands` return `false` until it is loaded).

### Built-in plugins

| Name              | What it adds                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Controls                                                       |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------- |
| `ai`              | AI assistant with your own model through your server: improve, fix, shorten, summarize or continue text; a chat about the document that also edits the whole document; autocomplete as you type (optional). Its changes arrive as suggested edits (needs `suggestions`); see [AI assistant](/guides/ai-assistant/)                                                                                                                                                                                                                                                             | `aidialog`, `aishortcuts`, `aichat`, `aiautocomplete`          |
| `advlist`         | bullet and numbering styles (circle, square, a/A, i/I, α); `bullist` and `numlist` become split buttons (`pluginOptions.advlist`: `bullets`, `numbers`)                                                                                                                                                                                                                                                                                                                                                                                                                        | `bullist`, `numlist`                                           |
| `anchor`          | named anchors `<a id>` for `#section` links                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | `anchor`                                                       |
| `autolink`        | URLs and e-mail addresses become links as you type; pasting a URL over selected text links it                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | —                                                              |
| `autoresize`      | height follows the content between `minHeight` and `maxHeight` (`pluginOptions.autoresize`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | —                                                              |
| `autosave`        | local draft in the browser; offers to restore it after a reload or crash (`pluginOptions.autosave`: `key`, `delay`, `retention` in minutes)                                                                                                                                                                                                                                                                                                                                                                                                                                    | `restoredraft`                                                 |
| `casechange`      | lowercase, UPPERCASE and Title Case for the selection or the word at the cursor; formatting is kept, code is left alone; the button repeats the case used last. Title Case keeps English minor words (a, the, of…) small, except first and last; `pluginOptions.casechange.titleCaseMinors` replaces them                                                                                                                                                                                                                                                                      | `casechange`, menu items `lowercase`, `uppercase`, `titlecase` |
| `formatpainter`   | copy the formatting at the cursor and apply it to the next mouse selection (double click: to several, until Escape); Ctrl+Alt+C copies and Ctrl+Alt+V applies (⌘⌥C, ⌘⌥V on a Mac). Text formatting and the block's kind and layout; links, comments and suggestions stay                                                                                                                                                                                                                                                                                                       | `formatpainter`                                                |
| `permanentpen`    | while on, everything typed gets the pen's formatting (red and bold by default) — for remarks that stand apart; `configurepermanentpen` sets font, size, bold, italic, underline, strikethrough, text and highlight color (`pluginOptions.permanentpen.properties`)                                                                                                                                                                                                                                                                                                             | `permanentpen`, menu item `configurepermanentpen`              |
| `checklist`       | checklists: click a box or press Ctrl/Cmd+Enter to tick an item, type `[ ]` or `[x]` at the start of a line; HTML is compatible with Tiptap task lists, TinyMCE and GitHub checklists are recognized                                                                                                                                                                                                                                                                                                                                                                           | `checklist`                                                    |
| `codesample`      | syntax highlighting in code blocks (27 languages, loaded on demand), language menu, dialog to insert or edit code; see [Code blocks](/guides/code-blocks/)                                                                                                                                                                                                                                                                                                                                                                                                                     | `codesample`, `codelanguage`                                   |
| `accordion`       | collapsible sections `<details><summary>`: click the arrow or press Ctrl/Cmd+Enter in the title to collapse, Enter in the title starts the content, Backspace at its start removes the frame; Tiptap and TinyMCE accordions load as they are (`pluginOptions.accordion`: `initialState`, `serializedState`)                                                                                                                                                                                                                                                                    | `accordion`                                                    |
| `tableofcontents` | a table of contents that follows the headings as you edit (links to `#id`; headings get stable ids while a table of contents exists); clicking an entry in the editor goes to the heading. `pluginOptions.tableofcontents`: `depth` (3), `className`, `titleTag`, `title`, `orderedList`                                                                                                                                                                                                                                                                                       | `tableofcontents`, `tableofcontentsupdate`                     |
| `math`            | LaTeX formulas in a line (`$E=mc^2$`) and on their own line (`$$`), drawn as MathML; the converter loads only when a document has a formula; see [Formulas](/guides/math/)                                                                                                                                                                                                                                                                                                                                                                                                     | `math`                                                         |
| `charmap`         | special characters with search (currency, typography, math, arrows, Latin, Greek)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | `charmap`                                                      |
| `draghandle`      | a handle to the left of the block under the mouse: drag it to move the block (paragraph, heading, list item, table, image), click it for move up/down, duplicate and delete; the keyboard equivalent is Alt+Shift+↑/↓ (core). Mouse and pen only                                                                                                                                                                                                                                                                                                                               | —                                                              |
| `directionality`  | right-to-left text for Arabic, Hebrew, Persian (`dir` on paragraphs and headings)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | `ltr`, `rtl`                                                   |
| `emoticons`       | emoji picker and `:name` autocompletion while typing                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | `emoticons`                                                    |
| `footnotes`       | numbered footnotes: "Insert footnote" puts the next number at the cursor and the cursor into its note at the end of the document. Numbers follow the order in the text as you edit, a deleted number takes its note along, a copied one gets a note of its own; a click on a number goes to its note, `^` goes back. Enter in a note is a line break; only the notes involved change, so co-authors can type in other notes at the same time. The HTML (`sup.mce-footnote`, `div.mce-footnotes`, DPUB-ARIA roles) is the one TinyMCE writes, so its footnotes load as they are | `footnotes`, `footnotesupdate`                                 |
| `importcss`       | the classes of your content CSS (`contentCss` files and `contentStyle`) become Styles items: `p.lead` styles a paragraph, `h2.fancy` a heading, `.badge` or `span.badge` text, `img.round` an image. `pluginOptions.importcss`: `selectorFilter`, `fileFilter`, `groups` (submenus), `converter`, `append: false` to keep only the imported items                                                                                                                                                                                                                              | `styles`                                                       |
| `insertdatetime`  | insert the current date or time                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | `insertdatetime`                                               |
| `markdown`        | Markdown pasted as plain text becomes formatting (headings, lists, quotes, code, tables, links, bold, italic); a notification offers Paste as text; see [Markdown](/guides/markdown/#pasting-markdown)                                                                                                                                                                                                                                                                                                                                                                         | —                                                              |
| `media`           | YouTube, Vimeo and .mp4/.webm video; only these sources are ever embedded                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | `media`                                                        |
| `nonbreaking`     | nonbreaking space, also Ctrl/Cmd+Shift+Space                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | `nonbreaking`                                                  |
| `importword`      | open a Word document (.docx); see [Word documents](/guides/word/)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | `importword`                                                   |
| `exportword`      | save the document as .docx; see [Word documents](/guides/word/)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | `exportword`                                                   |
| `exportpdf`       | save the document as a PDF file made by your server, with the page layout's sheet, header and footer; without a server it opens the print dialog; see [Pages and printing](/guides/pages-and-printing/#a-pdf-file-from-the-button)                                                                                                                                                                                                                                                                                                                                             | `exportpdf`                                                    |
| `pagelayout`      | page layout: a sheet of the real size with margins, lines where pages end, printing with the same sheet; see [Pages and printing](/guides/pages-and-printing/)                                                                                                                                                                                                                                                                                                                                                                                                                 | —                                                              |
| `pagebreak`       | page break for printing and PDF                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | `pagebreak`                                                    |
| `quickbars`       | formatting next to the selection and quick insert on empty lines; on touch screens the formatting bar sits above the keyboard and the insert bar is not shown                                                                                                                                                                                                                                                                                                                                                                                                                  | —                                                              |
| `email`           | Email preview: the content as an email client shows it (styles inline, a centered column, a desktop or a phone screen), its size, and copying it as an email or as HTML code; the HTML itself comes from `emailHTML(editor)` in `@novaprose/core/email`; see [Email](/guides/email/)                                                                                                                                                                                                                                                                                           | `emailpreview`                                                 |
| `a11ychecker`     | the Accessibility panel: images without alternative text, skipped heading levels, lists typed by hand, low contrast, vague links and more (WCAG 2.1), each with a fix where one is clear; the rules run on a server too (`@novaprose/core/a11y`); see [Accessibility checker](/guides/accessibility-checker/)                                                                                                                                                                                                                                                                  | `a11ycheck`                                                    |
| `spellchecker`    | spelling and grammar checked as you type by your own service (LanguageTool or a `check` function), problems underlined with `aria-invalid`, a bubble with corrections, Ignore, Ignore all and Add to dictionary; Alt+F7 goes to the next problem; see [Spell check](/guides/spell-check/)                                                                                                                                                                                                                                                                                      | `spellchecker`, `spellcheckdialog`                             |
| `save`            | the Save button and Ctrl/Cmd+S: `pluginOptions.save.onSave(editor)` saves (for example, sends `getHTML()` to your server); without it the form around the editor is submitted. Enabled only with unsaved changes (`enableWhenDirty: false` — always); Cancel brings back the text of the last save (`onCancel`)                                                                                                                                                                                                                                                                | `save`, `cancel`                                               |
| `template`        | "Insert template": your templates with a description and a preview (`pluginOptions.template.templates`: a list of `{ title, description, content }` or `{ …, url }`, a URL of a JSON list, or a function); `{$name}` becomes `values.name` as text, an element with the class `selcontent` gets the selection, `cdate` and `mdate` get the date (`creationDateFormat`, `%Y-%m-%d`); only what is inside `div.mceTmpl` is inserted                                                                                                                                              | `template`                                                     |
| `visualblocks`    | outlines blocks and shows their tags; `pluginOptions.visualblocks.default` to start enabled                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | `visualblocks`                                                 |
| `visualchars`     | shows invisible characters: no-break spaces as a dot, soft hyphens and zero-width spaces as a dashed mark; only the view changes, and screen readers read the text as before (`pluginOptions.visualchars.default` to start enabled)                                                                                                                                                                                                                                                                                                                                            | `visualchars`                                                  |

Most built-in plugins are loaded lazily as separate chunks, so they don't increase the core bundle.
Plugins that add document nodes (`anchor`, `accordion`, `footnotes`, `math`, `media`, `pagebreak`,
`tableofcontents` and others) keep their schema and how the document is drawn in the core, so a
document opens complete without a network request; their buttons and dialogs load lazily.
