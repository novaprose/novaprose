---
title: Shadow DOM and web components
description: Use the editor inside your own web component (Lit, Stencil, a design system) with an open or closed shadow root.
---

The editor works inside a shadow root, open or closed. Menus, dialogs, keyboard navigation and
selection work the same as on a regular page. This is tested in Chromium, Firefox and WebKit.

```ts
import { createEditor } from '@novaprose/core';
import css from '@novaprose/core/style.css?inline'; // Vite; other bundlers: a CSS-as-text loader

class ArticleEditor extends HTMLElement {
  connectedCallback() {
    const root = this.attachShadow({ mode: 'open' });
    // Page styles don't reach inside a shadow root: add the editor styles to the root itself.
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(css);
    root.adoptedStyleSheets = [sheet];

    const element = document.createElement('div');
    root.append(element);
    this.editor = createEditor({ element, content: this.innerHTML });
  }

  disconnectedCallback() {
    this.editor?.destroy();
  }
}
customElements.define('article-editor', ArticleEditor);
```

Without a bundler, link the stylesheet inside the root instead:
`root.innerHTML = '<link rel="stylesheet" href="/novaprose.css">'`.

## Good to know

- **Content styles.** `contentStyle` and `contentCss` are added to the shadow root automatically.
- **Dark theme.** `prefers-color-scheme` works as usual. `data-theme="dark"` must be set on an element
  inside the shadow root (for example, the element you pass to `createEditor`): attributes on the
  page's `<html>` can't reach inside.
- **Your own colors.** Override the `--nova-*` variables in a stylesheet inside the root, on
  `.nova-editor`.
- **Ready-made element.** If you don't need your own component, use
  [`<novaprose-editor>`](/frameworks/web-component/) — it works in regular forms.
