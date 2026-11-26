---
title: Getting started
description: Install NovaProse from npm or load it from a CDN and create your first editor.
---

NovaProse runs entirely in the browser. Install it from npm, or load a single script from a CDN.

:::note[Preview release]
NovaProse is in 0.x. The API may change between minor versions until 1.0. See the
[changelog](/changelog/).
:::

## Install from npm

```bash
npm install @novaprose/core
```

```ts
import { createEditor } from '@novaprose/core';
import '@novaprose/core/style.css';

const editor = createEditor({
  element: document.querySelector('#editor')!,
  content: '<p>Hello, world</p>',
});

editor.on('change', () => console.log(editor.getHTML()));
```

```html
<div id="editor"></div>
```

## Use a framework

| Framework                      | Package                    | Guide                                       |
| ------------------------------ | -------------------------- | ------------------------------------------- |
| React 18, 19 (Next.js, Remix)  | `@novaprose/react`         | [React](/frameworks/react/)                 |
| Vue 3 (Nuxt)                   | `@novaprose/vue`           | [Vue](/frameworks/vue/)                     |
| Angular 19+                    | `@novaprose/angular`       | [Angular](/frameworks/angular/)             |
| Plain HTML, Svelte, Astro, Lit | `@novaprose/web-component` | [Web Component](/frameworks/web-component/) |

## Load from a CDN (no build step)

```html
<link
  rel="stylesheet"
  href="https://cdn.jsdelivr.net/npm/@novaprose/web-component@0.7/dist/novaprose.css"
/>
<script src="https://cdn.jsdelivr.net/npm/@novaprose/web-component@0.7/dist/novaprose.global.js"></script>

<form method="post" action="/posts">
  <novaprose-editor name="body">
    <p>Hello, world</p>
  </novaprose-editor>
  <button>Save</button>
</form>
```

The script registers the `<novaprose-editor>` element and exposes a global `NovaProse` object with
the full API (`NovaProse.createEditor(...)`).

Parts that most pages never need (table editing, optional plugins, Office paste cleanup, plugin
dialogs) are separate files in `dist/novaprose-chunks/`, loaded on demand from the same address as the script.
To host the files yourself, copy the whole `dist` folder — the script, `novaprose.css` and `novaprose-chunks/`.
Chunk file names include a content hash, so caches never mix files from different versions.

## Save the content

`editor.getHTML()` returns clean HTML: every URL has passed the allowlist and only elements and
styles known to the editor remain. Still treat it as user input on your server: validate its size
and sanitize again if you render it somewhere the editor rules don't apply.

```ts
await fetch('/api/posts/42', {
  method: 'PUT',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ html: editor.getHTML() }),
});
```

## Next steps

- [Configure the toolbar and menus](/guides/toolbar-and-menus/)
- [Upload images to your server](/guides/images/)
- [Restrict what users can enter](/guides/content-restrictions/)
- [All options](/reference/options/) and [the editor API](/reference/api/)
