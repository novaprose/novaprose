// @vitest-environment node
import { HocuspocusProvider } from '@hocuspocus/provider';
import { SignJWT } from 'jose';
import { afterEach, describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { freePort } from './port';
import { createSyncServer } from '../src/server.mjs';

/** История версий: снимки, именованные версии, права, протокол stateless. */

const SECRET = 'test-secret-that-is-long-enough-for-hs256';
const cleanups: (() => unknown)[] = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});

async function start(extra: Record<string, unknown> = {}) {
  const server = createSyncServer({ secret: SECRET, database: ':memory:', ...extra });
  await server.listen(await freePort());
  cleanups.push(() => server.destroy());
  return `ws://127.0.0.1:${server.address.port}`;
}

const token = (claims: Record<string, unknown>) =>
  new SignJWT(claims)
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('1h')
    .sign(new TextEncoder().encode(SECRET));

/** Клиент с запросами «вопрос — ответ» поверх stateless-сообщений. */
async function client(url: string, name: string, tokenValue: string) {
  const document = new Y.Doc();
  const waiting = new Map<number, (reply: Record<string, unknown>) => void>();
  let rid = 0;
  let provider!: HocuspocusProvider;
  await new Promise<void>((resolve) => {
    provider = new HocuspocusProvider({
      url,
      name,
      document,
      token: tokenValue,
      onSynced: () => resolve(),
      onStateless: ({ payload }) => {
        const reply = JSON.parse(payload) as Record<string, unknown>;
        waiting.get(reply.rid as number)?.(reply);
      },
    });
  });
  cleanups.push(() => provider.destroy());
  return {
    document,
    provider,
    request(message: Record<string, unknown>) {
      const id = ++rid;
      return new Promise<Record<string, unknown>>((resolve) => {
        waiting.set(id, resolve);
        provider.sendStateless(JSON.stringify({ ...message, rid: id }));
      });
    },
  };
}

const until = async (check: () => Promise<boolean> | boolean, ms = 5000) => {
  const startedAt = Date.now();
  while (!(await check())) {
    if (Date.now() - startedAt > ms) throw new Error('timeout');
    await new Promise((r) => setTimeout(r, 50));
  }
};

describe('история версий', () => {
  it('«сохранить версию», список (новые первыми, с авторами) и содержимое версии', async () => {
    const url = await start();
    const anna = await client(url, 'plan', await token({ sub: 'a', name: 'Anna', doc: 'plan' }));
    anna.document.getText('t').insert(0, 'Draft one');
    const first = await anna.request({ nova: 'save-version', label: 'First draft' });
    expect(first.nova).toBe('saved');

    anna.document.getText('t').insert(9, ', revised');
    await anna.request({ nova: 'save-version' });

    const list = (await anna.request({ nova: 'versions' })).versions as Record<string, unknown>[];
    expect(list.map((v) => v.label)).toEqual([null, 'First draft']);
    expect(list[1]!.authors).toEqual(['Anna']);

    const reply = await anna.request({ nova: 'version', id: first.id });
    const old = new Y.Doc();
    Y.applyUpdate(old, Buffer.from(reply.state as string, 'base64'));
    expect(old.getText('t').toString()).toBe('Draft one');
    expect((await anna.request({ nova: 'version', id: 999 })).error).toBe('not-found');
  });

  it('без изменений новая версия не создаётся; читатель не может сохранять', async () => {
    const url = await start();
    const anna = await client(url, 'doc', await token({ sub: 'a', name: 'Anna', doc: 'doc' }));
    anna.document.getText('t').insert(0, 'x');
    const a = await anna.request({ nova: 'save-version' });
    const b = await anna.request({ nova: 'save-version' });
    expect(b.id).toBe(a.id);

    const viewer = await client(url, 'doc', await token({ sub: 'v', doc: 'doc', role: 'viewer' }));
    expect((await viewer.request({ nova: 'save-version' })).error).toBe('read-only');
    // Читать историю читателю можно.
    expect(((await viewer.request({ nova: 'versions' })).versions as unknown[]).length).toBe(1);
  });

  it('когда последний участник уходит, версия сохраняется сама', async () => {
    const url = await start();
    const t = await token({ sub: 'b', name: 'Boris', doc: 'auto' });
    const boris = await client(url, 'auto', t);
    boris.document.getText('t').insert(0, 'Auto saved');
    await new Promise((r) => setTimeout(r, 100));
    boris.provider.destroy();
    await until(async () => {
      const probe = await client(url, 'auto', t);
      const versions = (await probe.request({ nova: 'versions' })).versions as unknown[];
      probe.provider.destroy();
      return versions.length === 1;
    });
  });

  it('демо-комнаты: версии в памяти, пока в комнате кто-то есть', async () => {
    const url = await start({ publicPrefix: 'demo/' });
    const guest = await client(url, 'demo/room', '');
    guest.document.getText('t').insert(0, 'demo');
    const saved = await guest.request({ nova: 'save-version', label: 'Demo' });
    expect(typeof saved.id).toBe('number');
    const list = (await guest.request({ nova: 'versions' })).versions as Record<string, unknown>[];
    expect(list[0]!.label).toBe('Demo');
  });
});

describe('клиент @novaprose/collab: serverVersions', () => {
  it('список, сохранение и содержимое версии в схеме редактора', async () => {
    const { serverVersions } = await import('../../../packages/collab/src/versions');
    const { createSchema } = await import('@novaprose/core');
    const url = await start();
    const anna = await client(url, 'post', await token({ sub: 'a', name: 'Anna', doc: 'post' }));
    // Документ в формате y-prosemirror: <paragraph>Hello history</paragraph>.
    const paragraph = new Y.XmlElement('paragraph');
    paragraph.insert(0, [new Y.XmlText('Hello history')]);
    anna.document.getXmlFragment('prosemirror').insert(0, [paragraph]);

    const versions = serverVersions(anna.request, 'prosemirror');
    await versions.save!('Before edits');
    const list = await versions.list();
    expect(list).toEqual([expect.objectContaining({ label: 'Before edits', authors: ['Anna'] })]);
    const editor = { schema: createSchema() } as never;
    const content = await versions.load(list[0]!, editor);
    expect(content).toEqual({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          attrs: expect.any(Object),
          content: [{ type: 'text', text: 'Hello history' }],
        },
      ],
    });
  });
});
