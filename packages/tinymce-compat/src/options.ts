import {
  isPluginRegistered,
  type BlockFormat,
  type FilePickType,
  type FormatSpec,
  type StyleFormat,
  type EditorOptions,
  type UploadImageHandler,
} from '@novaprose/core';
import type { CompatEditor } from './editor';

/**
 * Translates a `tinymce.init({...})` configuration into NovaProse options. Option names and their
 * meaning come from TinyMCE's public documentation (a description of behavior); unknown options
 * don't break initialization but are listed in a warning, so it's clear what isn't supported yet.
 */

export type TinyConfig = Record<string, unknown> & {
  selector?: string;
  target?: HTMLElement;
  plugins?: string | string[];
  toolbar?: string | string[] | boolean;
  menubar?: string | boolean;
  inline?: boolean;
  setup?: (editor: CompatEditor) => void;
  init_instance_callback?: (editor: CompatEditor) => void;
};

/** Features built into the NovaProse core: such plugins don't need to be enabled. */
const BUILT_IN = new Set([
  'lists',
  'link',
  'image',
  'table',
  'code',
  'preview',
  'searchreplace',
  'fullscreen',
  'help',
  'wordcount',
  'paste',
  'hr',
  'print',
  'textcolor',
  'colorpicker',
  'contextmenu',
  'tabfocus',
  'textpattern',
  'imagetools',
  'powerpaste',
]);

/** Plugins with a different name in NovaProse. */
const RENAMED: Record<string, string> = {
  tinycomments: 'comments',
  tinymcespellchecker: 'spellchecker',
  inlinecss: 'email',
};

/** Options that are understood but not needed in NovaProse (cloud, skins, license, iframe). */
const IGNORED = new Set([
  'selector',
  'target',
  'license_key',
  'api_key',
  'branding',
  'promotion',
  'skin',
  'skin_url',
  'content_css',
  'icons',
  'icons_url',
  'theme',
  'theme_url',
  'base_url',
  'suffix',
  'referrer_policy',
  'convert_urls',
  'relative_urls',
  'remove_script_host',
  'document_base_url',
  'entity_encoding',
  'height',
  'min_height',
  'max_height',
  'width',
  'resize',
  'content_style',
  'setup',
  'init_instance_callback',
  'inline',
  'plugins',
  'toolbar',
  'menubar',
  'statusbar',
  'placeholder',
  'readonly',
  'disabled',
  'block_formats',
  'file_picker_callback',
  'formats',
  'style_formats',
  'style_formats_merge',
  'valid_classes',
  'table_class_list',
  'table_cell_class_list',
  'file_picker_types',
  'language',
  'images_upload_handler',
  'paste_as_text',
  'paste_preprocess',
  'paste_postprocess',
  'invalid_elements',
  'valid_elements',
  'directionality',
  'extended_valid_elements',
  'custom_elements',
  'valid_styles',
  'toolbar_mode',
  'toolbar_sticky',
  'font_family_formats',
  'font_size_formats',
  'line_height_formats',
  'color_map',
  'autosave_interval',
  'autosave_retention',
  'autosave_prefix',
  'quickbars_selection_toolbar',
  'quickbars_insert_toolbar',
  'mentions_fetch',
  'tinycomments_author',
  'tinycomments_author_name',
  'codesample_languages',
  'details_initial_state',
  'details_serialized_state',
  'tableofcontents_class',
  'tableofcontents_depth',
  'tableofcontents_header',
  'tableofcontents_orderedlist',
  'tableofcontents_includeheader',
  // Highlighting is our own (highlight.js, lazy); Prism on the site's page isn't needed for it.
  'codesample_global_prismjs',
  'casechange_title_case_minors',
  'permanentpen_properties',
  'visualchars_default_state',
  // save_* are wired in index.ts: the callbacks get the TinyMCE-style editor.
  'save_enablewhendirty',
  'save_onsavecallback',
  'save_oncancelcallback',
  'importcss_append',
  'importcss_file_filter',
  'importcss_selector_filter',
  'importcss_groups',
  'importcss_exclusive',
  'importcss_selector_converter',
  'templates',
  // tinymcespellchecker: the checking goes through your service (spellchecker_languagetool_url or
  // spellchecker_check, NovaProse's own options); Tiny's spellchecker_rpc_url is not used.
  'spellchecker_active',
  'spellchecker_language',
  'spellchecker_languages',
  'spellchecker_ignore_list',
  'spellchecker_dialog',
  'content_language',
  'spellchecker_languagetool_url',
  'spellchecker_check',
  // a11ychecker: the level, ignored rules, decorative images, the alt length, a filter. HTML 5 is
  // always checked, and there is no "more info" link.
  'a11ychecker_level',
  'a11ychecker_ignored_rules',
  'a11ychecker_allow_decorative_images',
  'a11y_advanced_options',
  'a11ychecker_alt_text_max_length',
  'a11ychecker_filter_issue',
  'a11ychecker_html_version',
  'a11ychecker_issue_url_callback',
  // ai: ai_request is wired in index.ts (its events go to the TinyMCE-style editor); ai_shortcuts
  // becomes the quick actions.
  'ai_request',
  'ai_shortcuts',
  // inlinecss → the email plugin: the filters of what is put inline.
  'inlinecss_selector_filter',
  'inlinecss_file_filter',
  // linkchecker: the service address (a server that answers our protocol, see the link checker
  // guide) and preprocess; the highlight's look comes from the theme's CSS variables.
  'linkchecker_service_url',
  'linkchecker_preprocess',
  'linkchecker_content_css',
  // pageembed: the sizes (classes) and inline styles; the wrapper keeps TinyMCE's class.
  'tiny_pageembed_classes',
  'tiny_pageembed_inline_styles',
  // advtable: your series for the numbers column (their generators give each row's value).
  'advtable_value_series',
  // advcode: the code laid out on open, getContent laid out too (index.ts); the code editor opens
  // in a dialog with a full screen button, so advcode_inline isn't needed.
  'advcode_prettify_editor',
  'advcode_prettify_getcontent',
  'advcode_inline',
  // view_show and sidebar_show: opened when the editor is ready (index.ts).
  'view_show',
  'sidebar_show',
  // editimage: the toolbar, the hosts with cookies, your way to fetch an image (editimage_fetch_image
  // gets an <img>). Images are read with CORS, so the CORS host list, the proxy and the upload timeout
  // aren't needed: fetchImage goes through your server instead.
  'editimage_toolbar',
  'editimage_credentials_hosts',
  'editimage_fetch_image',
  'editimage_cors_hosts',
  'editimage_proxy',
  'editimage_proxy_service_url',
  'editimage_upload_timeout',
  // autocorrect: corrections run in the browser, so Tiny's service address isn't needed.
  'autocorrect_autocorrect',
  'autocorrect_capitalize',
  'autocorrect_service_url',
  // typography: the language, the languages of the menu, the rules (Typograf rule ids), tags left alone.
  'typography_default_lang',
  'typography_langs',
  'typography_rules',
  'typography_ignore',
  // text_patterns: false turns the patterns off; a list (and text_patterns_lookup) is TinyMCE's
  // patterns, run through this editor's formatter and execCommand (index.ts).
  'text_patterns',
  'text_patterns_lookup',
  'template_replace_values',
  'template_preview_replace_values',
  'template_selected_content_classes',
  'template_cdate_classes',
  'template_mdate_classes',
  'template_cdate_format',
  'template_mdate_format',
]);

const list = (value: unknown): string[] =>
  (Array.isArray(value) ? value.join(' ') : String(value ?? '')).split(/[\s,]+/).filter(Boolean);

/** The TinyMCE names of the listed plugins that work here: built into the core, or loaded from the catalog. */
export function activePlugins(config: TinyConfig, has: (name: string) => boolean): string[] {
  return list(config.plugins).filter((name) => BUILT_IN.has(name) || has(RENAMED[name] ?? name));
}

/** Typograf rule ids (as typography_rules names them) → the typography plugin's rules. */
function typographyRule(id: string): string | null {
  if (/\/dash\//.test(id)) return 'dashes';
  if (/^common\/punctuation\/(quote|apostrophe)$/.test(id)) return 'quotes';
  if (id === 'common/punctuation/hellip') return 'ellipsis';
  if (id === 'common/punctuation/delDoublePunctuation' || id.startsWith('common/space/'))
    return 'spaces';
  if (id === 'common/symbols/arrow') return 'arrows';
  if (id.startsWith('common/symbols/')) return 'symbols';
  if (id === 'common/number/fraction') return 'fractions';
  if (id.startsWith('common/number/')) return 'math';
  if (id.startsWith('common/nbsp/')) return 'nbsp';
  return null;
}

/** HTML tags of typography_ignore → mark and node names left alone. */
const TYPOGRAPHY_TAGS: Record<string, string[]> = {
  code: ['code', 'code_block'],
  pre: ['code_block'],
  a: ['link'],
  strong: ['bold'],
  b: ['bold'],
  em: ['italic'],
  i: ['italic'],
  blockquote: ['blockquote'],
};

/** The typography plugin's options from typography_*. */
function typographyOptions(config: TinyConfig): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const lang = config.typography_default_lang;
  const first = Array.isArray(lang) ? lang[0] : lang;
  if (typeof first === 'string' && first) out.language = first.replace(/_/g, '-');
  const langs = config.typography_langs;
  const codes = Array.isArray(langs)
    ? langs
    : langs && typeof langs === 'object'
      ? Object.keys(langs)
      : [];
  const languages = codes
    .filter((c): c is string => typeof c === 'string')
    .map((c) => c.replace(/_/g, '-'));
  if (languages.length) out.languages = languages;
  if (Array.isArray(config.typography_rules)) {
    const on = new Set(
      config.typography_rules.map((id) => (typeof id === 'string' ? typographyRule(id) : null)),
    );
    out.rules = Object.fromEntries(
      [
        'quotes',
        'dashes',
        'ellipsis',
        'symbols',
        'arrows',
        'math',
        'fractions',
        'spaces',
        'nbsp',
      ].map((rule) => [rule, on.has(rule)]),
    );
  }
  if (Array.isArray(config.typography_ignore)) {
    const ignore = config.typography_ignore.flatMap((tag) =>
      typeof tag === 'string'
        ? (TYPOGRAPHY_TAGS[tag.toLowerCase().replace(/\[.*$/, '')] ?? [])
        : [],
    );
    if (ignore.length) out.ignore = [...new Set(ignore)];
  }
  return out;
}

/** «Arial=arial,helvetica,sans-serif; Courier New=courier new» → [{ label, value }]. */
function parseFormats(value: unknown): { label: string; value: string }[] | undefined {
  if (typeof value !== 'string') return undefined;
  return value
    .split(';')
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const [label, css] = item.includes('=') ? item.split('=') : [item, item];
      return { label: label!.trim(), value: (css ?? label!).trim() };
    });
}

/** The "blobInfo" object of the image upload handler, as described in the documentation. */
function blobInfo(file: File) {
  let base64 = '';
  const ready = new Promise<void>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      base64 = String(reader.result).replace(/^data:[^,]*,/, '');
      resolve();
    };
    reader.onerror = () => resolve();
    reader.readAsDataURL(file);
  });
  let uri = '';
  return {
    ready,
    info: {
      id: () => file.name.replace(/\.[^.]+$/, '') || 'image',
      name: () => file.name.replace(/\.[^.]+$/, '') || 'image',
      filename: () => file.name || 'image',
      blob: () => file,
      base64: () => base64,
      blobUri: () => (uri ||= URL.createObjectURL(file)),
      uri: () => undefined,
    },
  };
}

const BLOCKS = new Set(['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'pre']);
const INLINES = new Set([
  'span',
  'strong',
  'b',
  'em',
  'i',
  'u',
  's',
  'strike',
  'del',
  'code',
  'sub',
  'sup',
]);

/** A TinyMCE format (an object or an array of variants) → NovaProse descriptions; unsupported ones are skipped. */
export function toFormatSpecs(value: unknown): FormatSpec[] {
  const list = Array.isArray(value) ? value : [value];
  const out: FormatSpec[] = [];
  for (const item of list) {
    if (!item || typeof item !== 'object') continue;
    const raw = item as Record<string, unknown>;
    const spec: FormatSpec = {};
    if (typeof raw.block === 'string' && BLOCKS.has(raw.block.toLowerCase()))
      spec.block = raw.block.toLowerCase() as FormatSpec['block'];
    if (typeof raw.inline === 'string' && INLINES.has(raw.inline.toLowerCase()))
      spec.inline = raw.inline.toLowerCase() as FormatSpec['inline'];
    if (typeof raw.selector === 'string') spec.selector = raw.selector;
    if (typeof raw.classes === 'string' || Array.isArray(raw.classes))
      spec.classes = raw.classes as string | string[];
    if (raw.styles && typeof raw.styles === 'object')
      spec.styles = Object.fromEntries(
        Object.entries(raw.styles as Record<string, unknown>)
          .filter(([, v]) => typeof v === 'string' && !v.includes('%'))
          // TinyMCE allows camelCase: textAlign → text-align.
          .map(([k, v]) => [k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`), v as string]),
      );
    if (spec.block || spec.inline || spec.selector) out.push(spec);
  }
  return out;
}

/** TinyMCE style_formats → styleFormats (the same shape: title, format, items, block/inline/selector). */
function toStyleFormats(value: unknown): StyleFormat[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item): StyleFormat[] => {
    if (!item || typeof item !== 'object') return [];
    const raw = item as Record<string, unknown>;
    const title = String(raw.title ?? '');
    if (!title) return [];
    if (Array.isArray(raw.items)) return [{ title, items: toStyleFormats(raw.items) }];
    if (typeof raw.format === 'string') return [{ title, format: raw.format }];
    const [spec] = toFormatSpecs(raw);
    return spec ? [{ title, ...spec }] : [];
  });
}

interface AiShortcutSpec {
  title: string;
  prompt?: string;
  selection?: boolean;
  items?: AiShortcutSpec[];
}

/** TinyMCE's ai_shortcuts ({ title, prompt, selection } or a group with subprompts) → ours. */
function toAiShortcuts(value: unknown[]): AiShortcutSpec[] {
  return value.flatMap((item): AiShortcutSpec[] => {
    if (!item || typeof item !== 'object') return [];
    const raw = item as Record<string, unknown>;
    const title = typeof raw.title === 'string' ? raw.title : '';
    if (!title) return [];
    if (Array.isArray(raw.subprompts)) return [{ title, items: toAiShortcuts(raw.subprompts) }];
    if (typeof raw.prompt !== 'string') return [];
    return [
      {
        title,
        prompt: raw.prompt,
        ...(typeof raw.selection === 'boolean' ? { selection: raw.selection } : {}),
      },
    ];
  });
}

export interface MappedOptions {
  options: Omit<EditorOptions, 'element'>;
  /** Options NovaProse doesn't understand yet (for the warning). */
  unknown: string[];
  /** Plugins found neither in the core nor in the catalog. */
  missingPlugins: string[];
}

export function mapOptions(config: TinyConfig): MappedOptions {
  const unknown = Object.keys(config).filter((key) => !IGNORED.has(key));
  const plugins: string[] = [];
  const missingPlugins: string[] = [];
  for (const name of list(config.plugins)) {
    const target = RENAMED[name] ?? name;
    if (BUILT_IN.has(name)) continue;
    if (isPluginRegistered(target)) plugins.push(target);
    else missingPlugins.push(name);
  }
  // The AI assistant's edits arrive as suggestions: the ai plugin needs the suggestions plugin.
  if (plugins.includes('ai') && !plugins.includes('suggestions')) {
    plugins.splice(plugins.indexOf('ai'), 0, 'suggestions');
  }

  const options: Omit<EditorOptions, 'element'> = { plugins };

  // Toolbar: a string, an array of strings (several rows are merged) or false.
  if (config.toolbar === false) options.toolbar = false;
  else if (Array.isArray(config.toolbar)) options.toolbar = config.toolbar.join(' | ');
  else if (typeof config.toolbar === 'string') options.toolbar = config.toolbar;
  if (config.menubar !== undefined) options.menubar = config.menubar;
  if (config.text_patterns === false) options.textPatterns = false;
  if (typeof config.statusbar === 'boolean') options.statusbar = config.statusbar;
  if (typeof config.placeholder === 'string') options.placeholder = config.placeholder;
  if (config.readonly === true) options.editable = false;
  if (typeof config.content_style === 'string') options.contentStyle = config.content_style;
  // table_class_list / table_cell_class_list: [{ title, value }] (nested menus aren't supported).
  const classList = (value: unknown) =>
    Array.isArray(value)
      ? value
          .filter(
            (o): o is { title: string; value: string } =>
              !!o && typeof o.title === 'string' && typeof o.value === 'string',
          )
          .map(({ title, value }) => ({ title, value }))
      : undefined;
  const tableClasses = classList(config.table_class_list);
  if (tableClasses) options.tableClassList = tableClasses;
  const cellClasses = classList(config.table_cell_class_list);
  if (cellClasses) options.tableCellClassList = cellClasses;
  // Formats: formats are named, style_formats is the "Styles" menu.
  if (config.formats && typeof config.formats === 'object') {
    options.formats = Object.fromEntries(
      Object.entries(config.formats as Record<string, unknown>)
        .map(([name, value]) => [name, toFormatSpecs(value)] as const)
        .filter(([, specs]) => specs.length),
    );
  }
  if (Array.isArray(config.style_formats)) {
    options.styleFormats = toStyleFormats(config.style_formats);
    if (config.style_formats_merge === true) options.styleFormatsMerge = true;
  }
  // valid_classes: a string or an object by tag; without it TinyMCE keeps every class, and so do we.
  if (typeof config.valid_classes === 'string') options.validClasses = list(config.valid_classes);
  else if (config.valid_classes && typeof config.valid_classes === 'object')
    options.validClasses = Object.values(config.valid_classes as Record<string, unknown>).flatMap(
      (v) => list(v),
    );
  else options.validClasses = true;
  // content_css: an address, a comma-separated list or an array; names of built-in TinyMCE skins are skipped.
  if (config.content_css !== undefined && config.content_css !== false) {
    const skins = new Set(['default', 'dark', 'document', 'writer', 'tinymce-5', 'tinymce-5-dark']);
    const files = (
      Array.isArray(config.content_css) ? config.content_css : String(config.content_css).split(',')
    )
      .map((file) => String(file).trim())
      .filter((file) => file && !skins.has(file));
    if (files.length) options.contentCss = files;
  }
  if (config.disabled === true) options.disabled = true;
  // resize: true by default in TinyMCE (vertically), 'both' also horizontally, false means no handle.
  if (config.resize !== false) options.resize = config.resize === 'both' ? 'both' : true;
  // block_formats: 'Paragraph=p; Heading 1=h1; Code=pre'.
  const blocks = parseFormats(config.block_formats);
  if (blocks) {
    const known = ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'pre'];
    options.blockFormats = blocks
      .map(({ label, value }) => ({ label, block: value.toLowerCase() }))
      .filter((f): f is BlockFormat => known.includes(f.block));
  }
  if (typeof config.language === 'string') options.language = config.language.replace('_', '-');
  if (
    config.toolbar_mode === 'floating' ||
    config.toolbar_mode === 'sliding' ||
    config.toolbar_mode === 'scrolling' ||
    config.toolbar_mode === 'wrap'
  ) {
    options.toolbarMode = config.toolbar_mode;
  }
  if (config.inline === true) options.mode = 'inline';
  if (config.paste_as_text === true) options.pasteAsText = true;
  if (typeof config.paste_preprocess === 'function') {
    const fn = config.paste_preprocess as (editor: unknown, args: { content: string }) => void;
    options.pastePreprocess = (html, editor) => {
      const args = { content: html };
      fn(editor, args);
      return args.content;
    };
  }
  if (typeof config.invalid_elements === 'string')
    options.invalidElements = config.invalid_elements;
  if (typeof config.valid_elements === 'string') options.validElements = config.valid_elements;
  if (typeof config.extended_valid_elements === 'string')
    options.extendedValidElements = config.extended_valid_elements;
  if (typeof config.custom_elements === 'string') options.customElements = config.custom_elements;
  if (config.directionality === 'rtl' || config.directionality === 'ltr')
    options.direction = config.directionality;
  if (config.valid_styles) options.validStyles = config.valid_styles as string;
  const fonts = parseFormats(config.font_family_formats);
  if (fonts) options.fontFamilies = fonts;
  const sizes = parseFormats(config.font_size_formats);
  if (sizes) options.fontSizes = sizes.map((s) => s.value);
  const heights = parseFormats(config.line_height_formats);
  if (heights) options.lineHeights = heights.map((s) => s.value);
  if (Array.isArray(config.color_map)) {
    // [color, label, color, label, …]: take the colors.
    options.colors = (config.color_map as string[])
      .filter((_, i) => i % 2 === 0)
      .map((c) => (c.startsWith('#') ? c : `#${c}`));
  }

  // images_upload_handler(blobInfo, progress) → uploadImage(file, progress).
  if (typeof config.images_upload_handler === 'function') {
    const handler = config.images_upload_handler as (
      info: ReturnType<typeof blobInfo>['info'],
      progress: (percent: number) => void,
    ) => Promise<string>;
    const upload: UploadImageHandler = async (file, progress) => {
      const { ready, info } = blobInfo(file);
      await ready;
      return handler(info, progress);
    };
    options.uploadImage = upload;
  }

  // file_picker_callback(callback, value, meta): your own file manager calls callback(url, { text, title, alt }).
  if (typeof config.file_picker_callback === 'function') {
    const pick = config.file_picker_callback as (
      callback: (url: string, meta?: { text?: string; title?: string; alt?: string }) => void,
      value: string,
      meta: { filetype: string; fieldname: string },
    ) => void;
    // file_picker_types: 'file image media', the fields that show the button (all of them by default).
    if (typeof config.file_picker_types === 'string') {
      options.filePickerTypes = list(config.file_picker_types).filter(
        (type): type is FilePickType => type === 'file' || type === 'image' || type === 'media',
      );
    }
    options.filePicker = ({ type, value }) =>
      new Promise((resolve) =>
        pick((url, meta = {}) => resolve({ url, ...meta }), value, {
          filetype: type,
          fieldname: 'src',
        }),
      );
  }

  // Plugin settings under their options.
  const pluginOptions: Record<string, unknown> = {};
  if (config.autosave_interval || config.autosave_retention || config.autosave_prefix) {
    const seconds = (value: unknown) => parseInt(String(value), 10);
    pluginOptions.autosave = {
      ...(config.autosave_interval ? { delay: seconds(config.autosave_interval) * 1000 } : {}),
      ...(config.autosave_retention ? { retention: seconds(config.autosave_retention) } : {}),
      ...(config.autosave_prefix ? { key: String(config.autosave_prefix) } : {}),
    };
  }
  if (
    config.quickbars_selection_toolbar !== undefined ||
    config.quickbars_insert_toolbar !== undefined
  ) {
    pluginOptions.quickbars = {
      ...(config.quickbars_selection_toolbar !== undefined
        ? { selection: config.quickbars_selection_toolbar }
        : {}),
      ...(config.quickbars_insert_toolbar !== undefined
        ? { insert: config.quickbars_insert_toolbar }
        : {}),
    };
  }
  if (typeof config.mentions_fetch === 'function') {
    // mentions_fetch(query, success) with a callback → a Promise.
    const fetch = config.mentions_fetch as (
      query: { term: string },
      success: (users: { id: string; name: string; description?: string }[]) => void,
    ) => void;
    pluginOptions.mentions = {
      fetch: (term: string) => new Promise((resolve) => fetch({ term }, resolve)),
    };
  }
  if (config.tinycomments_author) {
    pluginOptions.comments = {
      author: {
        id: String(config.tinycomments_author),
        name: String(config.tinycomments_author_name ?? config.tinycomments_author),
      },
    };
  }
  if (Array.isArray(config.codesample_languages)) {
    // [{ text: 'HTML/XML', value: 'markup' }]: highlighting understands Prism values (markup, csharp…) too.
    const languages = (config.codesample_languages as unknown[]).flatMap((item) => {
      const { text, value } = (item ?? {}) as { text?: unknown; value?: unknown };
      return typeof value === 'string' && value
        ? [{ value, label: typeof text === 'string' && text ? text : value }]
        : [];
    });
    pluginOptions.codesample = { languages };
  }
  // Collapsible blocks: the state on load and in the output HTML.
  const detailsState = (value: unknown) =>
    value === 'inherited' || value === 'collapsed' || value === 'expanded' ? value : undefined;
  if (config.details_initial_state || config.details_serialized_state) {
    pluginOptions.accordion = {
      ...(detailsState(config.details_initial_state)
        ? { initialState: detailsState(config.details_initial_state) }
        : {}),
      ...(detailsState(config.details_serialized_state)
        ? { serializedState: detailsState(config.details_serialized_state) }
        : {}),
    };
  }
  // Table of contents: by default as in TinyMCE (div → nav with the mce-toc class, the title in h2),
  // so the site's styles for .mce-toc keep working.
  if (list(config.plugins).includes('tableofcontents')) {
    pluginOptions.tableofcontents = {
      className:
        typeof config.tableofcontents_class === 'string' ? config.tableofcontents_class : 'mce-toc',
      titleTag:
        typeof config.tableofcontents_header === 'string' ? config.tableofcontents_header : 'h2',
      ...(config.tableofcontents_depth !== undefined
        ? { depth: Number(config.tableofcontents_depth) }
        : {}),
      ...(config.tableofcontents_orderedlist ? { orderedList: true } : {}),
      ...(config.tableofcontents_includeheader === false ? { title: '' } : {}),
    };
  }
  if (Array.isArray(config.casechange_title_case_minors)) {
    pluginOptions.casechange = {
      titleCaseMinors: (config.casechange_title_case_minors as unknown[]).map(String),
    };
  }
  if (config.permanentpen_properties && typeof config.permanentpen_properties === 'object') {
    pluginOptions.permanentpen = { properties: { ...config.permanentpen_properties } };
  }
  if (config.visualchars_default_state === true) pluginOptions.visualchars = { default: true };
  // importcss: the classes of content_css become Styles items (filters, groups and the converter
  // as in TinyMCE; without importcss_append the menu keeps its own items too).
  const importcss = Object.fromEntries(
    (
      [
        ['append', config.importcss_append],
        ['fileFilter', config.importcss_file_filter],
        ['selectorFilter', config.importcss_selector_filter],
        ['groups', config.importcss_groups],
        ['exclusive', config.importcss_exclusive],
        ['converter', config.importcss_selector_converter],
      ] as const
    ).filter(([, value]) => value !== undefined),
  );
  if (Object.keys(importcss).length) pluginOptions.importcss = importcss;
  // template: the list as an array, a URL or a function with a callback (as in TinyMCE 5–6).
  const templates = config.templates;
  const template = Object.fromEntries(
    (
      [
        [
          'templates',
          typeof templates === 'function'
            ? () =>
                new Promise((resolve) =>
                  (templates as (done: (list: unknown) => void) => void)(resolve),
                )
            : templates,
        ],
        ['values', config.template_replace_values],
        ['previewValues', config.template_preview_replace_values],
        ['selectedContentClasses', config.template_selected_content_classes],
        ['creationDateClasses', config.template_cdate_classes],
        ['modifiedDateClasses', config.template_mdate_classes],
        ['creationDateFormat', config.template_cdate_format],
        ['modifiedDateFormat', config.template_mdate_format],
      ] as const
    ).filter(([, value]) => value !== undefined),
  );
  if (Object.keys(template).length) pluginOptions.template = template;
  // tinymcespellchecker → spellchecker. "Label=code,…" languages, an ignore list (also by language).
  const spellchecker: Record<string, unknown> = {};
  if (typeof config.spellchecker_active === 'boolean')
    spellchecker.active = config.spellchecker_active;
  const spellLanguage = config.content_language ?? config.spellchecker_language;
  if (typeof spellLanguage === 'string' && spellLanguage)
    spellchecker.language = spellLanguage.replace(/_/g, '-');
  if (typeof config.spellchecker_languages === 'string') {
    spellchecker.languages = config.spellchecker_languages
      .split(',')
      .map((pair) => pair.split('='))
      .filter(
        (pair): pair is [string, string] =>
          pair.length === 2 && !!pair[0]!.trim() && !!pair[1]!.trim(),
      )
      .map(([name, code]) => ({ name: name.trim(), code: code.trim().replace(/_/g, '-') }));
  }
  const ignore = config.spellchecker_ignore_list;
  const ignored = Array.isArray(ignore)
    ? ignore
    : ignore && typeof ignore === 'object'
      ? Object.values(ignore).flatMap((words) => (Array.isArray(words) ? words : []))
      : [];
  if (ignored.length)
    spellchecker.ignore = ignored.filter((w): w is string => typeof w === 'string');
  if (typeof config.spellchecker_check === 'function')
    spellchecker.check = config.spellchecker_check;
  if (typeof config.spellchecker_languagetool_url === 'string')
    spellchecker.languageTool = { url: config.spellchecker_languagetool_url };
  if (Object.keys(spellchecker).length) pluginOptions.spellchecker = spellchecker;
  // a11ychecker: as in TinyMCE, an image with alt="" is flagged unless decorative images are allowed.
  if (list(config.plugins).includes('a11ychecker')) {
    const a11y: Record<string, unknown> = {
      allowDecorativeImages:
        (config.a11ychecker_allow_decorative_images ?? config.a11y_advanced_options) === true,
    };
    if (typeof config.a11ychecker_level === 'string') {
      a11y.level = config.a11ychecker_level.toLowerCase();
    }
    if (typeof config.a11ychecker_ignored_rules === 'string') {
      a11y.ignoredRules = config.a11ychecker_ignored_rules
        .split(',')
        .map((rule) => rule.trim())
        .filter(Boolean);
    }
    if (typeof config.a11ychecker_alt_text_max_length === 'number') {
      a11y.altTextMaxLength = config.a11ychecker_alt_text_max_length;
    }
    const filter = config.a11ychecker_filter_issue;
    if (typeof filter === 'function') {
      // Issues as TinyMCE describes them (id, severity, contentID), with ours alongside.
      a11y.filterIssue = (issue: { rule: string; severity: string; text: string }) =>
        (filter as (issue: unknown) => unknown)({
          ...issue,
          id: issue.rule,
          contentID: issue.text,
        }) !== false;
    }
    pluginOptions.a11ychecker = a11y;
  }
  // ai_shortcuts: false or [] hides the menu; { title, prompt, selection, subprompts } → our shortcuts.
  const aiShortcuts = config.ai_shortcuts;
  if (aiShortcuts === false || (Array.isArray(aiShortcuts) && !aiShortcuts.length)) {
    pluginOptions.ai = { shortcuts: false };
  } else if (Array.isArray(aiShortcuts)) {
    pluginOptions.ai = { shortcuts: toAiShortcuts(aiShortcuts) };
  }
  // inlinecss: which selectors and which content style files are put inline.
  const email: Record<string, unknown> = {};
  if (
    ['string', 'function'].includes(typeof config.inlinecss_selector_filter) ||
    config.inlinecss_selector_filter instanceof RegExp
  )
    email.selectorFilter = config.inlinecss_selector_filter;
  if (
    ['string', 'function'].includes(typeof config.inlinecss_file_filter) ||
    config.inlinecss_file_filter instanceof RegExp
  )
    email.fileFilter = config.inlinecss_file_filter;
  if (Object.keys(email).length) pluginOptions.email = email;
  // autocorrect: typos as you type (on by default) and capitals at the start of sentences.
  const autocorrect: Record<string, unknown> = {};
  if (typeof config.autocorrect_autocorrect === 'boolean')
    autocorrect.autocorrect = config.autocorrect_autocorrect;
  if (typeof config.autocorrect_capitalize === 'boolean')
    autocorrect.capitalize = config.autocorrect_capitalize;
  if (Object.keys(autocorrect).length) pluginOptions.autocorrect = autocorrect;
  const linkchecker: Record<string, unknown> = {};
  if (typeof config.linkchecker_service_url === 'string')
    linkchecker.serviceUrl = config.linkchecker_service_url;
  const preprocess = config.linkchecker_preprocess;
  if (typeof preprocess === 'function') {
    // TinyMCE's gets { url } and gives { url } back.
    linkchecker.preprocess = (url: string) => {
      const out = (preprocess as (data: { url: string }) => { url?: unknown } | undefined)({ url });
      return typeof out?.url === 'string' ? out.url : url;
    };
  }
  if (Object.keys(linkchecker).length) pluginOptions.linkchecker = linkchecker;
  // pageembed: TinyMCE's classes, so its content and the page's CSS for them keep working.
  if (plugins.includes('pageembed')) {
    const classes = config.tiny_pageembed_classes;
    pluginOptions.pageembed = {
      className: 'tiny-pageembed',
      sizes: Array.isArray(classes)
        ? classes
            .filter(
              (size): size is { value: string; text?: unknown } =>
                !!size && typeof (size as { value?: unknown }).value === 'string',
            )
            .map((size) => ({
              value: size.value,
              ...(typeof size.text === 'string' ? { text: size.text } : {}),
            }))
        : ['21by9', '16by9', '4by3', '1by1'].map((ratio) => ({
            value: `tiny-pageembed--${ratio}`,
          })),
      inlineStyles: config.tiny_pageembed_inline_styles === true,
    };
  }
  // advtable: TinyMCE's series generators give the values of the numbered rows (rowIndex counts
  // them from 0; header rows get no number).
  const valueSeries = config.advtable_value_series;
  if (plugins.includes('advtable') && valueSeries && typeof valueSeries === 'object') {
    const series: Record<string, unknown> = {};
    for (const [name, def] of Object.entries(valueSeries as Record<string, unknown>)) {
      const { title, generator } = (def ?? {}) as { title?: unknown; generator?: unknown };
      if (typeof title !== 'string' || typeof generator !== 'function') continue;
      let prev: unknown;
      series[name] = {
        title,
        value: (index: number) => {
          if (index === 0) prev = undefined;
          const info = {
            sectionType: 'tbody',
            cellType: 'td',
            getRowType: () => 'body',
            classes: [],
            direction: 'column',
            prev,
          };
          const out = (generator as (i: unknown, row: number, col: number) => unknown)(
            info,
            index,
            0,
          );
          prev = out;
          const value = (out as { value?: unknown } | undefined)?.value;
          return typeof value === 'string' || typeof value === 'number' ? String(value) : undefined;
        },
      };
    }
    if (Object.keys(series).length) pluginOptions.advtable = { series };
  }
  if (plugins.includes('editimage')) {
    const editimage: Record<string, unknown> = {};
    if (typeof config.editimage_toolbar === 'string') editimage.toolbar = config.editimage_toolbar;
    if (Array.isArray(config.editimage_credentials_hosts))
      editimage.credentialsHosts = config.editimage_credentials_hosts.filter(
        (host): host is string => typeof host === 'string',
      );
    const fetchImage = config.editimage_fetch_image;
    if (typeof fetchImage === 'function') {
      // TinyMCE's gets the <img> element.
      editimage.fetchImage = (src: string) => {
        const img = document.createElement('img');
        img.src = src;
        return (fetchImage as (img: HTMLImageElement) => Promise<Blob>)(img);
      };
    }
    if (Object.keys(editimage).length) pluginOptions.editimage = editimage;
  }
  if (plugins.includes('advcode') && typeof config.advcode_prettify_editor === 'boolean')
    pluginOptions.advcode = { prettify: config.advcode_prettify_editor };
  const typography = typographyOptions(config);
  if (Object.keys(typography).length) pluginOptions.typography = typography;
  if (Object.keys(pluginOptions).length) options.pluginOptions = pluginOptions;

  return { options, unknown, missingPlugins };
}
