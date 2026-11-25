import { createEditor } from '@novaprose/core';
import { CompatEditor } from './editor';
import { mapOptions, type TinyConfig } from './options';

/**
 * Слой совместимости с API `tinymce` для перехода на NovaProse без переписывания интеграции:
 *
 * ```js
 * import { tinymce } from '@novaprose/tinymce-compat';
 * tinymce.init({ selector: 'textarea', plugins: 'lists link image', toolbar: 'undo redo | bold italic' });
 * ```
 *
 * Или тегом <script> (CDN-сборка задаёт window.tinymce и подключает стили сама).
 * Поведение — по публичной документации TinyMCE; код TinyMCE не используется.
 */

type PluginFn = (editor: CompatEditor, url: string) => unknown;

export interface TinyMCECompat {
  /** Версия API, под которую написана совместимость (некоторые интеграции проверяют её). */
  readonly majorVersion: string;
  readonly minorVersion: string;
  /** Признак: это NovaProse. */
  readonly novaprose: true;
  readonly activeEditor: CompatEditor | null;
  readonly editors: CompatEditor[];
  init(config: TinyConfig): Promise<CompatEditor[]>;
  get(): CompatEditor[];
  get(id: string | number): CompatEditor | null;
  remove(selector?: string | CompatEditor): void;
  triggerSave(): void;
  execCommand(command: string, ui?: boolean, value?: unknown): boolean;
  readonly PluginManager: {
    add(name: string, plugin: PluginFn): void;
    get(name: string): PluginFn | undefined;
    requireLangPack(): void;
    urls: Record<string, string>;
  };
  readonly IconManager: { add(name: string, pack: { icons: Record<string, string> }): void };
  readonly util: { I18n: { translate(text: string): string } };
}

const warned = new Set<string>();
function warnOnce(message: string): void {
  if (warned.has(message)) return;
  warned.add(message);
  console.warn(`[nova] tinymce-compat: ${message}`);
}

/** Номер для id редакторов без собственного id (mce_1, mce_2…). */
let counter = 0;

const px = (value: unknown) => (typeof value === 'number' ? `${value}px` : String(value));

export function createTinymce(): TinyMCECompat {
  const all: CompatEditor[] = [];
  const plugins = new Map<string, PluginFn>();
  let active: CompatEditor | null = null;

  async function initOne(target: HTMLElement, config: TinyConfig): Promise<CompatEditor> {
    const existing = all.find((e) => e.targetElm === target && !e.removed);
    if (existing) return existing;

    const { options, unknown, missingPlugins } = mapOptions(config);
    if (unknown.length) warnOnce(`options not supported yet: ${unknown.join(', ')}`);
    const custom = String(
      Array.isArray(config.plugins) ? config.plugins.join(' ') : (config.plugins ?? ''),
    )
      .split(/[\s,]+/)
      .filter((name) => plugins.has(name));
    const missing = missingPlugins.filter((name) => !plugins.has(name));
    if (missing.length) warnOnce(`plugins not available: ${missing.join(', ')}`);

    const id = target.id || `mce_${++counter}`;
    if (!target.id) target.id = id;
    const isTextarea = target instanceof HTMLTextAreaElement;
    const initial = isTextarea ? target.value : target.innerHTML;
    const settings: Record<string, unknown> = { ...config, __initialContent: initial };

    let host: HTMLElement;
    if (config.inline === true && !isTextarea) {
      target.replaceChildren();
      host = target;
    } else {
      host = document.createElement('div');
      host.className = 'nova-compat';
      target.after(host);
      target.hidden = true;
      settings.__wrapper = host;
    }

    let compat!: CompatEditor;
    const core = createEditor({
      ...options,
      element: host,
      content: initial,
      setup: (editor) => {
        compat = new CompatEditor(editor, target, id, settings);
        // Плагины, добавленные через tinymce.PluginManager.add, — как в TinyMCE: (editor, url).
        for (const name of custom) {
          try {
            plugins.get(name)!(compat, '');
          } catch (error) {
            console.error(`[nova] tinymce-compat: plugin "${name}" failed`, error);
          }
        }
        (config.setup as ((e: CompatEditor) => void) | undefined)?.(compat);
      },
    });

    if (config.height !== undefined) core.root.style.height = px(config.height);
    if (config.min_height !== undefined) core.root.style.minHeight = px(config.min_height);
    if (config.max_height !== undefined) core.root.style.maxHeight = px(config.max_height);
    if (config.width !== undefined) core.root.style.width = px(config.width);

    // События: изменения, выделение, фокус и клавиатура — с именами из API TinyMCE.
    let changedSinceFocus = false;
    core.on('change', () => {
      compat.setDirty(true);
      changedSinceFocus = true;
      compat.fire('input');
    });
    core.on('selectionChange', () => {
      compat.fire('NodeChange', { element: compat.selection.getNode(), selectionChange: true });
    });
    core.on('focus', () => {
      active = compat;
      changedSinceFocus = false;
      compat.fire('focus');
    });
    core.on('blur', () => {
      if (changedSinceFocus) compat.fire('change', { level: { content: compat.getContent() } });
      changedSinceFocus = false;
      compat.fire('blur');
    });
    for (const name of [
      'keydown',
      'keyup',
      'keypress',
      'click',
      'dblclick',
      'mousedown',
      'mouseup',
      'paste',
      'copy',
      'cut',
      'drop',
    ]) {
      core.view.dom.addEventListener(name, (event) => compat.fireNative(name, event));
    }
    // Отправка формы — содержимое в <textarea>, как делает TinyMCE.
    const form = isTextarea ? target.form : target.closest('form');
    form?.addEventListener('submit', () => compat.save());
    compat.on('remove', () => {
      const index = all.indexOf(compat);
      if (index >= 0) all.splice(index, 1);
      if (active === compat) active = all[0] ?? null;
    });

    all.push(compat);
    active ??= compat;
    await core.ready;
    if (compat.removed) return compat;
    compat.initialized = true;
    compat.fire('init');
    (config.init_instance_callback as ((e: CompatEditor) => void) | undefined)?.(compat);
    return compat;
  }

  const api: TinyMCECompat = {
    majorVersion: '7',
    minorVersion: '0.0',
    novaprose: true,
    get activeEditor() {
      return active;
    },
    get editors() {
      return [...all];
    },
    async init(config) {
      // init часто вызывают в <head>: элементов ещё нет — ждём разбора документа, как TinyMCE.
      if (document.readyState === 'loading') {
        await new Promise((resolve) =>
          document.addEventListener('DOMContentLoaded', resolve, { once: true }),
        );
      }
      const targets: HTMLElement[] = config.target
        ? [config.target]
        : config.selector
          ? [...document.querySelectorAll<HTMLElement>(config.selector)]
          : [];
      if (!targets.length) warnOnce(`no elements match "${config.selector ?? ''}"`);
      const editors: CompatEditor[] = [];
      for (const target of targets) editors.push(await initOne(target, config));
      return editors;
    },
    get: ((id?: string | number) => {
      if (id === undefined) return [...all];
      if (typeof id === 'number') return all[id] ?? null;
      return all.find((e) => e.id === id) ?? null;
    }) as TinyMCECompat['get'],
    remove(selector) {
      const targets =
        selector === undefined
          ? [...all]
          : typeof selector === 'string'
            ? all.filter(
                (e) => e.id === selector.replace(/^#/, '') || e.targetElm.matches(selector),
              )
            : [selector];
      targets.forEach((editor) => editor.remove());
    },
    triggerSave() {
      all.forEach((editor) => editor.save());
    },
    execCommand(command, ui, value) {
      return active?.execCommand(command, ui, value) ?? false;
    },
    PluginManager: {
      add: (name, plugin) => {
        plugins.set(name, plugin);
      },
      get: (name) => plugins.get(name),
      requireLangPack: () => {},
      urls: {},
    },
    IconManager: {
      add: (_name, pack) => {
        for (const [icon, svg] of Object.entries(pack.icons ?? {})) {
          CompatEditor.registerIcon(icon, svg);
        }
      },
    },
    util: { I18n: { translate: (text) => text } },
  };
  return api;
}

/** Общий объект `tinymce` для модулей (CDN-сборка кладёт его в window.tinymce). */
export const tinymce = createTinymce();

export { CompatEditor };
export { mapOptions, type TinyConfig } from './options';
