# @novaprose/vue

Vue 3 bindings for the [NovaProse](https://www.npmjs.com/package/@novaprose/core) rich text
editor: a `<NovaProseEditor>` component with `v-model` and composables for building your own UI
(`useEditor`, `useEditorState`, `useCommand`). SSR-safe (Nuxt).

> **Status: 0.x preview.** The API may change between minor versions until 1.0.

```bash
npm install @novaprose/vue @novaprose/core
```

```ts
import '@novaprose/core/style.css';
```

## Component

```vue
<script setup lang="ts">
import { ref } from 'vue';
import { NovaProseEditor } from '@novaprose/vue';

const html = ref('<p>Hello</p>');
</script>

<template>
  <NovaProseEditor
    v-model="html"
    :init="{ toolbar: 'undo redo | bold italic | link', menubar: true }"
  />
</template>
```

| Prop / event                                                          | What it does                                                                                |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `v-model` (`modelValue` / `update:modelValue`)                        | two-way HTML binding; external values are not added to undo history and are not echoed back |
| `defaultValue`                                                        | initial value without `v-model`                                                             |
| `init`                                                                | any core option (`toolbar`, `menubar`, `plugins`, `uploadImage`…)                           |
| `editable`                                                            | read-only mode, can change at any time                                                      |
| `placeholder`, `toolbar`, `plugins`, `prosemirrorPlugins`, `language` | common options as props (take precedence over `init`)                                       |
| `name`                                                                | renders `<input type="hidden">` with the HTML for native forms                              |
| `@ready`, `@focus`, `@blur`                                           | receive the `Editor` instance                                                               |
| `class`, `style`, `id`, `aria-*`                                      | applied to the container                                                                    |

A template ref exposes `{ editor, focus() }`. `init` is read on mount; change `key` to apply new
options. With VeeValidate, use `v-model` (`useField` → `value`) and `@blur`.

### Nuxt

The server renders an empty container and the editor is created after mount, so `<ClientOnly>` is
not required.

## Composables: build your own UI

```vue
<script setup lang="ts">
import { useCommand, useEditor, useEditorState } from '@novaprose/vue';

const { el, editor } = useEditor({ content: '<p>…</p>', toolbar: false });
const bold = useCommand(editor, 'bold');
const words = useEditorState(editor, (e) => e.getText().split(/\s+/).filter(Boolean).length);
</script>

<template>
  <button
    :aria-pressed="bold.active.value"
    :disabled="!bold.enabled.value"
    @mousedown.prevent
    @click="bold.run"
  >
    B
  </button>
  <div ref="el" />
  <p>Words: {{ words ?? 0 }}</p>
</template>
```

- `useEditor(options)` returns `{ el, editor, nodeViews }`. The editor is created when `el` is mounted and
  destroyed on unmount.
- `useEditorState(editor, selector, isEqual?)` returns a `ShallowRef` that updates only when the
  selector result changes (shallow comparison by default).
- `useCommand(editor, name)` returns `{ active, enabled, run }`; `editor` can be a ref or a getter.

## Node views: draw a node with a component

```vue
<!-- Callout.vue -->
<script setup lang="ts">
import { NodeViewContent, nodeViewProps } from '@novaprose/vue';
const props = defineProps(nodeViewProps);
</script>

<template>
  <div class="callout" :data-tone="props.node.attrs.tone">
    <div contenteditable="false">
      <select
        :value="props.node.attrs.tone"
        @change="props.updateAttributes({ tone: ($event.target as HTMLSelectElement).value })"
      >
        <option value="info">Info</option>
        <option value="warning">Warning</option>
      </select>
    </div>
    <NodeViewContent />
  </div>
</template>
```

```ts
import { definePlugin } from '@novaprose/core';
import { vueNodeView } from '@novaprose/vue';
import Callout from './Callout.vue';

const callout = definePlugin({
  name: 'callout',
  nodes: { callout: calloutSpec }, // parseDOM / toDOM as usual
  nodeViews: { callout: vueNodeView(Callout) },
});
```

- The component renders inside your app (`Teleport`), so `provide`/`inject`, the router and stores
  work. With `useEditor`, render the returned component: `<component :is="nodeViews" />`.
- `updateAttributes()` is one undo step; `useNodeView()` gives nested components the same props.
- The saved HTML still comes from `toDOM`. Details: [Node views](https://novaprose.com/guides/node-views/).

## License

MIT
