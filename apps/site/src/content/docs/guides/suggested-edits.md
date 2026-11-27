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

## Reviewing suggestions

The **Suggestions** panel (the `suggestionspanel` button, or **Review suggestions → Show all
suggestions**) lists every suggestion as a card: who made it, when, and what changed. A deletion
right before an insertion by the same person reads as one replacement (“Replaced ~~May~~ June”).
Click a card to find the suggestion in the text; **Accept** and **Reject** decide it.

Choose an author in the panel to see only their suggestions: **Accept shown** and **Reject shown**
then decide all of that person's suggestions at once. Without a filter they take every suggestion.

The **Review suggestions** menu also has:

- **Accept suggestions in selection** and **Reject suggestions in selection**: select a part of
  the text to decide only the suggestions it touches;
- **Preview: all accepted** and **Preview: all rejected**: read the text as it would be, without
  changing it.

Toolbar names: `suggestions` (the mode), `reviewsuggestions` (the menu), `suggestionspanel` (the
panel), `acceptsuggestion` and `rejectsuggestion` (for your own toolbars).

## Discussing a suggestion

With the [comments](/guides/comments/) plugin as well, every card has a **Comment** button: ask
why, agree, propose something else. Replies follow one another on the card (<kbd>Ctrl</kbd>+<kbd>Enter</kbd>
sends, <kbd>Esc</kbd> closes the box), and your own can be deleted. When the suggestion is
accepted or rejected, its discussion is resolved by whoever decided.

```ts
createEditor({
  element,
  plugins: ['suggestions', 'comments'],
  pluginOptions: {
    suggestions: { author },
    comments: { author, threads: saved.threads, onChange: (threads) => save(threads) },
  },
});
```

A discussion is a comment thread with a `suggestion` field, the id of the suggestion it is about:
it is saved, synced in [real-time collaboration](/guides/collaboration/) and passed to `onChange`
like any other thread, and it shows on the suggestion's card rather than in the comments panel.

## How suggestions are stored

Suggestions are part of the content, so they are saved with your HTML and sync in
[real-time collaboration](/guides/collaboration/) like any other text:

```html
<p>
  Ship in <del data-suggestion="s1" data-author="u42" data-name="Anna" data-time="…">May</del
  ><ins data-suggestion="s1" …>June</ins>
</p>
<!-- A suggested format: italic before it was made bold -->
<strong><span data-suggestion="s2" data-format='[{"type":"italic"}]'>Bold</span></strong>
```

Before publishing, resolve them, or render the final text without changing the document:

```ts
import { listSuggestions, resolveSuggestions, suggestionsResult } from '@novaprose/core';

listSuggestions(editor.view.state.doc); // [{ id, kind, author, time, text, from, to }]
editor.view.dispatch(resolveSuggestions(editor.view.state, 'accept')); // accept all
const final = suggestionsResult(editor, 'accept'); // document as if all were accepted
```

## What is tracked

Inserting and deleting text (typing, pasting, cutting) becomes a suggestion, and so does text
formatting: bold, italic, underline, strikethrough, code, subscript and superscript, colors,
fonts, sizes, links and styles. The new formatting shows at once, with a dotted line under it in
the author's color; rejecting it gives the text back the look it had. Formatting your own
suggested insertion just formats it. Structural changes — new paragraphs, lists, alignment — are
applied directly even in suggesting mode.

A paragraph whose whole text was a suggestion goes with it: reject a new paragraph's text, or
accept the deletion of a paragraph's text, and no empty line is left.

The [AI assistant](/guides/ai-assistant/) makes its changes as suggestions too.

[Try it in the live demo](/demo/collaboration/).
