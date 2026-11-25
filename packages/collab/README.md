# @novaprose/collab

Real-time collaborative editing for the [NovaProse](https://www.npmjs.com/package/@novaprose/core)
rich text editor:

- several people edit one document at once; changes merge without conflicts (Yjs CRDT);
- live cursors and selections with names;
- <kbd>Ctrl</kbd>+<kbd>Z</kbd> undoes only **your** changes, never someone else's;
- works with every NovaProse plugin, including ones that add nodes (media, anchors, page breaks).

**[Try the live demo →](https://novaprose.com/demo/collaboration/)**

> **Status: 0.x preview.** The API may change between minor versions until 1.0.

```bash
npm install @novaprose/collab @novaprose/core
```

```ts
import { createEditor } from '@novaprose/core';
import { collab } from '@novaprose/collab';
import '@novaprose/core/style.css';
import '@novaprose/collab/style.css';

const sync = collab({
  url: 'wss://sync.example.com',
  document: 'post-42',
  token: () => fetch('/api/sync-token?doc=post-42').then((r) => r.text()),
  user: { name: 'Anna' },
  onStatus: (status) => console.log(status), // 'connecting' | 'connected' | 'disconnected'
  onSynced: () => console.log('document loaded'),
  onUsers: (users) => console.log(users), // [{ clientId, name, color, self }]
});

createEditor({ element: document.querySelector('#editor')!, plugins: [sync] });

sync.setUser({ name: 'Anna K.' }); // rename for everyone, no reconnect
```

The document lives on the sync server: don't pass `content` to a collaborative editor. Save
`editor.getHTML()` to your database whenever you need a copy.

## Comments

Keep [comment threads](https://novaprose.com/guides/comments/) in the shared document — they sync
to everyone instantly and are saved by the server with the text:

```ts
createEditor({
  element,
  plugins: [sync, 'comments'],
  pluginOptions: {
    comments: { author: { id: user.id, name: user.name }, store: sync.commentStore() },
  },
});
```

## Version history

The sync server keeps versions of every document. Show them with the `revisionhistory` plugin:

```ts
createEditor({
  element,
  plugins: [sync, 'revisionhistory'],
  pluginOptions: { revisionhistory: sync.versions() },
});
```

See [novaprose.com/guides/version-history](https://novaprose.com/guides/version-history/).

## Server

Use the open-source
[NovaProse sync server](https://github.com/novaprose/novaprose/tree/main/apps/sync-server)
(Docker image, SQLite storage, JWT auth from your backend) or any Hocuspocus-compatible server.
Your backend signs a short-lived token for each user and document; the server checks it on
connect and makes `viewer` tokens read-only.

## Your own transport

Already running Yjs? Pass your own `Y.Doc` and `Awareness` (WebRTC, `y-websocket`, a message bus):

```ts
import { collab, Y, Awareness } from '@novaprose/collab';

const ydoc = new Y.Doc();
const awareness = new Awareness(ydoc);
createEditor({ element, plugins: [collab({ ydoc, awareness, user: { name: 'Anna' } })] });
```

## Options

| Option                   | Description                                                         |
| ------------------------ | ------------------------------------------------------------------- |
| `url`, `document`        | Sync server address (`wss://…`) and document name                   |
| `token`                  | JWT string, or a (async) function that returns one                  |
| `user`                   | `{ name, color? }` shown to others; color defaults to one per name  |
| `ydoc`, `awareness`      | Your own Yjs document and presence instead of the built-in provider |
| `field`                  | Name of the shared fragment in the Y.Doc (default `'prosemirror'`)  |
| `onStatus`, `onSynced`   | Connection status; first load from the server                       |
| `onUsers`                | Who is in the document, your own client first                       |
| `onAuthenticationFailed` | The server rejected the token                                       |

Guide: [novaprose.com/guides/collaboration](https://novaprose.com/guides/collaboration/). MIT
licensed.
