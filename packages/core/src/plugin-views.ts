/**
 * Представления плагинов ProseMirror, переживающие перестройку набора плагинов.
 *
 * Редактор догружает части лениво (механика таблиц, плагины по имени) и подключает их через
 * `state.reconfigure`. ProseMirror при любой смене набора плагинов уничтожает представления ВСЕХ
 * плагинов и создаёт заново — открытый список автодополнения закрывался, синхронизация совместного
 * редактирования перерисовывала документ, отмена y-prosemirror теряла историю. Здесь представление
 * создаётся один раз на редактор: при перестройке, которую делает сам редактор
 * (`reconfigurePlugins`), оно сохраняется и продолжает получать обновления, а уничтожается при
 * закрытии редактора или когда его плагин убран из набора.
 */
import type { Plugin, PluginView } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';

const reconfiguring = new WeakSet<EditorView>();
const kept = new WeakMap<EditorView, Map<Plugin, PluginView>>();
const wrapped = new WeakSet<Plugin>();

/** Подготовить плагины: их представления будут переживать `reconfigurePlugins`. */
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

/** Сменить набор плагинов, сохранив представления оставшихся. */
export function reconfigurePlugins(view: EditorView, plugins: Plugin[]): void {
  keepPluginViews(plugins);
  reconfiguring.add(view);
  try {
    view.updateState(view.state.reconfigure({ plugins }));
  } finally {
    reconfiguring.delete(view);
  }
  // Плагин убран из набора — его представление больше не нужно.
  const views = kept.get(view);
  if (!views) return;
  for (const [plugin, inner] of views) {
    if (!plugins.includes(plugin)) {
      views.delete(plugin);
      inner.destroy?.();
    }
  }
}
