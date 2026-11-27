import type { AccordionOptions } from './plugins/accordion';
import type { TableOfContentsOptions } from './plugins/tableofcontents';
import type { PageLayoutOptions } from './plugins/pagelayout';
import type { ExportPdfOptions } from './plugins/exportpdf';
import type { ExportWordOptions } from './plugins/exportword';
import type { ImportWordOptions } from './plugins/importword';
import type { AiOptions } from './plugins/ai';
import type { AutosaveOptions } from './plugins/autosave';
import type { CodeSampleOptions } from './plugins/codesample';
import { Formatter, type FormatSpec, type StyleFormat } from './formats';
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
import { Node as PMNode, Slice } from 'prosemirror-model';
import { EditorState, Plugin, type Command, type Transaction } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { commands, isCommandActive, type CommandName } from './commands';
import { createTranslator, type LanguagePack } from './i18n';
import { embeddedImageUploadPlugin, imageDropPastePlugin, type UploadImageHandler } from './image';
import { firstClickPlugin } from './first-click';
import { announcePlugin } from './announce';
import { currentName, renameOptions } from './deprecations';
import { buildInputRules, codeFenceKeymap } from './inputrules';
import { buildKeymap } from './keymap';
import { openLinkDialog } from './link';
import { loadPasteCleaner, pastePlugin, type PasteOptions } from './paste';
import { loadTables } from './tables';
import { activeElement } from './ui/dom';
import { htmlSerializer, isRtlLanguage, sanitizeJSON, schemaFromOptions } from './document';
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
import {
  loadPlugin,
  orderPlugins,
  resolveEntries,
  type NovaPlugin,
  type PluginEntry,
} from './plugins';
import { createChain, type CommandChain } from './chain';
import { searchPlugin } from './search';
import { createSearchBar, type SearchBarHandle } from './ui/search-bar';
import { openHelp, toggleFullscreen } from './ui/views';
import type { NovaSchema } from './schema';
import { registerBuiltins, type FontOption } from './ui/builtins';
import { linkBubblePlugin } from './ui/link-bubble';
import { contextToolbarPlugin, focusContextToolbar } from './ui/context-toolbar';
import { ImageView } from './ui/image-view';
import { flatMarkViews } from './mark-views';
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

export type EditorMode = 'classic' | 'inline' | 'distraction-free';

/** Marks a transaction that came from a collaborator (set by @novaprose/collab): it is not user input. */
export const REMOTE_CHANGE_META = 'nova:remote';
/** A transaction marker from the API (setContent, insertContent): it doesn't count as input. */
export const API_CHANGE_META = 'nova:api';

/** Event details: the second argument of a listener, `editor.on(event, (editor, detail) => …)`. */
export interface EditorEventDetails {
  /** The editor is ready: lazy plugins and content styles are loaded (same as `await editor.ready`). */
  init: undefined;
  /** The document changed in any way: typing, the API, a collaborator. */
  change: { transaction: Transaction };
  /** The user of this editor changed the document (typing, paste, toolbar buttons, shortcuts). */
  input: { transaction: Transaction };
  selectionChange: { transaction: Transaction };
  focus: { event: FocusEvent };
  blur: { event: FocusEvent };
  editableChange: undefined;
  destroy: undefined;
  /** Before setContent: `detail.content` can be replaced. */
  beforeSetContent: { content: string | Record<string, unknown> };
  setContent: { content: string | Record<string, unknown> };
  /** A key in the text, before the editor handles it; `detail.event.preventDefault()` cancels that. */
  keydown: { event: KeyboardEvent };
}

export type EditorEvent = keyof EditorEventDetails;

export type EditorListener<E extends EditorEvent = EditorEvent> = (
  editor: Editor,
  detail: EditorEventDetails[E],
) => void;

/**
 * Options of the built-in plugins (typed, so your code editor suggests them) and of any other plugin
 * by name. Types only: plugin modules are not pulled into the core.
 */
export interface PluginOptions {
  comments?: CommentsOptions;
  mentions?: MentionsOptions;
  mergetags?: MergeTagsOptions;
  revisionhistory?: RevisionHistoryOptions;
  autosave?: AutosaveOptions;
  quickbars?: QuickbarsOptions;
  codesample?: CodeSampleOptions;
  accordion?: AccordionOptions;
  tableofcontents?: TableOfContentsOptions;
  pagelayout?: PageLayoutOptions;
  exportword?: ExportWordOptions;
  exportpdf?: ExportPdfOptions;
  importword?: ImportWordOptions;
  ai?: AiOptions;
  [plugin: string]: unknown;
}

export interface EditorOptions extends PasteOptions, ContentRulesOptions {
  /** The element the editor is mounted into. */
  element: HTMLElement;
  /** Initial content: an HTML string or a JSON document. */
  content?: string | Record<string, unknown>;
  /**
   * Toolbar: a string ('undo redo | bold italic'), an array of names, or false (headless: you draw
   * the UI). Defaults to the standard set.
   */
  toolbar?: false | ToolbarConfig;
  /** What the toolbar does when it runs out of width. Default 'sliding' (the rest goes into "⋯"). */
  toolbarMode?: ToolbarMode;
  /**
   * classic — a frame with bars (default); inline — no frame, the toolbar appears above the text on
   * focus; distraction-free — no permanent bars, only quick toolbars over the selection and empty lines.
   */
  mode?: EditorMode;
  /** Menu bar: true for the standard one ('file edit view insert format table help'), a string for your own set. Off by default. */
  menubar?: boolean | string;
  /** Your own menus, or overrides of the standard ones: { insert: { title: 'Insert', items: 'image link | hr' } }. */
  menu?: Record<string, MenuDefinition>;
  /** Status bar with the element path and the word count. On by default. */
  statusbar?: boolean;
  /** Placeholder for an empty document. */
  placeholder?: string;
  editable?: boolean;
  /**
   * A disabled editor, like a disabled form field: the text can't be edited or focused and the bars
   * are inactive. Unlike editable: false (read-only), it looks dimmed.
   */
  disabled?: boolean;
  /**
   * Resize handle in the status bar: true — height, 'both' — height and width. Works with a mouse,
   * a finger or the keyboard (arrow keys on the handle). Off by default.
   */
  resize?: boolean | 'both';
  /**
   * Items of the block list (the `blocks` button) and their order: [{ label: 'Subheading', block: 'h3' }].
   * Default: paragraph, H1–H6 and code block.
   */
  blockFormats?: BlockFormat[];
  /**
   * Content styles (like content_style in TinyMCE), applied only to this editor's text. `body` and
   * `html` in selectors mean the text area itself: 'body { font-family: Georgia }'.
   */
  contentStyle?: string;
  /**
   * Content style sheets (like content_css), loaded and applied only to this editor's text;
   * relative url() and @import work. `await editor.ready` waits for them.
   */
  contentCss?: string | string[];
  /**
   * Named formats (like formats in TinyMCE): { note: { block: 'p', classes: 'note' } }. Apply them
   * with editor.formatter.apply('note'); their classes are kept when HTML is parsed.
   */
  formats?: Record<string, FormatSpec | FormatSpec[]>;
  /**
   * Items of the Styles menu (the `styles` button): your formats, references to named formats and
   * groups. Default: headings, text, blocks and alignment.
   */
  styleFormats?: StyleFormat[];
  /** true — add styleFormats to the standard set instead of replacing it. */
  styleFormatsMerge?: boolean;
  /**
   * Which classes to keep in the HTML besides those of the formats: a list, or true for all. By
   * default only format classes (pasted clutter such as MsoNormal stays out of the document).
   */
  validClasses?: string[] | true;
  /**
   * Table styles to choose from in the table properties (like table_class_list in TinyMCE):
   * [{ title: 'Bordered', value: 'grid' }]. Your CSS (contentCss) defines how they look.
   */
  tableClassList?: ClassOption[];
  /** Cell styles to choose from in the cell properties (like table_cell_class_list). */
  tableCellClassList?: ClassOption[];
  /** UI language (BCP 47): 'en', 'de'… Default 'en'. */
  language?: string;
  /**
   * Writing direction of the UI and the text. By default right-to-left for Arabic, Hebrew, Persian
   * and Urdu (from `language`), otherwise the page's direction.
   */
  direction?: 'ltr' | 'rtl';
  /** Override individual UI strings. */
  translations?: LanguagePack;
  /** Upload images to your server. Without it, images are embedded as data: URLs. */
  uploadImage?: UploadImageHandler;
  /**
   * Your own file picker: a Browse button next to the address field of the link, image and video
   * dialogs. Gets the field type and the current address, returns { url, text?, title?, alt? } or null.
   */
  filePicker?: FilePicker;
  /** Which fields get Browse: 'file' (link), 'image', 'media'. Default: all of them. */
  filePickerTypes?: FilePickType[];
  fontFamilies?: FontOption[];
  fontSizes?: string[];
  lineHeights?: string[];
  colors?: string[];
  /** Slash commands ("/"). false turns them off; an array adds commands to the standard ones. */
  slashCommands?: false | SlashCommand[];
  /**
   * NovaProse plugins: an object, a registered name ('insertdatetime') or a lazy loader
   * (() => import(...)). Lazy ones load after the editor is created; wait for them with `await editor.ready`.
   */
  plugins?: PluginEntry[];
  /** Plugin options by name: { comments: {...}, mentions: {...} }. Built-in plugins are typed. */
  pluginOptions?: PluginOptions;
  /** Raw ProseMirror plugins (for low-level extensions). */
  prosemirrorPlugins?: Plugin[];
  /** Called before the toolbar is drawn — the place for editor.ui.registry.addButton(...). */
  setup?: (editor: Editor) => void;
  onChange?: (editor: Editor) => void;
}

/** An item of the table or cell style list: a label and a class. */
export interface ClassOption {
  title: string;
  value: string;
}

/** An item of the block list: a label and the block's tag. */
export interface BlockFormat {
  label: string;
  block: 'p' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'pre';
}

/** Tags that insertContent inserts as separate blocks. */
const INSERT_BLOCK_TAGS = new Set(
  'P H1 H2 H3 H4 H5 H6 UL OL TABLE BLOCKQUOTE PRE HR DIV FIGURE'.split(' '),
);

/** The "insert HTML at the cursor" command (editor.insertContent and a chain step). */
function insertContentCommand(html: string): Command {
  return (state, dispatch) => {
    if (!dispatch) return true;
    const template = document.createElement('template');
    template.innerHTML = html;
    const container = document.createElement('div');
    container.append(template.content);
    const parser = parserFor(state.schema as NovaSchema);
    const hasBlocks = [...container.children].some((el) => INSERT_BLOCK_TAGS.has(el.tagName));
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
    dispatch(tr.setMeta(API_CHANGE_META, true).scrollIntoView());
    return true;
  };
}

/** The number of the content style scope (contentStyle/contentCss), unique on the page. */
let contentScopeId = 0;

/** Unknown command names already warned about (once per page each). */
const unknownCommands = new Set<string>();

/**
 * The public API of a NovaProse editor. The framework wrappers (React, Vue…) work only through this
 * class, never with ProseMirror directly.
 */
export class Editor {
  readonly view: EditorView;
  readonly root: HTMLElement;
  readonly ui: UiManager;
  readonly options: Readonly<EditorOptions>;
  private readonly listeners = new Map<EditorEvent, Set<EditorListener>>();
  /** Resolves when all lazy plugins are loaded and set up. */
  readonly ready: Promise<void>;
  private toolbar: ToolbarHandle | null;
  private readonly toolbarHost: HTMLElement;
  private readonly menubar: MenubarHandle | null;
  readonly mode: EditorMode;
  /** The editor's writing direction (the direction option, the language or the page's dir). */
  readonly direction: 'ltr' | 'rtl';
  private readonly pluginsByName = new Map<string, NovaPlugin>();
  private readonly commandOverrides = new Map<CommandName, Command>();
  private readonly transactionTransforms: NonNullable<NovaPlugin['transformTransaction']>[] = [];
  private readonly cleanups: (() => void)[] = [];
  /** Content restrictions (validElements/invalidElements/validStyles), or null when there are none. */
  private readonly contentRules: ContentRules | null;
  /** This editor's document schema: the built-in one plus nodes and marks of plugins. */
  readonly schema: NovaSchema;
  /** Formats: register / apply / remove / toggle / match. */
  readonly formatter: Formatter;
  private readonly statusbar: ReturnType<typeof createStatusbar> | null;
  private readonly searchBar: SearchBarHandle;
  private destroyed = false;
  private editable: boolean;
  private disabled: boolean;
  private pasteAsText: boolean;

  constructor(options: EditorOptions) {
    // Renamed options keep working under their old names, with a console warning (deprecations.ts).
    options = renameOptions(options);
    this.options = options;
    this.root = document.createElement('div');
    this.root.className = 'nova-editor';
    const direction = options.direction ?? (isRtlLanguage(options.language) ? 'rtl' : undefined);
    if (direction) this.root.dir = direction;
    // Without an explicit direction, follow the page (dir on <html> or the container).
    this.direction =
      direction ??
      (options.element.closest('[dir]')?.getAttribute('dir') === 'rtl' ? 'rtl' : 'ltr');
    options.element.appendChild(this.root);

    const toolbarHost = document.createElement('div');
    const contentHost = document.createElement('div');
    const statusbarHost = document.createElement('div');
    contentHost.className = 'nova-content';
    // Header: menubar + toolbar. The header is sticky, not the toolbar inside it.
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
      // Focus is somewhere inside the editor (text, panels, menus, dialogs): show the header.
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
      this,
    );
    // The prompt in an empty image caption goes through a CSS variable (it isn't in the document's HTML).
    this.root.style.setProperty(
      '--nova-caption-placeholder',
      JSON.stringify(this.ui.t('image.captionPlaceholder')),
    );

    const editorKeys = keymap({
      'Mod-k': () => (openLinkDialog(this), true),
      // The standard accessibility shortcut: move from the text to the toolbar.
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
      // Move to the context toolbar (image, table).
      'Ctrl-F9': () => focusContextToolbar(this),
      'Mod-f': () => (this.openSearch(), true),
      'Mod-Shift-f': () => (toggleFullscreen(this), true),
      'Alt-0': () => (openHelp(this), true),
      // Escape in the text closes the search bar if it is open.
      Escape: () => {
        if (!this.searchBar.isOpen()) return false;
        this.searchBar.close();
        return true;
      },
    });

    // Plugins: synchronous ones are attached right away (their ProseMirror plugins go into the initial state),
    // lazy ones after the editor is created.
    // distraction-free makes no sense without quickbars, so it is attached automatically.
    const pluginEntries = [...(options.plugins ?? [])];
    if (distractionFree && !pluginEntries.includes('quickbars')) pluginEntries.push('quickbars');
    const resolved = resolveEntries(pluginEntries);
    resolved.errors.forEach((message) => reportPluginError(message));
    const { ordered: syncPlugins, errors: orderErrors } = orderPlugins(resolved.plugins);
    orderErrors.forEach((message) => reportPluginError(message));
    // Lazy parts of plugins with nodes (NovaPlugin.load) load together with the lazy plugins.
    for (const plugin of syncPlugins) if (plugin.load) resolved.loaders.push(plugin.load);
    const pluginPm = syncPlugins.flatMap((plugin) => this.collectPmPlugins(plugin));

    const hasRules =
      options.validElements !== undefined ||
      options.invalidElements !== undefined ||
      options.validStyles !== undefined;
    this.contentRules = hasRules ? new ContentRules(options) : null;
    // The same schema as createRenderer() on the server: the editor's and the server's HTML match.
    // The set of classes is live: formatter.register() in setup adds to it as well.
    const { schema, allowedClasses } = schemaFromOptions(
      options,
      syncPlugins,
      this.direction,
      this,
    );
    this.schema = schema;
    this.formatter = new Formatter(this, allowedClasses);
    for (const [name, spec] of Object.entries(options.formats ?? {}))
      this.formatter.register(name, spec);
    syncPlugins.forEach((plugin) => this.registerCommands(plugin));
    const initialDoc = parseContent(this.schema, options.content ?? '');

    const tablesAnchor = searchPlugin();
    const initialPlugins = [
      // First: while the list is open, Enter/Tab/arrows belong to the autocompleter, not the keymap.
      autocompleterPlugin(this),
      buildInputRules((name) => this.isAllowed(name), this.schema),
      codeFenceKeymap((name) => this.isAllowed(name), this.schema),
      editorKeys,
      // The table plugins go here (before the general keymap) once the mechanics load: Tab in a table is
      // the next cell, not a list indent. See installTables().
      tablesAnchor,
      ...buildKeymap((name) => this.resolveCommand(name)),
      // Screen readers hear what a formatting shortcut or a typed Markdown shortcut changed.
      announcePlugin(this.ui.t, (text) => this.ui.announce(text)),
      ...(syncPlugins.some((plugin) => plugin.replaceHistory) ? [] : [history()]),
      dropCursor({ color: 'var(--nova-accent)', width: 2 }),
      gapCursor(),
      imageDropPastePlugin(this),
      embeddedImageUploadPlugin(this),
      pastePlugin(this),
      linkBubblePlugin(this),
      contextToolbarPlugin(this),
      ...(this.contentRules ? [contentRulesPlugin(this.contentRules)] : []),
      // After plugins with their own clicks (link, panels): the first click without focus lands where you clicked.
      firstClickPlugin(),
      ...pluginPm,
      ...(options.prosemirrorPlugins ?? []),
    ];
    // Loading lazy parts rebuilds the set of plugins, and their views must survive it.
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
        // The visible placeholder is CSS generated content with empty alternative text (style.css);
        // screen readers get it as aria-placeholder, not as text inside the document.
        ...(options.placeholder
          ? { 'data-placeholder': options.placeholder, 'aria-placeholder': options.placeholder }
          : {}),
      },
      // ProseMirror calls dispatchTransaction with this = the view: plugins (collaboration sync,
      // for example) may dispatch a transaction while still inside the EditorView constructor,
      // when the editor's this.view isn't assigned yet.
      dispatchTransaction: function (this: EditorView, tr: Transaction) {
        handleTransaction(tr, this);
      },
      // The same parser for paste as for setContent: the same preprocessing.
      clipboardParser: parserFor(this.schema),
      nodeViews: {
        image: (node, view, getPos) => new ImageView(node, view, getPos, this),
      },
      // Bold, italic and the like stay part of the line's text for screen readers (mark-views.ts).
      markViews: flatMarkViews(this.schema),
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
            // Until lazy plugins load, their buttons aren't registered yet, so no warning.
            { warnUnknown: resolved.loaders.length === 0 },
          );
    if (!this.toolbar) toolbarHost.remove();
    if (!this.toolbar && !this.menubar) header.remove();

    this.searchBar = createSearchBar(this, contentHost);
    // The statusbar is on by default only in classic: inline/distraction-free are part of the page.
    const statusbar = options.statusbar ?? this.mode === 'classic';
    this.statusbar = statusbar ? createStatusbar(this, statusbarHost) : null;
    if (!this.statusbar) statusbarHost.remove();

    if (options.onChange) this.on('change', options.onChange);
    this.updatePlaceholder();

    const contentCss = this.applyContentStyles();
    this.ready = Promise.all([
      resolved.loaders.length ? this.loadLazyPlugins(resolved.loaders) : undefined,
      contentCss,
      // Office paste cleanup is a separate chunk, loaded in the background (see paste.ts).
      loadPasteCleaner(),
      // Table mechanics are a separate chunk (~10 KB gzip), loaded in the background (see tables.ts).
      this.installTables(tablesAnchor),
    ]).then(() => {
      if (!this.destroyed) this.emit('init');
    });
  }

  /**
   * Install table editing (cell selection, column widths, Tab between cells) once it has loaded, at
   * its place before `anchor`, as if the plugins had been there from the start.
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

  /** contentStyle right away, contentCss as it loads. Each editor gets its own scope. */
  private applyContentStyles(): Promise<void> | undefined {
    const { contentStyle, contentCss } = this.options;
    const files =
      contentCss === undefined ? [] : Array.isArray(contentCss) ? contentCss : [contentCss];
    if (!contentStyle && !files.length) return undefined;
    const id = `nova-cs-${++contentScopeId}`;
    this.root.classList.add(id);
    const scope = `.nova-editor.${id} .nova-prosemirror`;
    // The order as in TinyMCE: files first, then content_style (it overrides the files).
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

  // ---------- plugins ----------

  /** Whether content restrictions allow a control, command or tag (always true without restrictions). */
  isAllowed(name: string): boolean {
    return this.contentRules?.isAllowed(name) ?? true;
  }

  hasPlugin(name: string): boolean {
    return this.pluginsByName.has(name);
  }

  private collectPmPlugins(plugin: NovaPlugin): Plugin[] {
    try {
      const pm = plugin.prosemirrorPlugins?.(this) ?? [];
      if (plugin.nodeViews) {
        const nodeViews = Object.fromEntries(
          Object.entries(plugin.nodeViews).map(([name, factory]) => [name, factory(this)]),
        );
        pm.push(new Plugin({ props: { nodeViews } }));
      }
      return pm;
    } catch (error) {
      reportPluginError(`Plugin "${plugin.name}" failed to create ProseMirror plugins`, error);
      return [];
    }
  }

  /** setup with errors isolated: a failing plugin doesn't break the editor. */
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
    // The schema is fixed when the editor is created: a lazy plugin can't add nodes and marks.
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
   * Refresh the button state (pressed / enabled) without changing the document — for example, after a
   * plugin switched a display mode. Document changes refresh the UI by themselves.
   */
  updateUI(): void {
    if (this.destroyed) return;
    this.toolbar?.update();
  }

  /** Rebuild the toolbar (after plugins registered new buttons). */
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

  /** Toolbar configuration: yours as it is; the default one plus the buttons of active plugins. */
  private toolbarConfig(): ToolbarConfig {
    if (this.options.toolbar) return this.options.toolbar;
    const extra = [...this.pluginsByName.values()].map((p) => p.toolbar).filter(Boolean);
    return extra.length ? `${defaultToolbar} | ${extra.join(' ')}` : defaultToolbar;
  }

  private handleTransaction(tr: Transaction, view: EditorView = this.view): void {
    // Plugins with timers (collaboration cursors) may send a transaction
    // after destroy(), and there is nothing to apply it to.
    if (view.isDestroyed) return;
    for (const transform of this.transactionTransforms) tr = transform(tr, view.state, this);
    view.updateState(view.state.apply(tr));
    // Still inside the EditorView constructor: no interface and no subscribers yet, only the state.
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

  // ---------- content ----------

  /** The document's HTML. Deterministic: the same in every browser and in Node. */
  getHTML(): string {
    return htmlSerializer.serializeFragment(this.view.state.doc.content);
  }

  getJSON(): Record<string, unknown> {
    return this.view.state.doc.toJSON() as Record<string, unknown>;
  }

  getText(): string {
    return this.view.state.doc.textBetween(0, this.view.state.doc.content.size, '\n\n');
  }

  /** Replace the content. By default it can be undone. */
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
   * Insert HTML at the cursor (like insertContent in TinyMCE). The HTML is parsed by the editor's
   * schema, as a paste is: no scripts, unsafe links or unknown tags. Blocks (paragraphs, tables) are
   * inserted as separate blocks. A table inserted with the cursor inside a table goes after it
   * rather than replacing its cells.
   */
  insertContent(html: string): boolean {
    if (!this.isEditable()) return false;
    return insertContentCommand(html)(this.view.state, this.view.dispatch);
  }

  isEmpty(): boolean {
    return this.view.dom.classList.contains('nova-empty');
  }

  // ---------- commands ----------

  /** The command for a name: a plugin's override or the built-in one; unknown names return false. */
  private resolveCommand(name: CommandName): Command {
    name = currentName('commands', name) as CommandName;
    const command =
      this.commandOverrides.get(name) ??
      (Object.prototype.hasOwnProperty.call(commands, name) ? commands[name] : undefined);
    if (command) return command;
    // A name from untyped JavaScript (CDN): not an exception but "not executed" and a hint in the console.
    if (!unknownCommands.has(name)) {
      unknownCommands.add(name);
      console.warn(`[nova] unknown command "${String(name)}": editor.exec() returns false`);
    }
    return () => false;
  }

  private registerCommands(plugin: NovaPlugin): void {
    for (const [name, command] of Object.entries(plugin.commands ?? {})) {
      if (command) this.commandOverrides.set(name as CommandName, command);
    }
    if (plugin.transformTransaction) this.transactionTransforms.push(plugin.transformTransaction);
  }

  /** Run a named command or any ProseMirror command; returns whether it ran. */
  exec(command: CommandName | Command): boolean {
    const cmd = typeof command === 'string' ? this.resolveCommand(command) : command;
    const result = cmd(this.view.state, this.view.dispatch, this.view);
    if (result) this.view.focus();
    return result;
  }

  /**
   * Several commands as one edit — one undo step, one change event:
   * `editor.chain().exec('h2').exec('alignCenter').run()`. If a step fails, the document doesn't
   * change and run() returns false; `chain().….can()` checks without changing anything (for buttons).
   */
  chain(): CommandChain {
    return createChain({
      view: () => (this.destroyed ? null : this.view),
      resolve: (name) => this.resolveCommand(name),
      insertContent: (html) => (state, dispatch, view) =>
        this.isEditable() && insertContentCommand(html)(state, dispatch, view),
    });
  }

  /** Whether the command can run in the current state (for disabled buttons). */
  can(command: CommandName | Command): boolean {
    const cmd = typeof command === 'string' ? this.resolveCommand(command) : command;
    return cmd(this.view.state, undefined, this.view);
  }

  /** Whether a named command is active for the current selection (for your own toolbar buttons). */
  isActive(command: CommandName): boolean {
    return isCommandActive(this.view.state, currentName('commands', command) as CommandName);
  }

  /**
   * The state of a named command for your own toolbar: whether it is active (a pressed button) and
   * whether it can run now. The equivalent of queryCommandState / queryCommandEnabled.
   */
  getCommandState(command: CommandName): { active: boolean; enabled: boolean } {
    return { active: this.isActive(command), enabled: this.isEditable() && this.can(command) };
  }

  focus(): void {
    if (!this.destroyed) this.view.focus();
  }

  /** "Paste as text" mode (the pastetext toggle). */
  isPasteAsText(): boolean {
    return this.pasteAsText;
  }

  setPasteAsText(value: boolean): void {
    this.pasteAsText = value;
    this.toolbar?.update();
  }

  /** Open the find and replace bar (Ctrl/Cmd+F). */
  openSearch(): void {
    this.searchBar.open();
  }

  closeSearch(): void {
    this.searchBar.close();
  }

  /** Whether the text can be edited now: neither read-only nor disabled. */
  isEditable(): boolean {
    return this.editable && !this.disabled;
  }

  isDisabled(): boolean {
    return this.disabled;
  }

  /** Disable or enable the editor (like disabled on a form field). */
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
    // A disabled field leaves the Tab order (like <textarea disabled>).
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

  // ---------- events ----------

  on<E extends EditorEvent>(event: E, listener: EditorListener<E>): () => void {
    event = currentName('events', event) as E;
    let set = this.listeners.get(event);
    if (!set) this.listeners.set(event, (set = new Set()));
    set.add(listener as EditorListener);
    return () => this.off(event, listener);
  }

  off<E extends EditorEvent>(event: E, listener: EditorListener<E>): void {
    event = currentName('events', event) as E;
    this.listeners.get(event)?.delete(listener as EditorListener);
  }

  private emit<E extends EditorEvent>(
    event: E,
    ...[detail]: EditorEventDetails[E] extends undefined ? [] : [EditorEventDetails[E]]
  ): void {
    for (const listener of this.listeners.get(event) ?? []) {
      // An error in the customer's handler must not break the editor and the other subscribers.
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

export function parseContent(
  schema: NovaSchema,
  content: string | Record<string, unknown>,
): PMNode {
  if (typeof content !== 'string') return PMNode.fromJSON(schema, sanitizeJSON(schema, content));
  const container = document.createElement('div');
  // Parsing through <template>: scripts and handlers don't run while parsing.
  // A full sanitizer will come as a separate module.
  const template = document.createElement('template');
  template.innerHTML = content;
  container.appendChild(template.content);
  return parserFor(schema).parse(container);
}

export function createEditor(options: EditorOptions): Editor {
  return new Editor(options);
}
