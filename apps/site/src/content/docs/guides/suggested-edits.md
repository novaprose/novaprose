---
title: Suggested edits
description: Let people propose changes that the author accepts or rejects — like suggesting mode in Google Docs.
---

With the `suggestions` plugin, edits can be made as **suggestions** instead of direct changes:

- typed text is marked as inserted, deleted text stays in place and is struck through;
- every suggestion remembers who made it and when (hover it to see);
- put the cursor in a suggestion to **accept** or **reject** it, or use **Review suggestions** to
  jump between them and accept or reject all at once;
- deleting text you yourself just suggested removes it for real — fixing a typo in your own
  suggestion doesn't create a new one.

Toggle the mode with the **Suggest edits** button or <kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>E</kbd>
(<kbd>⌘</kbd>+<kbd>⌥</kbd>+<kbd>⇧</kbd>+<kbd>E</kbd> on macOS).

```ts
createEditor({
  element,
  plugins: ['suggestions'],
  pluginOptions: {
    suggestions: {
      author: { id: user.id, name: user.name },
      enabled: false, // start in suggesting mode?
      force: false, // true: this user can only suggest (e.g. a reviewer)
      canReview: true, // false: this user can't accept or reject
    },
  },
});
```

## How suggestions are stored

Suggestions are part of the content, so they are saved with your HTML and sync in
[real-time collaboration](/guides/collaboration/) like any other text:

```html
<p>
  Ship in <del data-suggestion="s1" data-author="u42" data-name="Anna" data-time="…">May</del
  ><ins data-suggestion="s1" …>June</ins>
</p>
```

Before publishing, resolve them, or render the final text without changing the document:

```ts
import { listSuggestions, resolveSuggestions, suggestionsResult } from '@novaprose/core';

listSuggestions(editor.view.state.doc); // [{ id, kind, author, time, text, from, to }]
editor.view.dispatch(resolveSuggestions(editor.view.state, 'accept')); // accept all
const final = suggestionsResult(editor, 'accept'); // document as if all were accepted
```

## What is tracked

Inserting and deleting text (typing, pasting, cutting) becomes a suggestion. Structural changes —
new paragraphs, lists, formatting — are applied directly even in suggesting mode. A paragraph whose
whole text was a suggestion goes with it: reject a new paragraph's text, or accept the deletion of
a paragraph's text, and no empty line is left.

The [AI assistant](/guides/ai-assistant/) makes its changes as suggestions too.

[Try it in the live demo](/demo/collaboration/).
