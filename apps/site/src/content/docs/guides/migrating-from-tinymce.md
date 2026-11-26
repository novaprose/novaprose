---
title: Migrating from TinyMCE
description: Map TinyMCE options, toolbar names and API calls to NovaProse.
---

NovaProse uses the same names for toolbar controls, menus and plugins as TinyMCE, so most
configurations move over by renaming a few options. The table below maps the options you are
most likely to use.

## The fastest way: keep `tinymce.init()`

`@novaprose/tinymce-compat` runs your existing `tinymce.init({...})` code on NovaProse — the same
options, plugin API (`PluginManager.add`, `editor.ui.registry`), commands and events. For a page
with a script tag, change one line:

```html
<!-- before -->
<script src="https://cdn.tiny.cloud/1/your-api-key/tinymce/7/tinymce.min.js"></script>
<!-- after -->
<script src="https://cdn.jsdelivr.net/npm/@novaprose/tinymce-compat/dist/tinymce.global.js"></script>
```

With a bundler: `npm install @novaprose/tinymce-compat @novaprose/core` and
`import { tinymce } from '@novaprose/tinymce-compat'`. Options and plugins that aren't supported yet
are listed in a console warning instead of breaking the page. The
[package README](https://www.npmjs.com/package/@novaprose/tinymce-compat) lists what works.

When you're ready, move to the native API below — it is smaller, typed and framework-friendly.

## Options

| TinyMCE                                 | NovaProse                                                     |
| --------------------------------------- | ------------------------------------------------------------- |
| `selector` / `target`                   | `element` (one editor per element)                            |
| `toolbar`                               | `toolbar` — same syntax and control names                     |
| `toolbar_mode: 'sliding'` / `'wrap'`    | `toolbarMode: 'sliding'` / `'wrap'`                           |
| `menubar`, `menu`                       | `menubar`, `menu`                                             |
| `statusbar`                             | `statusbar`                                                   |
| `plugins`                               | `plugins` — most open-source plugins are built in (see below) |
| `inline: true`                          | `mode: 'inline'`                                              |
| `placeholder`                           | `placeholder`                                                 |
| `language`                              | `language`                                                    |
| `directionality: 'rtl'`                 | `direction: 'rtl'` (automatic for Arabic, Hebrew, Persian)    |
| read-only mode                          | `editable: false`, `editor.setEditable(false)`                |
| `images_upload_handler`                 | `uploadImage(file, progress) => Promise<url>`                 |
| `font_family_formats`                   | `fontFamilies: [{ label, value }]`                            |
| `font_size_formats`                     | `fontSizes: ['12px', '14px', …]`                              |
| `line_height_formats`                   | `lineHeights: ['1', '1.5', '2']`                              |
| `color_map`                             | `colors: ['#000000', …]`                                      |
| `valid_elements`, `invalid_elements`    | `validElements`, `invalidElements`                            |
| `extended_valid_elements`               | `extendedValidElements` (with `@novaprose/core/html-rules`)   |
| `custom_elements`                       | `customElements` (with `@novaprose/core/html-rules`)          |
| `valid_styles`                          | `validStyles`                                                 |
| `paste_preprocess`, `paste_postprocess` | `pastePreprocess(html)`, `pastePostprocess(fragment)`         |
| `paste_as_text`                         | `pasteAsText`                                                 |
| `setup`                                 | `setup(editor)`                                               |
| `height`, `min_height`                  | CSS on the container, or the `--nova-min-height` variable     |

## Plugins

| Status            | TinyMCE open-source plugins                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Built into core   | `lists`, `link`, `table`, `code`, `preview`, `fullscreen`, `searchreplace`, `help`, `wordcount` (status bar), `image` (partial), PowerPaste-style paste cleanup                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Optional plugin   | `accordion` (`details_initial_state`, `details_serialized_state` and the `InsertAccordion`, `ToggleAccordion`, `ToggleAllAccordions`, `RemoveAccordion` commands work), `advlist`, `anchor`, `autolink`, `autoresize`, `autosave`, `charmap`, `codesample` (highlighting with highlight.js, `codesample_languages` supported — see [Code blocks](/guides/code-blocks/)), `directionality`, `emoticons`, `insertdatetime`, `media`, `nonbreaking`, `pagebreak`, `quickbars`, `visualblocks`; `checklist` (a premium plugin in TinyMCE, free here — existing `tox-checklist` content is converted) |
| Not available yet | `visualchars`, `importcss`, `save`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |

Built-in features don't need to be listed in `plugins`. Unknown plugin names are reported in the
console and ignored.

## API

| TinyMCE                              | NovaProse                                                  |
| ------------------------------------ | ---------------------------------------------------------- |
| `editor.getContent()`                | `editor.getHTML()`                                         |
| `editor.setContent(html)`            | `editor.setContent(html)`                                  |
| `editor.execCommand('Bold')`         | `editor.exec('bold')`                                      |
| `editor.queryCommandState('Bold')`   | `editor.isActive('bold')`                                  |
| `editor.on('change', …)`             | `editor.on('change', …)` — returns an unsubscribe function |
| `editor.mode.set('readonly')`        | `editor.setEditable(false)`                                |
| `editor.ui.registry.addButton(…)`    | `editor.ui.registry.addButton(…)` — same shape             |
| `editor.windowManager.open(spec)`    | `editor.ui.dialog({ title, fields, onSubmit })`            |
| `editor.ui.registry.addSidebar(…)`   | `editor.ui.registry.addSidebar(name, { title, render })`   |
| `execCommand('ToggleSidebar', …)`    | `editor.ui.sidebar.toggle(name)`                           |
| `editor.focus()`, `editor.destroy()` | `editor.focus()`, `editor.destroy()`                       |

## Content

NovaProse outputs clean, deterministic HTML. When you load existing TinyMCE content, anything the
NovaProse document model doesn't support is dropped (for example `<script>`, unknown attributes and
unsafe URLs). Test with a sample of your real documents before switching, and keep the original
HTML until you are confident.
