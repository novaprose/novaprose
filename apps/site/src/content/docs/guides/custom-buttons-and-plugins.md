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
`addMenuItem` and `addToggleMenuItem` for the menu bar.

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

| Field                | Description                                                         |
| -------------------- | ------------------------------------------------------------------- |
| `name`               | unique name, also used in `requires` of other plugins               |
| `requires`           | plugins that must be set up first                                   |
| `setup`              | register controls and listeners; may return a cleanup function      |
| `toolbar`            | controls appended to the default toolbar                            |
| `prosemirrorPlugins` | `(editor) => Plugin[]` for low-level input handling and decorations |

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
created together with the editor.

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

| Name             | What it adds                                                                                                                                            | Controls             |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| `advlist`        | bullet and numbering styles (circle, square, a/A, i/I, α); `bullist` and `numlist` become split buttons (`pluginOptions.advlist`: `bullets`, `numbers`) | `bullist`, `numlist` |
| `anchor`         | named anchors `<a id>` for `#section` links                                                                                                             | `anchor`             |
| `autolink`       | URLs and e-mail addresses become links as you type; pasting a URL over selected text links it                                                           | —                    |
| `autoresize`     | height follows the content between `minHeight` and `maxHeight` (`pluginOptions.autoresize`)                                                             | —                    |
| `autosave`       | local draft in the browser; offers to restore it after a reload or crash (`pluginOptions.autosave`: `key`, `delay`, `retention` in minutes)             | `restoredraft`       |
| `charmap`        | special characters with search (currency, typography, math, arrows, Latin, Greek)                                                                       | `charmap`            |
| `directionality` | right-to-left text for Arabic, Hebrew, Persian (`dir` on paragraphs and headings)                                                                       | `ltr`, `rtl`         |
| `emoticons`      | emoji picker and `:name` autocompletion while typing                                                                                                    | `emoticons`          |
| `insertdatetime` | insert the current date or time                                                                                                                         | `insertdatetime`     |
| `media`          | YouTube, Vimeo and .mp4/.webm video; only these sources are ever embedded                                                                               | `media`              |
| `nonbreaking`    | nonbreaking space, also Ctrl/Cmd+Shift+Space                                                                                                            | `nonbreaking`        |
| `pagebreak`      | page break for printing and PDF                                                                                                                         | `pagebreak`          |
| `quickbars`      | formatting next to the selection and quick insert on empty lines                                                                                        | —                    |
| `visualblocks`   | outlines blocks and shows their tags; `pluginOptions.visualblocks.default` to start enabled                                                             | `visualblocks`       |

Most built-in plugins are loaded lazily as separate chunks, so they don't increase the core bundle.
`anchor`, `media` and `pagebreak` add document nodes, so they are part of the core and enabled by name
without a network request.
