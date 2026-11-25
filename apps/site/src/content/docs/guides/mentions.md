---
title: Mentions
description: Type @ to mention a person in the text or in a comment — people come from your own API.
---

The `mentions` plugin lets people type <kbd>@</kbd> and pick a colleague from a list. It works in
the document text and in [comments](/guides/comments/).

```ts
createEditor({
  element,
  plugins: ['mentions'],
  pluginOptions: {
    mentions: {
      // Search your user directory. May return a Promise; late answers are ignored.
      fetch: async (query) => {
        const response = await fetch(`/api/users?q=${encodeURIComponent(query)}`);
        return response.json(); // [{ id, name, description? }]
      },
      onMention: (user) => console.log('mentioned', user.id),
    },
  },
});
```

In the text a mention is one unit (<kbd>Backspace</kbd> removes it whole) and is saved as:

```html
<span data-mention="u42">@Anna Ivanova</span>
```

`getMentions(editor)` returns everyone mentioned in the document, once each — handy for sending
notifications when the document is saved. User ids may contain letters, digits and `_ . @ : + -`;
anything else, and any markup in names, is rejected or shown as plain text.

## Mentions in comments

With both `comments` and `mentions` enabled, <kbd>@</kbd> in a comment opens the same list. The
comment stores who was mentioned, and `onMention` lets you notify them:

```ts
pluginOptions: {
  mentions: { fetch: searchUsers },
  comments: {
    author: currentUser,
    onMention: ({ threadId, comment, users }) => api.notify(users, { threadId, text: comment.text }),
  },
}
```

If you only want mentions inside comments, pass `comments.mentions: searchUsers` and leave the
`mentions` plugin off.
