---
title: Spell check
description: Spelling and grammar checked as you type by your own service — LanguageTool or anything else — with corrections one click or one key away.
---

With the `spellchecker` plugin, spelling and grammar are checked as you type. Problems are
underlined — spelling in red, grammar in blue — and a click on one opens a bubble with
corrections, **Ignore**, **Ignore all** and **Add to dictionary**.

- <kbd>Alt</kbd>+<kbd>F7</kbd> goes to the next problem and opens its bubble; the arrow keys move
  between the corrections, <kbd>Enter</kbd> takes one, <kbd>Esc</kbd> goes back to the text.
- Underlined words carry `aria-invalid="spelling"` or `aria-invalid="grammar"`, so screen readers
  announce them.
- A correction is a normal edit: in [suggesting mode](/guides/suggested-edits/) it becomes a
  suggestion.
- Code blocks, inline code and text suggested for deletion are not checked.
- The **Spell check** button turns checking on and off and chooses the language. While it is on,
  the browser's own spell check is off, so words aren't underlined twice.

The editor doesn't check text itself: it sends paragraphs to a service you choose, the way the
[AI assistant](/guides/ai-assistant/) uses your model. A paragraph is sent again only when its text
changes, and paragraphs go in batches, so a long document costs a few requests, not thousands.

## With LanguageTool

[LanguageTool](https://languagetool.org/) is an open-source checker for more than 20 languages,
with grammar and style rules. It can run on your own servers, so the text never leaves them. Point
the plugin at it:

```ts
createEditor({
  element,
  plugins: ['spellchecker'],
  pluginOptions: {
    spellchecker: {
      languageTool: { url: 'https://languagetool.example.com' }, // its /v2/check API
      language: 'en-US', // or 'auto' (the default): LanguageTool detects it
      languages: [
        { code: 'en-US', name: 'English (US)' },
        { code: 'de-DE', name: 'Deutsch' },
      ],
    },
  },
});
```

`languageTool` also takes `headers` (for an API key of a hosted LanguageTool) and `level: 'picky'`
for more style hints. If the server needs a secret key, don't put it in the browser: use `check`
below and call LanguageTool from your server.

## With your own service

`check` gets the text (paragraphs separated by a blank line) and the language, and returns the
problems found:

```ts
pluginOptions: {
  spellchecker: {
    check: async ({ text, language, signal }) => {
      const response = await fetch('/api/spellcheck', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, language }),
        signal,
      });
      return response.json(); // [{ offset, length, kind, message, replacements }]
    },
  },
}
```

| Field          | Meaning                                                                     |
| -------------- | --------------------------------------------------------------------------- |
| `offset`       | where the problem starts in `text` (in UTF-16 code units, as in JavaScript) |
| `length`       | how long it is                                                              |
| `kind`         | `spelling` (default) or `grammar`                                           |
| `message`      | what is wrong, shown in the bubble                                          |
| `replacements` | corrections, best first (up to five are shown)                              |

Anything else in the answer is ignored, and a broken answer leaves the text unmarked rather than
failing. If the service can't be reached, the editor says so once and keeps working.

## Words and dictionaries

```ts
spellchecker: {
  check,
  ignore: ['NovaProse', 'Acme'], // never marked
  addToDictionary: (word, language) => saveToOrgDictionary(word, language),
  active: true, // false: start with checking off
}
```

**Ignore** skips one problem, **Ignore all** a word everywhere for this session. **Add to
dictionary** shows when `addToDictionary` is given: save the word for your organization and pass
it in `ignore` next time.

## Buttons

| Name               | What it does                                              |
| ------------------ | --------------------------------------------------------- |
| `spellchecker`     | turns checking on and off; its arrow chooses the language |
| `spellcheckdialog` | goes to the next problem (<kbd>Alt</kbd>+<kbd>F7</kbd>)   |

Coming from TinyMCE: `plugins: 'tinymcespellchecker'` with `tinymce.init()` works, together with
`spellchecker_active`, `spellchecker_language` (or `content_language`), `spellchecker_languages`,
`spellchecker_ignore_list` and the `mceSpellcheckEnable`, `mceSpellcheckDisable`,
`mceSpellcheckDialog` and `mceSpellcheckDialogClose` commands. Set your service with
`spellchecker_languagetool_url` or `spellchecker_check`; `spellchecker_rpc_url` is not used.
