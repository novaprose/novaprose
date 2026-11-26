// @vitest-environment node
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { HocuspocusProvider } from '@hocuspocus/provider';
import { SignJWT } from 'jose';
import { afterEach, describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { freePort } from './port';
import { createSyncServer, documentAllowed, sqliteStorage } from '../src/server.mjs';

/** The sync server over a real WebSocket: syncing, storage, rights. */

const SECRET = 'test-secret-that-is-long-enough-for-hs256';
const cleanups: (() => unknown)[] = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});

async function start(database = ':memory:') {
  const server = createSyncServer({ secret: SECRET, database });
  await server.listen(await freePort());
  cleanups.push(() => server.destroy());
  return `ws://127.0.0.1:${server.address.port}`;
}

function token(claims: Record<string, unknown>, expiresIn = '1h') {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime(expiresIn)
    .sign(new TextEncoder().encode(SECRET));
}

function client(url: string, name: string, tokenValue: string) {
  const document = new Y.Doc();
  let authFailed = '';
  const synced = new Promise<void>((resolve) => {
    const provider = new HocuspocusProvider({
      url,
      name,
      document,
      token: tokenValue,
      onSynced: () => resolve(),
      onAuthenticationFailed: ({ reason }) => {
        authFailed = reason;
        resolve();
      },
    });
    cleanups.push(() => provider.destroy());
  });
  return {
    document,
    text: () => document.getText('t').toString(),
    synced,
    authFailed: () => authFailed,
  };
}

const until = async (check: () => boolean, ms = 3000) => {
  const start = Date.now();
  while (!check()) {
    if (Date.now() - start > ms) throw new Error('timeout');
    await new Promise((r) => setTimeout(r, 20));
  }
};

describe('the sync server', () => {
  it("two clients see each other's edits", async () => {
    const url = await start();
    const t = await token({ sub: 'u1', doc: 'post-1' });
    const a = client(url, 'post-1', t);
    const b = client(url, 'post-1', t);
    await Promise.all([a.synced, b.synced]);
    a.document.getText('t').insert(0, 'hello');
    await until(() => b.text() === 'hello');
    b.document.getText('t').insert(5, ' world');
    await until(() => a.text() === 'hello world');
  });

  it('a document is saved to SQLite and loaded after a server restart', async () => {
    const database = join(mkdtempSync(join(tmpdir(), 'nova-sync-')), 'sync.db');
    const t = await token({ sub: 'u1', doc: 'notes/*' });
    {
      const server = createSyncServer({ secret: SECRET, database });
      await server.listen(await freePort());
      const a = client(`ws://127.0.0.1:${server.address.port}`, 'notes/1', t);
      await a.synced;
      a.document.getText('t').insert(0, 'persisted');
      // Let the server write (debounce 2 s): destroy flushes the changes to disk.
      await new Promise((r) => setTimeout(r, 100));
      for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
      await server.destroy();
    }
    const url = await start(database);
    const b = client(url, 'notes/1', t);
    await b.synced;
    await until(() => b.text() === 'persisted');
  });

  it("without a token, with someone else's signature, an expired one or another document: refused", async () => {
    const url = await start();
    const forged = await new SignJWT({ sub: 'x', doc: '*' })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('1h')
      .sign(new TextEncoder().encode('another-secret-another-secret-123'));
    const expired = await token({ sub: 'u1', doc: 'post-1' }, '-1m');
    const otherDoc = await token({ sub: 'u1', doc: 'post-2' });
    for (const bad of ['', forged, expired, otherDoc]) {
      const c = client(url, 'post-1', bad);
      await c.synced;
      expect(c.authFailed()).not.toBe('');
    }
  });

  it("a viewer reads but can't change the document", async () => {
    const url = await start();
    const editor = client(url, 'post-1', await token({ sub: 'e', doc: 'post-1' }));
    const viewer = client(url, 'post-1', await token({ sub: 'v', doc: 'post-1', role: 'viewer' }));
    await Promise.all([editor.synced, viewer.synced]);
    editor.document.getText('t').insert(0, 'from editor');
    await until(() => viewer.text() === 'from editor');
    viewer.document.getText('t').insert(0, 'HACK ');
    await new Promise((r) => setTimeout(r, 300));
    expect(editor.text()).toBe('from editor');
  });

  it('public (demo) rooms: no token, no saving; the others still need a token', async () => {
    const database = join(mkdtempSync(join(tmpdir(), 'nova-sync-')), 'sync.db');
    const server = createSyncServer({ secret: SECRET, database, publicPrefix: 'demo/' });
    await server.listen(await freePort());
    cleanups.push(() => server.destroy());
    const url = `ws://127.0.0.1:${server.address.port}`;

    const a = client(url, 'demo/room', '');
    const b = client(url, 'demo/room', '');
    await Promise.all([a.synced, b.synced]);
    expect(a.authFailed()).toBe('');
    a.document.getText('t').insert(0, 'guest text');
    await until(() => b.text() === 'guest text');

    const privateDoc = client(url, 'post-1', '');
    await privateDoc.synced;
    expect(privateDoc.authFailed()).not.toBe('');
    // A similar name without the prefix isn't public either.
    const lookalike = client(url, 'demo', '');
    await lookalike.synced;
    expect(lookalike.authFailed()).not.toBe('');

    // Everyone left, the server would save the document, but a demo isn't written to the database.
    for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
    const storage = sqliteStorage(database);
    expect(await storage.fetch({ documentName: 'demo/room' })).toBeNull();
    storage.close();
  });

  it('document patterns in the token', () => {
    expect(documentAllowed('post-1', 'post-1')).toBe(true);
    expect(documentAllowed(['a', 'b'], 'b')).toBe(true);
    expect(documentAllowed('team-7/*', 'team-7/doc')).toBe(true);
    expect(documentAllowed('team-7/*', 'team-8/doc')).toBe(false);
    expect(documentAllowed(undefined, 'x')).toBe(false);
    expect(documentAllowed('', 'x')).toBe(false);
  });
});
