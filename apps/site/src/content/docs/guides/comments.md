---
title: Comments
description: Let people discuss parts of a document — threads, replies, resolve — stored in your backend or synced in real time.
---

The `comments` plugin adds Google Docs–style discussions to the editor:

- select text and press **Add comment** (<kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>M</kbd>,
  <kbd>⌘</kbd>+<kbd>⌥</kbd>+<kbd>M</kbd> on macOS);
- reply, edit or delete your own comments, resolve and reopen threads;
- the commented text stays highlighted; clicking it opens its thread;
- on narrow screens the comments panel moves below the text.

Toolbar buttons use the TinyMCE names: `addcomment` and `showcomments`.

## Store comments with your content

The document only keeps an anchor around the discussed text — `<span data-comment="id">` —
so `getHTML()` stays small and clean. The threads themselves are data you store next to it:

```ts
import { createEditor } from '@novaprose/core';

const post = await api.getPost(42); // { html, comments }

createEditor({
  element,
  content: post.html,
  plugins: ['comments'],
  pluginOptions: {
    comments: {
      author: { id: currentUser.id, name: currentUser.name },
      threads: post.comments,
      onChange: (threads) => api.saveComments(42, threads),
    },
  },
});
```

Threads are plain JSON (`CommentThread[]`): an `id`, the `comments` (author, text, time) and
`resolved`. Data that comes back from your API is validated before it is shown, and every name
and comment is rendered as text, never as HTML.

By default people can edit and delete only their own comments. Change it with `canEdit`:

```ts
comments: {
  author,
  canEdit: (comment, author) => author.id === comment.author.id || currentUser.isAdmin,
}
```

To keep comments somewhere else entirely (your own API, local storage, a database listener),
pass a `store` that implements the `CommentStore` interface instead of `threads`/`onChange`.

## Mentions

Type <kbd>@</kbd> in a comment to mention someone; `onMention` tells you whom to notify. See
[Mentions](/guides/mentions/).

## Comments in real-time collaboration

With [`@novaprose/collab`](/guides/collaboration/), keep threads in the shared document: they
sync instantly to everyone and are saved by the sync server together with the text. Simultaneous
replies to the same thread are never lost.

```ts
import { collab } from '@novaprose/collab';

const sync = collab({ url: 'wss://sync.example.com', document: 'post-42', token, user });

createEditor({
  element,
  plugins: [sync, 'comments'],
  pluginOptions: { comments: { author: user, store: sync.commentStore() } },
});
```

[Try it in the live demo](/demo/collaboration/).

## Clean HTML for publishing

Anchors are harmless `<span>`s, but if you publish the HTML you may want to drop them. Remove
`data-comment` spans on your server, or render the published page from a copy of the content
loaded into an editor without the `comments` plugin — unknown anchors are dropped, the text stays.
