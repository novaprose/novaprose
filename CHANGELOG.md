# Changelog

All packages in this repository are versioned together. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow [SemVer](https://semver.org/)
(until 1.0, minor versions may contain breaking changes).

## Unreleased

### Markdown

- `@novaprose/core/markdown`: `markdownToHTML()` (CommonMark + GitHub tables and strikethrough,
  raw HTML not interpreted) and `toMarkdown(editor)`. A separate import (~46 KB gzip with the
  parser) — the core first load does not change. Output is stable across export/import, verified by
  property-based tests that also found and fixed: lists merging, headings losing a trailing `#`,
  a line break followed by `#` becoming a heading, `2025.` / `1)` becoming lists, plain-text
  addresses turning into links and code blocks gaining empty lines.

### Events

- New events: `init` (editor ready), `input` (the user changed the document — not `setContent()`,
  `insertContent()` or a collaborator), `beforeSetContent` (can replace the content), `setContent`
  and `keydown` (`preventDefault()` stops the editor from handling the key, e.g. Ctrl+Enter to send).
- Listeners get details as a second argument: `{ transaction }`, `{ event }`, `{ content }`.
  Existing one-argument listeners keep working. An exception in a listener no longer breaks the
  editor or other listeners.
- `editor.getCommandState(name)` returns `{ active, enabled }` for custom toolbars.
- `@novaprose/collab` marks collaborators' changes with `REMOTE_CHANGE_META`.

### Localization

- Language packs for German, Spanish, French, Italian and Portuguese (Brazil):
  `import de from '@novaprose/core/i18n/de'; registerLanguage('de', de)`. Each covers the core
  and all built-in plugins (289 strings), ships as a separate ~4 KB import and is marked as a draft
  until reviewed by a native speaker.
- `scripts/i18n.mjs`: `template` exports every UI string for translators, `check` verifies that
  packs have every key and the same `{placeholders}` (part of `pnpm check`).
- Plugin strings are now part of the common translation system. `registerLanguage()` and the
  `translations` option translate plugins too, with keys prefixed by the plugin name
  (`'anchor.title'`, `'comments.reply'`, `'charmap.groups.0'`). Before, a custom language
  translated the core UI only and plugins stayed in English.
- `getPluginMessages()` lists the strings of loaded plugins by language — a template for translators.
- New types `LanguagePack` and `PluginMessageKey`; `translations` accepts plugin keys.

### Performance

- Smaller first load: the Word / Google Docs / Excel paste cleanup is now a separate chunk, loaded in
  the background right after the editor is created (core: 149.9 → 146.4 KB gzip). A paste in the
  first milliseconds waits for it, so nothing is lost; `await editor.ready` covers it too.

### Fixes

- Spaces you type are no longer lost on save: leading spaces (indentation), double spaces, a space
  after a line break (Shift+Enter) and a trailing space now survive `getHTML()` → `setContent()`.
  They are written as `&nbsp;` where the browser would otherwise collapse them.
- Pasted or loaded HTML with formulas (MathML, e.g. from Word) or inline SVG no longer throws:
  a formula is kept as its text, SVG markup is dropped.
- JSON documents from outside (database, API, older versions) with attribute values of the wrong
  type — `null`, numbers, out-of-range heading levels, `colspan: null` — no longer make
  `setContent()` or `getHTML()` throw. Invalid values fall back to defaults instead of rejecting
  the whole document; a heading level outside 1–6 becomes 1.
- CommonJS users get correct TypeScript types: `exports` now point `require` to `.d.cts`.
  `@novaprose/react` and `@novaprose/vue` are marked side-effect free for better tree-shaking.

### Accessibility

- Toolbar menu buttons with visible text (block format, font, size) start their accessible name
  with that text (WCAG 2.5.3), so voice control finds them.
- The color palette grid has proper rows for screen readers.
- The editing area no longer carries `aria-expanded`, which is not allowed on a text box.
- Contrast (WCAG AA, 4.5:1) in light and dark themes: muted text, shortcut hints, the placeholder,
  the dialog divider and primary buttons (new tokens `--nova-accent-strong`,
  `--nova-accent-strong-hover`).

## 0.6.0 — 2026-11-25

Templates and documents: merge tags, formats, table styles and scoped content styles — enough to
move a print-forms editor (receipts, acts, invoices) to NovaProse without losing a single variable.

### Editor

- `disabled` option and `editor.setDisabled()`: a disabled editor works like a disabled form field —
  no editing, skipped by Tab, dimmed UI, `aria-disabled`.
- `resize` option: a resize handle in the status bar (`true` — height, `'both'` — height and width),
  usable with mouse, touch and arrow keys.
- `blockFormats` option: your own items and order for the block menu.
- `contentStyle` and `contentCss` options: your styles for the text only. Each editor gets its own
  scope (no iframe needed, the rest of the page is untouched), `body` means the text area, `@import`
  and relative `url()` work, and the styles are attached as constructable stylesheets, so a strict
  CSP without `unsafe-inline` is fine. `await editor.ready` waits for the files.
- Formats: `formats`, `styleFormats` and a Formats menu (`styles` toolbar button, grouped, with
  previews) plus `editor.formatter` (`register`, `apply`, `remove`, `toggle`, `match`, `canApply`).
  Formats can change the block type, mark text (span with classes, colours and fonts, or strong, em,
  code…) or add classes and alignment to existing paragraphs, headings, quotes and images.
- `class` on paragraphs, headings, quotes, images and text spans is now part of the document. Only
  classes from your formats (and `validClasses`) are kept, so the default output is unchanged and
  pasted junk like `MsoNormal` never enters the document. Office pastes drop their classes after
  their styles are inlined.
- New `mergetags` plugin: template variables (“Customer name”, “Order number”) as non-editable
  chips, inserted from a grouped toolbar menu or by typing `{{`. Saved as
  `<span data-mergetag="key">Label</span>`; the attribute is configurable (`data-var`…), labels come
  from your list, unknown keys are kept and highlighted. See the
  [merge tags guide](https://novaprose.com/guides/merge-tags/).
- Plugins can define nodes from their options (`nodes: (editor) => ({…})`), and a node spec can set
  `ignoreStyles: true` so its element's inline styles never become marks.
- `tableClassList` and `tableCellClassList` options: a Style select in the table and cell
  properties dialogs; tables and cells keep the chosen class in HTML, your CSS (`contentCss`) draws it.
- `filePicker` option: plug in your own file manager — a Browse button appears next to the address
  field in the link, image and video dialogs (`filePickerTypes` limits which ones).
- `editor.insertContent(html)`: insert HTML at the cursor through the editor's schema (same cleanup
  as paste). Blocks become separate blocks; a table inserted while the cursor is inside a table goes
  after it instead of overwriting its cells. tinymce-compat's `insertContent` now uses it.

### Fixes

- A non-editable inline element at the end of a paragraph (merge tag, mention, image) no longer
  adds an empty line on sites whose CSS resets `img { display: block }`: the ProseMirror separator
  now has its required inline style.
- Tables without set column widths no longer demand 100px per column, so a five-column table fits a
  narrow editor instead of overflowing it.
- A table or cell style made of several classes (`'pf-grid pf-plain'`) is kept whole.

### TinyMCE compatibility

- `content_css`; `content_style` now uses the same scoping (selectors are prefixed instead of
  relying on CSS nesting).
- `formats`, `style_formats` (+ `style_formats_merge`), `valid_classes` and `editor.formatter.register`;
  without `valid_classes` every class is kept, as in TinyMCE.
- `editor.selection.setCursorLocation` and `editor.selection.select`.
- `table_class_list` and `table_cell_class_list`.
- `file_picker_callback` and `file_picker_types`.
- `block_formats`, `disabled` (including `editor.options.set('disabled', …)`) and `resize` (on by
  default, as in TinyMCE).

## 0.5.3 — 2026-11-25

### Editor

- New icon set: every toolbar, menu and plugin icon now comes from [Lucide](https://lucide.dev)
  (ISC) instead of hand-drawn SVGs — one grid, one stroke weight, clearer table and image
  actions. License texts ship in `THIRD_PARTY_NOTICES.md`.

### Site

- New product site: home page with a live editor, features, collaboration, integrations and FAQ;
  [pricing](https://novaprose.com/pricing/) (Open Source free forever, Cloud in early access,
  Enterprise); [NovaProse Cloud](https://novaprose.com/cloud/) with an early-access waitlist; privacy
  policy; English and Russian; light and dark themes.

### Sync server

- `POST /waitlist` stores Cloud early-access sign-ups (validated, rate-limited, no IP stored).

## 0.5.2 — 2026-11-25

- Package descriptions and READMEs updated; the source is now public at
  [github.com/novaprose/novaprose](https://github.com/novaprose/novaprose).
- First release published from the public repository.

## 0.5.1 — 2026-11-25

0.5.0 was tagged but never published (the release build failed); 0.5.1 is the same release.

### Release tooling

- The build now runs on Linux CI as well: the packages filter is quoted so the shell does not expand it.

### `@novaprose/tinymce-compat`

- **Dialogs** — `windowManager.open` with panels and tabs, inputs, selects, checkboxes, buttons, HTML
  panels (sanitized), banners and grids; `initialData`, `onSubmit`, `onChange`, `onAction`, `onCancel`,
  `onClose`, `onTabChange` and the dialog `api`.
- `editor.ui.registry.addContextToolbar`; `editor.dom` for reading the content (`select`, `getParent`,
  `getAttrib`, `encode`…); `editor.formatter` (`apply`/`remove`/`toggle`/`match`) for built-in formats.

### Site

- [Switch from TinyMCE](https://novaprose.com/migrate/): run your `tinymce.init()` toolbar and plugins
  on NovaProse right on the page.

## 0.4.0 — 2026-11-25

### `@novaprose/core`

- **Suggested edits** (`plugins: ['suggestions']`, buttons `suggestions` and `reviewsuggestions`,
  Ctrl+Alt+Shift+E): typing and deleting become suggestions (`<ins>`/`<del>` with author and time)
  that are accepted or rejected one by one or all at once; author colors and “who, when” tooltips;
  options `author`, `enabled`, `force`, `canReview`. Works in real-time collaboration.
  `listSuggestions`, `resolveSuggestions`, `suggestionsResult`, `isSuggesting`, `setSuggesting`.
- Plugins can rewrite transactions before they apply (`transformTransaction`).
- New exports for integrations: `icons`, `HTMLSerializer`.

### `@novaprose/tinymce-compat` (new, preview)

- **Drop-in `tinymce.init()`**: keep an existing TinyMCE integration and run it on NovaProse —
  `tinymce.init/get/remove/activeEditor/triggerSave`, `PluginManager.add`, the editor API
  (`getContent`, `setContent`, `insertContent`, `execCommand`, `on/off/fire`, `selection`,
  `undoManager`, `mode`, `ui.registry`, notifications and alert/confirm), the common `init`
  options and events, form submit into the textarea. A CDN build replaces `tinymce.min.js` with one
  line and loads its own styles; `init()` in `<head>` waits for the document. Unsupported options
  and plugins are reported in a warning, not an error.

## 0.3.0 — 2026-11-25

### `@novaprose/core`

- **Comments** (`plugins: ['comments']`, buttons `addcomment` and `showcomments`, Ctrl+Alt+M):
  threads on selected text with replies, edit, delete, resolve and reopen; highlights in the text;
  a side panel that moves below the text on narrow screens. Threads are stored next to your
  content (`threads` + `onChange`) or in any `CommentStore`; the HTML keeps only
  `<span data-comment="id">` anchors. Adding or removing a comment is not undone by Ctrl+Z.
- **Mentions** (`plugins: ['mentions']`, `pluginOptions.mentions.fetch`): type @ to pick a person
  from your API; saved as `<span data-mention="id">@Name</span>`, removed as one unit;
  `getMentions(editor)` lists everyone mentioned. In comments, @ opens the same list, mentioned
  people are stored on the comment and reported through `comments.onMention`.
- Autocompleter items accept `detail` — plain text on the right (role, e-mail).
- **Version history** (`plugins: ['revisionhistory']`): browse versions, see the differences from
  the current text (word by word), restore in one undoable step. Versions come from
  `pluginOptions.revisionhistory` (`list`, `load`, optional `save`, `onRestore`).
- `pluginOptions` is typed for built-in plugins (`comments`, `mentions`, `revisionhistory`,
  `autosave`, `quickbars`): editors suggest and check their settings; other keys stay allowed.
- `editor.ui.closeOverlays()` closes popovers and the toolbar's “⋯” menu; the comments panel and
  version history use it, so they no longer open under the overflow menu on phones.

### `@novaprose/collab`

- `sync.commentStore()`: comments in the shared Y.Doc — synced live and saved by the sync server;
  simultaneous replies are merged.
- `sync.versions()`: version history from the sync server for the `revisionhistory` plugin.

### Sync server

- Version history: snapshots at most every `NOVA_SYNC_VERSION_INTERVAL` minutes (default 10), when
  the last person leaves, and on “Save version”; up to 500 per document; viewers can read but not
  save. Demo rooms keep versions in memory only.

## 0.2.0 — 2026-11-25

### `@novaprose/core`

- **Plugins can add document nodes and marks** (`nodes`, `marks` in `definePlugin`). Every editor
  now has its own schema (`editor.schema`), so editors with different plugins on one page don't
  affect each other. Plugins with nodes must be passed as objects, not lazy loaders.
- The HTML serializer now re-checks all output: `on*` attributes, unsafe URLs in `href`/`src`/
  `srcset` and unsafe CSS are removed, and elements such as `<script>`, `<style>` and `<object>`
  are never written, even if a plugin's `toDOM` produces them.
- **Paste from Word, Word for the web, Google Docs, Excel, Google Sheets and LibreOffice**: real
  nested lists instead of indented paragraphs, styles from CSS classes, highlights, tables with
  shading and merged cells, Google Docs links without the redirect wrapper. New option
  `pasteStyles: 'clean' | 'keep'` (default `'clean'`: no source fonts, sizes or spacing).
- **Images pasted from Word for Windows / Mac** are extracted from the RTF clipboard data (PNG,
  JPEG) instead of being lost behind `file:///` paths.
- With `uploadImage`, embedded (`data:`) images that arrive by paste or drop are uploaded
  automatically and replaced with the returned URL; on failure they stay embedded.
- Pasting into an empty paragraph keeps the first pasted paragraph's formatting.
- Superscript and subscript are recognized from `vertical-align`; `transparent`, `windowtext`
  and `auto` are no longer treated as colors.
- **New built-in plugins** (lazy, by name, TinyMCE names): `charmap`, `emoticons` (with `:name`
  autocompletion), `nonbreaking`, `autolink` (typing, Enter, and pasting a URL over a selection),
  `autosave` (`restoredraft`), `autoresize`, `visualblocks`.
- **`anchor`, `pagebreak`, `media`** plugins (document nodes, enabled by name). `media` embeds only
  YouTube (via youtube-nocookie.com), Vimeo and https video files; any other `<iframe>` is dropped on
  parse and on output.
- **`directionality`** (RTL) and **`advlist`** (bullet and numbering styles, split buttons) plugins.
  Schema: `dir` on paragraphs and headings, `listStyle` on lists (`list-style-type`, legacy
  `<ol type>`). Word paste keeps list styles (`a.` → lower-alpha, `o` → circle). New control type
  `editor.ui.registry.addSplitButton()`.
- **Tables:** sort by column (`advtablesort`), table properties (`tableprops`: width, alignment),
  cell properties (`tablecellprops`: vertical alignment, header/data cell, column width). Schema:
  `width`/`align` on tables, `valign` on cells (also from legacy `align`/`valign` attributes).
- Fix: a wide table or long code line no longer stretches the whole editor on narrow screens; it
  scrolls inside the editor.
- Paste (clean mode) drops source table sizes and default cell vertical alignment.
- Fix: on narrow screens, opening a dialog from the toolbar's “⋯” menu now closes that menu.
- `editor.updateUI()` refreshes toolbar state after display-only changes; the fullscreen button now
  reflects its state immediately.
- New exports: `createSchema`, `parserFor`, `nodesOf`, `marksOf`, types `NovaSchema`,
  `SchemaExtensions`.
- Plugins can override named commands (`commands`) and replace the built-in history
  (`replaceHistory`); plugins may dispatch transactions while the editor is being created.

### `@novaprose/collab` (new, preview)

- **Real-time collaboration** on Yjs: live sync, other participants' cursors and selections with
  names, per-user undo (Ctrl+Z never reverts someone else's changes). Works with node plugins.
- Connects to the NovaProse sync server, or to your own `Y.Doc` and `Awareness`.
- `onUsers` reports who is in the document (name, color, self); `plugin.setUser()` renames you
  for everyone without reconnecting.

### Sync server (`apps/sync-server`, new)

- Hocuspocus-protocol server with SQLite storage (`node:sqlite`), JWT (HS256) auth from your
  backend, document patterns in tokens, read-only viewers, public no-token rooms
  for demos (`NOVA_SYNC_PUBLIC_PREFIX`, never stored), `/health`, Docker image and Compose + Caddy setup.

### Site

- [Live collaboration demo](https://novaprose.com/demo/collaboration/): edit one document with
  anyone who has the link.

## 0.1.0 — first preview

### `@novaprose/core`

- ProseMirror-based editor with a deterministic string HTML serializer and a URL/CSS allowlist
  applied on parse and on output.
- Formatting: headings, lists, blockquote, code, sub/superscript, colors, fonts, font size, line
  height, alignment, indent, links, images (upload, resize, alignment, alt text), tables.
- UI: sliding toolbar with overflow, menu bar, context toolbars, quick bars, link bubble, dialogs,
  search and replace, source code view, preview, print, fullscreen, help, status bar, slash commands.
- Modes: classic, inline, distraction-free. Light and dark theme, English and Russian UI.
- TinyMCE-compatible names for toolbar items, menus and plugins; content restrictions
  (`validElements`, `invalidElements`, `validStyles`); paste hooks and plain-text paste.
- Plugin system with lazy built-in plugins (`insertdatetime`, `quickbars`).
- `editor.isActive(command)`, `editableChange` event.

### `@novaprose/react`

- `<NovaProseEditor>` (controlled / uncontrolled, `init`, `name` for native forms, React Hook Form).
- Hooks `useEditor`, `useEditorState`, `useCommand`; `'use client'` for Next.js.

### `@novaprose/vue`

- `<NovaProseEditor>` with `v-model`; composables `useEditor`, `useEditorState`, `useCommand`; Nuxt-safe.

### `@novaprose/web-component`

- `<novaprose-editor>` form-associated custom element (FormData, reset, required, disabled,
  readonly, `input` / `change` events); CDN build `dist/novaprose.global.js` + `dist/novaprose.css`.

### `@novaprose/angular`

- Standalone `NovaProseEditorComponent` with `ngModel` / Reactive Forms, zoneless and SSR support.
