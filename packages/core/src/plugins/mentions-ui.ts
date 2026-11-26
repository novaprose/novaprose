import { definePlugin } from '../plugins';
import { findMentionUsers, type MentionUser, type MentionsOptions } from './mentions';
import { pickLabels } from './shared';

/** Ленивая часть плагина mentions: список людей при вводе «@». */

export const LABELS = {
  en: { list: 'People', empty: 'No matches' },
};

export default definePlugin({
  name: 'mentions-ui',
  requires: ['mentions'],
  setup(editor) {
    const options = editor.options.pluginOptions?.mentions as MentionsOptions | undefined;
    if (!options?.fetch) {
      console.warn('[nova] mentions: set pluginOptions.mentions.fetch to search people');
      return;
    }
    const labels = pickLabels(editor, 'mentions', LABELS);
    const max = options.maxResults ?? 8;
    let found = new Map<string, MentionUser>();

    editor.ui.registry.addAutocompleter('mentions', {
      trigger: '@',
      label: labels.list,
      emptyText: labels.empty,
      maxResults: max,
      fetch: async (query) => {
        const users = await findMentionUsers(options.fetch, query, max);
        found = new Map(users.map((u) => [u.id, u]));
        return users.map((u) => ({
          value: u.id,
          label: u.name,
          ...(u.description ? { detail: u.description } : {}),
        }));
      },
      onSelect: (item, range, e) => {
        const user = found.get(item.value) ?? { id: item.value, name: item.label };
        const { state, dispatch } = e.view;
        const node = e.schema.nodes.mention!.create({ id: user.id, name: user.name });
        dispatch(
          state.tr
            .replaceWith(range.from, range.to, [node, state.schema.text(' ')])
            .scrollIntoView(),
        );
        options.onMention?.(user, e);
      },
    });
  },
});
