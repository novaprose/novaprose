import '@novaprose/core/style.css';
import '@novaprose/collab/style.css';
import '../playground.css';
import { createEditor, type Editor } from '@novaprose/core';
import { collab } from '@novaprose/collab';

/**
 * Песочница совместного редактирования: два редактора в одной комнате.
 * ?room=имя — своя комната (e2e берут случайную, чтобы тесты не мешали друг другу).
 * ?sync=ws://… — другой сервер синхронизации.
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
    // Комментарии — в общем документе: видны обоим редакторам и всем вкладкам.
    pluginOptions: {
      comments: { author: { id: name, name }, store: sync.commentStore() },
      // История версий — снимки на сервере синхронизации.
      revisionhistory: sync.versions(),
      suggestions: { author: { id: name, name } },
    },
  });
}

const editors = { anna: mount('anna', 'Anna'), boris: mount('boris', 'Boris') };
Object.assign(window, { editors });
