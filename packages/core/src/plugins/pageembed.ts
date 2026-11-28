import type { Node as PMNode, NodeSpec } from 'prosemirror-model';
import { Plugin } from 'prosemirror-state';
import type { Editor } from '../editor';
import { definePlugin } from '../plugins';
import { imageSize } from '../schema';
import { h } from '../ui/dom';

/**
 * The pageembed plugin: a web page shown in the document, in a frame. `plugins: ['pageembed']`.
 * Here are the node and its view in the editor; the dialog and the button are in pageembed-ui.ts.
 *
 * An embed is a wrapper with a frame: `<div class="nova-pageembed …"><iframe …></iframe></div>`. A
 * sized one (`nova-pageembed--16by9`) fills the width and keeps the ratio, a fixed one has its own
 * width and height.
 *
 * Security: only absolute http(s) addresses are embedded, without a name and password in them,
 * when parsing and on output (a document can come as JSON); `allowUrl` narrows them to your list.
 * An <iframe> on its own isn't embedded, so a pasted web page doesn't bring its frames along. The
 * frame is sandboxed: the page runs its own scripts, forms and popups, but can't navigate the page
 * it is shown on, and gets no camera, microphone or location.
 */

export interface PageEmbedSize {
  /** The name in the dialog ("Full width, 16:9" when left out). */
  text?: string;
  /** The class it adds to the wrapper; "…--16by9" fills the width with that ratio. */
  value: string;
}

export interface PageEmbedOptions {
  /** The sizes offered besides a fixed one. An empty list: only a fixed size. */
  sizes?: PageEmbedSize[];
  /** Sizes also as inline styles, so the page that shows the HTML needs no CSS for them (yes). */
  inlineStyles?: boolean;
  /** The wrapper's class ('nova-pageembed'). */
  className?: string;
  /** The frame's sandbox (`allow-*` words); false: no sandbox. */
  sandbox?: string | false;
  /** Which addresses may be embedded: every http(s) one by default. */
  allowUrl?: (url: string) => boolean;
}

export const DEFAULT_SANDBOX =
  'allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-presentation';

const DEFAULT_SIZES: PageEmbedSize[] = ['21by9', '16by9', '4by3', '1by1'].map((ratio) => ({
  value: `nova-pageembed--${ratio}`,
}));

/** The width and height of a fixed size when the HTML doesn't say. */
export const FIXED = { width: 350, height: 260 };

const CLASS_RE = /^[\w-]{1,60}$/;
const RATIO_RE = /--(\d{1,3})by(\d{1,3})$/;

/** The plugin's settings, checked: what is wrong in them falls back to the default. */
export function pageEmbedOptions(context: { options: Editor['options'] }): Required<
  Omit<PageEmbedOptions, 'allowUrl'>
> & {
  allowUrl?: (url: string) => boolean;
} {
  const raw = (context.options.pluginOptions?.pageembed ?? {}) as PageEmbedOptions;
  const sizes = Array.isArray(raw.sizes)
    ? raw.sizes.filter(
        (size): size is PageEmbedSize =>
          !!size && typeof size.value === 'string' && CLASS_RE.test(size.value),
      )
    : DEFAULT_SIZES;
  const sandbox =
    raw.sandbox === false
      ? false
      : typeof raw.sandbox === 'string'
        ? raw.sandbox
            .split(/\s+/)
            .filter((word) => /^allow-[a-z-]{1,40}$/.test(word))
            .join(' ')
        : DEFAULT_SANDBOX;
  return {
    sizes,
    inlineStyles: raw.inlineStyles !== false,
    className:
      typeof raw.className === 'string' && CLASS_RE.test(raw.className)
        ? raw.className
        : 'nova-pageembed',
    sandbox,
    allowUrl: typeof raw.allowUrl === 'function' ? raw.allowUrl : undefined,
  };
}

/** The ratio a size class keeps ([16, 9] for "…--16by9"), or null. */
export function ratioOf(value: string): [number, number] | null {
  const match = RATIO_RE.exec(value);
  if (!match) return null;
  const width = Number(match[1]);
  const height = Number(match[2]);
  return width > 0 && height > 0 ? [width, height] : null;
}

/** The address if it may be embedded: absolute http(s), no credentials, allowed by `allowUrl`. */
export function embeddableUrl(url: unknown, allowUrl?: (url: string) => boolean): string | null {
  if (typeof url !== 'string') return null;
  const value = url.trim();
  if (value.length > 2000 || !/^https?:\/\/[^\s/?#]/i.test(value)) return null;
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
  if (parsed.username || parsed.password) return null;
  try {
    if (allowUrl && !allowUrl(parsed.href)) return null;
  } catch {
    return null;
  }
  return value;
}

/** A name for screen readers: the title, or the site's name. */
function frameTitle(title: unknown, src: string): string {
  if (typeof title === 'string' && title.trim()) return title.trim().slice(0, 300);
  try {
    return new URL(src).hostname;
  } catch {
    return src;
  }
}

type Settings = ReturnType<typeof pageEmbedOptions>;

/** The size of a node: one of the configured classes, or '' (fixed). */
function sizeOf(value: unknown, settings: Settings): string {
  return typeof value === 'string' && settings.sizes.some((size) => size.value === value)
    ? value
    : '';
}

/** The size of a wrapper's classes: a configured class, or one with the same ratio (another editor's). */
function sizeFromClasses(classes: string[], settings: Settings): string {
  const own = classes.find((name) => settings.sizes.some((size) => size.value === name));
  if (own) return own;
  for (const name of classes) {
    const ratio = /^(?:nova|tiny)-pageembed--/.test(name) ? ratioOf(name) : null;
    if (!ratio) continue;
    const same = settings.sizes.find((size) => {
      const other = ratioOf(size.value);
      return !!other && other[0] * ratio[1] === other[1] * ratio[0];
    });
    if (same) return same.value;
  }
  return '';
}

function isWrapper(classes: string[], settings: Settings): boolean {
  return classes.some(
    (name) =>
      name === settings.className ||
      /^(?:nova|tiny)-pageembed(?:--[\w-]+)?$/.test(name) ||
      settings.sizes.some((size) => size.value === name),
  );
}

function frameAttrs(node: PMNode, src: string, settings: Settings): Record<string, string | null> {
  return {
    src,
    title: frameTitle(node.attrs.title, src),
    sandbox: settings.sandbox === false ? null : settings.sandbox,
    allow: 'fullscreen',
    allowfullscreen: '',
    loading: 'lazy',
    referrerpolicy: 'strict-origin-when-cross-origin',
    frameborder: node.attrs.border === true ? '1' : '0',
    scrolling: node.attrs.scrolling === false ? 'no' : null,
  };
}

function buildNodes(context: { options: Editor['options'] }): Record<string, NodeSpec> {
  const settings = pageEmbedOptions(context);
  return {
    pageembed: {
      group: 'block',
      atom: true,
      selectable: true,
      draggable: true,
      attrs: {
        src: { default: '' },
        size: { default: '' },
        width: { default: FIXED.width },
        height: { default: FIXED.height },
        title: { default: '' },
        border: { default: false },
        scrolling: { default: true },
      },
      parseDOM: [
        {
          tag: 'div',
          // Before element rules (extendedValidElements: 'div[*]') and plain blocks.
          priority: 70,
          getAttrs: (dom) => {
            const el = dom as HTMLElement;
            const classes = [...el.classList];
            if (!isWrapper(classes, settings)) return false;
            const frame = el.querySelector('iframe');
            const src = embeddableUrl(frame?.getAttribute('src'), settings.allowUrl);
            if (!frame || !src) return false;
            const border = frame.getAttribute('frameborder');
            return {
              src,
              size: sizeFromClasses(classes, settings),
              width: imageSize(frame.getAttribute('width')) ?? FIXED.width,
              height: imageSize(frame.getAttribute('height')) ?? FIXED.height,
              title: (frame.getAttribute('title') ?? '').trim().slice(0, 300),
              border: border !== null && border !== '0' && border.toLowerCase() !== 'no',
              scrolling: frame.getAttribute('scrolling')?.toLowerCase() !== 'no',
            };
          },
        },
      ],
      toDOM: (node) => {
        // The document may come from JSON: the address is checked again.
        const src = embeddableUrl(node.attrs.src, settings.allowUrl);
        if (!src) return ['div', { class: settings.className }];
        const attrs = frameAttrs(node, src, settings);
        const size = sizeOf(node.attrs.size, settings);
        if (!size) {
          attrs.width = String(imageSize(node.attrs.width) ?? FIXED.width);
          attrs.height = String(imageSize(node.attrs.height) ?? FIXED.height);
          return ['div', { class: settings.className }, ['iframe', attrs]];
        }
        const ratio = settings.inlineStyles ? ratioOf(size) : null;
        if (ratio) {
          const percent = Math.round((ratio[1] / ratio[0]) * 1e6) / 1e4;
          attrs.style = `position: absolute; top: 0; left: 0; width: 100%; height: 100%${
            node.attrs.border === true ? '' : '; border: 0'
          }`;
          return [
            'div',
            {
              class: `${settings.className} ${size}`,
              style: `position: relative; width: 100%; padding-top: ${percent}%; overflow: hidden`,
            },
            ['iframe', attrs],
          ];
        }
        return ['div', { class: `${settings.className} ${size}` }, ['iframe', attrs]];
      },
    },
  };
}

/** The view in the editor: the page in its frame under a layer, so a click selects the block. */
function pageEmbedView(node: PMNode, settings: Settings) {
  const dom = h('div', { className: 'nova-media nova-pageembed-view', contenteditable: 'false' });
  const overlay = h('div', { className: 'nova-media-overlay', 'aria-hidden': 'true' });
  let frame: HTMLIFrameElement | null = null;
  let shown: string | null = null;

  const render = (current: PMNode) => {
    const src = embeddableUrl(current.attrs.src, settings.allowUrl);
    const size = sizeOf(current.attrs.size, settings);
    const ratio = size ? ratioOf(size) : null;
    dom.classList.toggle('is-responsive', !!size);
    dom.classList.toggle('has-border', current.attrs.border === true);
    if (!src) {
      frame?.remove();
      frame = null;
      shown = null;
      dom.replaceChildren(
        h(
          'div',
          { className: 'nova-pageembed-missing' },
          typeof current.attrs.src === 'string' ? current.attrs.src : '',
        ),
        overlay,
      );
      return;
    }
    // The same address: the frame stays (it would load the page again otherwise).
    if (!frame || shown !== src) {
      const attrs = frameAttrs(current, src, settings);
      frame = h('iframe', {
        src,
        title: attrs.title!,
        ...(attrs.sandbox === null ? {} : { sandbox: attrs.sandbox }),
        allow: 'fullscreen',
        loading: 'lazy',
        referrerpolicy: 'strict-origin-when-cross-origin',
        // Tab stays in the text: the page in the frame is not a stop while editing.
        tabindex: '-1',
      }) as HTMLIFrameElement;
      shown = src;
      dom.replaceChildren(frame, overlay);
    }
    frame.title = frameTitle(current.attrs.title, src);
    if (current.attrs.scrolling === false) frame.setAttribute('scrolling', 'no');
    else frame.removeAttribute('scrolling');
    if (size) {
      frame.removeAttribute('width');
      frame.removeAttribute('height');
      frame.style.aspectRatio = ratio ? `${ratio[0]} / ${ratio[1]}` : '16 / 9';
    } else {
      frame.style.aspectRatio = '';
      frame.setAttribute('width', String(imageSize(current.attrs.width) ?? FIXED.width));
      frame.setAttribute('height', String(imageSize(current.attrs.height) ?? FIXED.height));
    }
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
  name: 'pageembed',
  toolbar: 'pageembed',
  nodes: buildNodes,
  prosemirrorPlugins: (editor) => {
    const settings = pageEmbedOptions(editor);
    return [
      new Plugin({
        props: {
          nodeViews: { pageembed: (node) => pageEmbedView(node, settings) },
        },
      }),
    ];
  },
  load: () => import('./pageembed-ui'),
});
