---
title: Versioning and support
description: How NovaProse numbers its releases, what counts as public API, how breaking changes are announced, and which browsers are supported.
---

## Versions

NovaProse follows [Semantic Versioning](https://semver.org/). All packages — `@novaprose/core`,
the React, Vue and Angular wrappers, the web component, the compatibility layer and collaboration —
are released together under one version number, so they always fit each other.

- **Until 1.0**, a minor version (0.7 → 0.8) may contain breaking changes. Each one is listed in the
  [changelog](/changelog/) under **Breaking** or marked **Changed**, with what to do instead.
- **From 1.0**, breaking changes come only in a major version. Before something is removed, it
  keeps working for at least one minor version and logs a warning in the console that names its
  replacement.

## What is public API

The rules above cover:

- the `Editor` class and everything it exposes (`getHTML`, `setContent`, `exec`, `can`, `chain`,
  `on`, `ready`, `ui`…), and the options of `createEditor`;
- named commands such as `editor.exec('bold')` — renaming one is a breaking change;
- events and what they carry;
- the exports of each package, the attributes and events of `<novaprose-editor>`, and the
  `tinymce.init()` options listed as supported;
- the `--nova-*` CSS variables of the theme;
- your saved documents: HTML and JSON written by one version load in later versions. When the HTML
  an editor produces changes — for example, an attribute that used to be dropped is now kept — the
  changelog says so.

They don't cover the class names and DOM structure of the editor's toolbar, menus and dialogs
(style them through the `--nova-*` variables), or the file names of the parts the CDN build loads
on demand, which change with every build.

## Browsers

Every change is tested in the current Chromium, Firefox and WebKit engines and on an emulated
Android phone. NovaProse supports the last two major versions of Chrome, Edge, Firefox and Safari on the
desktop, Safari on iOS and Chrome on Android. Opening and saving Word documents needs
`CompressionStream`: Chrome and Edge 103, Firefox 113, Safari 16.4 or later.

Rendering on the server (`createRenderer`, `renderHTML`) and Word conversion from code run in
Node.js 18 and later, without a DOM.

## Security fixes

Until 1.0, security fixes are released for the latest minor version. To report a vulnerability,
see the [security policy](https://github.com/novaprose/novaprose/blob/main/SECURITY.md) — please
write to security@novaprose.com rather than opening a public issue.
