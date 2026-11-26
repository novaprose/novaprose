---
title: Web Component
description: "The <novaprose-editor> custom element: a native form field for plain HTML, Svelte and server-rendered pages."
---

<!-- Сгенерировано из packages/web-component/README.md: правьте README, затем pnpm --filter @novaprose/site sync-docs -->

The [NovaProse](/getting-started/) rich text editor as a standard HTML
element, `<novaprose-editor>`. It needs no framework and behaves like a native form field. Use it
in plain HTML forms, Svelte, Angular, Lit, Astro and server templates (Django, Rails, Laravel).

## No build step: one `<script>`

```html
<link
  rel="stylesheet"
  href="https://cdn.jsdelivr.net/npm/@novaprose/web-component@0.7/dist/novaprose.css"
/>
<script src="https://cdn.jsdelivr.net/npm/@novaprose/web-component@0.7/dist/novaprose.global.js"></script>

<form method="post">
  <novaprose-editor name="body" required>
    <p>Markup inside the tag is the initial content (visible even without JavaScript).</p>
  </novaprose-editor>
  <button>Save</button>
</form>
```

The script registers the element and exposes a global `NovaProse` with the whole core API
(`NovaProse.createEditor(...)`). It is safe to load in `<head>`: the element waits until the
document is parsed.

Parts that most pages never need (table editing, optional plugins, Office paste cleanup, plugin
dialogs, language packs) are separate files in `dist/novaprose-chunks/`, loaded on demand from the same address as the script.
Every ready-made language works: `<novaprose-editor language="de">` loads its pack before the
editor appears; with `NovaProse.createEditor`, call `await NovaProse.loadLanguage('de')` first.
To host the files yourself, copy the whole `dist` folder — the script, `novaprose.css` and `novaprose-chunks/`.
Chunk file names include a content hash, so caches never mix files from different versions.

## With a bundler

```bash
npm install @novaprose/web-component @novaprose/core
```

```ts
import '@novaprose/core/style.css';
import '@novaprose/web-component/define'; // registers <novaprose-editor>
// or: import { defineNovaProseEditor } from '@novaprose/web-component'; defineNovaProseEditor('my-editor');
```

## A real form field

| Feature                           | Behavior                                                              |
| --------------------------------- | --------------------------------------------------------------------- |
| `name`                            | the HTML is included in `FormData` and in regular form submissions    |
| `required`                        | an empty editor blocks submission and focus moves into the text       |
| `<button type="reset">`           | restores the initial content                                          |
| `disabled`, `<fieldset disabled>` | disables editing and excludes the field from `FormData`               |
| `readonly`                        | read-only, the value is still submitted                               |
| `input` event                     | fires on every change (like `<textarea>`)                             |
| `change` event                    | fires on blur if the content changed                                  |
| `value` property                  | current HTML; setting it skips undo history and does not fire `input` |

## Configuration

Attributes are read when the element connects: `toolbar`, `menubar`, `statusbar="false"`,
`placeholder`, `language`, `mode`. Pass any other core option through the `init` property
**before** inserting the element:

```ts
const el = document.createElement('novaprose-editor');
el.init = { plugins: ['insertdatetime'], uploadImage: async (file) => upload(file) };
document.body.append(el);
el.addEventListener('novaprose-ready', (e) => console.log(e.detail.editor));
```

After connecting, the editor instance is available as `el.editor` (`exec`, `getHTML`, `on`…).

## Frameworks

**Svelte**

```svelte
<script>
  import '@novaprose/web-component/define';
  let html = '<p>Hello</p>';
</script>

<novaprose-editor value={html} on:input={(e) => (html = e.currentTarget.value)} />
```

**Angular**: prefer [`@novaprose/angular`](/frameworks/angular/) for
`ngModel` and Reactive Forms. To use the element directly, add `CUSTOM_ELEMENTS_SCHEMA` to the
component `schemas` and bind `(input)="html = $any($event.target).value"`.
