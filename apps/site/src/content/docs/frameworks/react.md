---
title: React
description: "React component and hooks for NovaProse: controlled value, React Hook Form, Next.js."
---

<!-- Сгенерировано из packages/react/README.md: правьте README, затем pnpm --filter @novaprose/site sync-docs -->

React bindings for the [NovaProse](/getting-started/) rich text
editor: a ready-made `<NovaProseEditor>` component and hooks for building your own UI
(`useEditor`, `useEditorState`, `useCommand`). React 18 and 19, SSR-safe (Next.js, Remix).

```bash
npm install @novaprose/react @novaprose/core
```

```tsx
import '@novaprose/core/style.css';
```

## Component

```tsx
import { useState } from 'react';
import { NovaProseEditor } from '@novaprose/react';

function Post() {
  const [html, setHtml] = useState('<p>Hello</p>');
  return (
    <NovaProseEditor
      value={html}
      onChange={setHtml}
      init={{ toolbar: 'undo redo | bold italic | link image', menubar: true }}
    />
  );
}
```

| Prop                                                                  | What it does                                                                                   |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `value` / `onChange(html, editor)`                                    | controlled mode; an external `value` is not added to undo history and does not call `onChange` |
| `defaultValue`                                                        | uncontrolled mode                                                                              |
| `init`                                                                | any core option (`toolbar`, `menubar`, `plugins`, `uploadImage`…)                              |
| `editable`                                                            | read-only mode, can change at any time                                                         |
| `placeholder`, `toolbar`, `plugins`, `prosemirrorPlugins`, `language` | common options as props (take precedence over `init`)                                          |
| `name`                                                                | renders `<input type="hidden">` with the HTML for native forms and `FormData`                  |
| `onReady`, `onFocus`, `onBlur`                                        | lifecycle and focus events                                                                     |
| `id`, `className`, `style`                                            | container attributes                                                                           |
| `ref`                                                                 | the `Editor` instance (`getHTML`, `exec`, `focus`…)                                            |

`init` is read on mount. To apply new options, change the component `key`.

### React Hook Form

```tsx
<Controller
  name="body"
  control={control}
  rules={{ validate: (html) => html !== '<p></p>' || 'Please write something' }}
  render={({ field }) => (
    <NovaProseEditor
      ref={field.ref} // lets RHF focus the editor on a validation error
      value={field.value}
      onChange={field.onChange}
      onBlur={field.onBlur}
    />
  )}
/>
```

`reset()` changes `value` from outside. That does not trigger `onChange`, so the field does not
become dirty.

### Next.js (App Router)

The package is marked `'use client'`, so you can import it directly from a server component. The
server renders an empty container; the editor is created in the browser.

## Hooks: build your own UI

```tsx
import {
  useCommand,
  useEditor,
  useEditorState,
  type CommandName,
  type Editor,
} from '@novaprose/react';

function Button({ editor, command }: { editor: Editor | null; command: CommandName }) {
  const { active, enabled, run } = useCommand(editor, command);
  return (
    <button
      aria-pressed={active}
      disabled={!enabled}
      onMouseDown={(e) => e.preventDefault()} // keep focus in the text
      onClick={run}
    >
      {command}
    </button>
  );
}

function MyEditor() {
  const { ref, editor } = useEditor({ content: '<p>…</p>', toolbar: false });
  const words = useEditorState(editor, (e) => e.getText().split(/\s+/).filter(Boolean).length);
  return (
    <>
      <Button editor={editor} command="bold" />
      <div ref={ref} />
      <p>Words: {words ?? 0}</p>
    </>
  );
}
```

- `useEditor(options, deps?)` returns `{ ref, editor }`. Callbacks in `options` are always the
  latest ones; changing `deps` recreates the editor.
- `useEditorState(editor, selector, isEqual?)` re-renders only when the selector result changes
  (shallow comparison by default).
- `useCommand(editor, name)` returns `{ active, enabled, run }` for a named command.
