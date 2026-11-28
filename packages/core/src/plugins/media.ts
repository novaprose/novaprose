import type { Node as PMNode } from 'prosemirror-model';
import { Plugin } from 'prosemirror-state';
import { definePlugin } from '../plugins';
import { imageSize } from '../schema';
import { h } from '../ui/dom';

/**
 * The media plugin: YouTube and Vimeo videos, and video files (mp4, webm, ogg) over https.
 * `plugins: ['media']`. Here are the node and its view in the editor; the dialog and the button are in media-ui.ts.
 *
 * Security: only addresses from the list of providers are embedded. Any other <iframe>, from paste,
 * setContent or JSON, is dropped both when parsing and on output. YouTube goes through youtube-nocookie.com.
 */

export type MediaKind = 'youtube' | 'vimeo' | 'video';

/** Turns an address the media plugin doesn't play into a block (a page's card): the mediaembed plugin. */
export type EmbedResolver = (url: string, signal: AbortSignal) => Promise<PMNode | null>;

/** The resolver of each editor that has one: the Video dialog then takes any address. */
export const embedResolvers = new WeakMap<object, EmbedResolver>();

export interface MediaSource {
  kind: MediaKind;
  /** The canonical address for embedding. */
  src: string;
}

const YOUTUBE =
  /^https?:\/\/(?:www\.|m\.)?(?:youtube(?:-nocookie)?\.com\/(?:watch\?(?:[^#]*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})(?:[?&#]|$)/i;
const VIMEO = /^https?:\/\/(?:www\.|player\.)?vimeo\.com\/(?:video\/)?(\d{1,12})(?:[/?#]|$)/i;
const VIDEO_FILE = /^https:\/\/[^\s"'<>]+\.(?:mp4|webm|ogv|ogg)(?:\?[^\s"'<>#]*)?$/i;

/** Recognizes a video address; null means not supported (and it won't be embedded). */
export function parseMediaUrl(url: string): MediaSource | null {
  if (typeof url !== 'string') return null; // JSON can bring anything
  const value = url.trim();
  const youtube = value.match(YOUTUBE);
  if (youtube)
    return { kind: 'youtube', src: `https://www.youtube-nocookie.com/embed/${youtube[1]}` };
  const vimeo = value.match(VIMEO);
  if (vimeo) return { kind: 'vimeo', src: `https://player.vimeo.com/video/${vimeo[1]}` };
  if (VIDEO_FILE.test(value)) return { kind: 'video', src: value };
  return null;
}

function mediaAttrs(dom: HTMLElement, src: string | null) {
  const source = src ? parseMediaUrl(src) : null;
  if (!source) return false;
  return {
    ...source,
    width: imageSize(dom.getAttribute('width')) ?? 560,
    height: imageSize(dom.getAttribute('height')) ?? 315,
    title: dom.getAttribute('title') ?? '',
  };
}

function renderMedia(node: PMNode): HTMLElement | null {
  const source = parseMediaUrl(node.attrs.src as string);
  if (!source) return null;
  const width = String(imageSize(node.attrs.width) ?? 560);
  const height = String(imageSize(node.attrs.height) ?? 315);
  if (source.kind === 'video') {
    return h('video', { src: source.src, controls: true, width, height, preload: 'metadata' });
  }
  return h('iframe', {
    src: source.src,
    width,
    height,
    title: (node.attrs.title as string) || 'Video',
    allow: 'accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen',
    allowfullscreen: true,
    loading: 'lazy',
    referrerpolicy: 'strict-origin-when-cross-origin',
  });
}

export default definePlugin({
  name: 'media',
  toolbar: 'media',
  nodes: {
    media: {
      group: 'block',
      atom: true,
      selectable: true,
      draggable: true,
      attrs: {
        kind: { default: 'youtube' },
        src: {},
        width: { default: 560 },
        height: { default: 315 },
        title: { default: '' },
      },
      parseDOM: [
        {
          tag: 'iframe[src]',
          getAttrs: (dom) =>
            mediaAttrs(dom as HTMLElement, (dom as HTMLElement).getAttribute('src')),
        },
        {
          tag: 'video',
          getAttrs: (dom) => {
            const el = dom as HTMLElement;
            const src =
              el.getAttribute('src') ??
              el.querySelector('source[src]')?.getAttribute('src') ??
              null;
            return mediaAttrs(el, src);
          },
        },
      ],
      toDOM: (node) => {
        // The document may come from JSON: the address is checked again and only the canonical one is output.
        const source = parseMediaUrl(node.attrs.src as string);
        const width = String(imageSize(node.attrs.width) ?? 560);
        const height = String(imageSize(node.attrs.height) ?? 315);
        if (!source) return ['p'];
        if (source.kind === 'video')
          return ['video', { src: source.src, controls: '', width, height }];
        return [
          'iframe',
          {
            src: source.src,
            width,
            height,
            title: (node.attrs.title as string) || null,
            allow: 'accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen',
            allowfullscreen: '',
            loading: 'lazy',
            referrerpolicy: 'strict-origin-when-cross-origin',
          },
        ];
      },
    },
  },
  prosemirrorPlugins: () => [
    new Plugin({
      props: {
        nodeViews: {
          // In the editor the player is covered by a transparent layer: a click selects the block instead of playing the video.
          media: (node) => {
            const player = renderMedia(node);
            const dom = h(
              'div',
              { className: 'nova-media', contenteditable: 'false' },
              player,
              h('div', { className: 'nova-media-overlay', 'aria-hidden': 'true' }),
            );
            return { dom, ignoreMutation: () => true, stopEvent: () => false };
          },
        },
      },
    }),
  ],
  load: () => import('./media-ui'),
});
