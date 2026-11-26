---
title: Changelog
description: "Release notes for all @novaprose packages."
---

<!-- Сгенерировано из CHANGELOG.md: правьте его, затем pnpm --filter @novaprose/site sync-docs -->

All packages in this repository are versioned together. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow [SemVer](https://semver.org/)
(until 1.0, minor versions may contain breaking changes).

## Unreleased

### Editing

- AI assistant (`plugins: ['suggestions', 'ai']`, buttons `aidialog` and `aishortcuts`, as in
  TinyMCE): select text and pick **Improve writing**, **Fix spelling and grammar**, **Make
  shorter**, **Make longer**, **Simplify**, a formal or friendly tone, **Summarize**, or type your
  own request; with nothing selected, **Continue writing** or your request writes at the cursor.
  The answer arrives as suggested edits from “AI”: the rewrite is compared word by word, so only
  changed words are marked, kept words keep their formatting, and each change is accepted or
  rejected like a colleague's. The model is yours: `pluginOptions.ai.request` sends the request
  (instruction, selected text, the text around it) through your server and returns the answer as
  text or as a stream shown while it is written; closing the dialog cancels it. The answer is
  inserted as text, never HTML. Guide with a server example:
  [AI assistant](https://novaprose.com/guides/ai-assistant/).
- **Fixed:** in suggesting mode, rejecting the text of a new paragraph left an empty line, and so
  did accepting the deletion of a paragraph's whole text — the paragraph now goes with it (unless
  it is the only one where a paragraph is required, such as a table cell).
- **Fixed:** the colors of suggestion authors and of deleted text did not reach the 4.5:1 contrast
  required for text on a white background; the palette is darker, and deleted text is no longer
  faded.
- Word documents: `plugins: ['importword', 'exportword']` open a `.docx` and save the document as
  `.docx` (buttons and File menu items, as in TinyMCE) — in the browser, with no conversion
  service. Headings, formatting, links and bookmarks, real Word lists, tables with merged cells,
  images, quotes, code, page breaks, suggested edits as Word tracked changes, and the page layout's
  sheet and margins both ways; imported footnotes go to the end. `@novaprose/core/docx`
  (`exportDocx`, `importDocx`, `fromDocx`) does the same from code and on the server (Node 18+,
  no DOM). Exported files are checked in Microsoft Word; files saved by Word are imported in tests.
- Page layout (`plugins: ['pagelayout']`): the text sits on a sheet of the real paper size
  (`size`: A3–A6, Letter, Legal or your own in mm; `orientation`; `margins` in mm), so lines wrap
  as on paper, and a dashed line with the page number marks where each page ends — including after
  a page break. `pageLayout(editor)` changes the sheet and reports the page count. The sheet stays
  white in the dark theme. Printing uses the same sheet, so pages break where the editor shows
  (checked against a PDF in Chromium).
- **Changed:** printing prints what the editor shows — formulas, highlighted code and node views
  included — with the page's styles and `contentStyle` / `contentCss`; it used to print simplified
  HTML with its own styles. Without page layout the margins are 20 mm, as before.

- Formulas (`plugins: ['math']`, button `math`): LaTeX in a line (type `$E=mc^2$`) and on its own
  line (`$$` and a space), with a dialog and live preview. Drawn as MathML by the browser; the
  converter (Temml, about 58 KB gzip) downloads only when a document has a formula. The HTML keeps
  the LaTeX source (`data-latex`, Tiptap's format) with `\( \)` / `\[ \]` text that KaTeX and
  MathJax render on your site. LaTeX commands such as `\href` are not executed; a formula with an
  error shows its source underlined, with the error in its tooltip.
- Table of contents (`plugins: ['tableofcontents']`, button `tableofcontents`, as in TinyMCE): a
  block with links to the headings that updates in the same edit when a heading is added, renamed
  or removed (undo reverts both). While a table of contents exists, headings get stable ids
  (`toc-…`); existing ids are kept and duplicates replaced. Clicking an entry in the editor goes
  to the heading without changing the page address. Options: `depth`, `className`, `titleTag`,
  `title`, `orderedList`; TinyMCE's `div.mce-toc` and `tableofcontents_*` options work.
- Headings keep their `id` attribute (it used to be dropped unless allowed by
  `extendedValidElements`), and changing the heading level keeps it, so `#section` links work.

- Collapsible sections (`plugins: ['accordion']`, button `accordion`, as in TinyMCE):
  `<details><summary>` with an arrow to collapse and expand, Ctrl/Cmd+Enter in the title, Enter
  in the title to start the content, Backspace at the start of the title to remove the frame. The
  toolbar button turns the selected blocks into a section. Accordions from TinyMCE and Tiptap load
  as they are; `pluginOptions.accordion.initialState` and `serializedState` (TinyMCE
  `details_initial_state` and `details_serialized_state`) set the state on load and in
  `getHTML()`. Collapsing is not an edit: Ctrl+Z does not undo it. The cursor never stays inside
  hidden content.

- Move blocks with the keyboard: Alt+Shift+↑/↓ moves the paragraph, heading, list item (among its
  siblings) or selected table or image up or down; with several blocks selected, they move
  together. New named commands `moveBlockUp` and `moveBlockDown`.
- Drag handle (`plugins: ['draghandle']`): a handle appears to the left of the block under the
  mouse. Drag it to move the block; the drop line shows where it lands (upper half of a block —
  before it, lower half — after it). A list item dropped outside its list keeps its list type and
  joins a neighbouring list of the same type; a paragraph dropped between list items becomes an
  item. Hold Ctrl (⌥ on a Mac) to copy. Click the handle for move up/down, duplicate and delete.

- Syntax highlighting in code blocks (`plugins: ['codesample']`, as in TinyMCE): 27 languages and
  their usual short names (`js`, `ts`, `sh`, `html`, Prism's `markup`…), colors with AA contrast
  in both themes, the language in the corner of each block and a language menu above the block with
  the cursor, and the `codesample` button with a dialog to insert or edit code. Highlighting only
  decorates the screen: the saved HTML stays `<pre><code class="language-…">`. The highlighter
  (highlight.js) and each grammar download only when a code block in that language appears (about
  11 KB for JavaScript). Own grammars and language list: `pluginOptions.codesample`; colors: CSS
  variables `--nova-code-*` or any highlight.js theme. TinyMCE `codesample_languages` and
  `execCommand('CodeSample')` work through `@novaprose/tinymce-compat`.
- The Markdown fence takes a language: type ` ```ts ` and press Space or Enter. **Changed:**
  three backticks alone no longer turn into a code block immediately — press Space or Enter, as you
  would in Markdown.
- Several lines copied in VS Code paste as a code block in the file's language, without the editor
  theme's colors and fonts; one line pastes as plain text.
- The language of a code block is read from `<pre class="language-x">` (TinyMCE, Prism), `lang-x`
  and `data-language` as well, and an unsafe language value from JSON no longer reaches the HTML
  class or the Markdown fence.
- Code blocks stay left-to-right in right-to-left documents.
- Multi-line fields in plugin dialogs (`editor.ui.dialog`, `type: 'textarea'`) are as tall as their
  `rows` — they used to be one line high. New `code: true` for code: monospace, no spell check.
- Context toolbars accept `placement: 'top-end' | 'bottom-end'` or a function of the editor.

### API

- Guide: [Your own toolbar](https://novaprose.com/guides/headless/) — a headless editor with React
  hooks, Vue composables or plain JavaScript, including a menu over the selection.
- Command chains: `editor.chain().exec('h2').exec('alignCenter').run()` applies several commands
  as one edit — one undo step, one `change` event. Steps are named commands, ProseMirror commands
  (`setStyle(…)`, `applyLink(…)`) or `insertContent(html)`, and each sees the result of the
  previous ones. If any step does not apply, nothing changes and `run()` returns `false`;
  `chain().….can()` checks the whole chain without changing the document.
- Rendering on the server: `createRenderer(options).html(json)` and `renderHTML(json, options)`
  turn a saved JSON document into the same HTML as `getHTML()` (and `text(json)` into the same
  text as `getText()`) without an editor or a DOM — in Node, workers and build steps. They take the
  editor's options that shape the HTML: plugins and their settings, formats and classes, content
  restrictions, direction. The output is checked against `getHTML()` on thousands of random
  documents.

### Plugins API

- Node views: `nodeViews` in a plugin draws its nodes with your own component —
  `reactNodeView(Component)` from `@novaprose/react`, `vueNodeView(Component)` from
  `@novaprose/vue`, or `defineNodeView({ mount, update, destroy })` for plain DOM. The component
  gets the node, `updateAttributes()` (one undo step), `deleteNode()` and `selected`, and places
  the editable content with `<NodeViewContent>`. React and Vue components render inside your app
  (a portal, `Teleport`), so context, `provide`/`inject`, stores and translations work. Fields,
  lists and buttons in a view keep their events. The HTML still comes from `toDOM`.
- **React:** `react-dom` is now a peer dependency (it renders node views). `useEditor()` in React
  and Vue also returns `nodeViews`: render it next to the editor container when you use node views
  (`<NovaProseEditor>` does it by itself).
- The plugins `anchor`, `media`, `pagebreak`, `mentions`, `mergetags` and `suggestions` keep only
  their nodes, marks and rendering in the first load; their buttons, dialogs and lists are a lazy part
  that registers right after creation. **Changed:** like other lazy plugins, their buttons exist after
  `await editor.ready`. Collapsible sections (`accordion`) now render from the first frame.
- `NovaPlugin.load`: a plugin with nodes keeps only its nodes and their rendering in the first load
  and names the rest (buttons, dialogs, commands, keys) as a lazy module, loaded after the editor
  is created.
- A plugin whose `nodes` function throws is reported and left without its nodes; the editor still
  opens.

### Distribution

- The CDN builds include `novaprose.licenses.txt` / `tinymce.licenses.txt` with the license of
  every bundled package (ProseMirror, highlight.js…), generated from the build itself, and a banner
  pointing to it.

- Checklists (`plugins: ['checklist']`, button `checklist`): tick an item with a click or Ctrl/Cmd+Enter,
  type `[ ]` or `[x]` at the start of a line, Enter starts a new unticked item; nesting, indent and
  paste work as in other lists. HTML uses the Tiptap task list format (`data-type="taskList"`,
  `data-checked`); TinyMCE (`tox-checklist`) and GitHub checklists are converted on load and paste,
  even without the plugin. Markdown: `- [ ]` / `- [x]` both ways. Keyboard and screen readers:
  each box is a `role="checkbox"` with its state.
- The numbered list button inside a bulleted list (and the other way round) now switches the list
  type. It used to do nothing.

### Plugin UI

- `editor.ui.dialog`: tabs (`tabs: [{ title, fields }]`, WAI-ARIA keyboard, switches to the tab with
  an invalid field) and a `file` field with a drop zone, a Browse button, a removable list of chosen
  files, `accept`, `multiple` and `maxSize`. The value is an array of `File` objects.
- `editor.ui.addStyles(id, css)`: a plugin adds its own styles once per page (or shadow root),
  without `'unsafe-inline'` in your CSP.

### Performance

- `style.css` shrinks from 11.9 to 10.3 KB gzip: styles of the comments panel, version history, plugin
  dialogs and the TinyMCE-compatible dialogs now come with their lazily loaded code. If you override
  these styles in your own CSS, use a selector at least as specific as ours.

## 0.7.0 — 2026-11-26

### Breaking

- **Russian is now a language pack, like the others.** `language: 'ru'` needs
  `import ru from '@novaprose/core/i18n/ru'; registerLanguage('ru', ru);` (other languages
  already worked this way). Without it the editor uses English and logs a hint. Plugins no longer
  embed their own Russian strings; every translation lives in the packs. The `ru` export of
  `@novaprose/core` is removed. The CDN builds (`novaprose.global.js`, `tinymce.global.js`) still
  include Russian. The core first load drops from 147.6 to 144.2 KB gzip.
- **Table helpers wait for the table editing chunk.** `tableCommands`, `setCellBackground`,
  `hasHeaderRow` and the other table helpers return `false` (or `null`) for the first milliseconds
  after the editor is created, until table editing has loaded. Call them after `await editor.ready`.
  Tables in the content render and insert immediately.
- **Self-hosted CDN files: copy the whole `dist` folder.** `novaprose.global.js` and
  `tinymce.global.js` now load their lazy parts from `novaprose-chunks/` and `tinymce-chunks/` next to
  them. Without those folders the editor still opens, but tables, optional plugins and plugin dialogs
  can't load their parts.

### Editing

- Paragraph and heading indent: the indent/outdent buttons and Ctrl+] / Ctrl+[ now work outside
  lists too (`margin-left` in 40 px steps, `margin-right` for right-to-left text, up to 10 levels;
  pasted `padding-left` / `pt` / `em` indents are normalized). Tab still indents list items only,
  so keyboard users are never trapped in the editor.
- Image uploads retry automatically twice on failure. If the upload still fails, the image stays in
  place and the notification offers **Retry** and **Remove image** instead of silently deleting it.
- Image captions: the **Caption** button in the image toolbar wraps the image in
  `<figure>` with an editable `<figcaption>` (formatting and links allowed, Enter continues below,
  alignment/size/alt keep working). Removing a caption keeps its text as a paragraph. `<figure>`
  from pasted or loaded HTML is recognized; Markdown export writes the image and the caption text.
- Notifications can carry action buttons (`actions`, `onClose` in `editor.ui.notify()`).

### Shadow DOM

- The editor works inside your own web component with an open or closed shadow root: menus no
  longer close when you click their own items, Tab stays inside dialogs, arrow keys move between
  toolbar buttons, and focus that leaves a dialog comes back. Tested in Chromium, Firefox and
  WebKit. See [Shadow DOM and web components](https://novaprose.com/guides/shadow-dom/).

### Plugin UI

- `editor.ui.dialog({ title, fields, onSubmit })`: dialogs from a list of fields — text, URL, email,
  number, textarea, select, checkbox, color, notes and custom elements — with hints, required fields,
  custom validation and errors next to each field (`aria-invalid`, focus on the first invalid one).
  `await editor.ui.dialog(...)` returns the submitted data, or `null` if the dialog was closed. The
  dialog code loads on first use, so the core first load barely grows.
- Sidebars for plugins: `editor.ui.registry.addSidebar(name, { title, render })` adds a panel next to
  the text (below it on narrow screens) and a toggle button; `editor.ui.sidebar.show / hide / toggle`.
  One panel is open at a time; content is rendered on first open and can be loaded lazily. The
  comments panel now uses it too.
- `@novaprose/tinymce-compat`: `ui.registry.addSidebar`, `ToggleSidebar` and
  `queryCommandValue('ToggleSidebar')`.

### Right-to-left languages

- `direction: 'rtl'` (automatic for Arabic, Hebrew, Persian and Urdu, otherwise following the page)
  mirrors the whole interface: toolbar order, menus aligned to the right edge of their button, arrow
  keys in the visible order, the resize handle in the bottom-left corner, flipped undo/redo, indent
  and list icons, quote bars and list bullets on the right. Paragraph indentation is written as
  `margin-right`. `editor.direction` returns the active direction; `directionality` in
  `@novaprose/tinymce-compat` maps to it.

### Chinese, Japanese and Korean

- The word count counts each Chinese character and each Japanese kana as a word, as word processors
  do (`日本語の文章です` is 8, not 1). Korean, written with spaces, is counted by words as before.
- Input through an IME (composition) is covered by browser tests: intermediate candidates never stay
  in the text, one undo removes the committed word, Enter that confirms a candidate doesn't pick a
  slash command, and composition works inside bold text, lists and table cells.

### Content rules

- Keep markup the editor doesn't create itself, or restrict attributes further:
  `extendedValidElements` (heading ids, `data-*`, callout `<div class>`, icon fonts like
  `<i class="fa fa-star"></i>`, `<abbr>`, `<details>`…), `customElements` (your own block and inline
  elements) and attribute lists in `validElements` (`a[href|title]`, default `=`, forced `:`, allowed
  `<` values, required `!`, `@[...]` for all elements). A separate import,
  `@novaprose/core/html-rules` (about 3 KB gzip), registered with `registerHtmlRules(htmlRules)`;
  the core first load doesn't change. Without it, editors behave as before.
- Rules can't make content unsafe: scripts, iframes, forms and `<svg>` are never allowed, event
  handlers and `srcdoc` are never kept, URLs and CSS are checked — for HTML and JSON input.
- `@novaprose/tinymce-compat` registers the rules itself: `extended_valid_elements`,
  `custom_elements` and attribute lists in `valid_elements` now work as in TinyMCE.

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

- CDN builds load less up front: table editing, optional plugins, Office paste cleanup and plugin
  dialogs are now separate files loaded on demand from the same address as the script
  (`novaprose-chunks/`, `tinymce-chunks/`). The main file shrinks from 168.1 to 140.5 KB gzip
  (`novaprose.global.js`) and from 178.6 to 151.0 KB (`tinymce.global.js`). The global object and
  `createEditor()` are available as soon as the script loads, as before. If you host the files
  yourself, copy the whole `dist` folder.
- Smaller first load: the Word / Google Docs / Excel paste cleanup is now a separate chunk, loaded in
  the background right after the editor is created (core: 149.9 → 146.4 KB gzip). A paste in the
  first milliseconds waits for it, so nothing is lost; `await editor.ready` covers it too.
- Table editing (cell selection, column resizing, row/column commands, sorting, properties) is a
  separate chunk too, loaded in the background on creation (core: 144.2 → 133.9 KB gzip). Tables
  in the content render and insert immediately; `tableCommands` and the other table helpers return
  `false` until the chunk is loaded — call them after `await editor.ready`.

### Fixes

- Menus aligned to the end of their button (and centered ones) were placed a few pixels off: their
  size was measured during the opening animation.
- With several editors on a page, `getHTML()` could render a formatting mark (a link, for example)
  the way another editor with different settings had rendered it.
- When a lazily loaded part of the editor finishes loading (for example the `autolink` plugin),
  an open slash-command or mention list no longer closes, and in collaborative editing undo and
  the cursor position no longer break.
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
