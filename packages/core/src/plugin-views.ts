/**
 * ProseMirror plugin views that survive a rebuild of the plugin set.
 *
 * The editor loads parts lazily (table mechanics, plugins by name) and attaches them through
 * `state.reconfigure`. On any change of the plugin set, ProseMirror destroys the views of ALL
 * plugins and creates them again: an open autocomplete list closed, collaboration sync
 * redrew the document, y-prosemirror undo lost its history. Here a view
 * is created once per editor: on a rebuild done by the editor itself
 * (`reconfigurePlugins`) it is kept and keeps receiving updates, and it is destroyed when
 * the editor closes or its plugin is removed from the set.
 */
import type { Plugin, PluginView } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';

const reconfiguring = new WeakSet<EditorView>();
const kept = new WeakMap<EditorView, Map<Plugin, PluginView>>();
const wrapped = new WeakSet<Plugin>();

/** Prepares the plugins: their views will survive `reconfigurePlugins`. */
export function keepPluginViews(plugins: readonly Plugin[]): void {
  for (const plugin of plugins) {
    const spec = plugin.spec;
    const create = spec.view;
    if (!create || wrapped.has(plugin)) continue;
    wrapped.add(plugin);
    spec.view = (view) => {
      let views = kept.get(view);
      if (!views) kept.set(view, (views = new Map()));
      let inner = views.get(plugin);
      if (!inner) views.set(plugin, (inner = create(view)));
      const current = inner;
      return {
        update: (v, prev) => current.update?.(v, prev),
        destroy: () => {
          if (reconfiguring.has(view)) return;
          views.delete(plugin);
          current.destroy?.();
        },
      };
    };
  }
}

/** Changes the plugin set, keeping the views of the plugins that stay. */
export function reconfigurePlugins(view: EditorView, plugins: Plugin[]): void {
  keepPluginViews(plugins);
  reconfiguring.add(view);
  try {
    view.updateState(view.state.reconfigure({ plugins }));
  } finally {
    reconfiguring.delete(view);
  }
  // The plugin was removed from the set: its view isn't needed anymore.
  const views = kept.get(view);
  if (!views) return;
  for (const [plugin, inner] of views) {
    if (!plugins.includes(plugin)) {
      views.delete(plugin);
      inner.destroy?.();
    }
  }
}
