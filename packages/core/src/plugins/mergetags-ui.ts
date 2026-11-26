import type { Editor } from '../editor';
import { definePlugin } from '../plugins';
import { icons } from '../ui/icons';
import type { MenuEntry } from '../ui/menu';
import { flatList, isGroup, LABELS, optionsOf, type MergeTag } from './mergetags';
import { pickLabels } from './shared';

/** Ленивая часть плагина mergetags: кнопка-меню переменных и список при вводе `{{`. */

function insertTag(editor: Editor, tag: MergeTag, range?: { from: number; to: number }): void {
  const { state, dispatch } = editor.view;
  const node = editor.schema.nodes.mergetag!.create({ key: tag.key, label: tag.label });
  const tr = range
    ? state.tr.replaceWith(range.from, range.to, node)
    : state.tr.replaceSelectionWith(node, false);
  dispatch(tr.scrollIntoView());
  editor.focus();
}

export default definePlugin({
  name: 'mergetags-ui',
  requires: ['mergetags'],
  setup(editor) {
    const labels = pickLabels(editor, 'mergetags', LABELS);

    editor.ui.registry.addMenuButton('mergetags', {
      icon: icons.mergeTags,
      tooltip: labels.insert,
      isEnabled: (e) => e.isEditable() && flatList(e).length > 0,
      items: (e) => {
        const entries: MenuEntry[] = [];
        const item = (tag: MergeTag, id: string): MenuEntry => ({
          id,
          label: tag.label,
          onSelect: () => insertTag(e, tag),
        });
        (optionsOf(e).list ?? []).forEach((entry, index) => {
          if (isGroup(entry)) {
            if (entries.length) entries.push({ type: 'separator' });
            entries.push({ type: 'heading', label: entry.title });
            entry.items.forEach((tag, i) => entries.push(item(tag, `mergetag-${index}-${i}`)));
          } else {
            entries.push(item(entry, `mergetag-${index}`));
          }
        });
        return entries;
      },
    });

    // {{ в тексте — список с поиском по подписи и ключу.
    editor.ui.registry.addAutocompleter('mergetags', {
      trigger: '{{',
      label: labels.search,
      emptyText: labels.empty,
      maxResults: 12,
      fetch: (query, e) => {
        const q = query.toLowerCase();
        return flatList(e)
          .filter((tag) => tag.label.toLowerCase().includes(q) || tag.key.toLowerCase().includes(q))
          .map((tag) => ({ value: tag.key, label: tag.label, detail: tag.key }));
      },
      onSelect: (item, range, e) => {
        const tag = flatList(e).find((t) => t.key === item.value);
        if (tag) insertTag(e, tag, range);
      },
    });
  },
});
