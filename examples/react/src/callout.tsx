import { definePlugin } from '@novaprose/core';
import { NodeViewContent, reactNodeView, type NodeViewProps } from '@novaprose/react';

const TONES = { info: 'Info', warning: 'Warning', success: 'Success' };

/** The callout as a React component: a list in the corner and editable text inside. */
function Callout({ node, updateAttributes }: NodeViewProps) {
  const tone = String(node.attrs.tone);
  return (
    <div className="callout" data-tone={tone}>
      <div className="callout-bar" contentEditable={false}>
        <select
          aria-label="Callout tone"
          value={tone}
          onChange={(event) => updateAttributes({ tone: event.target.value })}
        >
          {Object.entries(TONES).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <NodeViewContent className="callout-body" />
    </div>
  );
}

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
  nodeViews: { callout: reactNodeView(Callout) },
  setup(editor) {
    editor.ui.registry.addButton('callout', {
      text: 'Callout',
      tooltip: 'Insert a callout',
      onAction: (e) => e.insertContent('<div data-callout="" data-tone="info"><p>Note</p></div>'),
    });
  },
});
