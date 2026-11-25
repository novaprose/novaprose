---
title: Version history
description: Browse earlier versions of a document, see what changed and restore one — from the sync server or your own backend.
---

The `revisionhistory` plugin (the TinyMCE name) adds a **Version history** button. It opens a view
with every saved version — when, who edited, an optional name — and shows the selected version with
the differences from the current text highlighted:

- green underlined: text that exists only in that version;
- red struck through: text that exists only in the current document.

**Restore this version** replaces the content in one step, so <kbd>Ctrl</kbd>+<kbd>Z</kbd> brings
the current text back. Restored content goes through the same checks as any other content.

## With real-time collaboration

The [NovaProse sync server](/guides/collaboration/) keeps versions for you: a snapshot at most every
10 minutes while people edit (`NOVA_SYNC_VERSION_INTERVAL`), one when the last person leaves, and one
whenever someone presses **Save version**. Readers (`viewer` tokens) can browse history but not save.

```ts
import { collab } from '@novaprose/collab';

const sync = collab({ url: 'wss://sync.example.com', document: 'post-42', token, user });

createEditor({
  element,
  plugins: [sync, 'revisionhistory'],
  pluginOptions: { revisionhistory: sync.versions() },
});
```

## With your own backend

Without the sync server, give the plugin three functions. `load` may return HTML or the editor's
JSON.

```ts
createEditor({
  element,
  plugins: ['revisionhistory'],
  pluginOptions: {
    revisionhistory: {
      list: () => api.get('/posts/42/versions'), // [{ id, createdAt, authors?, label? }]
      load: (version) => api.get(`/posts/42/versions/${version.id}`).then((v) => v.html),
      save: () => api.post('/posts/42/versions', { html: editor.getHTML() }), // optional
      onRestore: (version) => analytics.track('restore', version.id),
    },
  },
});
```

[Try it in the live demo](/demo/collaboration/).
