import type { MarkSpec, NodeSpec } from 'prosemirror-model';
import type { Command, EditorState, Plugin as PMPlugin, Transaction } from 'prosemirror-state';
import type { CommandName } from './commands';
import type { Editor } from './editor';
import type { NodeViewFactory } from './node-view';

/**
 * A NovaProse plugin. Built-in and third-party plugins use the same API.
 *
 * ```ts
 * export default definePlugin({
 *   name: 'signature',
 *   setup(editor) {
 *     editor.ui.registry.addButton('signature', { text: 'Signature', tooltip: '…', onAction: … });
 *   },
 * });
 * ```
 */
export interface NovaPlugin {
  /** A unique name: the plugin is listed under it in the configuration and in `requires` of other plugins. */
  name: string;
  /** Plugins that must be set up first. */
  requires?: string[];
  /** Register buttons, commands, autocompleters. May return a cleanup function (called on destroy). */
  setup?: (editor: Editor) => void | (() => void);
  /**
   * Buttons appended to the end of the default toolbar ('insertdatetime'). Not added when the user
   * set their own toolbar: their configuration wins.
   */
  toolbar?: string;
  /** ProseMirror plugins (input handling, decorations, keys). */
  prosemirrorPlugins?: (editor: Editor) => PMPlugin[];
  /**
   * New document nodes (with parseDOM and toDOM); they extend this editor's schema. A plugin with
   * nodes or marks is passed as an object, not a lazy loader: the schema is created right away.
   * The function gets the editor before it is created — read only `editor.options`; on the server
   * (createRenderer) it gets just the options.
   */
  nodes?: Record<string, NodeSpec> | ((editor: Editor) => Record<string, NodeSpec>);
  /** New marks (inline formatting) with parseDOM and toDOM. */
  marks?: Record<string, MarkSpec>;
  /**
   * Your own way to draw nodes in the editor: `{ callout: reactNodeView(Callout) }`, `vueNodeView(…)`
   * or `defineNodeView(…)`. Doesn't affect the HTML (that comes from toDOM). Views belong in the plugin
   * itself, not in its lazy part: adding them later would redraw the whole document.
   */
  nodeViews?: Record<string, NodeViewFactory>;
  /**
   * Override named commands (buttons, menus, shortcuts and editor.exec take them from here). For
   * example, collaboration replaces undo/redo with its own, which undo only your own changes.
   */
  commands?: Partial<Record<CommandName, Command>>;
  /** The plugin keeps its own history: the built-in one (prosemirror-history) is not added. */
  replaceHistory?: boolean;
  /**
   * Rewrite a transaction before it is applied (suggesting mode turns a deletion into a "deleted"
   * mark). Called for every transaction of the editor; return the same one when there is nothing to change.
   */
  transformTransaction?: (tr: Transaction, state: EditorState, editor: Editor) => Transaction;
  /**
   * The lazy part of a plugin with nodes: buttons, dialogs, commands, keys. The schema is created
   * right away, so the nodes and everything that draws them (nodeViews) stay in the plugin itself
   * (first load), and the rest is a separate chunk loaded after the editor is created (part of
   * `editor.ready`). The part is an ordinary plugin without nodes.
   */
  load?: Loader;
}

type Loader = () => Promise<NovaPlugin | { default: NovaPlugin }>;

/** An entry of the plugins option: an object, a registered name or a lazy loader. */
export type PluginEntry = NovaPlugin | string | Loader;

/** A helper for typing a plugin definition. */
export function definePlugin(plugin: NovaPlugin): NovaPlugin {
  return plugin;
}

// ---------- the global registry (like PluginManager.add) ----------

const registry = new Map<string, NovaPlugin | Loader>();

/** Register a plugin (or its lazy loader) under a name, for `plugins: ['name']`. */
export function registerPlugin(name: string, plugin: NovaPlugin | Loader): void {
  registry.set(name, plugin);
}

export function isPluginRegistered(name: string): boolean {
  return registry.has(name);
}

// ---------- resolving the config ----------

export interface ResolvedPlugins {
  /** Synchronous plugins in dependency order. */
  plugins: NovaPlugin[];
  /** Lazy loaders (they load after the editor is created). */
  loaders: Loader[];
  errors: string[];
}

function isLoader(entry: unknown): entry is Loader {
  return typeof entry === 'function';
}

/** Turns the config into a list: names from the registry, loaders separately. */
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
 * Orders by dependencies (a topological sort).
 * A plugin with a missing or circular dependency is excluded, the others work.
 * available are the names of already attached plugins (for those loaded later).
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
