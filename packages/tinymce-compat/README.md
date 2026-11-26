# @novaprose/tinymce-compat

Run an existing `tinymce.init()` setup on [NovaProse](https://www.npmjs.com/package/@novaprose/core)
without rewriting it — then move to the native API when you are ready.

> **Status: 0.x preview.** Common integrations work as is; less common APIs print a warning.
> TinyMCE is a trademark of Tiny Technologies Inc. NovaProse is an independent project, not affiliated
> with Tiny Technologies; compatibility is implemented from public API documentation.

## Script tag: replace one line

```html
<!-- before -->
<script src="https://cdn.tiny.cloud/1/your-api-key/tinymce/7/tinymce.min.js"></script>
<!-- after -->
<script src="https://cdn.jsdelivr.net/npm/@novaprose/tinymce-compat/dist/tinymce.global.js"></script>

<script>
  tinymce.init({
    selector: 'textarea#post',
    plugins: 'lists link image table code',
    toolbar: 'undo redo | blocks | bold italic | bullist numlist | link image | code',
  });
</script>
```

The script sets `window.tinymce` and loads its stylesheet (`novaprose.css`, next to the script).
`init()` can run in `<head>`: it waits for the document like TinyMCE.

## npm

```bash
npm install @novaprose/tinymce-compat @novaprose/core
```

```ts
import '@novaprose/core/style.css';
import { tinymce } from '@novaprose/tinymce-compat';

const [editor] = await tinymce.init({ selector: '#post', plugins: 'lists link' });
editor.on('change', () => console.log(editor.getContent()));
```

## What works

- **`tinymce`**: `init` (selector, target, textarea or inline), `get`, `remove`, `activeEditor`,
  `triggerSave`, `execCommand`, `PluginManager.add`, `IconManager.add`.
- **Editor**: `getContent`/`setContent`/`insertContent`, `execCommand` and `queryCommandState` for
  the common commands (`Bold`, `FormatBlock`, `InsertUnorderedList`, `mceInsertContent`, `Undo`…),
  `addCommand`, `on`/`off`/`once`/`fire`/`dispatch`, `selection`, `undoManager`, `mode`,
  `isDirty`/`setDirty`/`save`, `focus`, `remove`, `notificationManager.open`,
  `windowManager.alert`/`confirm`, `getParam`/`options.get`.
- **Dialogs**: `windowManager.open` with `panel` or `tabpanel` bodies — `input`, `textarea`,
  `checkbox`, `selectbox`/`listbox`, `urlinput`, `colorinput`, `button`, `htmlpanel` (sanitized),
  `alertbanner`, `label`, `grid`, `bar`; `initialData`, `onSubmit`, `onChange`, `onAction`, `onCancel`,
  `onClose`, `onTabChange`; `api.getData/setData/close/block/unblock/focus/disable/enable/showTab`.
- **`editor.dom`** (reading): `select`, `get`, `getParent(s)`, `is`, `getAttrib`, `hasClass`, `encode`,
  `decode`, `create`, `uniqueId`. **`editor.formatter`**: `apply`/`remove`/`toggle`/`match` for built-in
  formats (`bold`…`h1`…`alignleft`…, `forecolor`, `hilitecolor`, `fontname`, `fontsize`) and your own
  (`formats` option, `formatter.register`). **`editor.selection`**: `getContent`, `setContent`, `getNode`,
  `isCollapsed`, `collapse`, `setCursorLocation`, `select`.
- **`editor.ui.registry`**: `addButton`, `addToggleButton` (with `onSetup` and `api.setActive`),
  `addMenuButton` (`fetch`), `addMenuItem`, `addContextToolbar`, `addSidebar` (with
  `ToggleSidebar` and `queryCommandValue`), `addIcon`; TinyMCE icon names map to
  NovaProse icons.
- **Events**: `init`, `input`, `change` (on blur after edits), `NodeChange`, `focus`, `blur`,
  `keydown`, `keyup`, `click`, `paste`, `SetContent`, `GetContent`, `SaveContent`, `ExecCommand`,
  `Dirty`, `remove`.
- **Options**: `toolbar`, `menubar`, `plugins`, `statusbar`, `placeholder`, `readonly`, `disabled`
  (also `editor.options.set('disabled', …)`), `resize`, `block_formats`, `file_picker_callback`, `file_picker_types`, `formats`, `style_formats`,
  `style_formats_merge`, `valid_classes`, `table_class_list`, `table_cell_class_list` (without it all classes are kept, as in TinyMCE), `language`,
  `inline`, `height`/`min_height`/`max_height`/`width`, `content_style`, `content_css` (your files; skin names
  like `default` or `dark` are ignored), `images_upload_handler`,
  `paste_as_text`, `paste_preprocess`, `valid_elements` (with attribute rules)/`invalid_elements`/`valid_styles`,
  `extended_valid_elements`, `custom_elements`, `directionality`,
  `font_family_formats`, `font_size_formats`, `line_height_formats`, `color_map`, `toolbar_mode`,
  `setup`, `init_instance_callback`, `autosave_*`, `quickbars_*`, `mentions_fetch`.
- Form submit writes the HTML back into the textarea.

Plugins built into NovaProse (`lists`, `link`, `image`, `table`, `code`, `searchreplace`…) need
nothing; optional ones (`charmap`, `emoticons`, `anchor`, `media`, `autosave`…) load by name.
Unknown options and plugins don't break initialization — they are listed in a console warning.

Not yet: direct DOM edits through `editor.dom` (NovaProse redraws the text from its document model —
use `setContent`, `insertContent` or `editor.formatter`), `addContextForm`; format features beyond
`block`/`inline`/`selector` + `classes`/`styles` (`wrapper`, `attributes`, `%value` variables, `div` blocks). See [the migration guide](https://novaprose.com/guides/migrating-from-tinymce/).
