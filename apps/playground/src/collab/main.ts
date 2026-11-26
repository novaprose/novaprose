import '@novaprose/core/style.css';
import '@novaprose/collab/style.css';
import '../playground.css';
import { createEditor, type Editor } from '@novaprose/core';
import { collab } from '@novaprose/collab';

/**
 * The collaboration playground: two editors in one room.
 * ?room=name picks your own room (e2e tests take a random one so they don't get in each other's way).
 * ?sync=ws://… points to another sync server.
 */
const params = new URLSearchParams(location.search);
const room = params.get('room') ?? 'playground';
const url = params.get('sync') ?? 'ws://localhost:1234';
document.getElementById('room')!.textContent = room;
const status = document.getElementById('status')!;
const synced = document.getElementById('synced')!;
let syncedCount = 0;

function mount(id: string, name: string): Editor {
  const sync = collab({
    url,
    document: room,
    user: { name },
    onStatus: (value) => (status.textContent = value),
    onSynced: () => (synced.textContent = String(++syncedCount)),
  });
  return createEditor({
    element: document.getElementById(id)!,
    toolbar:
      'undo redo | blocks | bold italic | bullist numlist | link | addcomment showcomments | revisionhistory | suggestions reviewsuggestions',
    plugins: [sync, 'comments', 'revisionhistory', 'suggestions'],
    // Comments live in the shared document: both editors and every tab see them.
    pluginOptions: {
      comments: { author: { id: name, name }, store: sync.commentStore() },
      // Version history: snapshots on the sync server.
      revisionhistory: sync.versions(),
      suggestions: { author: { id: name, name } },
    },
  });
}

const editors = { anna: mount('anna', 'Anna'), boris: mount('boris', 'Boris') };
Object.assign(window, { editors });
