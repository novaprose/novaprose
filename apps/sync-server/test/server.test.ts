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

/** Сервер синхронизации через настоящий WebSocket: синхронизация, хранение, права. */

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

describe('сервер синхронизации', () => {
  it('два клиента видят правки друг друга', async () => {
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

  it('документ сохраняется в SQLite и загружается после перезапуска сервера', async () => {
    const database = join(mkdtempSync(join(tmpdir(), 'nova-sync-')), 'sync.db');
    const t = await token({ sub: 'u1', doc: 'notes/*' });
    {
      const server = createSyncServer({ secret: SECRET, database });
      await server.listen(await freePort());
      const a = client(`ws://127.0.0.1:${server.address.port}`, 'notes/1', t);
      await a.synced;
      a.document.getText('t').insert(0, 'persisted');
      // Даём серверу записать (debounce 2 с) — destroy сбрасывает изменения на диск.
      await new Promise((r) => setTimeout(r, 100));
      for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
      await server.destroy();
    }
    const url = await start(database);
    const b = client(url, 'notes/1', t);
    await b.synced;
    await until(() => b.text() === 'persisted');
  });

  it('без токена, с чужой подписью, истёкшим или чужим документом — отказ', async () => {
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

  it('viewer читает, но не может менять документ', async () => {
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

  it('публичные (демо) комнаты: без токена, без сохранения; остальные — по-прежнему с токеном', async () => {
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
    // Похожее имя без префикса — тоже не публичное.
    const lookalike = client(url, 'demo', '');
    await lookalike.synced;
    expect(lookalike.authFailed()).not.toBe('');

    // Все ушли, сервер сохранил бы документ — но демо в базу не пишется.
    for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
    const storage = sqliteStorage(database);
    expect(await storage.fetch({ documentName: 'demo/room' })).toBeNull();
    storage.close();
  });

  it('шаблоны документов в токене', () => {
    expect(documentAllowed('post-1', 'post-1')).toBe(true);
    expect(documentAllowed(['a', 'b'], 'b')).toBe(true);
    expect(documentAllowed('team-7/*', 'team-7/doc')).toBe(true);
    expect(documentAllowed('team-7/*', 'team-8/doc')).toBe(false);
    expect(documentAllowed(undefined, 'x')).toBe(false);
    expect(documentAllowed('', 'x')).toBe(false);
  });
});
