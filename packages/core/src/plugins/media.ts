import { icons } from '../ui/icons';
import { attachFilePicker } from '../ui/file-picker';
import type { Node as PMNode } from 'prosemirror-model';
import { NodeSelection, Plugin } from 'prosemirror-state';
import { definePlugin } from '../plugins';
import { imageSize } from '../schema';
import { textField } from '../ui/dialog';
import { h } from '../ui/dom';
import { pickLabels } from './shared';

/**
 * Плагин media: видео YouTube и Vimeo, а также видеофайлы (mp4, webm, ogg) по https.
 * `plugins: ['media']`. Добавляет узел в схему, поэтому подключается сразу (не лениво).
 *
 * Безопасность: встраиваются только адреса из списка поставщиков. Любой другой <iframe> — из вставки,
 * setContent или JSON — отбрасывается и при разборе, и при выводе. YouTube — через youtube-nocookie.com.
 */

export type MediaKind = 'youtube' | 'vimeo' | 'video';

export interface MediaSource {
  kind: MediaKind;
  /** Канонический адрес для встраивания. */
  src: string;
}

const YOUTUBE =
  /^https?:\/\/(?:www\.|m\.)?(?:youtube(?:-nocookie)?\.com\/(?:watch\?(?:[^#]*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})(?:[?&#]|$)/i;
const VIMEO = /^https?:\/\/(?:www\.|player\.)?vimeo\.com\/(?:video\/)?(\d{1,12})(?:[/?#]|$)/i;
const VIDEO_FILE = /^https:\/\/[^\s"'<>]+\.(?:mp4|webm|ogv|ogg)(?:\?[^\s"'<>#]*)?$/i;

/** Распознать адрес видео; null — не поддерживается (и не будет встроен). */
export function parseMediaUrl(url: string): MediaSource | null {
  if (typeof url !== 'string') return null; // из JSON может прийти что угодно
  const value = url.trim();
  const youtube = value.match(YOUTUBE);
  if (youtube)
    return { kind: 'youtube', src: `https://www.youtube-nocookie.com/embed/${youtube[1]}` };
  const vimeo = value.match(VIMEO);
  if (vimeo) return { kind: 'vimeo', src: `https://player.vimeo.com/video/${vimeo[1]}` };
  if (VIDEO_FILE.test(value)) return { kind: 'video', src: value };
  return null;
}

const ICON = icons.media;

const LABELS = {
  en: {
    title: 'Video',
    url: 'Video URL',
    hint: 'YouTube, Vimeo or a link to an .mp4 / .webm file',
    name: 'Title (for screen readers)',
    invalid: 'This video address is not supported',
    save: 'Insert',
  },
  ru: {
    title: 'Видео',
    url: 'Адрес видео',
    hint: 'YouTube, Vimeo или ссылка на файл .mp4 / .webm',
    name: 'Название (для экранного диктора)',
    invalid: 'Этот адрес видео не поддерживается',
    save: 'Вставить',
  },
};

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
        // Документ мог прийти из JSON — адрес проверяем заново и выводим только канонический.
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
          // В редакторе плеер закрыт прозрачным слоем: клик выделяет блок, а не запускает видео.
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
  setup(editor) {
    const labels = pickLabels(editor, LABELS);
    const selected = () => {
      const { selection } = editor.view.state;
      return selection instanceof NodeSelection && selection.node.type.name === 'media'
        ? selection
        : null;
    };

    const open = () => {
      const current = selected();
      const url = textField({
        label: labels.url,
        type: 'url',
        placeholder: 'https://',
        hint: labels.hint,
        value: (current?.node.attrs.src as string | undefined) ?? '',
      });
      const title = textField({
        label: labels.name,
        value: (current?.node.attrs.title as string | undefined) ?? '',
      });
      attachFilePicker(editor, url, 'media', (picked) => {
        if (picked.title) title.input.value = picked.title;
      });
      editor.ui.openDialog({
        title: labels.title,
        body: h('div', { className: 'nova-form' }, url.el, title.el),
        submitLabel: labels.save,
        onSubmit: () => {
          const source = parseMediaUrl(url.input.value);
          if (!source) return labels.invalid;
          const { state, dispatch } = editor.view;
          const attrs = { ...source, title: title.input.value.trim() };
          const sel = selected();
          if (sel)
            dispatch(state.tr.setNodeMarkup(sel.from, undefined, { ...sel.node.attrs, ...attrs }));
          else
            dispatch(
              state.tr
                .replaceSelectionWith(editor.schema.nodes.media!.create(attrs))
                .scrollIntoView(),
            );
          return true;
        },
      });
    };

    editor.ui.registry.addToggleButton('media', {
      icon: ICON,
      tooltip: labels.title,
      isActive: () => selected() !== null,
      isEnabled: (e) => e.isEditable(),
      onAction: open,
    });
    editor.ui.registry.addMenuItem('media', { text: labels.title, icon: ICON, onAction: open });
  },
});
