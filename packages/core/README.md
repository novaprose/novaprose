# @novaprose/core

**NovaProse** is an embeddable rich text (WYSIWYG) editor built on [ProseMirror](https://prosemirror.net).
It is open source (MIT), produces clean, deterministic HTML, and includes real-time collaboration,
comments and version history. Toolbar, plugin and option names follow familiar conventions.

> **Status: 0.x preview.** The API may change between minor versions until 1.0.

- **Secure by default.** Every link and image URL is checked on input _and_ on output, dangerous
  markup is dropped, and the UI never injects user content with `innerHTML`.
- **Deterministic HTML.** `getHTML()` produces the same string in every browser, so diffs and
  snapshot tests stay stable.
- **Accessible.** ARIA roles, full keyboard support (Alt+F10 toolbar, Alt+F9 menu bar, Esc),
  visible focus, screen-reader labels.
- **Complete out of the box.** Tables, images with upload and resize, links, colors, fonts, line
  height, search and replace, source code view, fullscreen, menu bar, slash commands, Markdown
  shortcuts, paste sanitizing (anything outside the schema is dropped), English and Russian UI,
  light and dark theme. Dedicated Word and Excel paste cleanup is on the roadmap.
- **Small.** About 120 KB gzip including ProseMirror and tables. Optional plugins load lazily.

## Install

```bash
npm install @novaprose/core
```

```ts
import { createEditor } from '@novaprose/core';
import '@novaprose/core/style.css';

const editor = createEditor({
  element: document.querySelector('#editor')!,
  content: '<p>Hello, world</p>',
  placeholder: 'Start typing…',
  // Familiar toolbar syntax; "|" separates groups. Items that don't fit move into "⋯".
  toolbar:
    'undo redo | blocks | bold italic underline | forecolor backcolor | link image table | bullist numlist',
  // Upload pasted, dropped and picked images to your server.
  uploadImage: async (file) => {
    const body = new FormData();
    body.append('file', file);
    const response = await fetch('/upload', { method: 'POST', body });
    return (await response.json()).url;
  },
  onChange: (e) => console.log(e.getHTML()),
});

editor.exec('bold');
editor.getHTML();
editor.destroy();
```

Using a framework? See [`@novaprose/react`](https://www.npmjs.com/package/@novaprose/react),
[`@novaprose/vue`](https://www.npmjs.com/package/@novaprose/vue),
[`@novaprose/angular`](https://www.npmjs.com/package/@novaprose/angular) or the framework-agnostic
[`@novaprose/web-component`](https://www.npmjs.com/package/@novaprose/web-component) (also for
Svelte, Astro and server-rendered pages, with a CDN build).

## Options

| Option                                               | Description                                                                                                                                                                                          |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `element`                                            | container to mount into (required)                                                                                                                                                                   |
| `content`                                            | initial HTML string or document JSON                                                                                                                                                                 |
| `toolbar`                                            | string (`'bold italic \| link'`), array of groups, or `false`                                                                                                                                        |
| `toolbarMode`                                        | `'sliding'` (default) or `'wrap'`                                                                                                                                                                    |
| `mode`                                               | `'classic'`, `'inline'` (toolbar on focus) or `'distraction-free'` (quick bars)                                                                                                                      |
| `menubar`, `menu`                                    | File · Edit · View · Insert · Format · Table · Help menus, customizable                                                                                                                              |
| `statusbar`                                          | word count and path; `false` to hide                                                                                                                                                                 |
| `placeholder`, `editable`, `language`                | placeholder text, read-only mode, UI language (`en`, `ru` or your own)                                                                                                                               |
| `disabled`                                           | disabled like a form field: no editing, skipped by Tab, dimmed UI                                                                                                                                    |
| `resize`                                             | resize handle in the status bar: `true` (height) or `'both'`; mouse, touch and arrow keys                                                                                                            |
| `blockFormats`                                       | items and order of the block menu: `[{ label: 'Subheading', block: 'h3' }]`                                                                                                                          |
| `contentStyle`, `contentCss`                         | styles for the text only (like TinyMCE `content_style` / `content_css`): scoped to this editor, `body` means the text area, `@import` and relative `url()` work, no `unsafe-inline` needed under CSP |
| `uploadImage`                                        | `(file, progress) => Promise<url>`                                                                                                                                                                   |
| `filePicker`, `filePickerTypes`                      | your file manager behind a Browse button in the link, image and video dialogs: `({ type, value }) => Promise<{ url, text?, title?, alt? }                                                            | null>` |
| `fontFamilies`, `fontSizes`, `lineHeights`, `colors` | lists for the corresponding pickers                                                                                                                                                                  |
| `plugins`, `pluginOptions`                           | plugin objects or names of built-in lazy plugins (`insertdatetime`, `quickbars`)                                                                                                                     |
| `validElements`, `invalidElements`, `validStyles`    | restrict content, like TinyMCE `valid_elements` / `invalid_elements`                                                                                                                                 |
| `pastePreprocess`, `pastePostprocess`, `pasteAsText` | paste hooks and plain-text mode                                                                                                                                                                      |
| `setup`, `onChange`                                  | access the instance before first render; change callback                                                                                                                                             |
| `prosemirrorPlugins`                                 | raw ProseMirror plugins for advanced use                                                                                                                                                             |

## API

```ts
editor.getHTML();
editor.getJSON();
editor.getText();
editor.isEmpty();
editor.setContent(html, { addToHistory: false });
editor.exec('bold');
editor.can('undo');
editor.isActive('h2');
editor.setEditable(false);
editor.setDisabled(true);
editor.focus();
editor.on('change' | 'selectionChange' | 'focus' | 'blur' | 'editableChange' | 'destroy', handler);
editor.ui.registry.addButton('signature', { text: 'Sign', onAction: (e) => e.exec('bold') });
editor.destroy();
```

Command names (`bold`, `italic`, `h1`…`h6`, `bulletList`, `alignCenter`, `undo`…) are part of the
public API and stay stable across minor versions.

## Server-side rendering

Importing the package never touches `window` or `document`, so it is safe in SSR bundles. Create
the editor only in the browser.

## License

MIT
