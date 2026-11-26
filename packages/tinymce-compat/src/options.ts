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

/** Функции, которые в NovaProse встроены в ядро: такие плагины подключать не нужно. */
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
  'importcss',
]);

/** Плагины с другим именем в NovaProse. */
const RENAMED: Record<string, string> = {
  tinycomments: 'comments',
};

/** Опции, которые понятны, но в NovaProse не нужны (облако, скины, лицензия, iframe). */
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
  // Подсветка — своя (highlight.js, лениво); Prism на странице сайта для неё не нужен.
  'codesample_global_prismjs',
]);

const list = (value: unknown): string[] =>
  (Array.isArray(value) ? value.join(' ') : String(value ?? '')).split(/[\s,]+/).filter(Boolean);

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

/** Объект «blobInfo» обработчика загрузки картинок — по описанию из документации. */
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

/** Формат TinyMCE (объект или массив вариантов) → описания NovaProse; неподдерживаемые пропускаются. */
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
          // TinyMCE допускает camelCase: textAlign → text-align.
          .map(([k, v]) => [k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`), v as string]),
      );
    if (spec.block || spec.inline || spec.selector) out.push(spec);
  }
  return out;
}

/** style_formats TinyMCE → styleFormats (та же форма: title, format, items, block/inline/selector). */
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

  const options: Omit<EditorOptions, 'element'> = { plugins };

  // Тулбар: строка, массив строк (несколько рядов — объединяем) или false.
  if (config.toolbar === false) options.toolbar = false;
  else if (Array.isArray(config.toolbar)) options.toolbar = config.toolbar.join(' | ');
  else if (typeof config.toolbar === 'string') options.toolbar = config.toolbar;
  if (config.menubar !== undefined) options.menubar = config.menubar;
  if (typeof config.statusbar === 'boolean') options.statusbar = config.statusbar;
  if (typeof config.placeholder === 'string') options.placeholder = config.placeholder;
  if (config.readonly === true) options.editable = false;
  if (typeof config.content_style === 'string') options.contentStyle = config.content_style;
  // table_class_list / table_cell_class_list: [{ title, value }] (вложенные menu не поддерживаем).
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
  // Форматы: formats — именованные, style_formats — меню «Стили».
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
  // valid_classes: строка или объект по тегам; без неё TinyMCE сохраняет все классы — и мы тоже.
  if (typeof config.valid_classes === 'string') options.validClasses = list(config.valid_classes);
  else if (config.valid_classes && typeof config.valid_classes === 'object')
    options.validClasses = Object.values(config.valid_classes as Record<string, unknown>).flatMap(
      (v) => list(v),
    );
  else options.validClasses = true;
  // content_css: адрес, список через запятую или массив; имена встроенных скинов TinyMCE пропускаем.
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
  // resize: в TinyMCE по умолчанию true (по высоте), 'both' — и по ширине, false — без ручки.
  if (config.resize !== false) options.resize = config.resize === 'both' ? 'both' : true;
  // block_formats: 'Абзац=p; Заголовок 1=h1; Код=pre'.
  const blocks = parseFormats(config.block_formats);
  if (blocks) {
    const known = ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'pre'];
    options.blockFormats = blocks
      .map(({ label, value }) => ({ label, block: value.toLowerCase() }))
      .filter((f): f is BlockFormat => known.includes(f.block));
  }
  if (typeof config.language === 'string') options.language = config.language.replace('_', '-');
  if (config.toolbar_mode === 'sliding' || config.toolbar_mode === 'wrap') {
    options.toolbarMode = config.toolbar_mode;
  } else if (config.toolbar_mode === 'floating' || config.toolbar_mode === 'scrolling') {
    options.toolbarMode = 'sliding';
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
    // [цвет, подпись, цвет, подпись, …] — берём цвета.
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

  // file_picker_callback(callback, value, meta): свой менеджер файлов зовёт callback(url, { text, title, alt }).
  if (typeof config.file_picker_callback === 'function') {
    const pick = config.file_picker_callback as (
      callback: (url: string, meta?: { text?: string; title?: string; alt?: string }) => void,
      value: string,
      meta: { filetype: string; fieldname: string },
    ) => void;
    // file_picker_types: 'file image media' — для каких полей показывать кнопку (по умолчанию для всех).
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

  // Настройки плагинов под их опциями.
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
    // mentions_fetch(query, success) с колбэком → Promise.
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
    // [{ text: 'HTML/XML', value: 'markup' }] — значения Prism (markup, csharp…) понимает и подсветка.
    const languages = (config.codesample_languages as unknown[]).flatMap((item) => {
      const { text, value } = (item ?? {}) as { text?: unknown; value?: unknown };
      return typeof value === 'string' && value
        ? [{ value, label: typeof text === 'string' && text ? text : value }]
        : [];
    });
    pluginOptions.codesample = { languages };
  }
  // Раскрывающиеся блоки: состояние при загрузке и в HTML на выходе.
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
  // Оглавление: по умолчанию как у TinyMCE (div → nav с классом mce-toc, подпись в h2) —
  // стили сайта для .mce-toc продолжают работать.
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
  if (Object.keys(pluginOptions).length) options.pluginOptions = pluginOptions;

  return { options, unknown, missingPlugins };
}
