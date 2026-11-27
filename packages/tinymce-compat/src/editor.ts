import { toFormatSpecs } from './options';
import {
  getStyle,
  HTMLSerializer,
  icons,
  setStyle,
  type CommandName,
  type Editor,
  type StyleMark,
} from '@novaprose/core';
import type * as DialogModule from './dialog';
import type { DialogApi, DialogSpec } from './dialog';
import { AllSelection, NodeSelection, TextSelection } from 'prosemirror-state';

const serializer = new HTMLSerializer();

type Dialogs = typeof DialogModule;
let dialogs: Dialogs | null = null;
let dialogsLoading: Promise<Dialogs> | null = null;

/**
 * Dialogs from a description (windowManager.open) are a separate module: a lazy part in the CDN build.
 * The editor loads it in advance, so open() usually draws the dialog right away.
 */
export function loadDialogs(): Promise<Dialogs> {
  dialogsLoading ??= import('./dialog').then((module) => (dialogs = module));
  return dialogsLoading;
}

/**
 * The dialog API is available at once. While the module is still loading, setData collects data (the dialog
 * opens with it) and other calls wait for the dialog to open.
 */
function openDialog(
  core: Editor,
  spec: DialogSpec,
  reopen: (spec: DialogSpec) => DialogApi,
): DialogApi {
  if (dialogs) return dialogs.openSpecDialog(core, spec, reopen);
  let real: DialogApi | null = null;
  let data = { ...(spec.initialData ?? {}) };
  const queue: Array<(api: DialogApi) => void> = [];
  void loadDialogs().then(
    (module) => {
      real = module.openSpecDialog(core, { ...spec, initialData: data }, reopen);
      for (const call of queue.splice(0)) call(real);
    },
    (error: unknown) => console.error('[nova] windowManager: could not load dialogs', error),
  );
  const later =
    <K extends keyof DialogApi>(method: K) =>
    (...args: Parameters<DialogApi[K]>) => {
      const call = (api: DialogApi) => (api[method] as (...a: typeof args) => void)(...args);
      if (real) call(real);
      else queue.push(call);
    };
  return {
    getData: () => (real ? real.getData() : { ...data }),
    setData: (next) => {
      if (real) real.setData(next);
      else data = { ...data, ...next };
    },
    close: later('close'),
    block: later('block'),
    unblock: later('unblock'),
    focus: later('focus'),
    disable: later('disable'),
    enable: later('enable'),
    showTab: later('showTab'),
    redial: later('redial'),
  };
}

/**
 * A NovaProse editor with the TinyMCE editor API (from its public documentation): the methods,
 * events and control registry that existing integrations use. Everything goes through the public
 * `Editor` API — ProseMirror is never touched directly (except inserting HTML via view.pasteHTML).
 */

type Handler = (event: Record<string, unknown>) => unknown;

/** execCommand → a named NovaProse command (TinyMCE command names are case-insensitive). */
const COMMANDS: Record<string, CommandName> = {
  bold: 'bold',
  italic: 'italic',
  underline: 'underline',
  strikethrough: 'strike',
  superscript: 'superscript',
  subscript: 'subscript',
  justifyleft: 'alignLeft',
  justifycenter: 'alignCenter',
  justifyright: 'alignRight',
  justifyfull: 'alignJustify',
  insertunorderedlist: 'bulletList',
  insertorderedlist: 'orderedList',
  indent: 'indent',
  outdent: 'outdent',
  undo: 'undo',
  redo: 'redo',
  removeformat: 'clearFormatting',
  unlink: 'unlink',
  inserthorizontalrule: 'horizontalRule',
  mceblockquote: 'blockquote',
};

/**
 * Commands of the casechange, formatpainter, permanentpen, visualchars, save, template and
 * footnotes plugins (as in the TinyMCE documentation) → the menu item or button of the same action.
 */
const PLUGIN_COMMANDS: Record<string, string> = {
  mcelowercase: 'lowercase',
  mceuppercase: 'uppercase',
  mcetitlecase: 'titlecase',
  mcetoggleformatpainter: 'formatpainter',
  mcetogglepermanentpen: 'permanentpen',
  mceconfigurepermanentpen: 'configurepermanentpen',
  mcevisualchars: 'visualchars',
  mcesave: 'save',
  mcecancel: 'cancel',
  mcetemplate: 'template',
  mceinsertfootnote: 'footnotes',
  mceupdatefootnotes: 'footnotesupdate',
  mcespellcheckdialog: 'spellcheckdialog',
  mcetypography: 'typography',
};

/**
 * Commands of the spell checker (tinymcespellchecker in TinyMCE): on, off, check again (it checks as
 * you type anyway), close the bubble. mceSpellcheckDialog is in PLUGIN_COMMANDS: the next problem.
 */
const SPELLCHECK_COMMANDS = new Set([
  'mcespellcheckenable',
  'mcespellcheckdisable',
  'mcespellcheckupdate',
  'mcespellcheckdialogclose',
]);

/** Commands of collapsible blocks (the accordion plugin), as in the TinyMCE documentation. */
const ACCORDION_COMMANDS = new Set([
  'insertaccordion',
  'removeaccordion',
  'toggleaccordion',
  'toggleallaccordions',
]);

const FORMAT_BLOCKS: Record<string, CommandName> = {
  p: 'paragraph',
  h1: 'h1',
  h2: 'h2',
  h3: 'h3',
  h4: 'h4',
  h5: 'h5',
  h6: 'h6',
  blockquote: 'blockquote',
  pre: 'codeBlock',
};

/** TinyMCE icon names → NovaProse icons (the rest render as text or through addIcon). */
const ICON_NAMES: Record<string, keyof typeof icons> = {
  bold: 'bold',
  italic: 'italic',
  underline: 'underline',
  'strike-through': 'strike',
  link: 'link',
  unlink: 'unlink',
  image: 'image',
  table: 'table',
  undo: 'undo',
  redo: 'redo',
  'align-left': 'alignLeft',
  'align-center': 'alignCenter',
  'align-right': 'alignRight',
  'align-justify': 'alignJustify',
  'unordered-list': 'bulletList',
  'ordered-list': 'orderedList',
  indent: 'indent',
  outdent: 'outdent',
  quote: 'blockquote',
  'code-sample': 'codeBlock',
  'horizontal-rule': 'horizontalRule',
  'remove-formatting': 'clearFormatting',
  fullscreen: 'fullscreen',
  preview: 'preview',
  sourcecode: 'sourceCode',
  help: 'help',
  print: 'print',
  search: 'search',
  copy: 'copy',
  'edit-block': 'edit',
  checkmark: 'check',
  close: 'close',
  upload: 'upload',
  subscript: 'subscript',
  superscript: 'superscript',
  'paste-text': 'pasteText',
  'text-color': 'textColor',
  'highlight-bg-color': 'highlight',
  'line-height': 'lineHeight',
};

/** Built-in TinyMCE formats → NovaProse commands. */
const FORMAT_COMMANDS: Record<string, CommandName> = {
  bold: 'bold',
  italic: 'italic',
  underline: 'underline',
  strikethrough: 'strike',
  superscript: 'superscript',
  subscript: 'subscript',
  code: 'code',
  p: 'paragraph',
  h1: 'h1',
  h2: 'h2',
  h3: 'h3',
  h4: 'h4',
  h5: 'h5',
  h6: 'h6',
  blockquote: 'blockquote',
  pre: 'codeBlock',
  alignleft: 'alignLeft',
  aligncenter: 'alignCenter',
  alignright: 'alignRight',
  alignjustify: 'alignJustify',
};
const TAG_FORMATS = new Set(['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'pre']);
const BLOCK_FORMATS = new Set([
  'p',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'blockquote',
  'pre',
  'alignleft',
  'aligncenter',
  'alignright',
  'alignjustify',
]);
const STYLE_FORMATS: Record<string, StyleMark> = {
  forecolor: 'color',
  hilitecolor: 'background',
  fontname: 'font_family',
  fontsize: 'font_size',
};

function warnDom(method: string): void {
  console.warn(
    `[nova] tinymce-compat: editor.dom.${method} changes the editor DOM directly, which NovaProse redraws from its document model. Use setContent, insertContent or editor.formatter instead.`,
  );
}

/** SVGs added through editor.ui.registry.addIcon (shared by the page, as in TinyMCE). */
const customIcons = new Map<string, string>();

function resolveIcon(name: unknown): string | undefined {
  if (typeof name !== 'string' || !name) return undefined;
  if (customIcons.has(name)) return customIcons.get(name);
  const own = ICON_NAMES[name] ?? (name in icons ? (name as keyof typeof icons) : undefined);
  return own ? icons[own] : undefined;
}

/** Button state for onAction/onSetup (api.isActive, setActive, isEnabled, setEnabled). */
function buttonApi(compat: CompatEditor) {
  let active = false;
  let enabled = true;
  return {
    state: {
      get active() {
        return active;
      },
      get enabled() {
        return enabled;
      },
    },
    api: {
      isActive: () => active,
      setActive: (value: boolean) => {
        active = value;
        compat.core.updateUI();
      },
      isEnabled: () => enabled,
      setEnabled: (value: boolean) => {
        enabled = value;
        compat.core.updateUI();
      },
      // Compatibility with older versions of the API.
      isDisabled: () => !enabled,
      setDisabled: (value: boolean) => {
        enabled = !value;
        compat.core.updateUI();
      },
    },
  };
}

type ButtonSpec = {
  text?: string;
  icon?: string;
  tooltip?: string;
  onAction?: (api: unknown) => void;
  onSetup?: (api: unknown) => void | (() => void);
  enabled?: boolean;
};

type MenuItemSpec = ButtonSpec & { type?: string; value?: string; getSubmenuItems?: unknown };

export class CompatEditor {
  readonly id: string;
  readonly core: Editor;
  readonly targetElm: HTMLElement;
  readonly settings: Record<string, unknown>;
  /**
   * The plugins by their TinyMCE names (`editor.plugins.lists`): the listed ones that work here, and
   * what your own plugins return. inlinecss has `getContent()`: the content with its styles inline.
   */
  readonly plugins: Record<string, Record<string, unknown>> = {};
  initialized = false;
  removed = false;
  private readonly handlers = new Map<string, Set<Handler>>();
  private dirty = false;
  private readonly teardowns: (() => void)[] = [];

  constructor(core: Editor, target: HTMLElement, id: string, settings: Record<string, unknown>) {
    this.core = core;
    this.targetElm = target;
    this.id = id;
    this.settings = settings;
    // Dialogs of your own plugins load in advance, in the background: by the first open() the module is there.
    setTimeout(() => void loadDialogs().catch(() => {}), 0);
  }

  // ---------- content ----------

  getContent(args: { format?: string } = {}): string {
    const event = { format: args.format ?? 'html', content: '' };
    event.content = event.format === 'text' ? this.core.getText() : this.core.getHTML();
    this.fire('GetContent', event);
    return event.content;
  }

  setContent(content: string, args: Record<string, unknown> = {}): string {
    const event = { content, ...args };
    this.fire('BeforeSetContent', event);
    this.core.setContent(event.content);
    this.fire('SetContent', event);
    return event.content;
  }

  /**
   * Insert HTML in place of the selection. Blocks (<p>, lists, tables) go in as separate blocks (the
   * paragraph is split), inline content into the current line. Parsed by the editor's schema: the
   * same link and markup checks as when content is loaded.
   */
  insertContent(content: string): void {
    this.core.insertContent(content);
  }

  resetContent(content?: string): void {
    this.core.setContent(content ?? (this.settings.__initialContent as string) ?? '', {
      addToHistory: false,
    });
    this.setDirty(false);
  }

  getBody(): HTMLElement {
    return this.core.view.dom;
  }

  getElement(): HTMLElement {
    return this.targetElm;
  }

  getContainer(): HTMLElement {
    return this.core.root;
  }

  getContentAreaContainer(): HTMLElement {
    return this.core.view.dom.parentElement ?? this.core.root;
  }

  getDoc(): Document {
    return this.core.root.ownerDocument;
  }

  getWin(): Window {
    return this.core.root.ownerDocument.defaultView!;
  }

  // ---------- commands ----------

  /** The value of a command: for ToggleSidebar, the name of the open sidebar. */
  queryCommandValue(command: string): string {
    if (command.toLowerCase() === 'togglesidebar') return this.core.ui.sidebar.active ?? '';
    return '';
  }

  execCommand(command: string, _ui?: boolean, value?: unknown): boolean {
    const name = command.toLowerCase();
    let done = false;
    if (COMMANDS[name]) done = this.core.exec(COMMANDS[name]!);
    else if (name === 'formatblock' || name === 'mcetoggleformat') {
      const block = FORMAT_BLOCKS[String(value ?? '').toLowerCase()];
      done = block ? this.core.exec(block) : false;
    } else if (name === 'mceinsertcontent' || name === 'inserthtml') {
      this.insertContent(String(value ?? ''));
      done = true;
    } else if (name === 'togglesidebar') {
      // A sidebar from ui.registry.addSidebar (value is its name).
      void this.core.ui.sidebar.toggle(String(value ?? ''));
      done = true;
    } else if (
      (name === 'mceaidialog' || name === 'mceaidialogclose') &&
      this.core.hasPlugin('ai')
    ) {
      // The AI assistant's window: { prompt, generate, display } as in TinyMCE, or close it.
      const options = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
      const detail = {
        ...(typeof options.prompt === 'string' ? { prompt: options.prompt } : {}),
        ...(options.generate === true ? { generate: true } : {}),
        ...(options.display === false ? { display: false } : {}),
      };
      this.core.root.dispatchEvent(
        name === 'mceaidialog'
          ? new CustomEvent('nova-ai-dialog', { detail })
          : new CustomEvent('nova-ai-dialog-close'),
      );
      done = true;
    } else if (name === 'mcesetcontent') {
      this.setContent(String(value ?? ''));
      done = true;
    } else if (name === 'mceinserttoc' || name === 'mceupdatetoc') {
      // Table of contents (the tableofcontents plugin), like its buttons.
      const control = this.core.ui.registry.get(
        name === 'mceinserttoc' ? 'tableofcontents' : 'tableofcontentsupdate',
      );
      if (control?.type === 'button') {
        control.onAction(this.core);
        done = true;
      }
    } else if (ACCORDION_COMMANDS.has(name)) {
      done = this.accordionCommand(name, value);
    } else if (name === 'mceinserttemplate' && this.core.hasPlugin('template')) {
      // The template plugin inserts it the way its dialog does (values, dates, selection).
      this.core.root.dispatchEvent(
        new CustomEvent('nova-insert-template', { detail: String(value ?? '') }),
      );
      done = true;
    } else if (SPELLCHECK_COMMANDS.has(name) && this.core.hasPlugin('spellchecker')) {
      done = this.spellcheckCommand(name);
    } else if (PLUGIN_COMMANDS[name] || name === 'mcetogglestickyformatpainter') {
      done = this.pluginCommand(name);
    } else if (name === 'codesample') {
      // The "Code sample" dialog (the codesample plugin), like pressing its button.
      const button = this.core.ui.registry.get('codesample');
      if (button?.type === 'button') {
        button.onAction(this.core);
        done = true;
      }
    } else if (name === 'selectall') {
      const { state, dispatch } = this.core.view;
      dispatch(state.tr.setSelection(new AllSelection(state.doc)));
      done = true;
    } else if (name === 'mcecleanup') {
      done = true;
    } else {
      const custom = this.commands.get(name);
      if (custom) {
        custom(_ui, value);
        done = true;
      }
    }
    if (done) this.fire('ExecCommand', { command, ui: _ui, value });
    return done;
  }

  /**
   * InsertAccordion / RemoveAccordion — like the accordion button (inside one, remove the frame;
   * otherwise insert); ToggleAccordion / ToggleAllAccordions — value true expands, false collapses,
   * no value toggles. Collapsing is a view, not an edit: it doesn't go into the undo history.
   */
  private spellcheckCommand(name: string): boolean {
    if (name === 'mcespellcheckdialogclose') {
      this.core.ui.closeOverlays();
      return true;
    }
    if (name === 'mcespellcheckupdate') return true;
    const toggle = this.core.ui.registry.get('spellchecker') as
      { isActive?: (e: Editor) => boolean; onAction: (e: Editor) => void } | undefined;
    if (!toggle) return false;
    const on = !!toggle.isActive?.(this.core);
    if ((name === 'mcespellcheckenable') !== on) toggle.onAction(this.core);
    return true;
  }

  private accordionCommand(name: string, value: unknown): boolean {
    const { view } = this.core;
    const { state } = view;
    const $from = state.selection.$from;
    let around: { pos: number; open: boolean } | null = null;
    for (let depth = $from.depth; depth > 0 && !around; depth--) {
      const node = $from.node(depth);
      if (node.type.name === 'details') {
        around = { pos: $from.before(depth), open: node.attrs.open !== false };
      }
    }
    if (name === 'insertaccordion' || name === 'removeaccordion') {
      if ((name === 'removeaccordion') !== !!around) return false;
      const button = this.core.ui.registry.get('accordion');
      if (button?.type !== 'button') return false;
      button.onAction(this.core);
      return true;
    }
    const all: { pos: number; open: boolean }[] = [];
    if (name === 'toggleaccordion') {
      if (around) all.push(around);
    } else {
      state.doc.descendants((node, pos) => {
        if (node.type.name === 'details') all.push({ pos, open: node.attrs.open !== false });
        return !node.isTextblock;
      });
    }
    if (!all.length) return false;
    const open = typeof value === 'boolean' ? value : !all.every((d) => d.open);
    const tr = state.tr;
    for (const details of all) tr.setNodeAttribute(details.pos, 'open', open);
    view.dispatch(tr.setMeta('addToHistory', false));
    return true;
  }

  /**
   * A command of casechange, formatpainter or permanentpen: like its menu item or button.
   * mceToggleStickyFormatPainter turns the painter on to stay (a double click on the button), or off.
   */
  private pluginCommand(name: string): boolean {
    const { registry } = this.core.ui;
    if (name === 'mcetogglestickyformatpainter') {
      const painter = registry.get('formatpainter');
      const item = registry.getMenuItem('formatpainter');
      if (painter?.type !== 'button' || !item) return false;
      // On: off, like the menu item. Off: two presses of the button, a double click.
      if (item.isActive?.(this.core)) item.onAction(this.core);
      else {
        painter.onAction(this.core);
        painter.onAction(this.core);
      }
      return true;
    }
    const item = registry.getMenuItem(PLUGIN_COMMANDS[name]!);
    // mceSave saves even without changes; the rest act only when their control could.
    if (!item || (name !== 'mcesave' && item.isEnabled?.(this.core) === false)) return false;
    item.onAction(this.core);
    return true;
  }

  queryCommandState(command: string): boolean {
    const lower = command.toLowerCase();
    const name = COMMANDS[lower];
    if (name) return this.core.isActive(name);
    // The painter and the pen are on or off, like their buttons.
    if (lower === 'mcetoggleformatpainter' || lower === 'mcetogglepermanentpen') {
      return !!this.core.ui.registry.getMenuItem(PLUGIN_COMMANDS[lower]!)?.isActive?.(this.core);
    }
    return false;
  }

  queryCommandSupported(command: string): boolean {
    const name = command.toLowerCase();
    return (
      name in COMMANDS ||
      ['formatblock', 'mceinsertcontent', 'mcesetcontent'].includes(name) ||
      (name in PLUGIN_COMMANDS && !!this.core.ui.registry.getMenuItem(PLUGIN_COMMANDS[name]!)) ||
      (name === 'mcetogglestickyformatpainter' && this.core.ui.registry.has('formatpainter')) ||
      (SPELLCHECK_COMMANDS.has(name) && this.core.hasPlugin('spellchecker')) ||
      ((name === 'mceaidialog' || name === 'mceaidialogclose') && this.core.hasPlugin('ai')) ||
      this.commands.has(name)
    );
  }

  private readonly commands = new Map<string, (ui?: boolean, value?: unknown) => void>();

  addCommand(name: string, callback: (ui?: boolean, value?: unknown) => void): void {
    this.commands.set(name.toLowerCase(), callback);
  }

  // ---------- events ----------

  on(names: string, handler: Handler, prepend = false): this {
    for (const name of names.toLowerCase().split(/\s+/).filter(Boolean)) {
      const set = this.handlers.get(name) ?? new Set();
      if (prepend) this.handlers.set(name, new Set([handler, ...set]));
      else this.handlers.set(name, set.add(handler));
    }
    return this;
  }

  off(names?: string, handler?: Handler): this {
    if (!names) {
      this.handlers.clear();
      return this;
    }
    for (const name of names.toLowerCase().split(/\s+/).filter(Boolean)) {
      if (handler) this.handlers.get(name)?.delete(handler);
      else this.handlers.delete(name);
    }
    return this;
  }

  once(names: string, handler: Handler): this {
    const wrapped: Handler = (event) => {
      this.off(names, wrapped);
      return handler(event);
    };
    return this.on(names, wrapped);
  }

  fire(name: string, event: Record<string, unknown> = {}): Record<string, unknown> {
    const payload = Object.assign(event, { type: name.toLowerCase(), target: this });
    for (const handler of [...(this.handlers.get(name.toLowerCase()) ?? [])]) {
      try {
        handler(payload);
      } catch (error) {
        console.error(`[nova] tinymce-compat: "${name}" handler failed`, error);
      }
    }
    return payload;
  }

  /** A DOM event of the text (keydown, click…): handlers get the browser's event itself. */
  fireNative(name: string, event: Event): void {
    for (const handler of [...(this.handlers.get(name) ?? [])]) {
      try {
        handler(event as unknown as Record<string, unknown>);
      } catch (error) {
        console.error(`[nova] tinymce-compat: "${name}" handler failed`, error);
      }
    }
  }

  /** An icon for buttons by name (tinymce.IconManager / editor.ui.registry.addIcon). */
  static registerIcon(name: string, svg: string): void {
    customIcons.set(name, svg);
  }

  /** The newer name of fire in recent versions of the API. */
  dispatch(name: string, event?: Record<string, unknown>): Record<string, unknown> {
    return this.fire(name, event);
  }

  hasEventListeners(name: string): boolean {
    return (this.handlers.get(name.toLowerCase())?.size ?? 0) > 0;
  }

  // ---------- state ----------

  isDirty(): boolean {
    return this.dirty;
  }

  setDirty(state: boolean): void {
    const changed = this.dirty !== state;
    this.dirty = state;
    if (changed && state) this.fire('Dirty');
  }

  /** Write the content into the original <textarea> (as on form submit). */
  save(): string {
    const content = this.getContent();
    const event = this.fire('SaveContent', { content });
    if (this.targetElm instanceof HTMLTextAreaElement) {
      this.targetElm.value = String(event.content);
    }
    this.setDirty(false);
    return String(event.content);
  }

  focus(): void {
    this.core.focus();
  }

  hasFocus(): boolean {
    return this.core.view.hasFocus();
  }

  hide(): void {
    this.core.root.hidden = true;
    if (this.targetElm instanceof HTMLTextAreaElement) this.targetElm.hidden = false;
  }

  show(): void {
    this.core.root.hidden = false;
    if (this.targetElm instanceof HTMLTextAreaElement) this.targetElm.hidden = true;
  }

  isHidden(): boolean {
    // In newer DOM types hidden can be "until-found".
    return this.core.root.hidden === true;
  }

  getParam(name: string, defaultValue?: unknown): unknown {
    return name in this.settings ? this.settings[name] : defaultValue;
  }

  readonly options = {
    get: (name: string) => this.settings[name],
    set: (name: string, value: unknown) => {
      this.settings[name] = value;
      // Options that the TinyMCE documentation allows to change on the fly.
      if (name === 'disabled') this.core.setDisabled(value === true);
      return true;
    },
    isSet: (name: string) => name in this.settings,
    isRegistered: () => true,
    register: () => {},
  };

  readonly mode = {
    get: () => (this.core.isEditable() ? 'design' : 'readonly'),
    set: (mode: string) => this.core.setEditable(mode !== 'readonly'),
    isReadOnly: () => !this.core.isEditable(),
  };

  readonly undoManager = {
    undo: () => this.core.exec('undo'),
    redo: () => this.core.exec('redo'),
    hasUndo: () => this.core.can('undo'),
    hasRedo: () => this.core.can('redo'),
    add: () => null,
    clear: () => {},
    transact: (callback: () => void) => {
      callback();
      return null;
    },
    ignore: (callback: () => void) => callback(),
  };

  readonly selection = {
    getContent: (args: { format?: string } = {}) => {
      const { state } = this.core.view;
      const { from, to } = state.selection;
      if (args.format === 'text') return state.doc.textBetween(from, to, '\n');
      return serializer.serializeFragment(state.selection.content().content);
    },
    setContent: (content: string) => this.insertContent(content),
    getNode: () => {
      const { from } = this.core.view.state.selection;
      const { node } = this.core.view.domAtPos(from);
      return node instanceof Element ? node : node.parentElement;
    },
    getStart: () => this.selection.getNode(),
    getEnd: () => this.selection.getNode(),
    isCollapsed: () => this.core.view.state.selection.empty,
    collapse: (toStart = false) => {
      const { state, dispatch } = this.core.view;
      const pos = toStart ? state.selection.from : state.selection.to;
      dispatch(state.tr.setSelection(TextSelection.near(state.doc.resolve(pos))));
    },
    /** Put the cursor in a DOM node of the editor (at its start by default). */
    setCursorLocation: (node?: Node, offset = 0) => {
      const { view } = this.core;
      if (!node || !view.dom.contains(node)) return;
      const pos = view.posAtDOM(node, offset);
      view.dispatch(view.state.tr.setSelection(TextSelection.near(view.state.doc.resolve(pos))));
    },
    /** Select an element: content = true — only its content. */
    select: (node: Node, content = false) => {
      const { view } = this.core;
      if (!view.dom.contains(node)) return;
      const from = view.posAtDOM(node, 0);
      const to = view.posAtDOM(node, node.childNodes.length);
      const { doc } = view.state;
      const selection =
        !content && node instanceof HTMLImageElement
          ? NodeSelection.create(doc, Math.max(0, from - (doc.resolve(from).nodeAfter ? 0 : 1)))
          : TextSelection.between(doc.resolve(from), doc.resolve(to));
      view.dispatch(view.state.tr.setSelection(selection));
    },
  };

  readonly notificationManager = {
    open: (args: {
      text: string;
      type?: 'info' | 'success' | 'warning' | 'error';
      timeout?: number;
    }) =>
      this.core.ui.notify({
        text: args.text,
        ...(args.type ? { type: args.type } : {}),
        ...(args.timeout !== undefined ? { timeout: args.timeout } : {}),
      }),
    close: () => {},
  };

  readonly windowManager = {
    alert: (message: string, callback?: () => void) => {
      const p = document.createElement('p');
      p.textContent = message;
      this.core.ui.openDialog({
        title: '',
        body: p,
        onSubmit: () => true,
        ...(callback ? { onClose: callback } : {}),
      } as never);
    },
    confirm: (message: string, callback?: (state: boolean) => void) => {
      const p = document.createElement('p');
      p.textContent = message;
      let confirmed = false;
      this.core.ui.openDialog({
        title: '',
        body: p,
        submitLabel: 'OK',
        onSubmit: () => {
          confirmed = true;
          return true;
        },
        onClose: () => callback?.(confirmed),
      } as never);
    },
    open: (spec: DialogSpec): DialogApi =>
      openDialog(this.core, spec, (next) => this.windowManager.open(next)),
  };

  /** editor.ui.registry — buttons and menu items in TinyMCE format on top of the NovaProse registry. */
  readonly ui = {
    registry: {
      addIcon: (name: string, svg: string) => {
        customIcons.set(name, svg);
      },
      addButton: (name: string, spec: ButtonSpec) => this.addButton(name, spec, false),
      addToggleButton: (name: string, spec: ButtonSpec & { active?: boolean }) =>
        this.addButton(name, spec, true),
      addMenuButton: (
        name: string,
        spec: ButtonSpec & { fetch: (callback: (items: MenuItemSpec[]) => void) => void },
      ) => {
        let items: MenuItemSpec[] = [];
        spec.fetch((result) => (items = result));
        const icon = resolveIcon(spec.icon);
        this.core.ui.registry.addMenuButton(name, {
          tooltip: spec.tooltip ?? spec.text ?? name,
          ...(icon ? { icon } : { text: spec.text ?? name }),
          items: () => {
            spec.fetch((result) => (items = result));
            return items.map((item, index) =>
              item.type === 'separator'
                ? { type: 'separator' as const }
                : {
                    id: `${name}-${index}`,
                    label: item.text ?? '',
                    onSelect: () => item.onAction?.({}),
                  },
            );
          },
        });
      },
      addMenuItem: (name: string, spec: MenuItemSpec) => {
        const icon = resolveIcon(spec.icon);
        this.core.ui.registry.addMenuItem(name, {
          text: spec.text ?? name,
          ...(icon ? { icon } : {}),
          onAction: () => spec.onAction?.({}),
        });
      },
      /**
       * A context toolbar: predicate(node) gets the element at the cursor, items are toolbar buttons.
       * position: 'node' (above the element) or 'selection'/'line' (at the selection).
       */
      addContextToolbar: (
        name: string,
        spec: {
          predicate: (node: Element) => boolean;
          items: string;
          position?: string;
          label?: string;
        },
      ) => {
        this.core.ui.registry.addContextToolbar(name, {
          label: spec.label ?? name,
          items: spec.items,
          position: spec.position === 'node' ? 'node' : 'selection',
          predicate: () => {
            const node = this.selection.getNode();
            return !!node && this.getBody().contains(node) && spec.predicate(node);
          },
        });
      },
      /**
       * A sidebar: onSetup(api) draws the content into api.element() (once), onShow/onHide run when it
       * is shown or hidden. A toggle button named after the sidebar is for the toolbar; ToggleSidebar is the command.
       */
      addSidebar: (
        name: string,
        spec: {
          tooltip?: string;
          icon?: string;
          onSetup?: (api: { element(): HTMLElement }) => void | (() => void);
          onShow?: (api: { element(): HTMLElement }) => void;
          onHide?: (api: { element(): HTMLElement }) => void;
        },
      ) => {
        let element: HTMLElement | null = null;
        const api = { element: () => element! };
        const icon = resolveIcon(spec.icon);
        this.core.ui.registry.addSidebar(name, {
          title: spec.tooltip ?? name,
          ...(icon ? { icon } : {}),
          render: (container) => {
            element = container;
            const cleanup = spec.onSetup?.(api);
            return typeof cleanup === 'function' ? cleanup : undefined;
          },
          onShow: () => spec.onShow?.(api),
          onHide: () => spec.onHide?.(api),
        });
      },
      addContextForm: () => {
        console.warn('[nova] tinymce-compat: addContextForm is not supported yet');
      },
      getAll: () => ({}),
    },
  };

  private addButton(name: string, spec: ButtonSpec, toggle: boolean): void {
    const { api, state } = buttonApi(this);
    if (spec.enabled === false) api.setEnabled(false);
    if ((spec as { active?: boolean }).active) api.setActive(true);
    const icon = resolveIcon(spec.icon);
    this.core.ui.registry.addButton(name, {
      tooltip: spec.tooltip ?? spec.text ?? name,
      ...(icon ? { icon } : { text: spec.text ?? name }),
      isEnabled: () => state.enabled,
      ...(toggle ? { isActive: () => state.active } : {}),
      onAction: () => spec.onAction?.(api),
    });
    if (spec.onSetup) {
      // onSetup is called when the button renders; teardown when the editor is removed.
      const run = () => {
        const teardown = spec.onSetup!(api);
        if (typeof teardown === 'function') this.teardowns.push(teardown);
      };
      if (this.initialized) run();
      else this.once('init', run);
    }
  }

  /**
   * editor.dom — what makes sense on top of a document model: finding and reading. The text's DOM
   * can't be changed directly (the editor redraws it from the model); use setContent, insertContent
   * or formatter for edits — such calls log a warning.
   */
  readonly dom = {
    select: (selector: string, scope?: Element): Element[] => [
      ...(scope ?? this.getBody()).querySelectorAll(selector),
    ],
    get: (id: string | Element): Element | null =>
      typeof id === 'string' ? this.getBody().querySelector(`#${CSS.escape(id)}`) : id,
    getParent: (
      node: Node | null,
      selector: string | ((n: Element) => boolean),
    ): Element | null => {
      let current = node instanceof Element ? node : (node?.parentElement ?? null);
      while (current && current !== this.getBody()) {
        if (typeof selector === 'string' ? current.matches(selector) : selector(current))
          return current;
        current = current.parentElement;
      }
      return null;
    },
    getParents: (node: Node | null, selector?: string): Element[] => {
      const result: Element[] = [];
      let current = node instanceof Element ? node : (node?.parentElement ?? null);
      while (current && current !== this.getBody()) {
        if (!selector || current.matches(selector)) result.push(current);
        current = current.parentElement;
      }
      return result;
    },
    is: (node: Element | null, selector: string) => !!node?.matches(selector),
    getAttrib: (node: Element | null, name: string, fallback = '') =>
      node?.getAttribute(name) ?? fallback,
    hasClass: (node: Element | null, name: string) => !!node?.classList.contains(name),
    getStyle: (node: Element | null, name: string) =>
      node instanceof HTMLElement ? node.style.getPropertyValue(name) : '',
    getRoot: () => this.getBody(),
    encode: (text: string) => text.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`),
    decode: (html: string) => {
      const textarea = document.createElement('textarea');
      textarea.innerHTML = html;
      return textarea.value;
    },
    /** A new (not inserted) element: attributes via setAttribute, the content as text. */
    create: (tag: string, attrs: Record<string, string> = {}, text?: string) => {
      const node = document.createElement(tag);
      for (const [name, value] of Object.entries(attrs)) {
        if (!name.startsWith('on')) node.setAttribute(name, value);
      }
      if (text !== undefined) node.textContent = text;
      return node;
    },
    uniqueId: (prefix = 'mce_') => `${prefix}${Math.random().toString(36).slice(2, 10)}`,
    setAttrib: () => warnDom('setAttrib'),
    addClass: () => warnDom('addClass'),
    removeClass: () => warnDom('removeClass'),
    setStyle: () => warnDom('setStyle'),
    remove: () => warnDom('remove'),
  };

  /**
   * editor.formatter — the built-in TinyMCE formats: apply/remove/toggle/match. Your own formats
   * (register) are not supported yet.
   */
  readonly formatter = {
    apply: (name: string, vars: { value?: string } = {}) => this.applyFormat(name, vars, 'apply'),
    remove: (name: string) => this.applyFormat(name, {}, 'remove'),
    toggle: (name: string, vars: { value?: string } = {}) =>
      this.applyFormat(name, vars, this.formatter.match(name) ? 'remove' : 'apply'),
    match: (name: string): boolean => {
      // Custom formats (formats, formatter.register) use the core's format engine.
      if (this.core.formatter.has(name)) return this.core.formatter.match(name);
      const key = name.toLowerCase();
      // A block (p, h1…h6, blockquote, pre) by the document model: the block where the selection starts.
      if (TAG_FORMATS.has(key)) return this.blockMatches(key);
      const command = FORMAT_COMMANDS[key];
      if (command) return this.core.isActive(command);
      const style = STYLE_FORMATS[key];
      if (!style) return false;
      const { state } = this.core.view;
      const { from, to, empty } = state.selection;
      const type = state.schema.marks[style];
      // With a selection: whether the format is in the selected text; without one, at the cursor.
      return empty || !type
        ? getStyle(state, style) !== null
        : state.doc.rangeHasMark(from, to, type);
    },
    canApply: (name: string) =>
      this.core.formatter.has(name) ||
      name.toLowerCase() in FORMAT_COMMANDS ||
      name.toLowerCase() in STYLE_FORMATS,
    register: (name: string | Record<string, unknown>, spec?: unknown) => {
      // register('name', spec) or register({ name: spec, … }).
      const entries = typeof name === 'string' ? [[name, spec] as const] : Object.entries(name);
      for (const [key, value] of entries) {
        const specs = toFormatSpecs(value);
        if (specs.length) this.core.formatter.register(key, specs);
        else console.warn(`[nova] tinymce-compat: format "${key}" is not supported yet`);
      }
    },
    unregister: (name: string) => this.core.formatter.unregister(name),
    get: (name: string) => this.core.formatter.get(name),
  };

  private blockMatches(key: string): boolean {
    const { $from } = this.core.view.state.selection;
    for (let depth = $from.depth; depth > 0; depth -= 1) {
      const node = $from.node(depth);
      const name = node.type.name;
      if (key === 'blockquote' && name === 'blockquote') return true;
      if (depth !== $from.depth) continue;
      if (key === 'p') return name === 'paragraph';
      if (key === 'pre') return name === 'code_block';
      if (/^h[1-6]$/.test(key)) return name === 'heading' && node.attrs.level === Number(key[1]);
    }
    // Everything is selected (the cursor before the first block): look at the first text block.
    let first: { name: string; level: unknown } | null = null;
    this.core.view.state.doc.descendants((node) => {
      if (first || !node.isTextblock) return !first;
      first = { name: node.type.name, level: node.attrs.level };
      return false;
    });
    if (!$from.depth && first) {
      const block = first as { name: string; level: unknown };
      if (key === 'p') return block.name === 'paragraph';
      if (key === 'pre') return block.name === 'code_block';
      if (/^h[1-6]$/.test(key)) return block.name === 'heading' && block.level === Number(key[1]);
    }
    return false;
  }

  private applyFormat(name: string, vars: { value?: string }, action: 'apply' | 'remove'): void {
    if (this.core.formatter.has(name)) {
      if (action === 'apply') this.core.formatter.apply(name);
      else this.core.formatter.remove(name);
      return;
    }
    const key = name.toLowerCase();
    const command = FORMAT_COMMANDS[key];
    if (command) {
      const active = this.formatter.match(key);
      // Blocks (h1…) are applied, and applying again doesn't "turn them off". Marks toggle.
      if (BLOCK_FORMATS.has(key)) {
        if (action === 'apply') this.core.exec(command);
        else if (active) this.core.exec('paragraph');
      } else if ((action === 'apply') !== active) {
        this.core.exec(command);
      }
      return;
    }
    const style = STYLE_FORMATS[key];
    if (style) {
      this.core.exec(setStyle(style, action === 'apply' ? (vars.value ?? null) : null));
      return;
    }
    console.warn(`[nova] tinymce-compat: format "${name}" is not supported yet`);
  }

  /** Remove the editor and restore the original element (like editor.remove()). */
  remove(): void {
    if (this.removed) return;
    this.fire('remove');
    this.save();
    this.teardowns.splice(0).forEach((teardown) => teardown());
    this.removed = true;
    this.core.destroy();
    this.core.root.remove();
    const wrapper = this.settings.__wrapper as HTMLElement | undefined;
    wrapper?.remove();
    this.targetElm.hidden = false;
    this.off();
  }

  destroy(): void {
    this.remove();
  }
}
