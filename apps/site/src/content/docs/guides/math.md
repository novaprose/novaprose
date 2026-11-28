---
title: Formulas
description: LaTeX formulas in a line and on their own line, rendered as MathML in the editor.
---

```ts
createEditor({ element, plugins: ['math'] });
```

- Type `$E=mc^2$` in text: the formula appears in the line. Like Pandoc, a space right after the
  opening or before the closing dollar keeps the text as is, so "costs $5 and $10" stays text, and
  `\$` is a plain dollar sign.
- Type `$$` and a space at the start of a line for a formula on its own line.
- The `math` button or a click on a formula opens a dialog with a LaTeX field and a live preview; the
  "On its own line" checkbox switches between the two kinds. Enter on a selected formula opens it
  too.

In the editor, formulas are drawn as MathML, which browsers render themselves, without fonts or
stylesheets. The converter (Temml, about 58 KB gzip) downloads only when a document has a formula.
A formula with an error shows its source with a wavy underline; the error is in its tooltip.

## Saved HTML

The HTML keeps the LaTeX source, in the format Tiptap also uses, with the formula text between
`\( \)` or `\[ \]`:

```html
<span data-type="inline-math" data-latex="E=mc^2">\(E=mc^2\)</span>
<div data-type="block-math" data-latex="\frac{a}{b}">\[\frac{a}{b}\]</div>
```

On your site, render the formulas with KaTeX or MathJax: both recognise the `\( \)` and `\[ \]`
delimiters out of the box, for example with KaTeX's auto-render:

```ts
import renderMathInElement from 'katex/contrib/auto-render';

renderMathInElement(document.querySelector('.article')!);
```

Markdown export writes formulas as `$…$` and `$$…$$`.

## Formulas from elsewhere

MathML, the format other editors, Word and many sites use for formulas, becomes LaTeX when it is
loaded or pasted: `<math>` in a line, `<math display="block">` on its own line. A formula that
carries its TeX source — as MathJax, KaTeX, Temml and Wikipedia write it — keeps that source
exactly. Otherwise its structure is read: letters and numbers, operators and symbols, fractions,
roots, sub- and superscripts, accents, sums and limits, brackets and matrices. A formula pasted
from a page comes once, without the picture some sites put next to it (KaTeX's drawn copy,
Wikipedia's image). Only the formula's text and structure are read, never its markup. Without the
plugin, a formula is kept as its text.

LaTeX commands that could run code or open links (`\href`, `\url`, `\includegraphics`, `\html…`)
are not executed in the editor.
