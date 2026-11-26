import { icons } from '../ui/icons';
import { definePlugin } from '../plugins';
import { pickLabels } from './shared';

/**
 * Плагин autosave: черновик в localStorage браузера, чтобы текст не пропал при закрытой вкладке,
 * перезагрузке или сбое. Если при открытии найден черновик, отличный от текущего содержимого,
 * появляется уведомление, а кнопка «Восстановить черновик» (restoredraft) становится активной.
 *
 * `plugins: ['autosave']`, настройки — `pluginOptions.autosave`:
 * - key — ключ хранилища (по умолчанию адрес страницы + id элемента);
 * - delay — задержка сохранения после изменения, мс (1000);
 * - retention — сколько хранить черновик, минут (7 дней).
 */

export interface AutosaveOptions {
  key?: string;
  delay?: number;
  retention?: number;
}

interface Draft {
  html: string;
  time: number;
}

const ICON = icons.save;

export const LABELS = {
  en: {
    restore: 'Restore last draft',
    found: 'An unsaved draft was found. Use “Restore last draft” to bring it back.',
    restored: 'Draft restored',
  },
};

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    // Доступ к localStorage запрещён (приватный режим, политика браузера) — работаем без черновиков.
    return null;
  }
}

export default definePlugin({
  name: 'autosave',
  toolbar: 'restoredraft',
  setup(editor) {
    const options = (editor.options.pluginOptions?.autosave ?? {}) as AutosaveOptions;
    const labels = pickLabels(editor, 'autosave', LABELS);
    const store = storage();
    const key =
      options.key ??
      `novaprose-draft:${typeof location === 'undefined' ? '' : location.pathname}:${editor.options.element.id || 'editor'}`;
    const delay = options.delay ?? 1000;
    const retentionMs = (options.retention ?? 7 * 24 * 60) * 60_000;

    const read = (): Draft | null => {
      try {
        const draft = JSON.parse(store?.getItem(key) ?? 'null') as Draft | null;
        if (!draft || typeof draft.html !== 'string' || Date.now() - draft.time > retentionMs)
          return null;
        return draft;
      } catch {
        return null;
      }
    };

    // Черновик с прошлого раза запоминаем до первого сохранения нового.
    let pending = read();
    if (pending && pending.html === editor.getHTML()) pending = null;
    if (pending) editor.ui.notify({ text: labels.found, timeout: 8000 });

    let timer: ReturnType<typeof setTimeout> | undefined;
    const save = () => {
      timer = undefined;
      try {
        if (editor.isEmpty()) store?.removeItem(key);
        else store?.setItem(key, JSON.stringify({ html: editor.getHTML(), time: Date.now() }));
      } catch {
        // Хранилище переполнено — не мешаем работе.
      }
    };
    const off = editor.on('change', () => {
      // Первое изменение после открытия — старый черновик больше не восстанавливаем поверх.
      pending = null;
      clearTimeout(timer);
      timer = setTimeout(save, delay);
    });

    const restore = () => {
      const draft = pending ?? read();
      if (!draft) return;
      editor.setContent(draft.html);
      pending = null;
      editor.ui.notify({ text: labels.restored });
      editor.focus();
    };
    const spec = {
      icon: ICON,
      tooltip: labels.restore,
      isEnabled: () => editor.isEditable() && pending !== null,
      onAction: restore,
    };
    editor.ui.registry.addButton('restoredraft', spec);
    editor.ui.registry.addMenuItem('restoredraft', {
      text: labels.restore,
      icon: ICON,
      onAction: restore,
    });

    return () => {
      off();
      // Изменения последней секунды не теряем.
      if (timer !== undefined) {
        clearTimeout(timer);
        save();
      }
    };
  },
});
