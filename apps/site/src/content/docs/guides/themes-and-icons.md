---
title: Themes, skins and icons
description: Light and dark themes, your brand colors through design tokens, ready-made skins, and icon packs (Tabler, Phosphor or your own).
---

The editor's look is in layers, and each one can be changed on its own:

- **the theme**: light or dark, chosen by the reader's system or by your page;
- **design tokens**: CSS variables for every color, size and corner;
- **a skin**: a ready-made set of shapes and spacing (rounded, square, compact);
- **icons**: the built-in set, a pack from another icon family, or your own.

## Light and dark

`@novaprose/core/style.css` has both themes. The editor follows the system setting
(`prefers-color-scheme`). To choose for it, put `data-theme` on any element around it, the `<html>`
element of your page included:

```html
<html data-theme="dark">
  <!-- every editor on the page is dark -->
</html>

<div data-theme="light">
  <!-- this one stays light whatever the system says -->
</div>
```

Switching is instant: change the attribute, and the editor, its menus and its dialogs follow.

## Design tokens

Every color and size of the interface is a `--nova-*` CSS variable on `.nova-editor`. These are the
ones you will want most:

| Token                                                | What it is                                                         |
| ---------------------------------------------------- | ------------------------------------------------------------------ |
| `--nova-bg`, `--nova-fg`                             | the text area and its text                                         |
| `--nova-toolbar-bg`, `--nova-surface`                | the toolbar; menus, dialogs and panels                             |
| `--nova-muted`                                       | secondary text (hints, counters, shortcuts)                        |
| `--nova-border`, `--nova-control-border`             | dividers; the edge of fields and of the editor                     |
| `--nova-hover`, `--nova-pressed`                     | a control under the pointer, and while it is pressed               |
| `--nova-active`, `--nova-active-fg`                  | a control that is on (bold inside bold text)                       |
| `--nova-accent`, `--nova-accent-hover`               | links, the main button, the current item                           |
| `--nova-accent-strong`, `--nova-accent-strong-hover` | fills with white text (`--nova-accent-fg`)                         |
| `--nova-focus`                                       | the focus ring                                                     |
| `--nova-selection`                                   | selected text                                                      |
| `--nova-radius`, `--nova-radius-sm`                  | corners: the editor and dialogs; controls and fields               |
| `--nova-control-size`, `--nova-icon-size`            | the height of controls (32 px, 40 on touch screens); icons (18 px) |
| `--nova-font`, `--nova-ui-font-size`                 | the interface font and its size                                    |
| `--nova-content-font-size`, `--nova-mono`            | the size of the text; the code font                                |
| `--nova-min-height`                                  | the smallest height of the text area                               |

The full list, with the light and dark values, is at the top of
[`style.css`](https://github.com/novaprose/novaprose/blob/main/packages/core/src/style.css).

### Your brand color

Set the tokens after `style.css`, once for the light theme and once for the dark one. The dark
theme turns on in two ways (the system setting and `data-theme="dark"`), so its rule has two
selectors:

```css
/* Light, and the base for both. */
.nova-editor {
  --nova-accent: #6d28d9;
  --nova-accent-hover: #5b21b6;
  --nova-accent-strong: #6d28d9;
  --nova-accent-strong-hover: #5b21b6;
  --nova-active: #ede9fe;
  --nova-active-fg: #6d28d9;
  --nova-focus: #6d28d9;
  --nova-selection: rgba(109, 40, 217, 0.18);
}

/* Dark: chosen by the page… */
[data-theme='dark'] .nova-editor {
  --nova-accent: #a78bfa;
  --nova-accent-hover: #c4b5fd;
  --nova-accent-strong: #7c3aed;
  --nova-accent-strong-hover: #6d28d9;
  --nova-active: #2e1065;
  --nova-active-fg: #c4b5fd;
  --nova-focus: #a78bfa;
  --nova-selection: rgba(167, 139, 250, 0.3);
}

/* …or by the system, unless the page asks for light. */
@media (prefers-color-scheme: dark) {
  .nova-editor:not([data-theme='light'] *) {
    --nova-accent: #a78bfa;
    --nova-accent-hover: #c4b5fd;
    --nova-accent-strong: #7c3aed;
    --nova-accent-strong-hover: #6d28d9;
    --nova-active: #2e1065;
    --nova-active-fg: #c4b5fd;
    --nova-focus: #a78bfa;
    --nova-selection: rgba(167, 139, 250, 0.3);
  }
}
```

The built-in values meet WCAG 2.2 AA in both themes, on every surface and in every state. Keep that
true for your colors: text tokens (`--nova-fg`, `--nova-muted`, `--nova-accent`,
`--nova-active-fg`) need at least 4.5:1 against `--nova-bg`, `--nova-toolbar-bg` and
`--nova-surface`; white text needs 4.5:1 on `--nova-accent-strong`; `--nova-control-border` and
`--nova-focus` need 3:1 against the surfaces they sit on. The violet above passes all of them.

## Skins

A skin changes shapes and spacing, never colors, so it works with both themes and with your tokens.
Import one after the editor's style:

```ts
import '@novaprose/core/style.css';
import '@novaprose/core/skins/rounded.css';
```

| Skin          | What changes                                                                                       |
| ------------- | -------------------------------------------------------------------------------------------------- |
| `rounded.css` | softer corners, round controls and fields, airier toolbar                                          |
| `square.css`  | straight corners everywhere, for interfaces without rounded shapes                                 |
| `compact.css` | 28 px controls and 16 px icons, tighter toolbar, for side panels and narrow forms (40 px on touch) |

Skins only set tokens and a few spacing rules, so you can start from one and adjust a token or two
after it. Controls never get smaller than 24 px (WCAG 2.5.8), and the compact skin keeps 40 px
controls on touch screens.

Without a bundler, link the same files from a CDN after the editor's style sheet:

```html
<link
  rel="stylesheet"
  href="https://cdn.jsdelivr.net/npm/@novaprose/core@0.10/src/skins/compact.css"
/>
```

## Icon packs

The editor's icons come from [Lucide](https://lucide.dev). Two more families are ready as packs,
each with every icon the editor uses: [Tabler Icons](https://tabler.io/icons) and
[Phosphor](https://phosphoricons.com). A pack is a separate file: it loads only when you import it.

```ts
import { createEditor } from '@novaprose/core';
import phosphor from '@novaprose/core/icons/phosphor'; // or '@novaprose/core/icons/tabler'

createEditor({ element, icons: phosphor });
```

The pack redraws the whole interface: the toolbar and menus, the arrows of dropdowns, the "more"
button, dialogs, notifications, the image and table toolbars, and the buttons of plugins.

The [web component](/frameworks/web-component/) takes the pack through `init`:
`el.init = { icons: phosphor }`. Without a bundler, the packs are ES modules with nothing to
install:

```html
<script type="module">
  import tabler from 'https://cdn.jsdelivr.net/npm/@novaprose/core@0.10/dist/icons/tabler.js';
  NovaProse.createEditor({ element: document.querySelector('#editor'), icons: tabler });
</script>
```

### Your own icons

`icons` takes any SVGs by icon name, so a pack of your own is an object. Icons it doesn't have stay
the built-in ones, so it can replace just a few:

```ts
createEditor({
  element,
  icons: {
    bold: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">…</svg>',
    italic: '<svg viewBox="0 0 24 24">…</svg>',
  },
});
```

The names are the keys of the `icons` export (`import { icons } from '@novaprose/core'`): `bold`,
`alignLeft`, `chevronDown`, `more`, `close`, `check` and the rest. Draw with `currentColor`: icons
then take the color of the theme, of hover and of the pressed state.

`editor.ui.registry.addIcon(name, svg)` adds or replaces one icon by name. Call it in `setup` (or in
a plugin's setup), before the toolbar is drawn; after that, `editor.rebuildToolbar()` redraws the
toolbar with it. Your own buttons use any icon by name:

```ts
createEditor({
  element,
  toolbar: 'bold italic | signature',
  setup(editor) {
    editor.ui.registry.addIcon('signature', '<svg viewBox="0 0 24 24">…</svg>');
    editor.ui.registry.addButton('signature', {
      icon: 'signature',
      tooltip: 'Insert signature',
      onAction: (e) => e.insertContent('<p>— Anna</p>'),
    });
  },
});
```

An SVG file can go in as a drawing app saved it: an XML declaration, a doctype and comments before
`<svg>` are fine. Icons are drawn at `--nova-icon-size`, whatever size the SVG says. They are drawn
as markup, so the editor keeps one `<svg>` element with SVG elements only and leaves out what an
icon has no use for: scripts, `<style>`, event handlers, links, animation, embedded HTML and text
(`<title>`, `<desc>`). Icons are decorative (`aria-hidden`): a control's name comes from its
tooltip, never from the icon.

## Coming from TinyMCE

`tinymce.init()` from `@novaprose/tinymce-compat` takes an icon pack the way the TinyMCE
documentation describes it. A pack's script registers its icons with
`tinymce.IconManager.add(name, { icons })`, and the `icons` option picks it by name. With
`icons_url`, the script is loaded before the editors are created, from an http or https address
only. The pack's icons, under TinyMCE's icon names (`bold`, `chevron-down`, `more-drawer`,
`table-insert-row-after`…), redraw NovaProse's own buttons too. What the pack lacks stays built in.
`skin` and `skin_url` aren't needed: use the tokens and skins above.
