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

listSuggestions(editor.view.state.doc); // [{ id, kind, author, time, text, from, to, node? }]
editor.view.dispatch(resolveSuggestions(editor.view.state, 'accept')); // accept all
const final = suggestionsResult(editor, 'accept'); // document as if all were accepted
```

## What is tracked

Inserting and deleting text (typing, pasting, cutting) becomes a suggestion, and so does text
formatting: bold, italic, underline, strikethrough, code, subscript and superscript, colors,
fonts, sizes, links and styles. The new formatting shows at once, with a dotted line under it in
the author's color; rejecting it gives the text back the look it had. Formatting your own
suggested insertion just formats it.

A block's type and style are suggestions too: a heading instead of a paragraph (or a paragraph
instead of a heading), a code block, alignment, indent, line height and direction. The change shows
at once, with a bar in the author's color at the start of the block, and the card reads
“Paragraph → Heading 2” or “Align center”; rejecting it gives the block back its type and style.
Change it back yourself and the suggestion goes. In HTML the block remembers what it was:

```html
<h2 data-suggestion="s3" data-before='{"type":"paragraph","attrs":{}}' data-author="u42">Plan</h2>
```

Paragraph breaks are suggestions as well. <kbd>Enter</kbd> in the middle of a line makes a new
paragraph (or list item) with a pilcrow ¶ in the author's color in its margin; at the end of a line
the new paragraph is new as a whole, one suggestion with what you type in it. <kbd>Backspace</kbd>
or <kbd>Delete</kbd> across a break marks it deleted, with a struck pilcrow, instead of joining the
paragraphs at once. Rejecting a new break joins the paragraphs again, rejecting a new paragraph
removes it; accepting a deleted break joins them. Your own new paragraph is deleted for real, like
your own inserted text. In HTML:

```html
<p data-suggestion="s4" data-change="split" data-author="u42">The second half of a line</p>
<p data-suggestion="s5" data-change="insert" data-author="u42">A new paragraph</p>
<p data-suggestion="s6" data-change="join" data-author="u42">Joined to the one above</p>
```

Whole things are suggestions too: a table, a row, a column, an image, a horizontal line, a page
break, a paragraph inserted or deleted as a whole. A new one is outlined in the author's color, a
deleted one dashed (a deleted image or line is faded, a deleted row tinted), and it stays until the
deletion is accepted. Rejecting a new one removes it; a line or a table put in the middle of a
paragraph takes its break with it, so rejecting joins the paragraph again. A column is one
suggestion: a new cell in every row. Inside your own new table, what you type and the rows you add
are part of it. In HTML the node carries the suggestion:

```html
<table data-suggestion="s6" data-change="insert" data-author="u42">
  …
</table>
<tr data-suggestion="s7" data-change="delete" data-author="u42">
  …
</tr>
```

So are the settings of any node: a bulleted list made numbered, table and cell properties, a header
row, an image's size. The node remembers what it was, like a block's style, and rejecting gives it
back.

Lists and quotes: making paragraphs a list (the button or a typed `- `), taking items out of a list,
<kbd>Tab</kbd> and <kbd>Shift</kbd>+<kbd>Tab</kbd> in a list, putting text into a quote and taking it
out. Something put into a list or quote shows at once, with the author's bar; something taken out
stays where it is, with a dashed bar, until the change is accepted. The card reads “+Bulleted list”,
“−Quote” or “Increase indent”. <kbd>Tab</kbd> then <kbd>Shift</kbd>+<kbd>Tab</kbd> is no change at
all, and <kbd>Enter</kbd> on your own new empty item leaves the list as usual.

```html
<li data-suggestion="s8" data-change="wrap" data-author="u42"><p>Put into the list</p></li>
<li data-suggestion="s9" data-change="unwrap" data-author="u42"><p>To be taken out</p></li>
```

Deciding gives exactly what the same edits give outside suggesting mode, and rejecting gives
exactly the document before them, whatever order the edits were made in: a test checks both on
thousands of random documents and edits. Deleting a paragraph's text leaves the paragraph;
deleting the paragraph with its break removes it.

An edit that can't be a suggestion (merging table cells, the page setup) isn't made in suggesting
mode, and a notice says so: nothing changes the document directly. Content you paste carries no
suggestions of its own, so nobody's name can be put on a suggestion they didn't make.

In Word (`.docx`, with the `exportword` and `importword` plugins), a row or table cell inserted or
deleted is Word's own row or cell revision, and the text and images of a node inserted or deleted are
Word revisions; changes of lists and styles are exported as they are now.

The [AI assistant](/guides/ai-assistant/) makes its changes as suggestions too.

[Try it in the live demo](/demo/collaboration/).
