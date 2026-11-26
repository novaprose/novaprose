---
title: Your own toolbar (headless)
description: Hide the built-in interface and build your own controls with React hooks, Vue composables or plain JavaScript.
---

The built-in toolbar is optional. Turn it off and drive the editor from your own design system:
every button, list and menu below uses the same public API as the built-in interface, and keyboard
shortcuts (Ctrl+B, Ctrl+Z…) keep working.

```ts
createEditor({ element, toolbar: false, statusbar: false });
```

Keep `@novaprose/core/style.css`: it styles the document itself (lists, tables, images, the
focus ring), and its interface rules simply stay unused.

## React

```tsx
import { applyLink, setStyle } from '@novaprose/core';
import {
  useCommand,
  useEditor,
  useEditorState,
  type CommandName,
  type Editor,
} from '@novaprose/react';

function CommandButton({
  editor,
  command,
  label,
}: {
  editor: Editor | null;
  command: CommandName;
  label: string;
}) {
  const { active, enabled, run } = useCommand(editor, command);
  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={!enabled}
      onMouseDown={(event) => event.preventDefault()} // keep the selection in the text
      onClick={run}
    >
      {label}
    </button>
  );
}

const BLOCKS = [
  ['paragraph', 'Text'],
  ['h1', 'Heading 1'],
  ['h2', 'Heading 2'],
] as const;

function BlockSelect({ editor }: { editor: Editor | null }) {
  const block = useEditorState(editor, (e) => BLOCKS.find(([name]) => e.isActive(name))?.[0]);
  return (
    <select
      aria-label="Block type"
      value={block ?? 'paragraph'}
      onChange={(event) => editor?.exec(event.target.value as CommandName)}
    >
      {BLOCKS.map(([name, label]) => (
        <option key={name} value={name}>
          {label}
        </option>
      ))}
    </select>
  );
}

export function MyEditor() {
  const { ref, editor } = useEditor({ content: '<p>Hello</p>', toolbar: false, statusbar: false });
  const words = useEditorState(editor, (e) => e.getText().split(/\s+/).filter(Boolean).length);
  return (
    <>
      <div role="toolbar" aria-label="Formatting">
        <BlockSelect editor={editor} />
        <CommandButton editor={editor} command="bold" label="Bold" />
        <CommandButton editor={editor} command="italic" label="Italic" />
        <CommandButton editor={editor} command="bulletList" label="List" />
        <button
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            const href = prompt('Link address');
            if (href) editor?.exec(applyLink({ href }));
          }}
        >
          Link
        </button>
        <button
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => editor?.chain().exec(setStyle('color', '#d1242f')).exec('bold').run()}
        >
          Alert
        </button>
      </div>
      <div ref={ref} />
      <p>Words: {words ?? 0}</p>
    </>
  );
}
```

- `useCommand(editor, name)` gives `{ active, enabled, run }` for a [named command](/reference/api/#commands).
- `useEditorState(editor, selector)` re-renders only when the selector's result changes, so a big
  toolbar stays fast.
- Commands with parameters are functions: `applyLink({ href })`, `setStyle('color', value)`,
  `setLineHeight('1.5')`. Pass them to `exec`, or join several into one undo step with
  [`chain()`](/reference/api/#chains).
- `openLinkDialog(editor)` opens the built-in link dialog if you don't want your own.

## Vue

```vue
<script setup lang="ts">
import { useCommand, useEditor, useEditorState } from '@novaprose/vue';

const { el, editor } = useEditor({ content: '<p>Hello</p>', toolbar: false, statusbar: false });
const bold = useCommand(editor, 'bold');
const italic = useCommand(editor, 'italic');
const block = useEditorState(editor, (e) => (e.isActive('h2') ? 'h2' : 'paragraph'));
</script>

<template>
  <div role="toolbar" aria-label="Formatting">
    <select
      aria-label="Block type"
      :value="block ?? 'paragraph'"
      @change="editor?.exec(($event.target as HTMLSelectElement).value as 'h2' | 'paragraph')"
    >
      <option value="paragraph">Text</option>
      <option value="h2">Heading</option>
    </select>
    <button
      :aria-pressed="bold.active.value"
      :disabled="!bold.enabled.value"
      @mousedown.prevent
      @click="bold.run"
    >
      Bold
    </button>
    <button
      :aria-pressed="italic.active.value"
      :disabled="!italic.enabled.value"
      @mousedown.prevent
      @click="italic.run"
    >
      Italic
    </button>
  </div>
  <div ref="el" />
</template>
```

## Plain JavaScript

```html
<div role="toolbar" aria-label="Formatting" id="toolbar">
  <button type="button" data-command="bold">Bold</button>
  <button type="button" data-command="italic">Italic</button>
  <button type="button" data-command="undo">Undo</button>
</div>
<div id="editor"></div>
```

```ts
import { createEditor } from '@novaprose/core';

const editor = createEditor({
  element: document.querySelector('#editor')!,
  toolbar: false,
  statusbar: false,
});
const toolbar = document.querySelector('#toolbar')!;
const buttons = [...toolbar.querySelectorAll<HTMLButtonElement>('[data-command]')];

function update() {
  for (const button of buttons) {
    const { active, enabled } = editor.getCommandState(button.dataset.command as 'bold');
    button.setAttribute('aria-pressed', String(active));
    button.disabled = !enabled;
  }
}
editor.on('selectionChange', update);
editor.on('editableChange', update);
update();

toolbar.addEventListener('mousedown', (event) => event.preventDefault()); // keep the selection
toolbar.addEventListener('click', (event) => {
  const name = (event.target as Element).closest<HTMLElement>('[data-command]')?.dataset.command;
  if (name) editor.exec(name as 'bold');
});
```

## A menu over the selection

A floating menu needs the position of the selection. `editor.view` (ProseMirror's view) gives
screen coordinates of any document position:

```tsx
function SelectionMenu({ editor }: { editor: Editor | null }) {
  const at = useEditorState(editor, (e) => {
    const { from, to, empty } = e.view.state.selection;
    if (empty || !e.view.hasFocus()) return null;
    const start = e.view.coordsAtPos(from);
    const end = e.view.coordsAtPos(to);
    return { top: Math.min(start.top, end.top), left: (start.left + end.right) / 2 };
  });
  if (!at) return null;
  return (
    <div
      role="toolbar"
      aria-label="Selection"
      style={{ position: 'fixed', top: at.top - 44, left: at.left, transform: 'translateX(-50%)' }}
    >
      <CommandButton editor={editor} command="bold" label="Bold" />
      <CommandButton editor={editor} command="italic" label="Italic" />
    </div>
  );
}
```

The coordinates are relative to the window; if the page scrolls while the menu is open, recompute
them on `scroll` as well. The built-in [`quickbars`](/guides/custom-buttons-and-plugins/#built-in-plugins)
plugin is a ready-made selection toolbar if you don't need your own.

## Accessibility

Your controls replace the built-in ones, so they need what the built-in ones have:

- a `role="toolbar"` container with an `aria-label`, and a visible label or `aria-label` on every
  button and list;
- `aria-pressed` on toggles (bold, italic) and `disabled` when a command does not apply;
- `preventDefault()` on `mousedown`, so clicking a button keeps the selection in the text;
- a keyboard path to the toolbar: the built-in one is reached with Alt+F10, a custom one should be
  reachable with Tab before or after the text.
