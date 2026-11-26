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
import { openSpecDialog, type DialogApi, type DialogSpec } from './dialog';
import { AllSelection, NodeSelection, TextSelection } from 'prosemirror-state';

const serializer = new HTMLSerializer();

/**
 * Обёртка над редактором NovaProse с API редактора TinyMCE (по публичной документации): методы,
 * события и реестр кнопок, которыми пользуются существующие интеграции. Всё делается через публичный
 * API `Editor` — ProseMirror напрямую не трогаем (кроме вставки HTML через view.pasteHTML).
 */

type Handler = (event: Record<string, unknown>) => unknown;

/** execCommand → именованная команда NovaProse (имена команд TinyMCE — без учёта регистра). */
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

/** Команды раскрывающихся блоков (плагин accordion), как в документации TinyMCE. */
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

/** Имена иконок TinyMCE → иконки NovaProse (остальные — текстом или через addIcon). */
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

/** Встроенные форматы TinyMCE → команды NovaProse. */
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

/** SVG, добавленные через editor.ui.registry.addIcon (общие для страницы, как в TinyMCE). */
const customIcons = new Map<string, string>();

function resolveIcon(name: unknown): string | undefined {
  if (typeof name !== 'string' || !name) return undefined;
  if (customIcons.has(name)) return customIcons.get(name);
  const own = ICON_NAMES[name] ?? (name in icons ? (name as keyof typeof icons) : undefined);
  return own ? icons[own] : undefined;
}

/** Состояние кнопки для onAction/onSetup (api.isActive, setActive, isEnabled, setEnabled). */
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
      // Совместимость со старыми версиями API.
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
  }

  // ---------- содержимое ----------

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
   * Вставить HTML на место выделения. Блоки (<p>, списки, таблицы) — отдельными блоками (абзац
   * разрезается), строчное содержимое — в текущую строку. Разбор — схемой редактора: те же проверки
   * ссылок и разметки, что при загрузке содержимого.
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

  // ---------- команды ----------

  /** Значение команды: ToggleSidebar — имя открытой боковой панели. */
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
      // Боковая панель из ui.registry.addSidebar (value — её имя).
      void this.core.ui.sidebar.toggle(String(value ?? ''));
      done = true;
    } else if (name === 'mcesetcontent') {
      this.setContent(String(value ?? ''));
      done = true;
    } else if (ACCORDION_COMMANDS.has(name)) {
      done = this.accordionCommand(name, value);
    } else if (name === 'codesample') {
      // Диалог «Пример кода» (плагин codesample) — как нажатие его кнопки.
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
   * InsertAccordion / RemoveAccordion — как кнопка accordion (в блоке — снять рамку, иначе вставить);
   * ToggleAccordion / ToggleAllAccordions — value true раскрывает, false сворачивает, без value —
   * переключает. Сворачивание — вид, а не правка: в историю отмены не попадает.
   */
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

  queryCommandState(command: string): boolean {
    const name = COMMANDS[command.toLowerCase()];
    return name ? this.core.isActive(name) : false;
  }

  queryCommandSupported(command: string): boolean {
    const name = command.toLowerCase();
    return (
      name in COMMANDS ||
      ['formatblock', 'mceinsertcontent', 'mcesetcontent'].includes(name) ||
      this.commands.has(name)
    );
  }

  private readonly commands = new Map<string, (ui?: boolean, value?: unknown) => void>();

  addCommand(name: string, callback: (ui?: boolean, value?: unknown) => void): void {
    this.commands.set(name.toLowerCase(), callback);
  }

  // ---------- события ----------

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

  /** DOM-событие текста (keydown, click…) — обработчикам передаётся само событие браузера. */
  fireNative(name: string, event: Event): void {
    for (const handler of [...(this.handlers.get(name) ?? [])]) {
      try {
        handler(event as unknown as Record<string, unknown>);
      } catch (error) {
        console.error(`[nova] tinymce-compat: "${name}" handler failed`, error);
      }
    }
  }

  /** Иконка для кнопок по имени (tinymce.IconManager / editor.ui.registry.addIcon). */
  static registerIcon(name: string, svg: string): void {
    customIcons.set(name, svg);
  }

  /** Новое имя fire в последних версиях API. */
  dispatch(name: string, event?: Record<string, unknown>): Record<string, unknown> {
    return this.fire(name, event);
  }

  hasEventListeners(name: string): boolean {
    return (this.handlers.get(name.toLowerCase())?.size ?? 0) > 0;
  }

  // ---------- состояние ----------

  isDirty(): boolean {
    return this.dirty;
  }

  setDirty(state: boolean): void {
    const changed = this.dirty !== state;
    this.dirty = state;
    if (changed && state) this.fire('Dirty');
  }

  /** Записать содержимое в исходный <textarea> (как при отправке формы). */
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
    // В новых DOM-типах hidden может быть «until-found».
    return this.core.root.hidden === true;
  }

  getParam(name: string, defaultValue?: unknown): unknown {
    return name in this.settings ? this.settings[name] : defaultValue;
  }

  readonly options = {
    get: (name: string) => this.settings[name],
    set: (name: string, value: unknown) => {
      this.settings[name] = value;
      // Опции, которые по документации TinyMCE меняются на лету.
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
    /** Курсор в узел DOM редактора (по умолчанию — в начало). */
    setCursorLocation: (node?: Node, offset = 0) => {
      const { view } = this.core;
      if (!node || !view.dom.contains(node)) return;
      const pos = view.posAtDOM(node, offset);
      view.dispatch(view.state.tr.setSelection(TextSelection.near(view.state.doc.resolve(pos))));
    },
    /** Выделить элемент: content = true — только его содержимое. */
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
      openSpecDialog(this.core, spec, (next) => this.windowManager.open(next)),
  };

  /** editor.ui.registry — кнопки и пункты меню в формате TinyMCE поверх реестра NovaProse. */
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
       * Контекстная панель: predicate(node) получает элемент под курсором, items — кнопки тулбара.
       * position: 'node' (над элементом) или 'selection'/'line' (у выделения).
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
       * Боковая панель: onSetup(api) рисует содержимое в api.element() (один раз), onShow/onHide —
       * при показе. Кнопка-переключатель с именем панели — для toolbar; ToggleSidebar — командой.
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
      // onSetup вызывается при отрисовке кнопки; teardown — при удалении редактора.
      const run = () => {
        const teardown = spec.onSetup!(api);
        if (typeof teardown === 'function') this.teardowns.push(teardown);
      };
      if (this.initialized) run();
      else this.once('init', run);
    }
  }

  /**
   * editor.dom — то, что имеет смысл поверх модели документа: поиск и чтение. Менять DOM текста
   * напрямую нельзя (редактор перерисует его из модели) — для правок есть setContent/insertContent/
   * formatter; такие вызовы пишут предупреждение.
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
    /** Новый (не вставленный) элемент: атрибуты — через setAttribute, содержимое — текстом. */
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
   * editor.formatter — встроенные форматы TinyMCE: apply/remove/toggle/match.
   * Свои форматы (register) пока не поддержаны.
   */
  readonly formatter = {
    apply: (name: string, vars: { value?: string } = {}) => this.applyFormat(name, vars, 'apply'),
    remove: (name: string) => this.applyFormat(name, {}, 'remove'),
    toggle: (name: string, vars: { value?: string } = {}) =>
      this.applyFormat(name, vars, this.formatter.match(name) ? 'remove' : 'apply'),
    match: (name: string): boolean => {
      // Свои форматы (formats, formatter.register) — формат-движок ядра.
      if (this.core.formatter.has(name)) return this.core.formatter.match(name);
      const key = name.toLowerCase();
      // Блок (p, h1…h6, blockquote, pre) — по модели документа: блок, где начинается выделение.
      if (TAG_FORMATS.has(key)) return this.blockMatches(key);
      const command = FORMAT_COMMANDS[key];
      if (command) return this.core.isActive(command);
      const style = STYLE_FORMATS[key];
      if (!style) return false;
      const { state } = this.core.view;
      const { from, to, empty } = state.selection;
      const type = state.schema.marks[style];
      // С выделением — есть ли формат в выделенном; без — у курсора.
      return empty || !type
        ? getStyle(state, style) !== null
        : state.doc.rangeHasMark(from, to, type);
    },
    canApply: (name: string) =>
      this.core.formatter.has(name) ||
      name.toLowerCase() in FORMAT_COMMANDS ||
      name.toLowerCase() in STYLE_FORMATS,
    register: (name: string | Record<string, unknown>, spec?: unknown) => {
      // register('name', spec) или register({ name: spec, … }).
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
    // Выделено всё (курсор перед первым блоком) — смотрим первый текстовый блок.
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
      // Блоки (h1…) — применяются; повторное применение не «выключает». Марки — переключаются.
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

  /** Убрать редактор и вернуть исходный элемент (как editor.remove()). */
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
