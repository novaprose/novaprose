import type { AutosaveOptions } from './plugins/autosave';
import { Formatter, formatClasses, type FormatSpec, type StyleFormat } from './formats';
import { attachCss, loadCss, scopeCss } from './content-css';
import type { FilePicker, FilePickType } from './ui/file-picker';
import type { CommentsOptions } from './plugins/comments';
import type { MentionsOptions } from './plugins/mentions';
import type { MergeTagsOptions } from './plugins/mergetags';
import type { QuickbarsOptions } from './plugins/quickbars';
import type { RevisionHistoryOptions } from './plugins/revisionhistory';
import { dropCursor } from 'prosemirror-dropcursor';
import { gapCursor } from 'prosemirror-gapcursor';
import { history } from 'prosemirror-history';
import { keymap } from 'prosemirror-keymap';
import { Node as PMNode, Slice, type MarkSpec, type NodeSpec } from 'prosemirror-model';
import { EditorState, type Command, type Plugin, type Transaction } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { commands, isCommandActive, type CommandName } from './commands';
import { createTranslator, type LanguagePack } from './i18n';
import { embeddedImageUploadPlugin, imageDropPastePlugin, type UploadImageHandler } from './image';
import { buildInputRules } from './inputrules';
import { buildKeymap } from './keymap';
import { openLinkDialog } from './link';
import { loadPasteCleaner, pastePlugin, type PasteOptions } from './paste';
import { loadTables } from './tables';
import { activeElement } from './ui/dom';

/** Языки, которые пишут справа налево (по основной части кода: ar-EG → ar). */
const RTL_LANGUAGES = new Set(['ar', 'he', 'iw', 'fa', 'ur', 'ps', 'sd', 'ug', 'yi', 'dv', 'ckb']);
function isRtlLanguage(language: string | undefined): boolean {
  return !!language && RTL_LANGUAGES.has(language.toLowerCase().split(/[-_]/)[0]!);
}
import { keepPluginViews, reconfigurePlugins } from './plugin-views';
import { parserFor } from './parser';
import {
  createMenubar,
  DEFAULT_MENUBAR,
  DEFAULT_MENUS,
  type MenuDefinition,
  type MenubarHandle,
} from './ui/menubar';
import { registerMenuItems } from './ui/menu-items';
import { ContentRules, contentRulesPlugin, type ContentRulesOptions } from './content-rules';
import { htmlRulesFor, type HtmlRulesInstance } from './html-rules-api';
import {
  loadPlugin,
  orderPlugins,
  resolveEntries,
  type NovaPlugin,
  type PluginEntry,
} from './plugins';
import { searchPlugin } from './search';
import { createSearchBar, type SearchBarHandle } from './ui/search-bar';
import { openHelp, toggleFullscreen } from './ui/views';
import { createSchema, type ClassFilter, type NovaSchema } from './schema';
import { HTMLSerializer } from './serializer';
import { registerBuiltins, type FontOption } from './ui/builtins';
import { linkBubblePlugin } from './ui/link-bubble';
import { contextToolbarPlugin, focusContextToolbar } from './ui/context-toolbar';
import { ImageView } from './ui/image-view';
import { autocompleterPlugin } from './ui/autocompleter';
import { registerSlashCommands, type SlashCommand } from './ui/slash';
import { UiManager } from './ui/manager';
import { createStatusbar } from './ui/statusbar';
import {
  createToolbar,
  defaultToolbar,
  type ToolbarConfig,
  type ToolbarHandle,
  type ToolbarMode,
} from './ui/toolbar';

const htmlSerializer = new HTMLSerializer();

export type EditorMode = 'classic' | 'inline' | 'distraction-free';

/** Метка транзакции, пришедшей от соавтора (ставит @novaprose/collab): не считается вводом. */
export const REMOTE_CHANGE_META = 'nova:remote';
/** Метка транзакции из API (setContent, insertContent): не считается вводом. */
export const API_CHANGE_META = 'nova:api';

/** Подробности событий: второй аргумент обработчика `editor.on(event, (editor, detail) => …)`. */
export interface EditorEventDetails {
  /** Редактор готов: ленивые плагины и стили контента загружены (то же, что `await editor.ready`). */
  init: undefined;
  /** Документ изменился — любым путём: ввод, API, соавтор. */
  change: { transaction: Transaction };
  /** Документ изменил пользователь этого редактора (набор, вставка, кнопки, горячие клавиши). */
  input: { transaction: Transaction };
  selectionChange: { transaction: Transaction };
  focus: { event: FocusEvent };
  blur: { event: FocusEvent };
  editableChange: undefined;
  destroy: undefined;
  /** До setContent: `detail.content` можно заменить. */
  beforeSetContent: { content: string | Record<string, unknown> };
  setContent: { content: string | Record<string, unknown> };
  /** Клавиша в тексте до обработки редактором; `detail.event.preventDefault()` отменяет её обработку. */
  keydown: { event: KeyboardEvent };
}

export type EditorEvent = keyof EditorEventDetails;

export type EditorListener<E extends EditorEvent = EditorEvent> = (
  editor: Editor,
  detail: EditorEventDetails[E],
) => void;

/**
 * Настройки встроенных плагинов (типизированы — подсказки в редакторе кода) и любых сторонних по имени.
 * Только типы: модули плагинов не попадают в ядро.
 */
export interface PluginOptions {
  comments?: CommentsOptions;
  mentions?: MentionsOptions;
  mergetags?: MergeTagsOptions;
  revisionhistory?: RevisionHistoryOptions;
  autosave?: AutosaveOptions;
  quickbars?: QuickbarsOptions;
  [plugin: string]: unknown;
}

export interface EditorOptions extends PasteOptions, ContentRulesOptions {
  /** Элемент, внутрь которого монтируется редактор. */
  element: HTMLElement;
  /** Начальное содержимое: HTML-строка или JSON документа. */
  content?: string | Record<string, unknown>;
  /**
   * Тулбар: строка ('undo redo | bold italic'), массив имён или false (headless — UI рисует клиент).
   * По умолчанию — стандартный набор.
   */
  toolbar?: false | ToolbarConfig;
  /** Поведение тулбара при нехватке ширины. По умолчанию 'sliding' (лишнее уходит в «⋯»). */
  toolbarMode?: ToolbarMode;
  /**
   * classic — рамка и панели (по умолчанию); inline — без рамки, панель появляется над текстом при фокусе;
   * distraction-free — без постоянных панелей, только quickbars над выделением и на пустой строке.
   */
  mode?: EditorMode;
  /** Менюбар: true — стандартный ('file edit view insert format table help'), строка — свой набор. По умолчанию нет. */
  menubar?: boolean | string;
  /** Свои меню и переопределение стандартных: { insert: { title: 'Вставка', items: 'image link | hr' } }. */
  menu?: Record<string, MenuDefinition>;
  /** Статусбар с путём к элементу и счётчиком слов. По умолчанию включён. */
  statusbar?: boolean;
  /** Плейсхолдер для пустого документа. */
  placeholder?: string;
  editable?: boolean;
  /**
   * Отключённый редактор — как disabled у поля формы: текст не редактируется и не получает фокус,
   * панели неактивны. В отличие от editable: false (только чтение) выглядит приглушённо.
   */
  disabled?: boolean;
  /**
   * Ручка изменения размера в статусбаре: true — по высоте, 'both' — по высоте и ширине.
   * Мышь, палец или клавиатура (стрелки на ручке). По умолчанию нет.
   */
  resize?: boolean | 'both';
  /**
   * Пункты списка блоков (кнопка `blocks`) и их порядок: [{ label: 'Подзаголовок', block: 'h3' }].
   * По умолчанию — абзац, H1–H6 и блок кода.
   */
  blockFormats?: BlockFormat[];
  /**
   * Стили содержимого (как content_style в TinyMCE): применяются только к тексту этого редактора.
   * `body`/`html` в селекторах — это сама область текста: 'body { font-family: Georgia }'.
   */
  contentStyle?: string;
  /**
   * Файлы стилей содержимого (как content_css): загружаются и применяются только к тексту
   * этого редактора; относительные url() и @import работают. `await editor.ready` ждёт загрузки.
   */
  contentCss?: string | string[];
  /**
   * Именованные форматы (как formats в TinyMCE): { note: { block: 'p', classes: 'note' } }.
   * Применяются через editor.formatter.apply('note'); их классы сохраняются при разборе HTML.
   */
  formats?: Record<string, FormatSpec | FormatSpec[]>;
  /**
   * Пункты меню «Стили» (кнопка `styles`): свои форматы, ссылки на именованные и группы.
   * По умолчанию — заголовки, текст, блоки и выравнивание.
   */
  styleFormats?: StyleFormat[];
  /** true — добавить styleFormats к стандартному набору, а не заменить его. */
  styleFormatsMerge?: boolean;
  /**
   * Какие классы сохранять в HTML кроме классов из форматов: список или true — все.
   * По умолчанию только классы форматов (вставленный мусор вроде MsoNormal не попадает в документ).
   */
  validClasses?: string[] | true;
  /**
   * Стили таблиц на выбор в свойствах таблицы (как table_class_list в TinyMCE):
   * [{ title: 'С рамками', value: 'grid' }]. Внешний вид задаёт ваш CSS (contentCss).
   */
  tableClassList?: ClassOption[];
  /** Стили ячеек на выбор в свойствах ячейки (как table_cell_class_list). */
  tableCellClassList?: ClassOption[];
  /** Язык UI (BCP-47): 'en', 'ru'… По умолчанию 'en'. */
  language?: string;
  /**
   * Направление письма — интерфейса и текста. По умолчанию справа налево для арабского, иврита,
   * персидского и урду (по `language`), иначе как у страницы.
   */
  direction?: 'ltr' | 'rtl';
  /** Точечная замена строк UI. */
  translations?: LanguagePack;
  /** Загрузка изображений на ваш сервер. Без неё картинки встраиваются как data:URL. */
  uploadImage?: UploadImageHandler;
  /**
   * Свой выбор файла: кнопка «Обзор» у поля адреса в диалогах ссылки, картинки и видео.
   * Получает тип поля и текущий адрес, возвращает { url, text?, title?, alt? } или null.
   */
  filePicker?: FilePicker;
  /** Для каких полей показывать «Обзор»: 'file' (ссылка), 'image', 'media'. По умолчанию — для всех. */
  filePickerTypes?: FilePickType[];
  fontFamilies?: FontOption[];
  fontSizes?: string[];
  lineHeights?: string[];
  colors?: string[];
  /** Слэш-команды «/». false — выключить; массив — дополнительные команды к стандартным. */
  slashCommands?: false | SlashCommand[];
  /**
   * Плагины NovaProse: объект, имя из реестра ('insertdatetime') или ленивый загрузчик (() => import(...)).
   * Ленивые грузятся после создания редактора; дождаться — `await editor.ready`.
   */
  plugins?: PluginEntry[];
  /** Настройки плагинов по имени: { comments: {...}, mentions: {...} }. Встроенные — с типами. */
  pluginOptions?: PluginOptions;
  /** Сырые ProseMirror-плагины (для низкоуровневых расширений). */
  prosemirrorPlugins?: Plugin[];
  /** Вызывается до отрисовки тулбара — место для editor.ui.registry.addButton(...). */
  setup?: (editor: Editor) => void;
  onChange?: (editor: Editor) => void;
}

/** Пункт списка стилей таблицы или ячейки: подпись и класс. */
export interface ClassOption {
  title: string;
  value: string;
}

/** Пункт списка блоков: подпись и тег блока. */
export interface BlockFormat {
  label: string;
  block: 'p' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'pre';
}

/** Теги, которые insertContent вставляет отдельными блоками. */
const INSERT_BLOCK_TAGS = new Set(
  'P H1 H2 H3 H4 H5 H6 UL OL TABLE BLOCKQUOTE PRE HR DIV FIGURE'.split(' '),
);

/** Номер области стилей содержимого (contentStyle/contentCss) — уникален на странице. */
let contentScopeId = 0;

/**
 * Публичный API редактора NovaProse.
 * Обёртки (React, Vue…) работают только через этот класс, а не через ProseMirror напрямую.
 */
export class Editor {
  readonly view: EditorView;
  readonly root: HTMLElement;
  readonly ui: UiManager;
  readonly options: Readonly<EditorOptions>;
  private readonly listeners = new Map<EditorEvent, Set<EditorListener>>();
  /** Выполняется, когда загружены и подключены все ленивые плагины. */
  readonly ready: Promise<void>;
  private toolbar: ToolbarHandle | null;
  private readonly toolbarHost: HTMLElement;
  private readonly menubar: MenubarHandle | null;
  readonly mode: EditorMode;
  /** Направление письма редактора (опция direction, язык или dir страницы). */
  readonly direction: 'ltr' | 'rtl';
  private readonly pluginsByName = new Map<string, NovaPlugin>();
  private readonly commandOverrides = new Map<CommandName, Command>();
  private readonly transactionTransforms: NonNullable<NovaPlugin['transformTransaction']>[] = [];
  private readonly cleanups: (() => void)[] = [];
  /** Ограничения контента (validElements/invalidElements/validStyles) или null — без ограничений. */
  readonly contentRules: ContentRules | null;
  /** Схема документа этого редактора: базовая + узлы и марки синхронных плагинов. */
  readonly schema: NovaSchema;
  /** Форматы: register / apply / remove / toggle / match. */
  readonly formatter: Formatter;
  private readonly statusbar: ReturnType<typeof createStatusbar> | null;
  private readonly searchBar: SearchBarHandle;
  private destroyed = false;
  private editable: boolean;
  private disabled: boolean;
  private pasteAsText: boolean;

  constructor(options: EditorOptions) {
    this.options = options;
    this.root = document.createElement('div');
    this.root.className = 'nova-editor';
    const direction = options.direction ?? (isRtlLanguage(options.language) ? 'rtl' : undefined);
    if (direction) this.root.dir = direction;
    // Без явного направления — как у страницы (dir на <html> или контейнере).
    this.direction =
      direction ??
      (options.element.closest('[dir]')?.getAttribute('dir') === 'rtl' ? 'rtl' : 'ltr');
    options.element.appendChild(this.root);

    const toolbarHost = document.createElement('div');
    const contentHost = document.createElement('div');
    const statusbarHost = document.createElement('div');
    contentHost.className = 'nova-content';
    // Шапка: менюбар + тулбар. Липкая (sticky) — она, а не тулбар внутри неё.
    const header = document.createElement('div');
    header.className = 'nova-header';
    const menubarHost = document.createElement('div');
    header.append(menubarHost, toolbarHost);
    this.root.append(header, contentHost, statusbarHost);
    this.toolbarHost = toolbarHost;

    this.mode = options.mode ?? 'classic';
    this.root.classList.add(`nova-mode-${this.mode}`);
    const distractionFree = this.mode === 'distraction-free';
    if (this.mode !== 'classic') {
      // Фокус где-то внутри редактора (текст, панели, меню, диалоги) — показываем шапку.
      this.root.addEventListener('focusin', () => this.root.classList.add('is-focused'));
      this.root.addEventListener('focusout', () => {
        setTimeout(() => {
          if (!this.root.contains(activeElement(this.root)))
            this.root.classList.remove('is-focused');
        }, 0);
      });
    }

    this.ui = new UiManager(
      this.root,
      createTranslator(options.language, options.translations),
      () => this.focus(),
    );
    // Приглашение в пустой подписи картинки — через CSS-переменную (в HTML документа его нет).
    this.root.style.setProperty(
      '--nova-caption-placeholder',
      JSON.stringify(this.ui.t('image.captionPlaceholder')),
    );

    const editorKeys = keymap({
      'Mod-k': () => (openLinkDialog(this), true),
      // Стандартное сочетание доступности: перейти из текста на панель инструментов.
      'Alt-F9': () => {
        if (!this.menubar) return false;
        this.menubar.focus();
        return true;
      },
      'Alt-F10': () => {
        if (!this.toolbar) return false;
        this.toolbar.focus();
        return true;
      },
      // Перейти на контекстный тулбар (картинка, таблица).
      'Ctrl-F9': () => focusContextToolbar(this),
      'Mod-f': () => (this.openSearch(), true),
      'Mod-Shift-f': () => (toggleFullscreen(this), true),
      'Alt-0': () => (openHelp(this), true),
      // Escape в тексте закрывает панель поиска, если она открыта.
      Escape: () => {
        if (!this.searchBar.isOpen()) return false;
        this.searchBar.close();
        return true;
      },
    });

    // Плагины: синхронные подключаются сразу (их ProseMirror-плагины — в начальное состояние),
    // ленивые — после создания редактора.
    // distraction-free без quickbars бессмысленен — подключаем сам.
    const pluginEntries = [...(options.plugins ?? [])];
    if (distractionFree && !pluginEntries.includes('quickbars')) pluginEntries.push('quickbars');
    const resolved = resolveEntries(pluginEntries);
    resolved.errors.forEach((message) => reportPluginError(message));
    const { ordered: syncPlugins, errors: orderErrors } = orderPlugins(resolved.plugins);
    orderErrors.forEach((message) => reportPluginError(message));
    const pluginPm = syncPlugins.flatMap((plugin) => this.collectPmPlugins(plugin));

    const hasRules =
      options.validElements !== undefined ||
      options.invalidElements !== undefined ||
      options.validStyles !== undefined;
    this.contentRules = hasRules ? new ContentRules(options) : null;
    // Классы, которые схема сохраняет при разборе: из форматов, стилей и validClasses.
    // Набор живой — formatter.register() в setup тоже пополняет его.
    const allowedClasses = new Set([
      ...formatClasses(Object.values(options.formats ?? {}).flat()),
      ...formatClasses(options.styleFormats ?? []),
      ...(Array.isArray(options.validClasses) ? options.validClasses : []),
      ...[...(options.tableClassList ?? []), ...(options.tableCellClassList ?? [])].flatMap((o) =>
        o.value.split(/\s+/).filter(Boolean),
      ),
    ]);
    const htmlRules = htmlRulesFor(options);
    // `p[class]` в правилах без validClasses — классы сохраняются (как у TinyMCE по умолчанию).
    const allClasses =
      options.validClasses === true ||
      (options.validClasses === undefined && !!htmlRules?.classOnBuiltIn);
    this.schema = this.buildSchema(
      syncPlugins,
      allClasses ? () => true : (name) => allowedClasses.has(name),
      htmlRules,
    );
    this.formatter = new Formatter(this, allowedClasses);
    for (const [name, spec] of Object.entries(options.formats ?? {}))
      this.formatter.register(name, spec);
    syncPlugins.forEach((plugin) => this.registerCommands(plugin));
    const initialDoc = parseContent(this.schema, options.content ?? '');

    const tablesAnchor = searchPlugin();
    const initialPlugins = [
      // Первым: при открытом списке Enter/Tab/стрелки принадлежат автокомплитеру, а не раскладке клавиш.
      autocompleterPlugin(this),
      buildInputRules((name) => this.isAllowed(name), this.schema),
      editorKeys,
      // Сюда (до общей раскладки) встанут плагины таблиц после загрузки механики: Tab в таблице —
      // следующая ячейка, а не отступ списка. См. installTables().
      tablesAnchor,
      ...buildKeymap((name) => this.resolveCommand(name)),
      ...(syncPlugins.some((plugin) => plugin.replaceHistory) ? [] : [history()]),
      dropCursor({ color: 'var(--nova-accent)', width: 2 }),
      gapCursor(),
      imageDropPastePlugin(this),
      embeddedImageUploadPlugin(this),
      pastePlugin(this),
      linkBubblePlugin(this),
      contextToolbarPlugin(this),
      ...(this.contentRules ? [contentRulesPlugin(this.contentRules)] : []),
      ...pluginPm,
      ...(options.prosemirrorPlugins ?? []),
    ];
    // Догрузка ленивых частей перестраивает набор плагинов — их представления должны это пережить.
    keepPluginViews(initialPlugins);
    const state = EditorState.create({
      doc: this.contentRules ? this.contentRules.normalizeDoc(initialDoc) : initialDoc,
      plugins: initialPlugins,
    });

    this.editable = options.editable ?? true;
    this.disabled = options.disabled ?? false;
    this.pasteAsText = options.pasteAsText ?? false;
    const handleTransaction = this.handleTransaction.bind(this);
    this.view = new EditorView(contentHost, {
      state,
      editable: () => this.isEditable(),
      attributes: {
        class: 'nova-prosemirror',
        role: 'textbox',
        'aria-multiline': 'true',
        'aria-label': this.ui.t('editor.label'),
        ...(options.placeholder ? { 'data-placeholder': options.placeholder } : {}),
      },
      // ProseMirror вызывает dispatchTransaction с this = представление: плагины (например, синхронизация
      // совместного редактирования) могут отправить транзакцию ещё внутри конструктора EditorView,
      // когда this.view редактора не присвоен.
      dispatchTransaction: function (this: EditorView, tr: Transaction) {
        handleTransaction(tr, this);
      },
      // Тот же парсер для вставки, что и для setContent — одинаковая предобработка.
      clipboardParser: parserFor(this.schema),
      nodeViews: {
        image: (node, view, getPos) => new ImageView(node, view, getPos, this),
      },
      handleDOMEvents: {
        focus: (_view, event) => (this.emit('focus', { event }), false),
        blur: (_view, event) => (this.emit('blur', { event }), false),
      },
      handleKeyDown: (_view, event) => {
        this.emit('keydown', { event });
        return event.defaultPrevented;
      },
    });
    this.root.classList.toggle('nova-readonly', !this.editable);
    this.applyDisabled();

    registerBuiltins(this);
    registerMenuItems(this);
    if (options.slashCommands !== false) registerSlashCommands(this, options.slashCommands ?? []);
    syncPlugins.forEach((plugin) => this.setupPlugin(plugin));
    options.setup?.(this);

    const menubarConfig =
      options.menubar === true
        ? DEFAULT_MENUBAR
        : typeof options.menubar === 'string'
          ? options.menubar
          : null;
    this.menubar = menubarConfig
      ? createMenubar(this, menubarHost, menubarConfig, { ...DEFAULT_MENUS, ...options.menu })
      : null;
    if (!this.menubar) menubarHost.remove();

    this.toolbar =
      options.toolbar === false || (distractionFree && options.toolbar === undefined)
        ? null
        : createToolbar(
            this,
            toolbarHost,
            this.toolbarConfig(),
            options.toolbarMode ?? 'sliding',
            // Пока ленивые плагины не загружены, их кнопки ещё не зарегистрированы — не предупреждаем.
            { warnUnknown: resolved.loaders.length === 0 },
          );
    if (!this.toolbar) toolbarHost.remove();
    if (!this.toolbar && !this.menubar) header.remove();

    this.searchBar = createSearchBar(this, contentHost);
    // Статусбар по умолчанию только в classic: inline/distraction-free встроены в страницу.
    const statusbar = options.statusbar ?? this.mode === 'classic';
    this.statusbar = statusbar ? createStatusbar(this, statusbarHost) : null;
    if (!this.statusbar) statusbarHost.remove();

    if (options.onChange) this.on('change', options.onChange);
    this.updatePlaceholder();

    const contentCss = this.applyContentStyles();
    this.ready = Promise.all([
      resolved.loaders.length ? this.loadLazyPlugins(resolved.loaders) : undefined,
      contentCss,
      // Очистка вставки из Office — отдельный чанк, грузится в фоне (см. paste.ts).
      loadPasteCleaner(),
      // Механика таблиц — отдельный чанк (~10 КБ gzip), грузится в фоне (см. tables.ts).
      this.installTables(tablesAnchor),
    ]).then(() => {
      if (!this.destroyed) this.emit('init');
    });
  }

  /**
   * Подключить механику таблиц (выделение ячеек, ширина колонок, Tab по ячейкам) после её загрузки —
   * на место перед `anchor`, как если бы плагины были в начальном состоянии.
   */
  private async installTables(anchor: Plugin): Promise<void> {
    const tables = await loadTables();
    if (!tables || this.destroyed) return;
    const { state } = this.view;
    const at = state.plugins.indexOf(anchor);
    const plugins = [...state.plugins];
    plugins.splice(at < 0 ? plugins.length : at, 0, ...tables.tablePlugins());
    reconfigurePlugins(this.view, plugins);
    this.updateUI();
  }

  /** contentStyle сразу, contentCss — по мере загрузки. Каждый редактор — своя область. */
  private applyContentStyles(): Promise<void> | undefined {
    const { contentStyle, contentCss } = this.options;
    const files =
      contentCss === undefined ? [] : Array.isArray(contentCss) ? contentCss : [contentCss];
    if (!contentStyle && !files.length) return undefined;
    const id = `nova-cs-${++contentScopeId}`;
    this.root.classList.add(id);
    const scope = `.nova-editor.${id} .nova-prosemirror`;
    // Порядок как в TinyMCE: сначала файлы, затем content_style (он перекрывает файлы).
    const sheets: string[] = files.map(() => '');
    let detach: (() => void) | null = null;
    const apply = () => {
      if (this.destroyed) return;
      detach?.();
      detach = attachCss(this.root, scopeCss([...sheets, contentStyle ?? ''].join('\n'), scope));
    };
    this.cleanups.push(() => detach?.());
    apply();
    if (!files.length) return undefined;
    return Promise.all(
      files.map((url, index) =>
        loadCss(url).then(
          (css) => {
            sheets[index] = css;
          },
          (error) => console.warn(`[nova] contentCss: could not load ${url}`, error),
        ),
      ),
    ).then(apply);
  }

  // ---------- плагины ----------

  /** Разрешён ли контрол/команда/тег по ограничениям контента (без ограничений — всегда да). */
  isAllowed(name: string): boolean {
    return this.contentRules?.isAllowed(name) ?? true;
  }

  hasPlugin(name: string): boolean {
    return this.pluginsByName.has(name);
  }

  /**
   * Схема с узлами и марками плагинов. Конфликт имён — ошибка конфигурации: сообщаем и работаем
   * на базовой схеме, чтобы редактор всё равно открылся.
   */
  private buildSchema(
    plugins: NovaPlugin[],
    classFilter: ClassFilter,
    htmlRules: HtmlRulesInstance | null,
  ): NovaSchema {
    const nodes: Record<string, NodeSpec> = {};
    const marks: Record<string, MarkSpec> = {};
    for (const plugin of plugins) {
      // Узлы могут зависеть от настроек плагина (например, имя атрибута переменной).
      const pluginNodes = typeof plugin.nodes === 'function' ? plugin.nodes(this) : plugin.nodes;
      for (const [name, spec] of Object.entries(pluginNodes ?? {})) {
        if (name in nodes) reportPluginError(`Node "${name}" is defined by several plugins`);
        else nodes[name] = spec;
      }
      for (const [name, spec] of Object.entries(plugin.marks ?? {})) {
        if (name in marks) reportPluginError(`Mark "${name}" is defined by several plugins`);
        else marks[name] = spec;
      }
    }
    try {
      return createSchema({ nodes, marks }, classFilter, htmlRules, this.direction);
    } catch (error) {
      reportPluginError('Failed to build the document schema from plugins', error);
      return createSchema({}, classFilter, htmlRules, this.direction);
    }
  }

  private collectPmPlugins(plugin: NovaPlugin): Plugin[] {
    try {
      return plugin.prosemirrorPlugins?.(this) ?? [];
    } catch (error) {
      reportPluginError(`Plugin "${plugin.name}" failed to create ProseMirror plugins`, error);
      return [];
    }
  }

  /** setup с изоляцией ошибок: упавший плагин не ломает редактор. */
  private setupPlugin(plugin: NovaPlugin): void {
    try {
      const cleanup = plugin.setup?.(this);
      if (typeof cleanup === 'function') this.cleanups.push(cleanup);
      this.pluginsByName.set(plugin.name, plugin);
    } catch (error) {
      reportPluginError(`Plugin "${plugin.name}" failed during setup`, error);
    }
  }

  private async loadLazyPlugins(loaders: Parameters<typeof loadPlugin>[0][]): Promise<void> {
    const results = await Promise.all(
      loaders.map((loader) =>
        loadPlugin(loader).catch((error: unknown) => {
          reportPluginError('Failed to load plugin', error);
          return null;
        }),
      ),
    );
    if (this.destroyed) return;
    // Схема фиксируется при создании редактора: ленивый плагин не может добавить узлы и марки.
    const loaded = results.filter((p): p is NovaPlugin => {
      if (!p) return false;
      if (p.nodes || p.marks) {
        reportPluginError(
          `Plugin "${p.name}" defines nodes or marks and cannot be loaded lazily; pass the plugin object instead`,
        );
        return false;
      }
      return true;
    });
    const { ordered, errors } = orderPlugins(loaded, new Set(this.pluginsByName.keys()));
    errors.forEach((message) => reportPluginError(message));
    const extraPm = ordered.flatMap((plugin) => this.collectPmPlugins(plugin));
    if (extraPm.length) {
      reconfigurePlugins(this.view, [...this.view.state.plugins, ...extraPm]);
    }
    ordered.forEach((plugin) => {
      this.registerCommands(plugin);
      this.setupPlugin(plugin);
    });
    this.rebuildToolbar();
  }

  /**
   * Обновить состояние кнопок (нажата / доступна) без изменения документа — например, после того как
   * плагин переключил режим отображения. Изменения документа обновляют UI сами.
   */
  updateUI(): void {
    if (this.destroyed) return;
    this.toolbar?.update();
  }

  /** Перестроить тулбар (после регистрации новых кнопок плагинами). */
  rebuildToolbar(): void {
    if (!this.toolbar || this.destroyed) return;
    this.toolbar.destroy();
    this.toolbar = createToolbar(
      this,
      this.toolbarHost,
      this.toolbarConfig(),
      this.options.toolbarMode ?? 'sliding',
    );
  }

  /** Конфиг тулбара: пользовательский как есть; по умолчанию — плюс кнопки подключённых плагинов. */
  private toolbarConfig(): ToolbarConfig {
    if (this.options.toolbar) return this.options.toolbar;
    const extra = [...this.pluginsByName.values()].map((p) => p.toolbar).filter(Boolean);
    return extra.length ? `${defaultToolbar} | ${extra.join(' ')}` : defaultToolbar;
  }

  private handleTransaction(tr: Transaction, view: EditorView = this.view): void {
    // Плагины с таймерами (курсоры совместного редактирования) могут прислать транзакцию
    // уже после destroy() — её некуда применять.
    if (view.isDestroyed) return;
    for (const transform of this.transactionTransforms) tr = transform(tr, view.state, this);
    view.updateState(view.state.apply(tr));
    // Ещё внутри конструктора EditorView: интерфейса и подписчиков пока нет — только состояние.
    if (!this.view) return;
    this.toolbar?.update();
    this.statusbar?.update(tr.docChanged);
    this.searchBar?.update();
    this.updatePlaceholder();
    if (tr.docChanged) {
      this.emit('change', { transaction: tr });
      const programmatic = tr.getMeta(API_CHANGE_META) || tr.getMeta(REMOTE_CHANGE_META);
      if (!programmatic && tr.getMeta('addToHistory') !== false) {
        this.emit('input', { transaction: tr });
      }
    }
    if (tr.selectionSet || tr.docChanged) this.emit('selectionChange', { transaction: tr });
  }

  private updatePlaceholder(): void {
    const doc = this.view.state.doc;
    const empty =
      doc.childCount === 1 &&
      doc.firstChild?.type === this.schema.nodes.paragraph &&
      doc.firstChild.content.size === 0;
    this.view.dom.classList.toggle('nova-empty', empty);
  }

  // ---------- содержимое ----------

  /** HTML документа. Детерминирован: одинаков во всех браузерах и в Node. */
  getHTML(): string {
    return htmlSerializer.serializeFragment(this.view.state.doc.content);
  }

  getJSON(): Record<string, unknown> {
    return this.view.state.doc.toJSON() as Record<string, unknown>;
  }

  getText(): string {
    return this.view.state.doc.textBetween(0, this.view.state.doc.content.size, '\n\n');
  }

  /** Заменить содержимое. По умолчанию попадает в историю undo. */
  setContent(content: string | Record<string, unknown>, { addToHistory = true } = {}): void {
    const detail = { content };
    this.emit('beforeSetContent', detail);
    const doc = parseContent(this.schema, detail.content);
    const tr = this.view.state.tr.replaceWith(0, this.view.state.doc.content.size, doc.content);
    tr.setMeta(API_CHANGE_META, true);
    if (!addToHistory) tr.setMeta('addToHistory', false);
    this.view.dispatch(tr);
    this.emit('setContent', { content: detail.content });
  }

  /**
   * Вставить HTML в позицию курсора (как insertContent в TinyMCE). HTML разбирается схемой
   * редактора — как вставка: без скриптов, опасных ссылок и лишних тегов.
   * Блоки (абзацы, таблицы) встают отдельными блоками. Таблица, вставляемая при курсоре
   * внутри таблицы, встаёт после неё (а не заменяет её ячейки).
   */
  insertContent(html: string): boolean {
    if (!this.isEditable()) return false;
    const template = document.createElement('template');
    template.innerHTML = html;
    const container = document.createElement('div');
    container.append(template.content);
    const parser = parserFor(this.schema);
    const hasBlocks = [...container.children].some((el) => INSERT_BLOCK_TAGS.has(el.tagName));
    const { state } = this.view;
    const slice = hasBlocks
      ? new Slice(parser.parse(container).content, 0, 0)
      : parser.parseSlice(container);
    let hasTable = false;
    slice.content.descendants((node) => {
      if (node.type.spec.tableRole === 'table') hasTable = true;
      return !hasTable;
    });
    const { $from } = state.selection;
    let tableDepth = 0;
    for (let depth = 1; depth <= $from.depth; depth++) {
      if ($from.node(depth).type.spec.tableRole === 'table') {
        tableDepth = depth;
        break;
      }
    }
    const tr =
      hasTable && tableDepth
        ? state.tr.insert($from.after(tableDepth), slice.content)
        : state.tr.replaceSelection(slice);
    this.view.dispatch(tr.setMeta(API_CHANGE_META, true).scrollIntoView());
    return true;
  }

  isEmpty(): boolean {
    return this.view.dom.classList.contains('nova-empty');
  }

  // ---------- команды ----------

  /** Выполнить именованную команду или произвольную ProseMirror-команду. */
  /** Команда по имени: переопределение плагина или встроенная. */
  resolveCommand(name: CommandName): Command {
    return this.commandOverrides.get(name) ?? commands[name];
  }

  private registerCommands(plugin: NovaPlugin): void {
    for (const [name, command] of Object.entries(plugin.commands ?? {})) {
      if (command) this.commandOverrides.set(name as CommandName, command);
    }
    if (plugin.transformTransaction) this.transactionTransforms.push(plugin.transformTransaction);
  }

  exec(command: CommandName | Command): boolean {
    const cmd = typeof command === 'string' ? this.resolveCommand(command) : command;
    const result = cmd(this.view.state, this.view.dispatch, this.view);
    if (result) this.view.focus();
    return result;
  }

  /** Можно ли выполнить команду в текущем состоянии (для disabled-кнопок). */
  can(command: CommandName | Command): boolean {
    const cmd = typeof command === 'string' ? this.resolveCommand(command) : command;
    return cmd(this.view.state, undefined, this.view);
  }

  /** Активна ли именованная команда в текущем выделении (для своих кнопок тулбара). */
  isActive(command: CommandName): boolean {
    return isCommandActive(this.view.state, command);
  }

  /**
   * Состояние именованной команды для своего тулбара: активна ли (подсветка кнопки) и доступна ли
   * сейчас. Аналог queryCommandState / queryCommandEnabled.
   */
  getCommandState(command: CommandName): { active: boolean; enabled: boolean } {
    return { active: this.isActive(command), enabled: this.isEditable() && this.can(command) };
  }

  focus(): void {
    if (!this.destroyed) this.view.focus();
  }

  /** Режим «вставлять как текст» (переключатель pastetext). */
  isPasteAsText(): boolean {
    return this.pasteAsText;
  }

  setPasteAsText(value: boolean): void {
    this.pasteAsText = value;
    this.toolbar?.update();
  }

  /** Открыть панель «Найти и заменить» (Ctrl/Cmd+F). */
  openSearch(): void {
    this.searchBar.open();
  }

  closeSearch(): void {
    this.searchBar.close();
  }

  /** Можно ли сейчас править текст: не «только чтение» и не отключён. */
  isEditable(): boolean {
    return this.editable && !this.disabled;
  }

  isDisabled(): boolean {
    return this.disabled;
  }

  /** Отключить или включить редактор (как disabled у поля формы). */
  setDisabled(value: boolean): void {
    if (this.disabled === value) return;
    this.disabled = value;
    this.view.setProps({});
    this.applyDisabled();
    if (value) {
      this.ui.closePopover();
      this.view.dom.blur();
    }
    this.toolbar?.update();
    this.emit('editableChange');
  }

  private applyDisabled(): void {
    this.root.classList.toggle('nova-disabled', this.disabled);
    if (this.disabled) this.root.setAttribute('aria-disabled', 'true');
    else this.root.removeAttribute('aria-disabled');
    // Отключённое поле не попадает в порядок Tab (как <textarea disabled>).
    if (this.disabled) this.view.dom.setAttribute('tabindex', '-1');
    else this.view.dom.removeAttribute('tabindex');
  }

  setEditable(value: boolean): void {
    if (this.editable === value) return;
    this.editable = value;
    this.view.setProps({});
    this.root.classList.toggle('nova-readonly', !value);
    if (!value) this.ui.closePopover();
    this.toolbar?.update();
    this.emit('editableChange');
  }

  // ---------- события ----------

  on<E extends EditorEvent>(event: E, listener: EditorListener<E>): () => void {
    let set = this.listeners.get(event);
    if (!set) this.listeners.set(event, (set = new Set()));
    set.add(listener as EditorListener);
    return () => this.off(event, listener);
  }

  off<E extends EditorEvent>(event: E, listener: EditorListener<E>): void {
    this.listeners.get(event)?.delete(listener as EditorListener);
  }

  private emit<E extends EditorEvent>(
    event: E,
    ...[detail]: EditorEventDetails[E] extends undefined ? [] : [EditorEventDetails[E]]
  ): void {
    for (const listener of this.listeners.get(event) ?? []) {
      // Ошибка в обработчике клиента не должна ломать редактор и остальных подписчиков.
      try {
        (listener as EditorListener<E>)(this, detail as EditorEventDetails[E]);
      } catch (error) {
        reportPluginError(`Listener for "${event}" failed`, error);
      }
    }
  }

  destroy(): void {
    if (this.destroyed) return;
    this.emit('destroy');
    this.destroyed = true;
    this.menubar?.destroy();
    this.ui.destroy();
    this.toolbar?.destroy();
    this.statusbar?.destroy();
    for (const cleanup of this.cleanups.splice(0)) {
      try {
        cleanup();
      } catch (error) {
        reportPluginError('Plugin cleanup failed', error);
      }
    }
    this.searchBar.destroy();
    if (this.root.classList.contains('nova-fullscreen')) toggleFullscreen(this, false);
    this.view.destroy();
    this.root.remove();
    this.listeners.clear();
  }
}

function reportPluginError(message: string, error?: unknown): void {
  console.error(`[nova] ${message}`, ...(error === undefined ? [] : [error]));
}

type AttrSpecs = Record<string, { validate?: string | ((value: unknown) => void) }>;

/** Проходит ли значение проверку `validate` атрибута схемы ("number", "string|null", функция). */
function attrValid(spec: AttrSpecs[string] | undefined, value: unknown): boolean {
  const validate = spec?.validate;
  if (!validate) return true;
  if (typeof validate === 'function') {
    try {
      validate(value);
      return true;
    } catch {
      return false;
    }
  }
  const type = value === null ? 'null' : typeof value;
  return validate.split('|').includes(type);
}

function sanitizeAttrs(specs: AttrSpecs | undefined, attrs: unknown): unknown {
  if (!attrs || typeof attrs !== 'object' || !specs) return attrs;
  // Значение не того типа заменяем значением по умолчанию (просто убираем — подставит схема).
  return Object.fromEntries(
    Object.entries(attrs).filter(([name, value]) => attrValid(specs[name], value)),
  );
}

/**
 * Документ из JSON (БД, API, старые версии) мог сохраниться с атрибутами не того типа:
 * `colspan: null` и т.п. ProseMirror в таком случае отвергает ВЕСЬ документ — пользователь не
 * открыл бы его из-за одной ячейки. Здесь неверные значения атрибутов заменяются умолчаниями.
 */
function sanitizeJSON(schema: NovaSchema, json: Record<string, unknown>): Record<string, unknown> {
  const type = schema.nodes[json.type as string];
  const out: Record<string, unknown> = { ...json };
  if (type) out.attrs = sanitizeAttrs(type.spec.attrs as AttrSpecs, json.attrs);
  if (Array.isArray(json.marks)) {
    out.marks = json.marks.map((mark: Record<string, unknown>) => {
      const markType = mark && schema.marks[mark.type as string];
      return markType
        ? { ...mark, attrs: sanitizeAttrs(markType.spec.attrs as AttrSpecs, mark.attrs) }
        : mark;
    });
  }
  if (Array.isArray(json.content)) {
    out.content = json.content.map((child: unknown) =>
      child && typeof child === 'object'
        ? sanitizeJSON(schema, child as Record<string, unknown>)
        : child,
    );
  }
  return out;
}

export function parseContent(
  schema: NovaSchema,
  content: string | Record<string, unknown>,
): PMNode {
  if (typeof content !== 'string') return PMNode.fromJSON(schema, sanitizeJSON(schema, content));
  const container = document.createElement('div');
  // Разбор через <template>: скрипты и обработчики не исполняются при парсинге.
  // Полноценный санитайзер (PRD §4.1, P1) появится отдельным модулем.
  const template = document.createElement('template');
  template.innerHTML = content;
  container.appendChild(template.content);
  return parserFor(schema).parse(container);
}

export function createEditor(options: EditorOptions): Editor {
  return new Editor(options);
}
