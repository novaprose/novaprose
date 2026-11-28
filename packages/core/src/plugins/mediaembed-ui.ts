import { closeHistory } from 'prosemirror-history';
import type { Node as PMNode } from 'prosemirror-model';
import { NodeSelection, Plugin, PluginKey } from 'prosemirror-state';
import type { Editor } from '../editor';
import { definePlugin } from '../plugins';
import { icons } from '../ui/icons';
import { embedResolvers, parseMediaUrl } from './media';
import {
  cardFields,
  cardHref,
  cardImage,
  cardText,
  type EmbedInfo,
  type MediaEmbedOptions,
} from './mediaembed';
import { pickLabels } from './shared';

/**
 * The lazy part of mediaembed: asking your service about a page, the card (or player, or picture)
 * it becomes, a link alone on its line becoming one on Enter, and the card's toolbar.
 */

export const LABELS = {
  en: {
    open: 'Open the page',
    unwrap: 'Show as a link',
    remove: 'Remove the card',
    toolbar: 'Card',
  },
};

const svg = (paths: string) =>
  `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
const UNWRAP = svg(
  '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
);

/** A server that answers POST { url } with an EmbedInfo, as a `resolve` function. */
function service(url: string) {
  return async (target: string, signal: AbortSignal): Promise<EmbedInfo | null> => {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: target }),
      credentials: 'same-origin',
      signal,
    });
    if (!response.ok) throw new Error(`The embed service answered ${response.status}`);
    if (response.status === 204) return null;
    return (await response.json()) as EmbedInfo | null;
  };
}

/**
 * What an address becomes: a player for a video the media plugin plays, otherwise what the service
 * says (a player, a picture, or a card). Only text and checked addresses are taken from the answer.
 */
async function embedFor(
  editor: Editor,
  resolve: ((url: string, signal: AbortSignal) => Promise<EmbedInfo | null | undefined>) | null,
  url: string,
  signal: AbortSignal,
): Promise<PMNode | null> {
  const href = cardHref(url);
  if (!href) return null;
  const nodes = editor.schema.nodes;
  const video = nodes.media ? parseMediaUrl(href) : null;
  if (video) return nodes.media!.create({ ...video });
  const answer = resolve ? await resolve(href, signal) : null;
  // Nothing known about the page: no card, the link stays a link.
  if (!answer || typeof answer !== 'object') return null;
  const info: EmbedInfo = answer;
  if (info.type === 'video' && nodes.media && typeof info.video === 'string') {
    const player = parseMediaUrl(info.video);
    if (player) return nodes.media.create({ ...player, title: cardText(info.title, 300) });
  }
  if (info.type === 'photo') {
    const src = cardImage(info.image);
    if (src)
      return nodes.paragraph!.create(
        null,
        nodes.image!.create({ src, alt: cardText(info.title, 300) || null }),
      );
  }
  if (!nodes.link_card) return null;
  return nodes.link_card.create({
    href,
    title: cardText(info.title, 300),
    description: cardText(info.description, 500),
    image: cardImage(info.image) ?? '',
    site: cardText(info.site, 100),
    author: cardText(info.author, 100),
  });
}

export default definePlugin({
  name: 'mediaembed-ui',
  requires: ['mediaembed'],
  prosemirrorPlugins: (editor) => {
    const options = (editor.options.pluginOptions?.mediaembed ?? {}) as MediaEmbedOptions;
    const resolve =
      typeof options.resolve === 'function'
        ? options.resolve
        : typeof options.serviceUrl === 'string' && options.serviceUrl
          ? service(options.serviceUrl)
          : null;
    const pending = new Set<AbortController>();
    // With a service, the Video dialog takes any page.
    if (resolve)
      embedResolvers.set(editor, (url, signal) => embedFor(editor, resolve, url, signal));

    /** The line that still holds only that address (the nearest to where it was) becomes the block. */
    const replaceLine = async (href: string, near: number) => {
      const controller = new AbortController();
      pending.add(controller);
      let node: PMNode | null = null;
      try {
        node = await embedFor(editor, resolve, href, controller.signal);
      } catch (error) {
        // No card: the link stays as it was typed.
        if (!controller.signal.aborted) console.warn('[nova] mediaembed:', error);
      } finally {
        pending.delete(controller);
      }
      if (!node || controller.signal.aborted || editor.view.isDestroyed) return;
      const { doc } = editor.view.state;
      let best = -1;
      doc.descendants((child, pos) => {
        if (child.type === editor.schema.nodes.paragraph && child.textContent.trim() === href) {
          if (best < 0 || Math.abs(pos - near) < Math.abs(best - near)) best = pos;
        }
        return !child.isTextblock;
      });
      if (best < 0) return;
      const line = doc.nodeAt(best)!;
      // Its own undo step: Ctrl+Z gives the link back and keeps the new line.
      editor.view.dispatch(
        closeHistory(editor.view.state.tr.replaceWith(best, best + line.nodeSize, node)),
      );
    };

    return [
      new Plugin({
        key: new PluginKey('nova-mediaembed'),
        view: () => ({
          /**
           * A link alone on its line, then Enter (from a key or a phone's keyboard): Enter works as
           * always, and the line becomes a card when its answer comes. Seen from the result: the
           * cursor was at the end of that line and is now at the start of a new empty line after it.
           */
          update(view, previous) {
            if (view.state.doc === previous.doc || !previous.selection.empty) return;
            const paragraph = view.state.schema.nodes.paragraph;
            // The cheap checks first: this runs after every change.
            const { $from, empty } = view.state.selection;
            if (!empty || $from.parent.type !== paragraph || $from.parent.content.size) return;
            const before = previous.selection.$from;
            if (before.parent.type !== paragraph) return;
            if (before.parentOffset !== before.parent.content.size) return;
            const text = before.parent.textContent.trim();
            const href = cardHref(text);
            if (!href || /\s/.test(text)) return;
            const line = view.state.doc.resolve($from.before()).nodeBefore;
            if (!line || line.type !== paragraph || line.textContent.trim() !== text) return;
            const video = view.state.schema.nodes.media ? parseMediaUrl(href) : null;
            if (!video && !resolve) return;
            void replaceLine(href, $from.before() - line.nodeSize);
          },
          destroy: () => {
            pending.forEach((controller) => controller.abort());
            embedResolvers.delete(editor);
          },
        }),
      }),
    ];
  },
  setup(editor) {
    const labels = pickLabels(editor, 'mediaembed', LABELS);
    const selectedCard = (e: Editor) => {
      const { selection } = e.view.state;
      return selection instanceof NodeSelection && selection.node.type.name === 'link_card'
        ? selection
        : null;
    };
    editor.ui.registry.addButton('linkcardopen', {
      icon: icons.externalLink,
      tooltip: labels.open,
      isEnabled: (e) => !!selectedCard(e),
      onAction: (e) => {
        const href = cardFields(selectedCard(e)?.node.attrs ?? {}).href;
        if (href) window.open(href, '_blank', 'noopener,noreferrer');
      },
    });
    editor.ui.registry.addButton('linkcardunwrap', {
      icon: UNWRAP,
      tooltip: labels.unwrap,
      isEnabled: (e) => e.isEditable() && !!selectedCard(e),
      onAction: (e) => {
        const card = selectedCard(e);
        const href = card ? cardFields(card.node.attrs).href : null;
        if (!card || !href) return;
        const { state, dispatch } = e.view;
        const link = state.schema.marks.link!.create({ href });
        const line = state.schema.nodes.paragraph!.create(null, state.schema.text(href, [link]));
        dispatch(state.tr.replaceWith(card.from, card.to, line).scrollIntoView());
        e.focus();
      },
    });
    editor.ui.registry.addButton('linkcarddelete', {
      icon: icons.trash,
      tooltip: labels.remove,
      isEnabled: (e) => e.isEditable() && !!selectedCard(e),
      onAction: (e) => {
        const card = selectedCard(e);
        if (!card) return;
        e.view.dispatch(e.view.state.tr.deleteSelection().scrollIntoView());
        e.focus();
      },
    });
    editor.ui.registry.addContextToolbar('linkcard', {
      label: labels.toolbar,
      predicate: (e) => !!selectedCard(e),
      items: 'linkcardopen linkcardunwrap | linkcarddelete',
    });
  },
});
