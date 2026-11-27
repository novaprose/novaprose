---
title: Typography
description: Typographic quotes, dashes and symbols as each language writes them, for the selection or the whole text, in one click — in the browser.
---

With the `typography` plugin, the **Enhance typography** button gives the selection (or the whole
text, when nothing is selected) the typography of its language:

| Typed                    | English   | German      | French      | Russian     |
| ------------------------ | --------- | ----------- | ----------- | ----------- |
| `"quotes"`               | “quotes”  | „quotes“    | « quotes »  | «quotes»    |
| `'nested'` inside quotes | ‘nested’  | ‚nested‘    | “nested”    | „nested“    |
| `word - word`            | word—word | word – word | word – word | word — word |
| `don't`                  | don’t     |             |             |             |

and in every language: `...` → …, `(c) 2026` → © 2026, `Name(tm)` → Name™, `->` → →, `=>` → ⇒,
`<=` → ≤, `>=` → ≥, `!=` → ≠, `+-5` → ±5, `1/2` → ½, `10x20` → 10×20, no doubled spaces or space
before a comma, and non-breaking spaces where a line must not break (`5 kg`, `§ 3`; after short
prepositions in Slavic languages; before `; : ! ?` in French).

- It changes the text only, never its formatting: bold stays bold, a link stays a link.
- Code, web and email addresses, `code in backticks` and text suggested for deletion are left as
  they are. `(c)` in a list of items "(a) (b) (c)" and `5"` (inches) are not touched either.
- All the changes are one step: <kbd>Ctrl</kbd>+<kbd>Z</kbd> takes them back at once. In
  [suggesting mode](/guides/suggested-edits/) they are suggestions.
- Everything happens in the browser.

```ts
createEditor({
  element,
  plugins: ['typography'],
  pluginOptions: {
    typography: {
      language: 'de', // by default: the autocorrect or spell checker language, then the page's
      languages: ['de', 'en-US', 'fr'], // in the button's menu
      rules: { nbsp: false }, // turn rules off
      ignore: ['link'], // formatting and blocks left alone, besides code
    },
  },
});
```

The button's arrow chooses the language; the choice is applied at once and remembered for next
time (`remember: false` keeps it to this page). Built-in conventions: English (US and UK),
German, French, Spanish, Italian, Portuguese (Portugal and Brazil), Catalan, Dutch, Swedish,
Finnish, Danish, Norwegian, Polish, Czech, Slovak, Hungarian, Romanian, Turkish, Greek, Russian,
Ukrainian and Belarusian; another language gets English typography.

| Rule        | What it does                                                                       |
| ----------- | ---------------------------------------------------------------------------------- |
| `quotes`    | typographic quotes and apostrophes of the language                                 |
| `dashes`    | dashes between words, and a dash that starts a line of dialogue (Russian, Spanish) |
| `ellipsis`  | `...` → …                                                                          |
| `symbols`   | ©, ®, ™                                                                            |
| `arrows`    | → ← ↔ ⇒ ⇔                                                                          |
| `math`      | ≤ ≥ ≠ ± ×                                                                          |
| `fractions` | ½ ¼ ¾ ⅓ ⅔                                                                          |
| `spaces`    | no doubled spaces, no space before `, .`; French spacing; no doubled `,` `;` `:`   |
| `nbsp`      | non-breaking spaces: numbers and units, `§`, short words in Slavic languages       |

The `typography` button and menu item (also in the **Tools** menu) apply it; with
`tinymce.init()`, `plugins: 'typography'` works with `typography_default_lang`,
`typography_langs`, `typography_rules` (Typograf rule ids, mapped to the rules above),
`typography_ignore` and the `mceTypography` command.
