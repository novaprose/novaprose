---
title: Editor API
description: Methods, events and named commands of the NovaProse editor.
---

`createEditor(options)` returns an `Editor`. It is the only public entry point; the framework
packages wrap the same object.

## Content

| Method                                            | Description                                                                                                                                      |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `getHTML({ fullPage }): string`                   | the document as clean, deterministic HTML; with the fullpagehtml plugin the [whole page](/guides/full-page/), `fullPage: false` only the content |
| `getJSON(): object`                               | the document as JSON (can be passed back as `content`)                                                                                           |
| `getText(): string`                               | plain text                                                                                                                                       |
| `isEmpty(): boolean`                              | `true` when the document has no content                                                                                                          |
| `setContent(content, { addToHistory, fullPage })` | replace the document with HTML or JSON; `addToHistory: false` keeps it out of undo history, `fullPage: false` keeps a whole page's head as it is |

## Selection

`editor.selection` reads and moves the selection. Positions are document positions: `0` is before
the first block, and every character and block boundary counts one.

| Method                                       | Description                                                                                                                                      |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `getHTML(): string`                          | the selected content as HTML, as `getHTML()` writes it; `''` for a cursor                                                                        |
| `getText(): string`                          | the selected text, blocks on separate lines                                                                                                      |
| `setHTML(html): boolean`                     | replace the selection with HTML, read and checked like `insertContent()`                                                                         |
| `getRange(): { from, to }`                   | where the selection starts and ends                                                                                                              |
| `setRange(from, to?)`                        | select from `from` to `to`; without `to`, a cursor at `from`                                                                                     |
| `isCollapsed(): boolean`                     | whether it is only a cursor                                                                                                                      |
| `collapse(toStart?)`                         | collapse it to its end, or to its start                                                                                                          |
| `selectAll()`                                | select the whole document                                                                                                                        |
| `getNode(): HTMLElement`                     | the element of the editing area where the selection is: all of a bold word gives its `<strong>`, a selection across elements their common parent |
| `select(element, content?)`                  | select an element of the editing area, or (`content: true`) what is inside it                                                                    |
| `setCursorLocation(node, offset?)`           | put the cursor in a node of the editing area                                                                                                     |
| `getDOMRange(): Range`                       | the selection as a DOM `Range`, to measure it                                                                                                    |
| `getRect(): DOMRect`                         | where the selection is on the screen, for a popup of your own                                                                                    |
| `getBookmark()` / `moveToBookmark(bookmark)` | remember the selection and put it back later: changes made in between move it along; `false` when its text was deleted                           |
| `scrollIntoView()`                           | scroll the selection into view                                                                                                                   |

```ts
// Your own dialog: the selection is put back after it, wherever changes moved it meanwhile.
const bookmark = editor.selection.getBookmark();
const choice = await openYourDialog(editor.selection.getText());
editor.selection.moveToBookmark(bookmark);
if (choice === 'quote') editor.exec('blockquote');
```

## Documents without an editor

Turn a saved JSON document into the same HTML as `getHTML()` without an editor or a DOM: on a
server, in a worker, at build time. See [Rendering on the server](/guides/server-rendering/).

```ts
import { createRenderer, renderHTML } from '@novaprose/core';
```

| Function                    | Description                                                                                                         |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `createRenderer(options)`   | `{ html(json, { fullPage }), text(json), doc(json), schema }` for the editor's options; reuse it for many documents |
| `renderHTML(json, options)` | HTML of one document                                                                                                |

## Commands

| Method                       | Description                                               |
| ---------------------------- | --------------------------------------------------------- |
| `exec(command): boolean`     | run a named command; returns `false` if it does not apply |
| `can(command): boolean`      | whether the command applies to the current selection      |
| `isActive(command): boolean` | whether the selection already has this format             |
| `getCommandState(command)`   | `{ active, enabled }` for a custom toolbar button         |

Named commands — part of the public API, stable across minor versions:

| Group     | Commands                                                                                         |
| --------- | ------------------------------------------------------------------------------------------------ |
| Marks     | `bold` `italic` `underline` `strike` `code` `subscript` `superscript`                            |
| Blocks    | `paragraph` `h1` `h2` `h3` `h4` `h5` `h6` `blockquote` `codeBlock` `moveBlockUp` `moveBlockDown` |
| Lists     | `bulletList` `orderedList` `indent` `outdent`                                                    |
| Alignment | `alignLeft` `alignCenter` `alignRight` `alignJustify`                                            |
| Other     | `horizontalRule` `unlink` `clearFormatting` `undo` `redo`                                        |

`exec()` and `can()` also accept a raw ProseMirror `Command` for advanced use.

### Chains

`chain()` joins several commands into one edit: one undo step, one `change` event.

```ts
import { setStyle } from '@novaprose/core';

editor.chain().exec('h2').exec('alignCenter').run();
editor.chain().insertContent('<p>Note</p>').exec(setStyle('color', '#e03e2d')).run();

const enabled = editor.chain().exec('h2').exec('alignCenter').can(); // for a button
```

| Method                | Description                                                                          |
| --------------------- | ------------------------------------------------------------------------------------ |
| `exec(command)`       | a named command or a ProseMirror `Command` (`setStyle(…)`, `applyLink(…)`, your own) |
| `insertContent(html)` | insert HTML at the cursor, as `editor.insertContent()`                               |
| `run(): boolean`      | apply all steps; returns `false` and changes nothing if any step does not apply      |
| `can(): boolean`      | whether `run()` would succeed now; the document does not change                      |

Each step sees the document and selection left by the previous steps. `undo` and `redo` run on
their own and are not accepted in a chain. A custom command in a chain must build its changes on
`state.tr` (as ProseMirror commands do), not on `view.state.tr`.

## State and UI

| Method / property                          | Description                                                                                                 |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| `focus()`                                  | focus the text                                                                                              |
| `isEditable()`, `setEditable(value)`       | read-only mode                                                                                              |
| `isDisabled()`, `setDisabled(value)`       | disabled mode: no editing, no focus, dimmed, like a disabled form field                                     |
| `isPasteAsText()`, `setPasteAsText(value)` | plain-text paste mode                                                                                       |
| `openSearch()`, `closeSearch()`            | the search and replace bar                                                                                  |
| `isAllowed(name): boolean`                 | whether content rules allow an element or control                                                           |
| `hasPlugin(name): boolean`                 | whether a plugin is active                                                                                  |
| `rebuildToolbar()`                         | re-render the toolbar after registering controls late                                                       |
| `updateUI()`                               | refresh toolbar state (pressed/disabled) after a display-only change                                        |
| `ready: Promise<void>`                     | resolves when all plugins and lazy parts (e.g. table editing) are set up                                    |
| `mode`                                     | `'classic'`, `'inline'` or `'distraction-free'`                                                             |
| `direction`                                | `'ltr'` or `'rtl'`: from the `direction` option or the language                                             |
| `formatter`                                | named formats: `apply(name)`, `remove(name)`, `toggle(name)`, `match(name)`, `register(name, spec)`         |
| `root: HTMLElement`                        | the editor's root element                                                                                   |
| `ui.registry`                              | register controls ([Custom buttons](/guides/custom-buttons-and-plugins/))                                   |
| `ui.t(key)`                                | translate a UI string                                                                                       |
| `ui.addStyles(id, css)`                    | add a plugin's styles once per page (or shadow root), CSP-friendly                                          |
| `ui.dialog(spec)`                          | a dialog from a list of fields ([Plugins](/guides/custom-buttons-and-plugins/#a-dialog))                    |
| `ui.sidebar`                               | `show(name)`, `hide()`, `toggle(name)`, `active` ([Plugins](/guides/custom-buttons-and-plugins/#a-sidebar)) |
| `ui.notify(text \| options)`               | a notification, optionally with action buttons                                                              |
| `ui.announce(text)`                        | say a short message to screen readers (a hidden polite live region), without moving focus                   |
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

More functions for your own toolbar and integrations — reading the state, commands with parameters,
the built-in dialogs, defaults to extend — are in [Helper functions](/reference/helpers/).
