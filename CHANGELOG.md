# Changelog

All packages in this repository are versioned together. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow [SemVer](https://semver.org/)
(until 1.0, minor versions may contain breaking changes).

## Unreleased

### Migrating from TinyMCE

- `npx @novaprose/tinymce-compat migrate` moves a TinyMCE project to the compatibility layer: script
  tags that load TinyMCE from Tiny Cloud or a public CDN load the drop-in, imports of the `tinymce`
  package become the compatibility layer's (with the stylesheet; the theme, model, icon, skin and
  plugin imports go), and `package.json` depends on NovaProse. The rest is reported line by line:
  options and plugins NovaProse doesn't have, framework components to move (with the props to
  rename), imports without a counterpart, copies of TinyMCE of your own. A dry run unless you add
  `--write`; `--json` for the report as JSON. See
  [Migrating from TinyMCE](https://novaprose.com/guides/migrating-from-tinymce/#or-let-a-command-do-it).
- The compatibility layer uploads images to `images_upload_url`: a multipart POST with the image as
  `file`, and the answer `{ "location": "…" }` is the image's address (`images_upload_base_path` in
  front of a relative one; `images_upload_credentials` sends cookies to another origin). Progress
  shows on the image; a failure keeps it with Retry and Remove.

## 0.10.0 — 2026-11-28

Templates you can lock, AI that reviews and restructures, and a sharper look: locked content with
editable fields inside, the AI chat's Review mode and structural edits, alternative text written by
your model, photos made smaller and stripped of camera data before upload, two icon packs and three
skins, HTML cleaned on a server with the editor's own rules, and formulas from other editors and
sites read as LaTeX.

### Upgrading from 0.9

- **Photos are prepared before upload.** A photo larger than 2560 pixels is scaled down and loses
  its camera metadata (EXIF and XMP, the place it was taken). To send files as they are, pass
  `imageOptimize: false`.
- **Icons draw at one size**, the `--nova-icon-size` token (18 px), whatever size their SVG says: a
  button icon of your own drawn at 24 px now shows at 18 px. Set the token to change it.
- **Icons that don't come with the editor are cleaned** before they are drawn (your controls' own
  SVG, `addIcon`, icon packs): one `<svg>` of SVG elements only, without `<title>`, `<desc>`,
  scripts, styles, event handlers or links, marked `aria-hidden`. A control is named by its tooltip.
- **AI requests have two new actions**, `describe` (alternative text for an image, with `image`) and
  `review` (remarks on the document). A server that sends `prompt` as it is needs nothing; one that
  builds its own prompt by `action` should handle them.
- **The blocks of an `edit` or `review` request say their kind**: a heading, quote, list item or
  table cell comes as `<block id="N" type="h2">` (`quote`, `bullet`, `number`, `cell`); a plain
  paragraph stays `<block id="N">`. A server that reads these lines itself should allow the
  attribute.
- **The compatibility layer locks `mceNonEditable` content**, as TinyMCE does; until now such content
  was editable.

### Formulas

- The math plugin reads MathML: `<math>` from other editors, Word and web pages becomes a formula
  in LaTeX — its TeX source when it carries one (MathJax, KaTeX, Temml, Wikipedia), otherwise its
  structure (fractions, roots, scripts, accents, sums, brackets, matrices, Greek letters and
  operators). A formula pasted from a page comes once, without the picture next to it. See
  [Formulas](https://novaprose.com/guides/math/#formulas-from-elsewhere).
- A node of a plugin can read elements of another namespace (`fromForeign` in its spec), which
  the parser otherwise turns into text (MathML) or drops (SVG).

### AI

- The chat panel's Edit mode changes structure when you ask for it: a paragraph made a heading,
  paragraphs put in a bulleted or numbered list or a quote (neighbours form one list), new
  paragraphs and headings, paragraphs removed — each a suggestion, so rejecting gives the text
  back. The model sees each block's kind and answers in the same block form (`type`, `after`,
  `remove`); a new paragraph after a list's last item comes after the list, a new item joins the
  list next to it.
- AI review: the chat panel's **Review** mode lists the model's remarks on the document (or the
  selected paragraphs), each with the reason. A remark with a fix arrives as a suggestion where its
  words are, accepted or rejected on its own from the panel or in the text; a remark without a fix
  shows its place. It works in read-only documents too (the remarks are listed, nothing changes).
  The request has `action: 'review'`; see
  [AI assistant](https://novaprose.com/guides/ai-assistant/#the-chat).
- The chat panel no longer redraws an edit's buttons when nothing it shows has changed: a click on
  **Accept all** right after the edit arrived could be lost.

### Locked content

- The `noneditable` plugin locks parts of a document: an element with the class
  `mceNonEditable` or `contenteditable="false"` (a paragraph, a table, a `div` around several
  blocks, a `span` in a line) is selected, copied and deleted whole, and nothing inside it changes.
  Typing or pasting over a selected locked piece doesn't replace it; formatting across it formats
  what is around it. Parts marked `mceEditable` (or `contenteditable="true"`) inside stay
  editable, without changes leaking past their edges. The HTML is written back as it came. Arrow
  keys, Backspace and Delete next to a locked piece select it; screen readers hear that it is
  locked. See [Locked content](https://novaprose.com/guides/locked-content/).
- The compatibility layer locks `mceNonEditable` content by default, as TinyMCE does, with
  `noneditable_class` and `editable_class`.
- Plugins can give `nodeAttributes` as a function of the editor's settings, as `nodes`.

### Security

- HTML from outside can be cleaned on a server with the editor's own rules:
  `createRenderer({ ...yourOptions, document })` takes a DOM (for example jsdom's), and
  `await renderer.sanitize(html)` gives exactly what `setContent` + `getHTML()` would give: only
  what the schema allows, addresses and styles checked, content rules applied, broken tables
  repaired. `renderer.fromHTML(html)` gives the same document as JSON. See
  [HTML from outside](https://novaprose.com/guides/server-rendering/#html-from-outside).
- A color written `<font color="AAA">` (a word CSS doesn't read as a color) is no longer kept: written
  as a style, it vanished the next time the HTML was read.

### Themes and icons

- Icon packs: `icons` takes SVGs by icon name over the built-in ones. Two packs come ready, each
  with every icon the editor uses: `@novaprose/core/icons/tabler` (Tabler Icons) and
  `@novaprose/core/icons/phosphor` (Phosphor), separate files that load only when imported. A pack
  redraws the whole interface: the toolbar and menus, dropdown arrows, the "more" button, dialogs,
  notifications and plugin buttons. `editor.ui.registry.addIcon(name, svg)` replaces one icon by
  name, and controls take an icon by name as well as an SVG.
- Skins: `@novaprose/core/skins/rounded.css`, `square.css` and `compact.css` change shapes and
  spacing (never colors), so they work with both themes and your own tokens. The compact one has
  28 px controls and 16 px icons, and keeps 40 px controls on touch screens.
- Icons draw at one size, the new `--nova-icon-size` token (18 px), whatever size an SVG says, so
  a row of controls stays even with icons from any pack.
- Icons that don't come with the editor (packs, `addIcon`, a control's own SVG) are drawn as one
  `<svg>` element of SVG elements only: no scripts, `<style>`, event handlers, links, animation,
  embedded HTML or text, and marked decorative. An SVG file can go in as saved, with its XML
  declaration, doctype and comments.
- The compatibility layer takes TinyMCE icon packs: `tinymce.IconManager.add(name, { icons })`
  with `icons: name`, or `icons_url` (http and https addresses only). The pack's icons redraw
  NovaProse's own buttons too, and many more TinyMCE icon names are understood (`chevron-down`,
  `more-drawer`, the table icons and others).
- A new guide, [Themes, skins and icons](https://novaprose.com/guides/themes-and-icons/): the light
  and dark themes, design tokens and your brand color, skins, icon packs.

### Images

- AI for images: with the `ai` plugin, the **Alternative text** dialog has **Describe with AI**. It
  sends the image and the text around it to your model (`action: 'describe'`, the image as base64
  or its address in `request.image`), and the model's one or two sentences go into the field for
  the author to review and save. The server example in the
  [AI assistant](https://novaprose.com/guides/ai-assistant/#describing-images) guide sends the
  image to Claude.
- Images are prepared in the browser before they are uploaded or embedded: a photo larger than
  2560 pixels is scaled down, keeps its orientation and loses what the camera wrote into it (EXIF
  and XMP: the place it was taken, the camera, the date). A file that needs none of this goes as it
  is; GIF, SVG and animated WebP never change. `imageOptimize` sets the limits and the quality,
  `false` sends files as they are. See
  [Images](https://novaprose.com/guides/images/#smaller-files-no-camera-metadata).

## 0.9.0 — 2026-11-28

An accessibility release. A phrase in another language can be marked for screen readers; the line
with the cursor never hides under the sticky toolbar; field edges, focus and pressed buttons stand
out 3:1, also in Windows high contrast mode; and find and replace stays in view in long documents.
The [accessibility conformance report](https://novaprose.com/project/accessibility-report/) (VPAT
2.5, International Edition) describes this version.

### Upgrading from 0.8

Nothing in the API changed. Visible differences:

- The edges of fields and of the editor are darker (3:1 on every surface). A theme of your own can
  set `--nova-control-border`.
- The find bar sits in the sticky header, under the toolbar, instead of above the text.
- Collaborators' default cursor colors are darker.
- Pasted HTML keeps `lang` on a passage in another language than the text's.

### Accessibility

- A passage in another language (WCAG 3.1.2): the `language` button and **Format → Language…**
  mark the selected words, so screen readers read them with that language's voice; in the HTML it
  is a `<span lang="…">`. `contentLangs` lists the languages to offer (by default 20 common ones,
  named in the interface language), `setTextLanguage()` and `getTextLanguage()` do it from code.
  `lang` on any element of the content is kept, a broken one is dropped. A Word export keeps a
  passage's language. With `tinymce.init`, `content_langs` works (without it the button isn't
  there, as in TinyMCE).
- `contentLanguage`: the language of the text when it isn't the page's (screen readers and the
  browser's spell check use it); `content_language` with `tinymce.init`.
- The line with the caret never stays under the sticky header (WCAG 2.4.11): moving with the arrow
  keys or Page Up, typing at the top and jumping to a search match scroll it into view below the
  header. `toolbarStickyOffset` sticks the header below your page's own fixed header
  (`toolbar_sticky_offset` with `tinymce.init`).
- **Fixed:** in a long document on a scrolling page, opening **Find and replace** took the page
  back to the top, and going to a match didn't scroll to it while the find field had focus. The
  find bar now sits in the sticky header, under the toolbar, and every match is scrolled into view
  below it.
- Contrast of what isn't text (WCAG 1.4.11): the edges of fields and of the editor stand out 3:1
  on every surface (the new `--nova-control-border` color), a pressed button has a ring as well as
  its tint, a focused menu item shows the focus ring, and a white color swatch has a visible edge.
- Windows high contrast mode: pressed buttons, the table size grid, search matches and selected
  cells show in the system's colors, and color swatches keep their colors.
- **Fixed (screen readers):** VoiceOver said "invalid data" for the link dialog's empty address
  field as soon as the dialog opened; the field is marked required for screen readers without being
  an error, and an empty address now says it is required.
- VoiceOver on macOS is checked in CI as well as NVDA on Windows: what it says after formatting and
  Markdown shortcuts and when a dialog opens.
- **Fixed (screen readers):** the resize handle in the status bar said its value (the editor's
  height) only after the first resize; it says it from the start, with its range.
- Collaboration: the cursor colors are darker, so the white name labels are at least 4.5:1, and a
  color of your own gets a black or white label, whichever reads better (`labelColorOn()` in
  `@novaprose/collab`). **Changed:** the default colors of collaborators.
- **Changed:** pasted HTML keeps `lang` on a passage in another language than the text's; it used
  to drop every `lang`. Word's own document language (on every run) is still left out.

## 0.8.0 — 2026-11-28

The largest release so far. Suggested edits cover structure, formats and Word tracked changes; an
AI assistant works with your own model; Word import and export, page layout with headers and
footers, PDF export and printing as on screen; formulas, highlighted code, a code editor for the
HTML, checklists, collapsible sections, a table of contents, footnotes and templates; image
editing, link cards, embedded pages and a link checker; an accessibility checker, spell checking,
autocorrect and typography; whole HTML pages and email output. For developers: `editor.selection`,
`editor.chain()`, node views in React and Vue, rendering on a server and upload adapters for cloud
storage. Screen readers hear what a shortcut changed.

### Upgrading from 0.7

Most code keeps working as it is. Check these:

- **A language with the CDN build:** `NovaProse.createEditor({ language: 'ru' })` needs
  `await NovaProse.loadLanguage('ru')` first, because languages are separate files now.
  `<novaprose-editor language="…">` and `tinymce.init` wait for the language by themselves.
- **React:** `react-dom` is a peer dependency. With `useEditor()` and node views, render the
  `nodeViews` it returns next to the editor (`<NovaProseEditor>` does it by itself).
- **Buttons of lazy plugins:** the buttons of `anchor`, `media`, `pagebreak`, `mentions`,
  `mergetags` and `suggestions` exist after `await editor.ready`.
- **Toolbar:** `toolbarMode: 'sliding'` is now a strip under the toolbar; the panel that opens from
  **⋯** is `'floating'`, the default.
- **Removed internals:** undocumented exports of `@novaprose/core` (`cssValue`, `createTranslator`,
  `parseToolbar` and others, listed under API) and the types of `editor.resolveCommand()` and
  `editor.contentRules`.

### Editing

- Upload adapters: `@novaprose/core/upload` has ready `uploadImage` functions for cloud storage.
  `signedUpload` sends an image to the address your server signs (Amazon S3 and storage that speaks
  its protocol, such as Cloudflare R2, MinIO, DigitalOcean Spaces or Backblaze B2, and Google Cloud
  Storage; a presigned PUT or an S3 presigned POST), `azureBlobUpload` to Azure Blob Storage,
  `cloudinaryUpload` to Cloudinary with an unsigned preset or a signature, and `uploadcareUpload`
  to Uploadcare. Keys never reach the browser, progress is reported, and only an `http(s)` address
  comes back as the image. The [Images](https://novaprose.com/guides/images/#cloud-storage) guide
  has server code that signs uploads of one image type and size, run against all three SDKs.
- Selection API: `editor.selection` gives the selected content as HTML or text, replaces it,
  reads and sets its range, collapses it, selects all, an element or what is inside it, puts the
  cursor in a node, gives the element where it is, a DOM `Range` and its place on screen, and keeps
  bookmarks that move along with later changes (`getBookmark()` / `moveToBookmark()`). With
  `tinymce.init`, `editor.selection` is built on it and gains `getRng()`, `setRng()`,
  `getBookmark()`, `moveToBookmark()` and `scrollIntoView()`.
- Whole HTML pages: with the `fullpagehtml` plugin the editor holds a whole HTML document. The
  doctype, the head (title, meta tags, style sheets) and the attributes of `<html>` and `<body>` are
  kept around the content; `getHTML()` gives the whole page and `setContent()` of a whole page
  reads its head, while `{ fullPage: false }` works with the content only. The page lives in the
  document, so `getJSON()`, undo and the server renderer keep it. **Document properties** (a button
  and an item in the **File** menu) edits the title, description, keywords, author, language, search
  engines and encoding, as one undo step; the **Source code** view shows the whole page
  (`hideInSourceView` for the content only). Scripts, `<base>`, a refreshing or cookie-setting
  `<meta>`, event handlers and unsafe addresses are never kept, and a style sheet can't close its
  element. Settings fill in a default doctype, title, encoding and body style. With `tinymce.init`,
  `getContent/setContent({ fullpagehtml: false })`, the `fullpagehtml_*` options and
  `mceFullPageHtmlProperties` work. See [Whole HTML pages](https://novaprose.com/guides/full-page/).
- Plugins: a plugin can keep a whole page around the content (`page` in `definePlugin`:
  `read` and `write`), and markup rules (`validElements`) keep the document's own attributes.
- Link cards: with the `mediaembed` plugin, a link alone on its line becomes a card on Enter, with
  the page's title, description, picture and site, from your server (`serviceUrl` or your own
  `resolve`); the Video dialog takes any page, and a link to a picture shows the picture. The card
  is its own undo step, so Ctrl+Z brings the link back; its toolbar opens the page, turns the card
  back into a link or removes it. Nothing from the server is put in as HTML, and the card's address
  and picture are checked like any link and image. The card is a link with inline styles, so the
  page that shows it needs no CSS, and on a narrow screen its text goes under the picture; in Word
  and Markdown it is a link. With `tinymce.init`, `mediaembed_service_url`, `mediaembed_max_width`
  and `mediaembed_inline_styles` work, and cards keep the `ephox-summary-card` classes. The
  [Link cards](https://novaprose.com/guides/embeds/#link-cards) guide has a server that reads
  pages' Open Graph tags safely.
- **Fixed:** image editing takes a file that your `fetchImage` gets from another window (an
  iframe); before, such a file was called unreadable.
- **Fixed:** a `<pre>` holding blocks (lines as `<p>` or `<div>`, as some sites copy code) keeps
  their text in the code block, one per line; before, the text left the code block and the
  paragraphs after it kept tabs that the next save turned into spaces. Found by a property-based
  test.
- Views for plugins: `editor.ui.registry.addView(name, { title, buttons, onShow, onHide })` puts a
  screen of your own in place of the editor (a review, a report), with your buttons at its top;
  `editor.ui.view.show/hide/toggle` and `active`. Focus moves into the view and back, Escape closes
  it. With `tinymce.init`, `ui.registry.addView`, `ToggleView`, `queryCommandValue('ToggleView')`
  and `view_show` (and `sidebar_show`) work.
- Image editing: with the `editimage` plugin the image toolbar rotates and flips the picture, and
  **Edit image** crops it (by dragging on a preview or with the fields, free or to a shape),
  resizes it and changes its brightness, contrast and saturation, the same in every browser. The
  edited picture is a new file through `uploadImage` (embedded without it), shown at once while it
  uploads; one undo brings the previous picture back, and a failed upload brings back the original.
  Images from other sites are read with CORS or through `fetchImage` on your server; SVG is never
  edited. With `tinymce.init`, `editimage_toolbar`, `editimage_credentials_hosts`,
  `editimage_fetch_image` and the `mceImageRotate*`, `mceImageFlip*` and `mceEditImage` commands
  work.
- A context toolbar moves to its place when an image in the text finishes loading (a new or edited
  image had no size yet).
- A code editor for the HTML: with the `advcode` plugin, **Source code** opens the HTML in
  CodeMirror (loaded when first opened): laid out with nested blocks indented and opened where the
  cursor is, colors for HTML, CSS and JavaScript in the editor's theme, matching brackets and tags,
  folding, several cursors, search and replace, tags closed as you type, text size, line wrapping,
  full screen and <kbd>Ctrl</kbd>+<kbd>S</kbd> to save. The layout is a helper too,
  `prettyHTML()`: reading it back gives the same document (a property-based test checks it). With
  `tinymce.init`, `mceCodeEditor`, `advcode_prettify_editor`, `advcode_prettify_getcontent` and
  `getContent({ prettify: true })` work. See [Editing the
  HTML](https://novaprose.com/guides/html-source/).
- Dialogs: an Escape a field inside uses itself (a code editor closing its search) no longer closes
  the dialog, and the dialogs of two editors on one page no longer pull the focus back and forth.
- Advanced tables: the `advtable` plugin adds a column of row numbers (**Row numbers**: numbers,
  letters or your own `series`) that stays in order as rows are added, deleted and sorted; the
  column is found by its cells (`data-series`), so a number is never written over your text. Its
  **Sort…** dialog sorts the rows by any column or the columns by any row, the whole table or the
  selected cells; header rows and columns stay in place. Sorting rows moves whole rows, with their
  own attributes. With `tinymce.init`, `mceTableToggleSeries`, `mceSortTableAdvanced` and the
  other sort commands and `advtable_value_series` work. The new
  [Tables](https://novaprose.com/guides/tables/) guide covers tables as a whole.
- Embedded pages: the `pageembed` plugin shows a web page (a map, a form, a calendar) in the
  document, at full width with a ratio (21:9, 16:9, 4:3, 1:1, or your own classes) or at a fixed
  size, with a title for screen readers. The frame is sandboxed (`sandbox` to change it), only
  absolute http(s) addresses are embedded, and `allowUrl` limits them to your sites; an `<iframe>`
  on its own is never embedded, so pasting a web page brings no frames along. The sizes are inline
  styles too (`inlineStyles: false` for classes only). In Word, Markdown and email an embedded page
  is a link. With `tinymce.init`, `tiny_pageembed_classes` and `tiny_pageembed_inline_styles`
  work and content keeps its classes. The new [Video, web pages and link
  cards](https://novaprose.com/guides/embeds/) guide covers them. The **Insert** menu has
  **Video** and **Embedded page**, and a disabled dialog field now looks disabled.
- Link checker: with the `linkchecker` plugin, links are checked as the document changes, and a
  broken one gets a wavy red underline (`aria-invalid` for screen readers); its bubble says
  **This link seems broken**, with **Ignore**. The check runs on your server: `serviceUrl` answers
  `POST { urls }` with `{ results }`, or `check` is your own function; `preprocess` changes an
  address before it is sent. The [Link checker](https://novaprose.com/guides/link-checker/) guide
  has a Node.js server that keeps your own network out of reach (private and loopback addresses,
  redirects, DNS rebinding). With `tinymce.init`, `linkchecker_service_url` and
  `linkchecker_preprocess` work. The link bubble shortens a long address on a narrow screen
  instead of moving its buttons to a second line.
- Your own typing shortcuts: `textPatterns` takes a list that replaces the built-in ones, of three
  kinds: at the start of a block (`{ start: '#', format: 'h1' }`, `{ start: '1.', command:
'orderedList' }`, with `trigger: 'enter'` on Enter), between two markers (`{ start: '*', end: '*',
format: 'italic' }`) and replacements (`{ start: '(c)', replacement: '©' }`, text or HTML).
  `format` is one of your formats or a built-in one, `command` a named command or your function;
  `textPatternsLookup` adds patterns on every attempt from the text before the cursor. With
  `tinymce.init`, `text_patterns` lists and `text_patterns_lookup` work as they are, their formats
  and commands (`InsertHorizontalRule`, `mceBlockQuote`, your own) run through the editor.
- The toolbar's four ways of fitting: `toolbarMode: 'floating'` (the default, as before: the groups
  that don't fit open from **⋯** in a panel), `'sliding'` (they open in a strip under the toolbar,
  which moves the text down), `'scrolling'` (one row that scrolls sideways, for touch screens; the
  focused control scrolls into view) and `'wrap'`. **Changed:** `'sliding'` is now the strip; the
  panel, the default, is `'floating'`. With `tinymce.init`, every `toolbar_mode` works as it is.
- Suggested edits cover structure. Whole things inserted or deleted are suggestions: a table, a
  row, a column (one suggestion, a cell in every row), an image, a horizontal line, a page break, a
  paragraph; a deleted one stays, dashed or faded, until the deletion is accepted. So are the
  settings of any node (a bulleted list made numbered, table and cell properties, a header row, an
  image's size) and lists and quotes: paragraphs made a list (the button or a typed `- `), items
  taken out of a list, <kbd>Tab</kbd> and <kbd>Shift</kbd>+<kbd>Tab</kbd> in a list, text put into a
  quote or taken out. Cards name what changed (“Table row”, “+Bulleted list”, “Increase
  indent”). In HTML the node carries `data-change="insert"`, `"delete"`, `"wrap"` or `"unwrap"`;
  `Suggestion` has a new `node` field, and for a suggestion a node carries, `from`…`to` is the whole
  node. Accepting gives exactly what the same edit gives outside suggesting mode and rejecting gives
  back exactly the document before the edits, in any order: a property-based test checks both on
  thousands of random documents and edits.
- **Changed:** in suggesting mode nothing changes the document directly. An edit that can't be a
  suggestion yet (merging table cells, the page setup) isn't made, and a notice says so; before, such
  edits, lists and tables were applied directly. Accepting the deletion of a paragraph's text
  leaves the paragraph (as deleting its text does outside suggesting mode); deleting the paragraph
  with its break removes it. A line or paragraphs put in the middle of a paragraph are rejected with
  the break they made. <kbd>Enter</kbd> at the end of a line makes a paragraph that is new as a
  whole: one suggestion with what is typed in it (`data-change="insert"`), and in Word an inserted
  paragraph; in the middle of a line it is still a new paragraph break.
- **Fixed (security):** pasted or dropped content carries no suggestions of its own, so a copied web
  page can't put somebody's name on a suggestion they didn't make. What a node "was" in a suggestion
  saved in HTML or JSON can only bring back a type that fits where the node is.
- **Fixed:** a table, a line or another block inserted at the start of an image's caption cut the
  image in two, one of them without a picture; the block now goes after the image.
- Word (`.docx`): a table row or cell inserted or deleted as a suggestion is Word's row or cell
  revision (`w:trPr`, `w:cellIns`, `w:cellDel`), and the text, images and paragraph marks of a node
  inserted or deleted are Word revisions; on import they come back as suggestions on the row or cell.
  **Fixed:** with revisions accepted on import, a row Word marked deleted no longer arrives as an
  empty row.
- **Fixed:** in suggesting mode, a collaborator's change (or one kept out of the undo history) that
  looked like a paragraph break or a block style change could be turned into a suggestion on your
  side instead of being applied as it was; only your own edits become suggestions.
- `typography` plugin: the **Enhance typography** button gives the selection (or the whole
  text) the typography of its language — typographic quotes as the language writes them (“ ”,
  „ “, « », ‘ ’ nested), apostrophes, dashes, an ellipsis, ©, ®, ™, arrows, ≤ ≥ ≠ ±, ½ ¼ ¾, ×,
  no stray spaces, non-breaking spaces (numbers and units, §, Slavic short words, French
  punctuation). Conventions of 24 languages are built in; the button's arrow picks the language,
  applies it and remembers it. It changes text only (formatting stays), leaves code, addresses and
  text suggested for deletion alone, and is one undo step; in suggesting mode its changes are
  suggestions. `rules` turns rules off, `ignore` leaves formatting alone. With `tinymce.init`,
  `typography_default_lang`, `typography_langs`, `typography_rules` (Typograf rule ids),
  `typography_ignore` and `mceTypography` work. The plugin loads lazily.
- `textPatterns: false` turns off the shortcuts that react to typed characters (Markdown: "# ",
  "- ", "```"; typography: "--", "..."), for people who dictate or type those characters as text
  (WCAG 2.1.4). With `tinymce.init`, `text_patterns: false` does the same.
- **Fixed (accessibility, WCAG 3.1.2):** with the `language` option, the toolbar, menus, dialogs,
  tooltips, the status bar and side panels carry `lang`, so a screen reader reads the interface in
  its language on a page in another one; the text area keeps the page's language.
- **Fixed (accessibility, WCAG 1.4.13):** toolbar tooltips can be dismissed with Escape without
  moving focus or the pointer, and they stay while the pointer rests on them. A button focused from
  the keyboard shows its tooltip, so its first Escape dismisses the tooltip and the next one goes
  back to the text.
- Suggested paragraph breaks: in suggesting mode, Enter makes a new paragraph (or list item) as a
  suggestion, with a pilcrow in the author's color in its margin, and Backspace or Delete across a
  break marks it deleted instead of joining the paragraphs. Rejecting a new break joins the
  paragraphs again, accepting a deleted one joins them; your own new paragraph is deleted for real.
  Cards: “New paragraph”, “Paragraphs joined”. In HTML: `data-change="split"` or `"join"` on the
  block. **Fixed:** in suggesting mode, Backspace at the start of a paragraph and in an empty
  paragraph did nothing.
- Suggested block changes: in suggesting mode, a heading instead of a paragraph (or the other
  way round), a code block, alignment, indent, line height and direction are suggestions like
  text edits. The change shows at once with a bar in the author's color, the card in the
  **Suggestions** panel reads “Paragraph → Heading 2” or “Align center”, and rejecting it gives
  the block back its type and style (changing it back yourself takes the suggestion away). In HTML
  the block keeps what it was in `data-before`; values from HTML or JSON are checked like any
  other. Plugins can now add their own attribute to existing blocks with `nodeAttributes`
  (`nodes: 'textblock'`, `'all'` for every node but the document and text, or node names).
- Discussing a suggested edit: with the `comments` plugin, every card in the **Suggestions** panel
  has a **Comment** button, and replies follow one another on the card (Ctrl+Enter sends, Esc
  closes the box, your own replies can be deleted). Accepting or rejecting the suggestion resolves
  its discussion. A discussion is a comment thread with a `suggestion` field: it is saved, passed
  to `onChange` and synced in real-time collaboration like any other thread, and it stays out of
  the comments panel. `resolveSuggestions` marks its transaction with what it decided.
- `autocorrect` plugin: common typos are corrected as you type ("teh" → "the", "recieve" →
  "receive", "i" → "I", TWo INitial CApitals), when the word ends, in the case it was typed in and
  with its formatting. Backspace right after a correction puts back what was typed and leaves that
  word alone; Ctrl+Z undoes a correction as a step of its own; screen readers hear each one. With
  `capitalize: true`, sentences start with a capital letter (abbreviations such as "e.g." and
  "Dr." are known, and more are learned when a capital is taken back). The built-in list is
  English, about 430 typos that are never right as typed; `replacements` add your own in any
  language, `ignore` keeps words as they are, `onCorrect` hears every correction. Code,
  addresses, paths, handles and merge tags are left alone. Nothing is sent to a server. With
  `tinymce.init`, `autocorrect_autocorrect`, `autocorrect_capitalize`, the `autocorrect` and
  `capitalization` menu items and the `AutocorrectStart/End` and `CapitalizeStart/End` events
  work. The plugin loads lazily.
- A **Tools** menu for the menu bar (`menubar: '… tools …'`): spell check, autocorrect and the
  accessibility checker, when those plugins are on.
- **Fixed:** inside inline code, "--" became an em dash and "..." an ellipsis as you typed
  (`npm --help` turned into `npm —help`); code is now left as typed.
- `a11ychecker` plugin: the **Accessibility** panel (`a11ycheck`) lists what breaks WCAG 2.1 in the
  document — images without alternative text or with a file name for it, skipped heading levels,
  empty headings, paragraphs that are headings in all but name, lists typed by hand, links side by
  side to one address, vague or empty links, low text contrast (AA, AAA), duplicate ids, tables
  without header cells — each with a fix where one is clear (the alternative text typed in the
  card, Change to Heading 3, Make it a list…), Show in the text with an outline, and Ignore. It
  checks again as the document changes. The rules don't need a browser: `checkAccessibility` from
  `@novaprose/core/a11y` checks stored content on a server. Rule ids are TinyMCE's where the check
  is the same; with `tinymce.init`, the `a11ychecker_*` options work. The plugin loads lazily.
- **Fixed:** a decorative image lost its `alt=""` on output, and screen readers then read its file
  name; an image without alternative text is still written without `alt`.
- `spellchecker` plugin: spelling and grammar checked as you type by your own service, the way the
  AI assistant uses your model — a LanguageTool server (`languageTool: { url }`, open source and
  self-hostable) or a `check` function. Problems are underlined (spelling red, grammar blue) with
  `aria-invalid`; a click, or Alt+F7 for the next one, opens a bubble with corrections, Ignore,
  Ignore all and Add to dictionary (`addToDictionary`). Paragraphs go in batches and are checked
  again only when they change; code and text suggested for deletion are skipped; the browser's
  own check is off meanwhile. The whole plugin loads lazily. With `tinymce.init`,
  `tinymcespellchecker`, its `spellchecker_*` options and `mceSpellcheck*` commands work.
- Suggested formats: in suggesting mode, text formatting (bold, italic, underline, strikethrough,
  code, sub/superscript, colors, fonts, sizes, links, styles) is a suggestion too. The new look
  shows at once with a dotted line in the author's color; rejecting it brings back how the text
  looked (`<span data-suggestion="…" data-format="[…]">` remembers it), and a change back takes
  the suggestion away. People who can only suggest (`force`) no longer change formatting directly.
  The panel says what changed ("+Bold −Italic"), and Word gets and gives tracked formatting
  changes (`w:rPrChange`). `Suggestion.kind` can now be `format`, with `added` and `removed`.
- Reviewing suggested edits: the **Suggestions** panel (`suggestionspanel`, or Review suggestions →
  Show all suggestions) lists every suggestion as a card with its author, time and text, a deletion
  right before an insertion by the same person as one replacement; a click finds it in the text.
  Choose an author to see only their suggestions, and **Accept shown** / **Reject shown** decides
  all of them at once. The Review menu can accept or reject the suggestions in the selection only,
  and preview the text with every suggestion accepted or rejected without changing it. Screen
  readers hear how many suggestions were accepted or rejected.
- Word tracked changes open as suggested edits: with the `suggestions` plugin, the tracked changes
  of a `.docx` arrive as suggestions with Word's author names and dates (before, they were
  accepted), so a document reviewed in Word can be reviewed here and saved back with its revisions.
  On the server: `fromDocx(bytes, { revisions: 'suggestions' })`; `importDocx` takes `revisions`
  to choose.
- **Fixed:** in suggesting mode, `setContent` turned the whole document into one suggestion
  (everything old deleted, everything new inserted). Loading a document is not an edit.
- Three formatting tools, as plugins named as in TinyMCE. `casechange`: lowercase, UPPERCASE and
  Title Case for the selection or the word at the cursor; formatting stays letter by letter, code is
  left alone, Title Case keeps English minor words (a, the, of…) small except the first and last
  (`pluginOptions.casechange.titleCaseMinors`), and the button repeats the case used last.
  `formatpainter`: copy the formatting at the cursor and apply it to the next mouse selection (a
  double click keeps it on until Escape), or Ctrl+Alt+C and Ctrl+Alt+V from the keyboard (⌘⌥C, ⌘⌥V
  on a Mac); it carries text formatting and the block's kind and layout, never links, comments or
  suggestions. `permanentpen`: while it is on, everything typed gets the pen's formatting (dark red
  and bold by default); `configurepermanentpen` sets its font, size, styles and colors
  (`pluginOptions.permanentpen.properties`). With `tinymce.init`, `casechange_title_case_minors`,
  `permanentpen_properties` and the `mceLowerCase`, `mceUpperCase`, `mceTitleCase`,
  `mceToggleFormatPainter`, `mceToggleStickyFormatPainter`, `mceTogglePermanentPen` and
  `mceConfigurePermanentPen` commands work.
- `visualchars` plugin: shows invisible characters — no-break spaces as a dot, soft hyphens and
  zero-width spaces as a dashed mark — without touching the text; screen readers read it as before
  (`pluginOptions.visualchars.default`, for TinyMCE `visualchars_default_state` and
  `mceVisualChars`). Only changed paragraphs are scanned again, so long documents stay fast.
- `footnotes` plugin: "Insert footnote" puts the next number at the cursor and the cursor into
  its note in the section at the end of the document. As you edit, the numbers follow the order in
  the text and the notes follow the numbers; a deleted number takes its note along, a copied one gets
  a note of its own, and undo brings a number and its note back together. Enter in a note is a line
  break and pasted paragraphs become its lines; changes touch only the notes involved, so a
  co-author typing in another note loses nothing. A click on a number goes to its note, `^` back to
  the number. The HTML is the one TinyMCE writes (`sup.mce-footnote`, `div.mce-footnotes`,
  DPUB-ARIA roles), so its footnotes load as they are; with `tinymce.init`, `mceInsertFootnote` and
  `mceUpdateFootnotes` work.
- `template` plugin ("Insert template", named as in TinyMCE 5–6): your templates with a
  description and a preview, inserted at the cursor through the schema like a paste. A template is
  HTML or a file; `{$name}` becomes `values.name` (as text, never HTML), an element with the class
  `selcontent` gets the selection, `cdate` and `mdate` get the date in a TinyMCE-style format, and
  only what is inside `div.mceTmpl` is inserted. The list can be an array, a URL of a JSON list or
  a function. With `tinymce.init`, `templates` (with a callback too), `template_*` options,
  `mceTemplate` and `mceInsertTemplate` work.
- `importcss` plugin: the classes of your content CSS (`contentCss` files and `contentStyle`) become
  Styles items — `p.lead` styles a paragraph, `h2.fancy` a heading, `.badge` or `span.badge` text,
  `img.round` an image; other selectors are left out. `pluginOptions.importcss`: `selectorFilter`,
  `fileFilter`, `groups` (submenus), `exclusive`, `converter`, and `append: false` to keep only the
  imported items. The `importcss_*` options of `tinymce.init` work. Plugins can add Styles items
  themselves with `editor.ui.registry.addStyleFormats(items, { replace })`.
- `markdown` plugin: Markdown pasted as plain text — from a text editor, a terminal, a chat, VS Code
  — becomes formatting (headings, lists and checklists, quotes, code, tables, links, bold, italic,
  strikethrough), and a notification offers **Paste as text** to undo it. Only text that looks like
  Markdown is converted; Ctrl/Cmd+Shift+V, "paste as text" mode and code blocks stay plain. The
  parser loads with the plugin (`pluginOptions.markdown.paste: false` turns it off). See
  [Markdown](https://novaprose.com/guides/markdown/#pasting-markdown).
- `save` plugin: the Save button and Ctrl/Cmd+S call `pluginOptions.save.onSave(editor)` or submit
  the form around the editor; Save is enabled only with unsaved changes (`enableWhenDirty: false` —
  always), and Cancel brings back the text of the last save. With `tinymce.init`,
  `save_onsavecallback` and `save_oncancelcallback` get the editor (the content is already in the
  `<textarea>`), and `save_enablewhendirty`, `mceSave` and `mceCancel` work.

- `email` plugin and `@novaprose/core/email`: email HTML from the content. Content styles go into each
  element's `style` attribute with a browser's cascade (specificity, order, `!important`, inline
  styles), on top of built-in email styles that keep the editor look (tables with borders, quotes,
  code); custom properties are resolved, structural selectors work, `@media` rules go to the head
  of a whole email. A video becomes a link to its page, a collapsible block is shown open, checklist
  items get ☑ and ☐, relative links and images become absolute, and template tags such as
  `{{unsubscribe_url}}` stay as they are. `document` gives a whole email: a centered column Outlook
  keeps too, preview text for the inbox. `toEmailHTML` takes HTML from anywhere: scripts, event
  handlers, forms, SVG, unsafe addresses and CSS that runs code are removed. **Email preview** (`emailpreview`) shows it on a desktop
  or a phone screen with its size (Gmail cuts off emails over 102 KB) and copies it as an email or
  as HTML code. With `tinymce.init`, `inlinecss` works (`editor.plugins.inlinecss.getContent()`,
  the `InlineCSS` event, `inlinecss_selector_filter`, `inlinecss_file_filter`), and
  `editor.plugins` lists the plugins that work, with what your own plugins return.
- **Fixed:** the AI assistant on text in a code block sent its request and then said it suggested
  no changes: code can't carry suggestions. Now, with only code selected, the window says so and
  writes after the code block; with text and code selected, only the text changes.
- **Fixed:** a click on a dialog's title or anything else in it that takes no focus (in Safari, a
  button or a radio too) dropped focus out of the dialog, and Escape and Tab stopped working; a
  click inside now keeps focus in the dialog.
- **Fixed:** the icons of the text color, highlight and table buttons sat 2 px above the rest of the
  toolbar; every icon is on one line now, the color bar just under the letter.
- AI assistant (`plugins: ['suggestions', 'ai']`, buttons `aidialog` and `aishortcuts`, as in
  TinyMCE): select text and pick **Improve writing**, **Fix spelling and grammar**, **Make
  shorter**, **Make longer**, **Simplify**, a formal or friendly tone, **Summarize**, or type your
  own request; with nothing selected, **Continue writing** or your request writes at the cursor.
  The answer arrives as suggested edits from “AI”: the rewrite is compared word by word, so only
  changed words are marked, kept words keep their formatting, and each change is accepted or
  rejected like a colleague's. The model is yours: `pluginOptions.ai.request` sends the request
  through your server and returns the answer as text or as a stream shown while it is written;
  closing the window cancels it. Each request carries a ready `prompt` (the text in tags, the
  rules for the answer), so a server only passes it on. The answer is inserted as text, never
  HTML. `shortcuts` replaces the quick actions with your own (groups too).
  - **AI chat** (`aichat`): a panel next to the text. **Ask** answers questions about the
    document (and the selection), keeps the conversation, and **Insert** or **Replace
    selection** puts an answer into the text as suggestions. **Edit** changes the whole
    document, or the selected paragraphs, as you ask: the model gets the paragraphs numbered,
    sends back only the ones it changed, and each appears as suggestions as soon as it arrives;
    **Accept all** and **Reject all** in the panel resolve that edit. A paragraph someone changes
    while the model writes is left alone. The selection stays highlighted while focus is in the
    panel.
  - **Autocomplete** (`autocomplete: true`): after a pause at the end of a paragraph, the
    model's continuation shows in grey after the cursor; Tab or a tap accepts it, Esc dismisses
    it, typing its letters keeps the rest, and screen readers announce it. The `aiautocomplete`
    toggle turns it off.
  - With `tinymce.init`, `ai_request` (`respondWith.string` and `respondWith.stream`),
    `ai_shortcuts`, `mceAiDialog`, `mceAiDialogClose` and the `AIRequest`, `AIResponse`,
    `AIError`, `AIDialogOpen`, `AIDialogClose` events work; an HTML answer becomes text.
    Guide with a server example: [AI assistant](https://novaprose.com/guides/ai-assistant/).
- Phones and tablets: the quick formatting bar (`quickbars`) sits across the screen just above the
  keyboard instead of next to the selection, where it covered the text, the selection handles and the
  system Copy/Paste menu. **Changed:** on touch screens the quick insert bar (image, table) no longer
  pops up on every empty line; those buttons are in the toolbar.
- **Fixed:** with the keyboard open on a phone, menus, the link panel and other floating panels could
  appear away from what they belong to, over the text: they are now placed within the visible part of
  the screen.
- **Fixed:** the first click into an editor without focus, beside the text rather than on it — to the
  right of the last line, or below it — put the cursor at the start of the document (Chromium, Safari
  and Firefox, with content loaded through `setContent`). The cursor now goes where you clicked.
- **Fixed:** in suggesting mode, rejecting the text of a new paragraph left an empty line, and so
  did accepting the deletion of a paragraph's whole text — the paragraph now goes with it (unless
  it is the only one where a paragraph is required, such as a table cell).
- **Fixed:** the colors of suggestion authors and of deleted text did not reach the 4.5:1 contrast
  required for text on a white background; the palette is darker, and deleted text is no longer
  faded.
- **Fixed (screen readers):** the placeholder of an empty editor was read as if it were text in the
  document; it is now announced as the field's placeholder (`aria-placeholder`). In real-time
  collaboration, the names on other participants' cursors were read as part of the text; the
  cursors are now hidden from screen readers.
- Screen readers hear what a shortcut changed: Ctrl+B says “Bold on” or “Bold off” (likewise italic,
  underline, strikethrough, code, subscript, superscript and the list shortcuts), heading and paragraph
  shortcuts name the block, alignment shortcuts name the alignment, and typing a Markdown shortcut such
  as “- ”, “1. ”, “## ” or “> ” says “Bulleted list”, “Numbered list”, “Heading 2” or “Quote”. Before,
  NVDA read only the typed characters. The messages go to a hidden polite live region, translated with
  the editor; plugins can use it too: `editor.ui.announce(text)`.
- **Fixed (screen readers):** after Ctrl+B on a selected word, NVDA also read the next word as
  “unselected” (likewise Ctrl+I, Ctrl+E and the other format shortcuts). Chromium gave bold, italic,
  strikethrough, inline code, subscript and superscript text accessibility objects of their own; in the
  editor they now stay part of the line (`role="none"`), and the formatting still reaches screen readers
  as text attributes. The HTML output is unchanged. An NVDA test on a Windows runner checks it on every
  change.
- The keyboard shortcuts help (Alt+0) lists each shortcut as one line, “Bold Ctrl+B”. It was a table,
  and screen readers named the row and column of every cell.
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
- Headers, footers and page numbers in page layout: `header` and `footer` (a string, or
  `{ left, center, right }`) with `{page}` and `{pages}`, and `differentFirstPage` for a title page.
  They print on every page in Chrome and Edge (CSS page margin boxes), appear in PDF files, and go into
  Word files as a Word header and footer with PAGE and NUMPAGES fields. On screen the header shows in
  the top margin of the first page and the footer in the bottom margin of the last one.
- Export to PDF (`plugins: ['exportpdf']`, button and File menu item `exportpdf`, as in TinyMCE): your
  server turns the editor's print document — text, styles, sheet, header and footer — into a PDF with
  a headless Chrome (`pluginOptions.exportpdf.request`), and the file downloads. Without a server the
  button opens the print dialog with a hint to choose “Save as PDF”. A server example with the
  security settings it needs is in [Pages and printing](https://novaprose.com/guides/pages-and-printing/).
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
- Checklists (`plugins: ['checklist']`, button `checklist`): tick an item with a click or Ctrl/Cmd+Enter,
  type `[ ]` or `[x]` at the start of a line, Enter starts a new unticked item; nesting, indent and
  paste work as in other lists. HTML uses the Tiptap task list format (`data-type="taskList"`,
  `data-checked`); TinyMCE (`tox-checklist`) and GitHub checklists are converted on load and paste,
  even without the plugin. Markdown: `- [ ]` / `- [x]` both ways. Keyboard and screen readers:
  each box is a `role="checkbox"` with its state.
- The numbered list button inside a bulleted list (and the other way round) now switches the list
  type. It used to do nothing.

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
- **Breaking:** `@novaprose/core` no longer exports internal helpers that were never documented:
  `API_CHANGE_META`, `cssValue`, `imageSize`, `createTranslator` (use `editor.ui.t`),
  `parseToolbar`, `rankSlashCommands`, `ContentRules`, `KNOWN_TAGS`, `KNOWN_STYLES`,
  `newCommentId`, `resolvePageLayout`, `MENTION_ID_RE` — a step towards freezing the API for 1.0.
- **Fixed:** `editor.exec()`, `editor.can()` and chain steps threw a `TypeError` for a command name
  the editor doesn't have (possible from JavaScript without types, such as the CDN build); they now
  return `false` and log a hint once.
- Languages on demand: `registerLanguage('de', () => import('@novaprose/core/i18n/de'))` registers
  a pack that is downloaded only when needed; `await loadLanguage('de')` loads it before the editor
  is created, and `hasLanguage(code)` tells whether a language is ready.
- The `SchemaSpecs` type is exported. The types of `@novaprose/core/html-rules` used it without a
  public name, so a type inferred from them could fail with TS2742 in your project.
- **Changed:** `editor.resolveCommand()` and `editor.contentRules` are no longer part of the public
  types. They were undocumented internals; use `editor.exec()`, `editor.can()` and
  `editor.isAllowed()`.
- Ready for renames after 1.0: a renamed option, command or event keeps working under its old name and
  logs one console warning that names the replacement. Nothing is renamed today.
- The reference lists every option: `disabled`, `resize`, `blockFormats`, `formats`,
  `styleFormats`, `styleFormatsMerge`, `validClasses`, `tableClassList`, `tableCellClassList`,
  `filePicker` and `filePickerTypes` were missing.

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

- The size limit CI checks: the core's first load, ProseMirror included, may take up to 175 KB gzip
  (it was 145), the CDN main files up to 180 KB (web component) and 190 KB (`tinymce.init`). In
  0.8.0 the first load is 157.4 KB (144.2 in 0.7.0), the CDN main files 161.4 and 174.6 KB.
  Optional plugins keep loading lazily, outside these numbers.
- Every ready-made language (Russian, German, Spanish, French, Italian, Portuguese) works in the
  CDN builds: each is a separate file next to the script. `<novaprose-editor language="de">` and
  `tinymce.init({ language: 'de' })` load it before the editor appears. **Changed:** Russian is no
  longer inside the main file, which gets 5–6 KB gzip smaller, so with `NovaProse.createEditor`
  call `await NovaProse.loadLanguage('ru')` first.
- The CDN builds include `novaprose.licenses.txt` / `tinymce.licenses.txt` with the license of
  every bundled package (ProseMirror, highlight.js…), generated from the build itself, and a banner
  pointing to it.
- CDN builds: code that several lazy parts need (the Word export helpers, the comparison of
  versions) ships once, as a part of its own that they share, instead of a copy inside each part.

### Plugin UI

- `editor.ui.dialog`: tabs (`tabs: [{ title, fields }]`, WAI-ARIA keyboard, switches to the tab with
  an invalid field) and a `file` field with a drop zone, a Browse button, a removable list of chosen
  files, `accept`, `multiple` and `maxSize`. The value is an array of `File` objects.
- `editor.ui.addStyles(id, css)`: a plugin adds its own styles once per page (or shadow root),
  without `'unsafe-inline'` in your CSP.

### Performance

- A smaller first load: the find and replace bar, the table and cell properties dialogs, and
  reading the images of desktop Word on paste load when needed instead of with the editor (the bar
  comes with `editor.ready`, so Ctrl+F is there before anyone presses it). `editor.openSearch()` now
  returns a promise that resolves once the bar is open.
- Speed is measured on every change, with limits: a 100-page document (about 50,000 words) on the
  production CDN build in Chromium — creating the editor, typing, Enter and Backspace, pasting from
  Word, formatting the whole document, typing with page layout and in suggesting mode, typing in a
  large table, and memory after creating and destroying editors. On a developer laptop a keystroke
  takes about 5 ms in that document and the editor opens in about 90 ms.
- `style.css` shrinks from 11.9 to 10.3 KB gzip: styles of the comments panel, version history, plugin
  dialogs and the TinyMCE-compatible dialogs now come with their lazily loaded code. If you override
  these styles in your own CSS, use a selector at least as specific as ours.

### Sync server

- Public rooms (`NOVA_SYNC_PUBLIC_PREFIX`) have limits, so a demo server can't become free hosting for
  other sites. `NOVA_SYNC_PUBLIC_ORIGINS` lists the sites allowed to open them; at most 50 rooms are
  open at once, with 25 people in a room and 20 connections from one address; a message over 512 KB, or
  a room whose edits pass 2 MB, closes the room for an hour. A refused client gets the reason in
  `onAuthenticationFailed`: `demo-origin`, `demo-busy`, `demo-room-full`, `demo-too-many-connections` or
  `demo-room-closed`. Rooms with a token have none of these limits.
- One WebSocket frame is at most 8 MB. Before, the socket library accepted frames of up to 100 MB from
  anyone, before any token was checked.

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
