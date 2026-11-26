import { definePlugin, type NodeViewFactory, type NovaPlugin } from '@novaprose/core';

/**
 * Узел «выноска» для песочниц React и Vue: свой вид узла (reactNodeView / vueNodeView) со списком
 * «тон», полем «заголовок» и редактируемым содержимым. Его гоняет e2e/node-views.spec.ts.
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
  '<p>Выноска нарисована компонентом:</p>' +
  '<div data-callout="" data-tone="info" data-title=""><p>Текст внутри выноски</p></div>';

export const TONES = [
  ['info', 'Инфо'],
  ['warning', 'Внимание'],
] as const;
