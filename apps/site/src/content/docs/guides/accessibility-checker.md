---
title: Accessibility checker
description: Find what keeps people from reading a document with a screen reader, a keyboard or weak eyesight, and fix it from a panel — in the editor or on your server.
---

With the `a11ychecker` plugin, the **Check accessibility** button (`a11ycheck`) opens the
**Accessibility** panel. It lists what in the document breaks the
[WCAG 2.1](https://www.w3.org/TR/WCAG21/) guidelines — an image without alternative text, a skipped
heading level, a list typed by hand, text with too little contrast — and fixes most of it in one
click: type the alternative text right in the card, **Change to Heading 3**, **Make it a list**.

- **Show in the text** selects the problem; the one under the mouse or the keyboard focus is
  outlined in the text.
- **Ignore** hides a problem for the session.
- The panel checks again as the document changes; a fix is a normal edit, so Ctrl+Z undoes it.

```ts
createEditor({
  element,
  plugins: ['a11ychecker'],
  toolbar: 'undo redo | bold italic | a11ycheck',
  pluginOptions: {
    a11ychecker: {
      level: 'aa', // 'a', 'aa' (default) or 'aaa'
      ignoredRules: ['D1'], // rule ids from the table below
      allowDecorativeImages: true, // alt="" marks an image screen readers skip
      altTextMaxLength: 150,
      pageBackground: '#ffffff', // where the content is shown, for contrast
      filterIssue: (issue) => issue.rule !== 'N1',
    },
  },
});
```

## What is checked

| Rule     | Severity | WCAG | The problem                                                           | Fix                                         |
| -------- | -------- | ---- | --------------------------------------------------------------------- | ------------------------------------------- |
| I2       | error    | A    | an image without alternative text                                     | the text, typed in the panel, or decorative |
| I3       | error    | A    | alternative text that is a file name (`IMG_1234`, `cat.png`)          | the text                                    |
| I4       | warning  | A    | alternative text over 150 characters                                  | the text                                    |
| I1       | error    | A    | a decorative image (`alt=""`) when `allowDecorativeImages` is `false` | the text                                    |
| D2       | error    | A    | a skipped heading level (Heading 2, then Heading 4)                   | Change to Heading 3                         |
| N2       | error    | AA   | an empty heading                                                      | Remove the heading                          |
| D1       | warning  | A    | a short bold paragraph that is a heading in all but name              | Make it a heading                           |
| D4U, D4O | error    | A    | a list typed with `•` or `1.`, `2.`                                   | Make it a list                              |
| D3       | error    | A    | two links side by side to the same address                            | Join the links                              |
| N1       | warning  | A    | link text that doesn't say where it leads ("click here")              | Edit the link                               |
| N3       | error    | A    | a link without text                                                   | Remove the link                             |
| D5A, D5B | error    | AA   | text contrast under 3:1 (large text) or 4.5:1                         | Remove the colors                           |
| D5C      | error    | AAA  | text contrast under 4.5:1 (large) or 7:1, at level `aaa`              | Remove the colors                           |
| H93      | error    | A    | the same id twice (headings, anchors)                                 | Make the id unique                          |
| T4B      | error    | A    | a table without header cells                                          | Make the first row a header                 |

Rule ids match TinyMCE's where the check is the same, so lists of ignored rules carry over; N1, N2
and N3 are NovaProse's. Contrast is computed for text with a color or a highlight of its own,
against `pageBackground`.

## On your server

The rules don't need a browser: check stored content before it is published, in a build step or
an API.

```ts
import { createRenderer } from '@novaprose/core';
import { checkAccessibility } from '@novaprose/core/a11y';

const doc = createRenderer({ plugins: ['anchor'] }).doc(savedJson);
const issues = checkAccessibility(doc, { level: 'aa' });
// [{ rule: 'I2', severity: 'error', level: 'A', from, to, text: 'cat.png' }, …]
if (issues.some((issue) => issue.severity === 'error')) refusePublishing(issues);
```

## Coming from TinyMCE

With `tinymce.init()`, `plugins: 'a11ychecker'` and the `a11ycheck` button work, with
`a11ychecker_level`, `a11ychecker_ignored_rules`, `a11ychecker_allow_decorative_images` (or
`a11y_advanced_options`), `a11ychecker_alt_text_max_length` and `a11ychecker_filter_issue` (it gets
`id` and `contentID` as in TinyMCE). As there, an image with `alt=""` is flagged unless decorative
images are allowed. The checks are of HTML 5, and the panel replaces the dialog.
