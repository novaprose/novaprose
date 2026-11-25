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

| Method / property                          | Description                                                               |
| ------------------------------------------ | ------------------------------------------------------------------------- |
| `focus()`                                  | focus the text                                                            |
| `isEditable()`, `setEditable(value)`       | read-only mode                                                            |
| `isPasteAsText()`, `setPasteAsText(value)` | plain-text paste mode                                                     |
| `openSearch()`, `closeSearch()`            | the search and replace bar                                                |
| `isAllowed(name): boolean`                 | whether content rules allow an element or control                         |
| `hasPlugin(name): boolean`                 | whether a plugin is active                                                |
| `rebuildToolbar()`                         | re-render the toolbar after registering controls late                     |
| `updateUI()`                               | refresh toolbar state (pressed/disabled) after a display-only change      |
| `ready: Promise<void>`                     | resolves when all plugins (including lazy ones) are set up                |
| `mode`                                     | `'classic'`, `'inline'` or `'distraction-free'`                           |
| `root: HTMLElement`                        | the editor's root element                                                 |
| `ui.registry`                              | register controls ([Custom buttons](/guides/custom-buttons-and-plugins/)) |
| `ui.t(key)`                                | translate a UI string                                                     |
| `schema`                                   | this editor's document schema: built-in plus plugin nodes and marks       |
| `view`                                     | the underlying ProseMirror `EditorView` (advanced use)                    |
| `destroy()`                                | remove the editor and all its listeners                                   |

## Events

```ts
const off = editor.on('change', (e) => save(e.getHTML()));
off(); // unsubscribe
```

| Event             | When                                        |
| ----------------- | ------------------------------------------- |
| `change`          | the document changed                        |
| `selectionChange` | the selection moved or the document changed |
| `focus`, `blur`   | the text gained or lost focus               |
| `editableChange`  | read-only mode was switched                 |
| `destroy`         | the editor is being destroyed               |

Listeners receive the editor instance. `editor.off(event, listener)` removes a listener as well.

## Utilities

```ts
import { isSafeLinkUrl, isSafeImageUrl, htmlToPlainText, defaultToolbar } from '@novaprose/core';
```

`isSafeLinkUrl` and `isSafeImageUrl` expose the same URL allowlist the editor uses, so you can
apply it on your server too.
