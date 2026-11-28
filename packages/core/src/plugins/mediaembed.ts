import type { DOMOutputSpec, Node as PMNode, NodeSpec } from 'prosemirror-model';
import { Plugin } from 'prosemirror-state';
import type { Editor } from '../editor';
import { definePlugin } from '../plugins';
import { h } from '../ui/dom';
import { isSafeImageUrl, isSafeLinkUrl } from '../url';

/**
 * The mediaembed plugin: a link to a page becomes a card with its title, description, picture and
 * site, from your service (`resolve` or `serviceUrl`); a video link becomes a player (the media
 * plugin). Here are the card node and its view; asking the service and the buttons are in
 * mediaembed-ui.ts.
 *
 * Security: nothing from the service is put in as HTML. The card is built from text, its address
 * and picture are checked like any link and image, when parsing, from JSON and on output.
 */

export interface MediaEmbedOptions {
  /**
   * Your service: what a page is (its title, description, picture, site), through your server.
   * null when nothing is known about it: the link stays a link.
   */
  resolve?: (url: string, signal: AbortSignal) => Promise<EmbedInfo | null | undefined>;
  /** When `resolve` isn't given: a server that answers POST { url } with an EmbedInfo (or null). */
  serviceUrl?: string;
  /** The widest a card gets, in pixels (650). */
  maxWidth?: number;
  /** The card's look as inline styles too, so the page that shows it needs no CSS (yes). */
  inlineStyles?: boolean;
  /** The card's class; its parts get "-title", "-description", "-thumbnail", "-website", "-author". */
  className?: string;
}

/** What the service says about a page. Everything is optional; unknown fields are ignored. */
export interface EmbedInfo {
  /** 'video': a player (`video` is its address); 'photo': a picture (`image`); otherwise a card. */
  type?: 'link' | 'video' | 'photo' | 'rich';
  title?: string;
  description?: string;
  /** A picture for the card (or the photo itself). */
  image?: string;
  /** The site's name. */
  site?: string;
  author?: string;
  /** For a video: the player's address (YouTube, Vimeo or a video file). */
  video?: string;
}

const CLASS_RE = /^[\w-]{1,60}$/;

export function mediaEmbedOptions(context: { options: Editor['options'] }) {
  const raw = (context.options.pluginOptions?.mediaembed ?? {}) as MediaEmbedOptions;
  const maxWidth = Number(raw.maxWidth);
  return {
    className:
      typeof raw.className === 'string' && CLASS_RE.test(raw.className)
        ? raw.className
        : 'nova-card',
    inlineStyles: raw.inlineStyles !== false,
    maxWidth:
      Number.isFinite(maxWidth) && maxWidth >= 200 ? Math.min(2000, Math.round(maxWidth)) : 650,
  };
}

type Settings = ReturnType<typeof mediaEmbedOptions>;

/** A text field from anywhere (JSON, a service): a string, trimmed and cut to a sane length. */
export function cardText(value: unknown, max: number): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '';
}

/** A card's address: an absolute http(s) link. */
export function cardHref(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const href = value.trim();
  return /^https?:\/\/[^\s/?#]/i.test(href) && href.length <= 2000 && isSafeLinkUrl(href)
    ? href
    : null;
}

/** A card's picture: an absolute http(s) image address. */
export function cardImage(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const src = value.trim();
  return /^https?:\/\/[^\s/?#]/i.test(src) && src.length <= 2000 && isSafeImageUrl(src)
    ? src
    : null;
}

export function hostOf(href: string): string {
  try {
    return new URL(href).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

/** The card's fields, checked: what a node from JSON (or a service) holds may be anything. */
export function cardFields(attrs: Record<string, unknown>) {
  const href = cardHref(attrs.href);
  return {
    href,
    title: cardText(attrs.title, 300) || (href ? hostOf(href) : ''),
    description: cardText(attrs.description, 500),
    image: cardImage(attrs.image),
    site: cardText(attrs.site, 100) || (href ? hostOf(href) : ''),
    author: cardText(attrs.author, 100),
  };
}

type Part = 'title' | 'description' | 'thumbnail' | 'website' | 'author';

function buildNodes(context: { options: Editor['options'] }): Record<string, NodeSpec> {
  const settings = mediaEmbedOptions(context);
  const prefixes = [...new Set([settings.className, 'nova-card', 'ephox-summary-card'])];
  /** A part of a card element, by its class (any of the known prefixes). */
  const part = (el: HTMLElement, name: Part) =>
    el.querySelector<HTMLElement>(prefixes.map((p) => `.${p}-${name}`).join(', '));
  return {
    link_card: {
      group: 'block',
      atom: true,
      selectable: true,
      draggable: true,
      attrs: {
        href: { default: '' },
        title: { default: '' },
        description: { default: '' },
        image: { default: '' },
        site: { default: '' },
        author: { default: '' },
      },
      parseDOM: [
        {
          tag: 'a, div',
          // Before links (marks) and plain blocks.
          priority: 70,
          getAttrs: (dom) => {
            const el = dom as HTMLElement;
            if (!prefixes.some((p) => el.classList.contains(p))) return false;
            const href = cardHref(
              el.getAttribute('href') ?? el.querySelector('a[href]')?.getAttribute('href'),
            );
            if (!href) return false;
            const thumbnail = part(el, 'thumbnail');
            const image =
              thumbnail?.getAttribute('src') ??
              thumbnail?.querySelector('img')?.getAttribute('src') ??
              '';
            return {
              href,
              title: cardText(part(el, 'title')?.textContent, 300),
              description: cardText(part(el, 'description')?.textContent, 500),
              image: cardImage(image) ?? '',
              site: cardText(part(el, 'website')?.textContent, 100),
              author: cardText(part(el, 'author')?.textContent, 100),
            };
          },
        },
      ],
      toDOM: (node) => cardDOM(node, settings),
    },
  };
}

const style = (settings: Settings, css: string) => (settings.inlineStyles ? css : null);

/** The card's HTML: a link holding a picture, the title, the description and the site. */
function cardDOM(node: PMNode, settings: Settings): DOMOutputSpec {
  const f = cardFields(node.attrs);
  const p = settings.className;
  // A card that lost its address (JSON) is just its text.
  if (!f.href) return ['div', { class: p }, f.title];
  const muted = 'display: block; opacity: 0.75; font-size: 0.875em';
  const text: DOMOutputSpec[] = [
    [
      'span',
      { class: `${p}-title`, style: style(settings, 'display: block; font-weight: 600') },
      f.title,
    ],
  ];
  if (f.description)
    text.push([
      'span',
      { class: `${p}-description`, style: style(settings, muted) },
      f.description,
    ]);
  text.push(['span', { class: `${p}-website`, style: style(settings, muted) }, f.site]);
  if (f.author)
    text.push(['span', { class: `${p}-author`, style: style(settings, muted) }, f.author]);
  return [
    'a',
    {
      class: p,
      href: f.href,
      rel: 'noopener noreferrer',
      style: style(
        settings,
        `display: flex; flex-wrap: wrap; gap: 12px; max-width: ${settings.maxWidth}px; margin: 0.5em 0; padding: 12px; ` +
          'border: 1px solid rgb(127 127 127 / 0.35); border-radius: 8px; color: inherit; text-decoration: none; overflow: hidden',
      ),
    },
    ...((f.image
      ? [
          [
            'img',
            {
              class: `${p}-thumbnail`,
              src: f.image,
              alt: '',
              loading: 'lazy',
              style: style(
                settings,
                'flex: none; width: 120px; height: 90px; object-fit: cover; border-radius: 4px',
              ),
            },
          ],
        ]
      : []) as DOMOutputSpec[]),
    // Narrower than 180px beside the picture (a phone), the text goes under it.
    ['span', { style: style(settings, 'display: block; flex: 1 1 180px; min-width: 0') }, ...text],
  ] as DOMOutputSpec;
}

/** The card in the editor: the same look, without a working link (a click selects it). */
function cardView(node: PMNode, settings: Settings) {
  const dom = h('div', { className: 'nova-card-view', contenteditable: 'false' });
  dom.style.maxWidth = `${settings.maxWidth}px`;
  const render = (current: PMNode) => {
    const f = cardFields(current.attrs);
    dom.replaceChildren(
      ...(f.image ? [h('img', { className: 'nova-card-view-image', src: f.image, alt: '' })] : []),
      h(
        'div',
        { className: 'nova-card-view-text' },
        h('div', { className: 'nova-card-view-title' }, f.title),
        f.description ? h('div', { className: 'nova-card-view-description' }, f.description) : null,
        h(
          'div',
          { className: 'nova-card-view-site' },
          [f.site, f.author].filter(Boolean).join(' · '),
        ),
      ),
    );
    dom.title = f.href ?? '';
  };
  render(node);
  return {
    dom,
    update(next: PMNode) {
      if (next.type !== node.type) return false;
      node = next;
      render(next);
      return true;
    },
    ignoreMutation: () => true,
    stopEvent: () => false,
  };
}

export default definePlugin({
  name: 'mediaembed',
  nodes: buildNodes,
  prosemirrorPlugins: (editor) => {
    const settings = mediaEmbedOptions(editor);
    return [
      new Plugin({ props: { nodeViews: { link_card: (node) => cardView(node, settings) } } }),
    ];
  },
  load: () => import('./mediaembed-ui'),
});
