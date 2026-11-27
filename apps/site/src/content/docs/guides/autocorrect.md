---
title: Autocorrect
description: Common typos corrected as you type, in the case you typed them, with Backspace to put a word back — in the browser, without a server.
---

With the `autocorrect` plugin, common typos are corrected as you type: "teh" becomes "the",
"recieve" becomes "receive", "i" becomes "I". A word is corrected when it ends, at a space, a
punctuation mark or <kbd>Enter</kbd>, so nothing changes under the cursor while you are still
typing it.

- The case you typed is kept: "Teh" becomes "The". The word keeps its formatting.
- <kbd>Backspace</kbd> right after a correction puts back what you typed, and that word is left
  alone from then on. <kbd>Ctrl</kbd>+<kbd>Z</kbd> undoes a correction as a step of its own.
- The word just corrected is underlined with dots while <kbd>Backspace</kbd> can still put it
  back, and screen readers hear "teh changed to the".
- TWo INitial CApitals lose the second capital ("THe" becomes "The"), but plurals of abbreviations
  (IDs), units (MHz) and names written that way (OAuth, VMware) stay as they are.
- Code blocks, inline code, web and email addresses, paths, `@handles`, `#tags`, `{{merge tags}}`
  and words in capitals only are left as typed.
- A correction is a normal edit: in [suggesting mode](/guides/suggested-edits/) it is part of
  your suggestion.

Everything happens in the browser: the text is not sent anywhere.

```ts
createEditor({
  element,
  plugins: ['autocorrect'],
  pluginOptions: {
    autocorrect: {
      capitalize: true, // also start sentences with a capital letter
      replacements: { acme: 'ACME', teh: 'the' },
      ignore: ['npm', 'VMware'],
    },
  },
});
```

## Capitals at the start of sentences

With `capitalize: true`, the first word of a paragraph, a list item, a table cell and of a
sentence after `.`, `!` or `?` gets a capital letter. A period after an abbreviation doesn't end
a sentence: "e.g. this", "Dr. smith", "J. smith" and "approx. ten" stay as typed. If you put a
small letter back with <kbd>Backspace</kbd> after a period, the word before that period is taken
as an abbreviation from then on. Words with a capital inside (iPhone, eBay) keep their case. This
works in every language that has capital letters.

## Languages and your own corrections

The built-in list is English: about 430 common typos, only spellings that are never right as
typed, and none that are words in the languages often written next to English (German "im",
French "dont", Spanish "posible"). It applies when the content is in English: by default the
editor takes the language from the [spell checker](/guides/spell-check/), otherwise from the
`lang` attribute of the page; set `language` when neither says it.

Your `replacements` work in any language and win over the built-in list. A typo is found whatever
its case, and the case it was typed in is kept:

```ts
autocorrect: {
  language: 'de',
  replacements: { strasse: 'straße', vieleicht: 'vielleicht' },
  builtInList: false, // only your corrections, even for English
}
```

| Option         | Description                                                                               |
| -------------- | ----------------------------------------------------------------------------------------- |
| `autocorrect`  | corrects typos, "i", TWo INitial CApitals; `true` by default                              |
| `capitalize`   | capital letters at the start of sentences; `false` by default                             |
| `replacements` | your corrections, a typo → the right word                                                 |
| `ignore`       | words never changed (the spell checker's `ignore` list counts too)                        |
| `language`     | the content's language; the built-in list is used for English                             |
| `builtInList`  | the built-in English list; `true` by default                                              |
| `remember`     | remember the choice made in the menu (in `localStorage`) for next time; `true` by default |
| `onCorrect`    | called after each correction, and with `reverted: true` when the person takes one back    |

```ts
autocorrect: {
  // Learn from the people who write: words they take back could join `ignore` next time.
  onCorrect: ({ word, replacement, kind, reverted }) => {
    if (reverted) saveIgnoredWord(word);
  },
}
```

`kind` is `typo`, `capitals` (TWo INitial CApitals) or `sentence` (the first letter of a
sentence).

## Buttons and menu items

| Name             | What it does                                                     |
| ---------------- | ---------------------------------------------------------------- |
| `autocorrect`    | button: turns correcting on and off; its arrow has both switches |
| `autocorrect`    | menu item: "Correct typos as you type"                           |
| `capitalization` | menu item: "Capitalize the first letter of sentences"            |

The button is added to the default toolbar. Both menu items are in the **Tools** menu
(`menubar: 'file edit view insert format tools table help'`).

Coming from TinyMCE: `plugins: 'autocorrect'` with `tinymce.init()` works, together with
`autocorrect_autocorrect`, `autocorrect_capitalize`, the `autocorrect` and `capitalization` menu
items and the `AutocorrectStart`, `AutocorrectEnd`, `CapitalizeStart` and `CapitalizeEnd` events.
`autocorrect_service_url` is not needed: nothing is sent to a server.
