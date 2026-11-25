import {
  isPluginRegistered,
  type BlockFormat,
  type FilePickType,
  type EditorOptions,
  type UploadImageHandler,
} from '@novaprose/core';
import type { CompatEditor } from './editor';

/**
 * Перевод конфигурации `tinymce.init({...})` в опции NovaProse. Имена опций и их смысл — из публичной
 * документации TinyMCE (описание поведения); незнакомые опции не ломают инициализацию, а
 * перечисляются в предупреждении, чтобы при переходе было видно, что ещё не поддержано.
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
  'codesample',
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
  'accordion',
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
  'file_picker_types',
  'language',
  'images_upload_handler',
  'paste_as_text',
  'paste_preprocess',
  'paste_postprocess',
  'invalid_elements',
  'valid_elements',
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

export interface MappedOptions {
  options: Omit<EditorOptions, 'element'>;
  /** Опции, которые NovaProse пока не понимает (для предупреждения). */
  unknown: string[];
  /** Плагины, которых нет ни в ядре, ни в каталоге. */
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
  if (Object.keys(pluginOptions).length) options.pluginOptions = pluginOptions;

  return { options, unknown, missingPlugins };
}
