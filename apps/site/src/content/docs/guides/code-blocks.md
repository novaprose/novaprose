---
title: Code blocks and syntax highlighting
description: Code blocks with a language, syntax highlighting while editing, and highlighted code on your site.
---

Code blocks are part of the core: the `codeblock` button, the block style menu, the slash menu and
the Markdown fence. Type three backticks and press Space or Enter; add a language right after them
to set it: ` ```ts `.

The saved HTML is `<pre><code class="language-ts">…</code></pre>`, the convention of CommonMark,
highlight.js and Prism, so highlighting libraries on your site recognize it. When loading HTML,
NovaProse also reads the language from `<pre class="language-x">` (TinyMCE, Prism), `lang-x`
(Prettify) and `data-language`.

## Highlighting while editing

```ts
createEditor({ element, plugins: ['codesample'] });
```

The `codesample` plugin:

- colors code by language as you type;
- shows the language in the corner of each block, and a language menu above the block with the
  cursor (Ctrl+F9 moves keyboard focus to it);
- adds the `codesample` button and menu item: a dialog to paste code and pick its language. With the
  cursor in a code block, the dialog edits that block.

Highlighting only decorates the text on screen. It never changes the document or `getHTML()`.

**What it costs.** The plugin is about 6 KB gzip. The highlighter (highlight.js, about 8 KB) and
each language grammar (0.3–5 KB) download only when a code block in that language appears: a
document with JavaScript code adds about 11 KB, a document without code adds nothing. Blocks over
20,000 characters are recolored after a short pause in typing instead of on every keystroke.

## Languages

27 languages out of the box: Bash, C, C++, C#, CSS, Diff, Dockerfile, Go, GraphQL, HTML, Java,
JavaScript, JSON, Kotlin, Lua, Markdown, PHP, PowerShell, Python, Ruby, Rust, SCSS, SQL, Swift,
TypeScript, XML and YAML. Common short names are highlighted too: `js`, `ts`, `tsx`, `sh`, `py`,
`yml`, `html`, `markup`, `c++`, `cs` and others.

Set the list shown in the menu and the dialog, and add any
[highlight.js grammar](https://github.com/highlightjs/highlight.js/blob/main/SUPPORTED_LANGUAGES.md):

```ts
createEditor({
  element,
  plugins: ['codesample'],
  pluginOptions: {
    codesample: {
      languages: [
        { value: 'javascript', label: 'JavaScript' },
        { value: 'php', label: 'PHP' },
        { value: '1c', label: '1C:Enterprise' },
      ],
      grammars: {
        '1c': () => import('highlight.js/lib/languages/1c'),
      },
    },
  },
});
```

`value` is what goes into `class="language-…"`. A block whose language is not in the list keeps
its language and shows it as written.

## Colors

Token colors are CSS variables with at least 4.5:1 contrast in the light and dark themes. Override
any of them:

```css
.nova-editor {
  --nova-code-keyword: #d73a49;
  --nova-code-string: #032f62;
}
```

The variables are `--nova-code-keyword`, `--nova-code-string`, `--nova-code-comment`,
`--nova-code-number`, `--nova-code-function`, `--nova-code-type`, `--nova-code-attr`,
`--nova-code-meta`, `--nova-code-deleted` and `--nova-code-inserted` (with `-bg` variants for the
last two). The block background is `--nova-code-bg`.

Tokens carry highlight.js class names (`hljs-keyword`, `hljs-string`…) and the built-in rules have
zero specificity, so a highlight.js theme stylesheet on the page takes over without `!important`.

## Highlighted code on your site

The saved HTML has no colors. Highlight it where you display it with the library you prefer, for
example highlight.js:

```ts
import hljs from 'highlight.js';

document.querySelectorAll('pre code').forEach((el) => hljs.highlightElement(el));
```

## Pasting from VS Code

Copy several lines in VS Code and paste them: they become a code block in the file's language,
without the editor theme's colors and fonts. A single line, plain text or Markdown is pasted as
ordinary text.

## Coming from TinyMCE

With [`@novaprose/tinymce-compat`](/guides/migrating-from-tinymce/), `plugins: 'codesample'` uses
this plugin. `codesample_languages` sets the language list (Prism names such as `markup` and
`csharp` are highlighted as well), `codesample_global_prismjs` is no longer needed, and
`execCommand('CodeSample')` opens the dialog. Existing `<pre class="language-x"><code>` content
keeps its language.
