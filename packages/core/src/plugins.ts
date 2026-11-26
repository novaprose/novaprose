import type { MarkSpec, NodeSpec } from 'prosemirror-model';
import type { Command, EditorState, Plugin as PMPlugin, Transaction } from 'prosemirror-state';
import type { CommandName } from './commands';
import type { Editor } from './editor';

/**
 * Плагин NovaProse. Встроенные и сторонние плагины используют один и тот же API.
 *
 * ```ts
 * export default definePlugin({
 *   name: 'signature',
 *   setup(editor) {
 *     editor.ui.registry.addButton('signature', { text: 'Подпись', tooltip: '…', onAction: … });
 *   },
 * });
 * ```
 */
export interface NovaPlugin {
  /** Уникальное имя; по нему плагин указывается в конфиге и в requires других плагинов. */
  name: string;
  /** Плагины, которые должны быть подключены раньше. */
  requires?: string[];
  /** Регистрация кнопок, команд, автокомплитеров. Может вернуть функцию очистки (при destroy). */
  setup?: (editor: Editor) => void | (() => void);
  /**
   * Кнопки, которые добавляются в конец тулбара по умолчанию ('insertdatetime').
   * Если пользователь задал свой toolbar — не добавляются: его конфиг главнее.
   */
  toolbar?: string;
  /** ProseMirror-плагины (ввод, декорации, клавиши). */
  prosemirrorPlugins?: (editor: Editor) => PMPlugin[];
  /**
   * Новые узлы документа (с parseDOM и toDOM). Расширяют схему конкретного редактора.
   * Плагин с узлами или марками передаётся объектом, не ленивым загрузчиком: схема создаётся сразу.
   * Функция получает редактор до его создания — читать только `editor.options`; на сервере
   * (createRenderer) ей передаются только настройки.
   */
  nodes?: Record<string, NodeSpec> | ((editor: Editor) => Record<string, NodeSpec>);
  /** Новые марки (инлайн-форматирование) с parseDOM и toDOM. */
  marks?: Record<string, MarkSpec>;
  /**
   * Переопределение именованных команд (кнопки, меню, горячие клавиши и editor.exec берут их отсюда).
   * Например, совместное редактирование заменяет undo/redo своими — «отменить только свои правки».
   */
  commands?: Partial<Record<CommandName, Command>>;
  /** Плагин ведёт свою историю изменений — встроенная (prosemirror-history) не подключается. */
  replaceHistory?: boolean;
  /**
   * Переписать транзакцию до применения (режим правок превращает удаление в пометку «удалено»).
   * Вызывается для каждой транзакции редактора; вернуть ту же, если менять нечего.
   */
  transformTransaction?: (tr: Transaction, state: EditorState, editor: Editor) => Transaction;
  /**
   * Ленивая часть плагина с узлами: интерфейс, команды, представления узлов, клавиши. Схема
   * создаётся сразу, поэтому узлы — в самом плагине (первая загрузка), а остальное — отдельным
   * чанком после создания редактора (входит в `editor.ready`). Часть — обычный плагин без узлов.
   */
  load?: Loader;
}

type Loader = () => Promise<NovaPlugin | { default: NovaPlugin }>;

/** Элемент конфига plugins: объект, имя из реестра или ленивый загрузчик. */
export type PluginEntry = NovaPlugin | string | Loader;

/** Помощник для типизации определения плагина. */
export function definePlugin(plugin: NovaPlugin): NovaPlugin {
  return plugin;
}

// ---------- глобальный реестр (аналог PluginManager.add) ----------

const registry = new Map<string, NovaPlugin | Loader>();

/** Зарегистрировать плагин (или его ленивый загрузчик) под именем — для `plugins: ['имя']`. */
export function registerPlugin(name: string, plugin: NovaPlugin | Loader): void {
  registry.set(name, plugin);
}

export function isPluginRegistered(name: string): boolean {
  return registry.has(name);
}

// ---------- разрешение конфига ----------

export interface ResolvedPlugins {
  /** Синхронные плагины в порядке зависимостей. */
  plugins: NovaPlugin[];
  /** Ленивые загрузчики (грузятся после создания редактора). */
  loaders: Loader[];
  errors: string[];
}

function isLoader(entry: unknown): entry is Loader {
  return typeof entry === 'function';
}

/** Превращает конфиг в список: имена — из реестра, загрузчики — отдельно. */
export function resolveEntries(entries: PluginEntry[]): ResolvedPlugins {
  const plugins: NovaPlugin[] = [];
  const loaders: Loader[] = [];
  const errors: string[] = [];
  for (const entry of entries) {
    if (typeof entry === 'string') {
      const found = registry.get(entry);
      if (!found) errors.push(`Plugin "${entry}" is not registered`);
      else if (isLoader(found)) loaders.push(found);
      else plugins.push(found);
    } else if (isLoader(entry)) {
      loaders.push(entry);
    } else {
      plugins.push(entry);
    }
  }
  return { plugins, loaders, errors };
}

/**
 * Упорядочить по зависимостям (топологическая сортировка).
 * Плагин с отсутствующей или циклической зависимостью исключается, остальные работают.
 * available — имена уже подключённых плагинов (для догружаемых).
 */
export function orderPlugins(
  plugins: NovaPlugin[],
  available: Set<string> = new Set(),
): { ordered: NovaPlugin[]; errors: string[] } {
  const byName = new Map(plugins.map((p) => [p.name, p]));
  const ordered: NovaPlugin[] = [];
  const errors: string[] = [];
  const state = new Map<string, 'visiting' | 'done' | 'failed'>();

  const visit = (plugin: NovaPlugin, path: string[]): boolean => {
    const s = state.get(plugin.name);
    if (s === 'done') return true;
    if (s === 'failed') return false;
    if (s === 'visiting') {
      errors.push(`Plugin dependency cycle: ${[...path, plugin.name].join(' → ')}`);
      return false;
    }
    state.set(plugin.name, 'visiting');
    for (const dep of plugin.requires ?? []) {
      if (available.has(dep)) continue;
      const depPlugin = byName.get(dep);
      if (!depPlugin) {
        errors.push(`Plugin "${plugin.name}" requires "${dep}", which is not loaded`);
        state.set(plugin.name, 'failed');
        return false;
      }
      if (!visit(depPlugin, [...path, plugin.name])) {
        state.set(plugin.name, 'failed');
        return false;
      }
    }
    state.set(plugin.name, 'done');
    ordered.push(plugin);
    return true;
  };

  for (const plugin of plugins) visit(plugin, []);
  return { ordered, errors };
}

export async function loadPlugin(loader: Loader): Promise<NovaPlugin> {
  const mod = await loader();
  return 'default' in mod && mod.default ? mod.default : (mod as NovaPlugin);
}
