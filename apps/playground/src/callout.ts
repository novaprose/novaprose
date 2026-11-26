import { definePlugin, type NodeViewFactory, type NovaPlugin } from '@novaprose/core';

/**
 * The "callout" node for the React and Vue playgrounds: a custom node view (reactNodeView / vueNodeView) with a
 * "tone" list, a "title" field and editable content. e2e/node-views.spec.ts drives it.
 */
export function calloutPlugin(view: NodeViewFactory): NovaPlugin {
  return definePlugin({
    name: 'callout',
    nodes: {
      callout: {
        group: 'block',
        content: 'paragraph+',
        attrs: { tone: { default: 'info' }, title: { default: '' } },
        parseDOM: [
          {
            tag: 'div[data-callout]',
            getAttrs: (dom) => ({
              tone: (dom as HTMLElement).dataset.tone === 'warning' ? 'warning' : 'info',
              title: (dom as HTMLElement).dataset.title ?? '',
            }),
          },
        ],
        toDOM: (node) => [
          'div',
          {
            'data-callout': '',
            'data-tone': node.attrs.tone === 'warning' ? 'warning' : 'info',
            'data-title': typeof node.attrs.title === 'string' ? node.attrs.title : '',
          },
          0,
        ],
      },
    },
    nodeViews: { callout: view },
  });
}

export const CALLOUT_CONTENT =
  '<p>A component draws this callout:</p>' +
  '<div data-callout="" data-tone="info" data-title=""><p>Text inside the callout</p></div>';

export const TONES = [
  ['info', 'Info'],
  ['warning', 'Warning'],
] as const;
