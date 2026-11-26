---
title: Node views
description: Draw a document node with your own React or Vue component — with controls and editable content inside.
---

A node's HTML comes from its `toDOM`. In the editor you can draw the same node with your own
component instead: add controls (a list, a field, buttons), show a live preview, and put the
editable content wherever the design needs it. The saved HTML does not change.

## React

```tsx
import { definePlugin } from '@novaprose/core';
import {
  NodeViewContent,
  NovaProseEditor,
  reactNodeView,
  type NodeViewProps,
} from '@novaprose/react';

function Callout({ node, updateAttributes }: NodeViewProps) {
  return (
    <div className="callout" data-tone={String(node.attrs.tone)}>
      <div contentEditable={false}>
        <select
          aria-label="Tone"
          value={String(node.attrs.tone)}
          onChange={(event) => updateAttributes({ tone: event.target.value })}
        >
          <option value="info">Info</option>
          <option value="warning">Warning</option>
        </select>
      </div>
      <NodeViewContent className="callout-body" />
    </div>
  );
}

const callout = definePlugin({
  name: 'callout',
  nodes: {
    callout: {
      group: 'block',
      content: 'paragraph+',
      attrs: { tone: { default: 'info' } },
      parseDOM: [
        { tag: 'div[data-callout]', getAttrs: (dom) => ({ tone: dom.dataset.tone ?? 'info' }) },
      ],
      toDOM: (node) => ['div', { 'data-callout': '', 'data-tone': node.attrs.tone }, 0],
    },
  },
  nodeViews: { callout: reactNodeView(Callout) },
});

export function Editor() {
  return <NovaProseEditor plugins={[callout]} />;
}
```

The component is rendered inside your React tree, so it sees your context: theme, translations,
data stores. `<NovaProseEditor>` does this by itself. With `useEditor`, render the `nodeViews` it
returns next to the container:

```tsx
const { ref, nodeViews } = useEditor({ plugins: [callout] });
return (
  <>
    <div ref={ref} />
    {nodeViews}
  </>
);
```

Nested components read the same props with `useNodeView()`.

## Vue

```ts
import { definePlugin } from '@novaprose/core';
import { NodeViewContent, nodeViewProps, vueNodeView } from '@novaprose/vue';
import { defineComponent, h } from 'vue';

const Callout = defineComponent({
  props: nodeViewProps,
  setup(props) {
    return () =>
      h('div', { class: 'callout', 'data-tone': String(props.node.attrs.tone) }, [
        h('div', { contenteditable: 'false' }, [
          h(
            'select',
            {
              'aria-label': 'Tone',
              value: String(props.node.attrs.tone),
              onChange: (event: Event) =>
                props.updateAttributes({ tone: (event.target as HTMLSelectElement).value }),
            },
            [h('option', { value: 'info' }, 'Info'), h('option', { value: 'warning' }, 'Warning')],
          ),
        ]),
        h(NodeViewContent, { class: 'callout-body' }),
      ]);
  },
});

const callout = definePlugin({
  name: 'callout',
  nodes: { callout: calloutSpec }, // the same spec as above
  nodeViews: { callout: vueNodeView(Callout) },
});
```

In a single-file component, use `defineProps(nodeViewProps)` and `<NodeViewContent />` in the
template. The component is rendered with `Teleport` inside your app, so `provide`/`inject`, the
router, translations and stores work. `<NovaProseEditor>` does this by itself; with `useEditor`,
render the returned component: `<component :is="nodeViews" />`. Nested components read the props
with `useNodeView()`.

## Props

| Prop                      | Description                                                               |
| ------------------------- | ------------------------------------------------------------------------- |
| `node`                    | the document node: `node.attrs`, `node.type.name`, `node.textContent`     |
| `updateAttributes(attrs)` | change attributes; one edit, undone with Ctrl+Z                           |
| `deleteNode()`            | remove the node                                                           |
| `selected`                | the whole node is selected (for nodes without editable content)           |
| `getPos()`                | the node's position in the document, `undefined` once it is removed       |
| `editor`                  | the editor                                                                |
| `contentDOM`              | the element with the editable content; `NodeViewContent` puts it in place |

## Things to know

- Put your controls in an element with `contentEditable={false}` (`contenteditable="false"` in
  Vue): some browsers don't let you type into a field inside editable text.
- Events of fields, lists, buttons and labels in the view stay with the view: typing in your field
  doesn't reach the document. Mark other interactive elements with `data-node-view-control`.
- Node views belong to the plugin object itself, not to its lazy `load` part: a view that appears
  later would make the editor redraw the whole document.
- `getHTML()` and [rendering on the server](/guides/server-rendering/) use `toDOM`; the view only
  changes what people see in the editor.

## Without a framework

`defineNodeView` from `@novaprose/core` takes a plain renderer, for example for a web component or
your own UI library:

```ts
import { defineNodeView } from '@novaprose/core';

const badgeView = defineNodeView(() => {
  let label: HTMLElement;
  return {
    mount(dom, props) {
      label = document.createElement('b');
      dom.append(label);
      this.update(props);
    },
    update(props) {
      label.textContent = `#${props.node.attrs.label}`;
    },
    destroy() {},
  };
});
```

Options (second argument of `defineNodeView`, `reactNodeView` and `vueNodeView`): `as` — the tag
of the view's root (`div`, or `span` for inline nodes), `contentAs` — the tag of the content
element, `className`, and `stopEvent(event)` to decide yourself which events the view keeps.
