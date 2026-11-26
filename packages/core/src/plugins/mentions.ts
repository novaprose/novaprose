import type { Node as PMNode } from 'prosemirror-model';
import type { Editor } from '../editor';
import { definePlugin } from '../plugins';
import { pickLabels } from './shared';

/**
 * Плагин mentions: «@» в тексте → список людей → упоминание `<span data-mention="id">@Имя</span>`.
 * `plugins: ['mentions']`, список людей — `pluginOptions.mentions.fetch` (обычно поиск в вашем API).
 * Тот же источник используют комментарии: «@» в поле комментария.
 */

export interface MentionUser {
  id: string;
  name: string;
  /** Вторая строка в списке: должность, e-mail. */
  description?: string;
}

export interface MentionsOptions {
  /** Поиск людей по началу имени (запрос без «@»). Может вернуть Promise. */
  fetch: (query: string) => MentionUser[] | Promise<MentionUser[]>;
  /** Человека упомянули в тексте (для уведомлений — или соберите их при сохранении: getMentions). */
  onMention?: (user: MentionUser, editor: Editor) => void;
  /** Сколько показывать в списке (по умолчанию 8). */
  maxResults?: number;
}

export const LABELS = {
  en: { list: 'People', empty: 'No matches' },
};

/** id пользователя: UUID, числа, e-mail, логины — без пробелов, кавычек и угловых скобок. */
export const MENTION_ID_RE = /^[\w.@:+-]{1,128}$/;
const MAX_NAME = 80;

const cleanName = (value: string) => value.replace(/^@/, '').trim().slice(0, MAX_NAME);

/** Подходящие люди: id и имя проверены и обрезаны (данные приходят из чужого API). */
export async function findMentionUsers(
  fetch: MentionsOptions['fetch'],
  query: string,
  max = 8,
): Promise<MentionUser[]> {
  const result = await fetch(query);
  if (!Array.isArray(result)) return [];
  return result
    .filter((u) => u && typeof u.id === 'string' && MENTION_ID_RE.test(u.id) && u.name)
    .slice(0, max)
    .map((u) => ({
      id: u.id,
      name: cleanName(String(u.name)),
      ...(u.description ? { description: String(u.description).slice(0, 120) } : {}),
    }));
}

/** Кто упомянут в документе (без повторов, в порядке появления) — например, чтобы уведомить. */
export function getMentions(editorOrDoc: Editor | PMNode): MentionUser[] {
  const doc = 'view' in editorOrDoc ? editorOrDoc.view.state.doc : editorOrDoc;
  const seen = new Map<string, MentionUser>();
  doc.descendants((node) => {
    if (node.type.name === 'mention' && !seen.has(node.attrs.id as string)) {
      seen.set(node.attrs.id as string, {
        id: node.attrs.id as string,
        name: node.attrs.name as string,
      });
    }
  });
  return [...seen.values()];
}

export default definePlugin({
  name: 'mentions',
  nodes: {
    mention: {
      group: 'inline',
      inline: true,
      atom: true,
      selectable: false,
      attrs: { id: {}, name: { default: '' } },
      parseDOM: [
        {
          tag: 'span[data-mention]',
          getAttrs: (dom) => {
            const el = dom as HTMLElement;
            const id = el.getAttribute('data-mention') ?? '';
            return MENTION_ID_RE.test(id) ? { id, name: cleanName(el.textContent ?? '') } : false;
          },
        },
      ],
      // Документ мог прийти из JSON: id проверяем и при выводе, имя — только текст.
      toDOM: (node) => [
        'span',
        { 'data-mention': MENTION_ID_RE.test(node.attrs.id as string) ? node.attrs.id : null },
        `@${cleanName(String(node.attrs.name))}`,
      ],
      leafText: (node) => `@${cleanName(String(node.attrs.name))}`,
    },
  },
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
