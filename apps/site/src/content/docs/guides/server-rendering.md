---
title: Rendering on the server
description: Turn saved documents into HTML without an editor or a browser — for emails, previews and server-rendered pages.
---

Save the document as JSON (`editor.getJSON()`) and turn it into HTML wherever you need it: in
Node, in a serverless function or a worker, at build time. No editor and no DOM are created. The
HTML is exactly what `getHTML()` returns in an editor with the same options.

```ts
import { createRenderer } from '@novaprose/core';

const renderer = createRenderer({ plugins: ['mentions', 'math'] });

const html = renderer.html(savedJson); // same as editor.getHTML()
const text = renderer.text(savedJson); // same as editor.getText(): search index, plain-text email
```

`createRenderer` builds the document schema once, so one renderer serves any number of documents.
For a single document there is a shortcut:

```ts
import { renderHTML } from '@novaprose/core';

const html = renderHTML(savedJson, { plugins: ['mentions'] });
```

## Use the editor's options

Only some options shape the HTML. Pass the same values as to `createEditor`, or keep them in one
shared module and import it on both sides:

| Option                                    | Why it matters                                                      |
| ----------------------------------------- | ------------------------------------------------------------------- |
| `plugins`, `pluginOptions`                | nodes added by plugins and their settings (attribute names, states) |
| `formats`, `styleFormats`, `validClasses` | which classes the document may keep                                 |
| `tableClassList`, `tableCellClassList`    | table classes                                                       |
| `validElements`, `invalidElements`        | [content restrictions](/guides/content-restrictions/)               |
| `validStyles`                             | allowed inline styles                                               |
| `extendedValidElements`, `customElements` | after `registerHtmlRules(htmlRules)`, as in the editor              |
| `direction`, `language`                   | in right-to-left documents an indent is `margin-right`, not `-left` |

Plugins without their own nodes (buttons, autosave, word count…) don't change the HTML and are
skipped, and the parts of plugins that run in the editor (dialogs, buttons) are never loaded on
the server.

If the editor takes its direction from the page (`<html dir="rtl">` and no `direction` option),
pass `direction: 'rtl'` to the renderer.

## Safety

Rendering a document from your database goes through the same checks as in the editor:

- links and images keep only safe addresses: `javascript:` and similar URLs never reach the HTML;
- an attribute of the wrong type (`colspan: null`, a level `"x"`) is replaced with its default
  instead of failing the whole document;
- content restrictions (`invalidElements` and others) are applied to the JSON as well.

A node type the schema doesn't know (for example, from a plugin you no longer use) throws, as
`setContent` does. Catch the error if documents may come from older configurations.

## Things to know

- **Formulas** (`math`) render as their LaTeX source in `\( \)` and `\[ \]`; KaTeX or MathJax
  on your page turns them into formulas. See [Formulas](/guides/math/).
- **Table of contents** entries are stored in the document, so the renderer outputs them as the
  editor saved them.
- **Own plugins**: when `nodes` is a function, on the server it receives an object with `options`
  only — read your settings from `options.pluginOptions`.
- Input is JSON. HTML needs a browser parser: to clean up HTML on the server, load it into an
  editor in the browser first and save its JSON.
