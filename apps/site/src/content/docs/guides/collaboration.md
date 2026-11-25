---
title: Real-time collaboration
description: Let several people edit the same document at once, with live cursors and per-user undo.
---

`@novaprose/collab` turns any NovaProse editor into a collaborative one:

- changes sync in real time through a server, and merge without conflicts (Yjs CRDT);
- everyone sees the other participants' cursors and selections with their names;
- <kbd>Ctrl</kbd>+<kbd>Z</kbd> undoes only **your** changes, never someone else's;
- works with every plugin, including ones that add nodes (media, anchors, page breaks).

```bash
npm install @novaprose/collab @novaprose/core
```

Collaboration is in preview (0.x): the API may still change between minor versions.

[Try the live demo](/demo/collaboration/) — open it in two windows.

## Connect an editor

```ts
import { createEditor } from '@novaprose/core';
import { collab } from '@novaprose/collab';
import '@novaprose/core/style.css';
import '@novaprose/collab/style.css';

createEditor({
  element: document.querySelector('#editor')!,
  plugins: [
    collab({
      url: 'wss://sync.example.com',
      document: 'post-42',
      token: () => fetch('/api/sync-token?doc=post-42').then((r) => r.text()),
      user: { name: 'Anna' }, // the cursor color is derived from the name unless you pass `color`
      onStatus: (status) => console.log(status), // 'connecting' | 'connected' | 'disconnected'
      onSynced: () => console.log('document loaded'),
    }),
  ],
});
```

The document lives on the server: don't pass `content` to a collaborative editor, and save the
HTML from `editor.getHTML()` to your database whenever you need a copy (for search, emails,
rendering pages).

Wait for `onSynced` before letting users type into a brand-new document; until then the editor
shows only what this browser knows.

## Run the server

The sync server is a small Node program (Docker image included) that stores documents in SQLite
and checks a JWT from your backend on every connection. It does not know your users — your
backend decides who may open which document and signs a token:

```js
import { SignJWT } from 'jose';

app.get('/api/sync-token', async (req, res) => {
  // your own permission check here
  const token = await new SignJWT({
    sub: req.user.id,
    doc: req.query.doc, // or a prefix: 'team-7/*'
    role: req.user.canEdit ? 'editor' : 'viewer',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('1h')
    .sign(new TextEncoder().encode(process.env.NOVA_SYNC_SECRET));
  res.send(token);
});
```

Viewers receive live updates but cannot change the document: the server drops their edits.

```bash
docker run -d -p 1234:1234 -e NOVA_SYNC_SECRET=… -v novaprose-sync:/data novaprose-sync
```

See the [server's README](https://github.com/novaprose/novaprose/tree/main/apps/sync-server) for all settings. A hosted sync service will be part of NovaProse Cloud.

## Your own transport

Already running Yjs? Pass your own `Y.Doc` and `Awareness` and connect them however you like —
WebRTC, `y-websocket`, a message bus:

```ts
import { collab, Y, Awareness } from '@novaprose/collab';

const ydoc = new Y.Doc();
const awareness = new Awareness(ydoc);
// …connect ydoc and awareness to your provider…

createEditor({ element, plugins: [collab({ ydoc, awareness, user: { name: 'Anna' } })] });
```
