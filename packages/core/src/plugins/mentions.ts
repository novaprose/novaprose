import type { Node as PMNode } from 'prosemirror-model';
import type { Editor } from '../editor';
import { definePlugin } from '../plugins';

/**
 * The mentions plugin: "@" in the text → a list of people → a mention
 * `<span data-mention="id">@Name</span>`. `plugins: ['mentions']`, the people come from
 * `pluginOptions.mentions.fetch` (usually a search in your API). Comments use the same source for
 * "@" in a comment field. This part is the node and shared functions; the list while typing "@" is in mentions-ui.ts.
 */

export interface MentionUser {
  id: string;
  name: string;
  /** A second line in the list: a job title, an e-mail. */
  description?: string;
}

export interface MentionsOptions {
  /** Find people by the start of their name (the query without "@"). May return a Promise. */
  fetch: (query: string) => MentionUser[] | Promise<MentionUser[]>;
  /** Someone was mentioned in the text (for notifications — or collect them on save with getMentions). */
  onMention?: (user: MentionUser, editor: Editor) => void;
  /** How many to show in the list (8 by default). */
  maxResults?: number;
}

/** A user id: UUIDs, numbers, e-mails, logins, without spaces, quotes or angle brackets. */
export const MENTION_ID_RE = /^[\w.@:+-]{1,128}$/;
const MAX_NAME = 80;

const cleanName = (value: string) => value.replace(/^@/, '').trim().slice(0, MAX_NAME);

/** Matching people: id and name checked and trimmed (the data comes from someone else's API). */
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

/** Who is mentioned in the document (no repeats, in order of appearance) — for example, to notify them. */
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
      // The document may come from JSON: the id is checked on output too, the name is only text.
      toDOM: (node) => [
        'span',
        { 'data-mention': MENTION_ID_RE.test(node.attrs.id as string) ? node.attrs.id : null },
        `@${cleanName(String(node.attrs.name))}`,
      ],
      leafText: (node) => `@${cleanName(String(node.attrs.name))}`,
    },
  },
  load: () => import('./mentions-ui'),
});
