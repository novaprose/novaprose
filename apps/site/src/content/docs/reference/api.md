---
title: Editor API
description: Methods, events and named commands of the NovaProse editor.
---

`createEditor(options)` returns an `Editor`. It is the only public entry point; the framework
packages wrap the same object.

## Content

| Method                                  | Description                                                                                |
| --------------------------------------- | ------------------------------------------------------------------------------------------ |
| `getHTML(): string`                     | the document as clean, deterministic HTML                                                  |
| `getJSON(): object`                     | the document as JSON (can be passed back as `content`)                                     |
| `getText(): string`                     | plain text                                                                                 |
| `isEmpty(): boolean`                    | `true` when the document has no content                                                    |
| `setContent(content, { addToHistory })` | replace the document with HTML or JSON; `addToHistory: false` keeps it out of undo history |

## Commands

| Method                       | Description                                               |
| ---------------------------- | --------------------------------------------------------- |
| `exec(command): boolean`     | run a named command; returns `false` if it does not apply |
| `can(command): boolean`      | whether the command applies to the current selection      |
| `isActive(command): boolean` | whether the selection already has this format             |
| `getCommandState(command)`   | `{ active, enabled }` for a custom toolbar button         |

Named commands — part of the public API, stable across minor versions:

| Group     | Commands                                                              |
| --------- | --------------------------------------------------------------------- |
| Marks     | `bold` `italic` `underline` `strike` `code` `subscript` `superscript` |
| Blocks    | `paragraph` `h1` `h2` `h3` `h4` `h5` `h6` `blockquote` `codeBlock`    |
| Lists     | `bulletList` `orderedList` `indent` `outdent`                         |
| Alignment | `alignLeft` `alignCenter` `alignRight` `alignJustify`                 |
| Other     | `horizontalRule` `unlink` `clearFormatting` `undo` `redo`             |

`exec()` and `can()` also accept a raw ProseMirror `Command` for advanced use.

## State and UI

| Method / property                          | Description                                                                                                 |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| `focus()`                                  | focus the text                                                                                              |
| `isEditable()`, `setEditable(value)`       | read-only mode                                                                                              |
| `isPasteAsText()`, `setPasteAsText(value)` | plain-text paste mode                                                                                       |
| `openSearch()`, `closeSearch()`            | the search and replace bar                                                                                  |
| `isAllowed(name): boolean`                 | whether content rules allow an element or control                                                           |
| `hasPlugin(name): boolean`                 | whether a plugin is active                                                                                  |
| `rebuildToolbar()`                         | re-render the toolbar after registering controls late                                                       |
| `updateUI()`                               | refresh toolbar state (pressed/disabled) after a display-only change                                        |
| `ready: Promise<void>`                     | resolves when all plugins and lazy parts (e.g. table editing) are set up                                    |
| `mode`                                     | `'classic'`, `'inline'` or `'distraction-free'`                                                             |
| `root: HTMLElement`                        | the editor's root element                                                                                   |
| `ui.registry`                              | register controls ([Custom buttons](/guides/custom-buttons-and-plugins/))                                   |
| `ui.t(key)`                                | translate a UI string                                                                                       |
| `ui.addStyles(id, css)`                    | add a plugin's styles once per page (or shadow root), CSP-friendly                                          |
| `ui.dialog(spec)`                          | a dialog from a list of fields ([Plugins](/guides/custom-buttons-and-plugins/#a-dialog))                    |
| `ui.sidebar`                               | `show(name)`, `hide()`, `toggle(name)`, `active` ([Plugins](/guides/custom-buttons-and-plugins/#a-sidebar)) |
| `ui.notify(text \| options)`               | a notification, optionally with action buttons                                                              |
| `schema`                                   | this editor's document schema: built-in plus plugin nodes and marks                                         |
| `view`                                     | the underlying ProseMirror `EditorView` (advanced use)                                                      |
| `destroy()`                                | remove the editor and all its listeners                                                                     |

## Events

```ts
const off = editor.on('change', (e) => save(e.getHTML()));
off(); // unsubscribe
```

| Event              | When                                                             | Details (2nd argument) |
| ------------------ | ---------------------------------------------------------------- | ---------------------- |
| `init`             | the editor is ready (lazy plugins and content styles loaded)     | —                      |
| `change`           | the document changed in any way: typing, API, a collaborator     | `{ transaction }`      |
| `input`            | **the user** changed the document (typing, paste, toolbar, keys) | `{ transaction }`      |
| `selectionChange`  | the selection moved or the document changed                      | `{ transaction }`      |
| `beforeSetContent` | before `setContent()`; assign `detail.content` to change it      | `{ content }`          |
| `setContent`       | after `setContent()`                                             | `{ content }`          |
| `keydown`          | a key in the text, before the editor handles it                  | `{ event }`            |
| `focus`, `blur`    | the text gained or lost focus                                    | `{ event }`            |
| `editableChange`   | read-only or disabled mode was switched                          | —                      |
| `destroy`          | the editor is being destroyed                                    | —                      |

Listeners receive the editor and the details. `editor.off(event, listener)` removes a listener as
well. An exception in your listener is reported to the console and does not break the editor.

Use `input` for "unsaved changes" indicators and `change` to save: `change` also fires for
`setContent()` and for edits from collaborators.

```ts
// Ctrl+Enter sends the message instead of starting a new paragraph.
editor.on('keydown', (editor, { event }) => {
  if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
    event.preventDefault();
    send(editor.getHTML());
  }
});
```

## Utilities

```ts
import { isSafeLinkUrl, isSafeImageUrl, htmlToPlainText, defaultToolbar } from '@novaprose/core';
```

`isSafeLinkUrl` and `isSafeImageUrl` expose the same URL allowlist the editor uses, so you can
apply it on your server too.
