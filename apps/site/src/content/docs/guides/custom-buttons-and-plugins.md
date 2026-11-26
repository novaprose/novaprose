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
