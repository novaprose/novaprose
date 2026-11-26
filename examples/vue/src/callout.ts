import { definePlugin } from '@novaprose/core';
import { vueNodeView } from '@novaprose/vue';
import Callout from './Callout.vue';

/** A new block type: its HTML comes from toDOM, the editor draws it with the component. */
export const callout = definePlugin({
  name: 'callout',
  nodes: {
    callout: {
      group: 'block',
      content: 'paragraph+',
      attrs: { tone: { default: 'info' } },
      parseDOM: [
        { tag: 'div[data-callout]', getAttrs: (dom) => ({ tone: dom.dataset.tone ?? 'info' }) },
      ],
      toDOM: (node) => ['div', { 'data-callout': '', 'data-tone': String(node.attrs.tone) }, 0],
    },
  },
  nodeViews: { callout: vueNodeView(Callout) },
  setup(editor) {
    editor.ui.registry.addButton('callout', {
      text: 'Callout',
      tooltip: 'Insert a callout',
      onAction: (e) => e.insertContent('<div data-callout="" data-tone="info"><p>Note</p></div>'),
    });
  },
});
