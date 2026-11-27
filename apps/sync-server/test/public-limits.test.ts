// @vitest-environment node
import { HocuspocusProvider, HocuspocusProviderWebsocket } from '@hocuspocus/provider';
import { SignJWT } from 'jose';
import { afterEach, describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { freePort } from './port';
import { createSyncServer } from '../src/server.mjs';
import { REFUSED, clientAddress } from '../src/public-limits.mjs';

/** Limits of public (demo) rooms over a real WebSocket: allowed sites, rooms and people at once, room size. */

const SECRET = 'test-secret-that-is-long-enough-for-hs256';
const SITE = 'https://novaprose.com';
const cleanups: (() => unknown)[] = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});

async function start(publicLimits: Record<string, number> = {}, publicOrigins = [SITE]) {
  const server = createSyncServer({
    secret: SECRET,
    publicPrefix: 'demo/',
    publicOrigins,
    publicLimits,
  });
  await server.listen(await freePort());
  cleanups.push(() => server.destroy());
  return `ws://127.0.0.1:${server.address.port}`;
}

/** A browser's WebSocket as the server sees it behind Caddy: the page's Origin and the client's address. */
function socketFrom(origin: string, address: string) {
  return class extends WebSocket {
    constructor(url: string | URL, protocols?: string | string[]) {
      // Node's WebSocket accepts extra headers in the second argument; a browser sends Origin by itself.
      super(url, {
        protocols,
        headers: { origin, 'x-forwarded-for': address },
      } as unknown as string[]);
    }
  };
}

function guest(
  url: string,
  room: string,
  { origin = SITE, address = '198.51.100.1', token = '' } = {},
) {
  const document = new Y.Doc();
  let refused = '';
  const socket = new HocuspocusProviderWebsocket({
    url,
    WebSocketPolyfill: socketFrom(origin, address),
  });
  let provider!: HocuspocusProvider;
  const settled = new Promise<void>((resolve) => {
    provider = new HocuspocusProvider({
      websocketProvider: socket,
      name: room,
      document,
      token,
      onSynced: () => resolve(),
      onAuthenticationFailed: ({ reason }) => {
        refused = reason;
        resolve();
      },
    });
  });
  provider.attach();
  const leave = () => {
    provider.destroy();
    socket.destroy();
  };
  cleanups.push(leave);
  return { document, settled, leave, refused: () => refused };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('public room limits', () => {
  it('only the listed sites may open a demo room', async () => {
    const url = await start();
    const ours = guest(url, 'demo/a');
    const theirs = guest(url, 'demo/a', {
      origin: 'https://other.example',
      address: '198.51.100.2',
    });
    const script = guest(url, 'demo/a', { origin: '', address: '198.51.100.3' });
    await Promise.all([ours.settled, theirs.settled, script.settled]);
    expect(ours.refused()).toBe('');
    expect(theirs.refused()).toBe(REFUSED.origin);
    expect(script.refused()).toBe(REFUSED.origin);
  });

  it('a room takes a limited number of people', async () => {
    const url = await start({ maxRoomConnections: 2 });
    const a = guest(url, 'demo/r', { address: '198.51.100.1' });
    const b = guest(url, 'demo/r', { address: '198.51.100.2' });
    await Promise.all([a.settled, b.settled]);
    const c = guest(url, 'demo/r', { address: '198.51.100.3' });
    await c.settled;
    expect([a.refused(), b.refused()]).toEqual(['', '']);
    expect(c.refused()).toBe(REFUSED.roomFull);
  });

  it('only so many demo rooms at once; joining an open one still works', async () => {
    const url = await start({ maxRooms: 2 });
    const one = guest(url, 'demo/one');
    const two = guest(url, 'demo/two');
    await Promise.all([one.settled, two.settled]);
    const three = guest(url, 'demo/three');
    await three.settled;
    expect(three.refused()).toBe(REFUSED.busy);
    const another = guest(url, 'demo/two', { address: '198.51.100.9' });
    await another.settled;
    expect(another.refused()).toBe('');
  });

  it('connections from one address are limited; other addresses get in, and leaving frees a place', async () => {
    const url = await start({ maxConnectionsPerAddress: 2 });
    const a = guest(url, 'demo/x');
    const b = guest(url, 'demo/y');
    await Promise.all([a.settled, b.settled]);
    const c = guest(url, 'demo/z');
    await c.settled;
    expect(c.refused()).toBe(REFUSED.tooManyConnections);
    const elsewhere = guest(url, 'demo/z', { address: '203.0.113.7' });
    await elsewhere.settled;
    expect(elsewhere.refused()).toBe('');

    a.leave();
    await sleep(300);
    const again = guest(url, 'demo/w');
    await again.settled;
    expect(again.refused()).toBe('');
  });

  it('a room that grows past its size closes and stays closed', async () => {
    const url = await start({ maxRoomBytes: 2000 });
    const a = guest(url, 'demo/big');
    await a.settled;
    a.document.getText('t').insert(0, 'x'.repeat(5000));
    await sleep(300);
    const late = guest(url, 'demo/big', { address: '198.51.100.5' });
    await late.settled;
    expect(late.refused()).toBe(REFUSED.roomClosed);
  });

  it('one message over the limit ends the connection and closes the room', async () => {
    const url = await start({ maxMessageBytes: 1000 });
    const a = guest(url, 'demo/paste');
    await a.settled;
    a.document.getText('t').insert(0, 'z'.repeat(5000));
    await sleep(300);
    const late = guest(url, 'demo/paste', { address: '198.51.100.6' });
    await late.settled;
    expect(late.refused()).toBe(REFUSED.roomClosed);
    // Other rooms are not affected.
    const other = guest(url, 'demo/other', { address: '198.51.100.7' });
    await other.settled;
    expect(other.refused()).toBe('');
  });

  it('rooms with a token are not limited: no Origin check, no room count', async () => {
    const url = await start({ maxRooms: 0 });
    const demo = guest(url, 'demo/any');
    await demo.settled;
    expect(demo.refused()).toBe(REFUSED.busy);
    const token = await new SignJWT({ sub: 'u1', doc: 'post-1' })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('1h')
      .sign(new TextEncoder().encode(SECRET));
    const member = guest(url, 'post-1', { origin: 'https://customer.example', token });
    await member.settled;
    expect(member.refused()).toBe('');
  });

  it('the client address is the first X-Forwarded-For entry', () => {
    expect(clientAddress(new Headers({ 'x-forwarded-for': '203.0.113.9, 10.0.0.1' }))).toBe(
      '203.0.113.9',
    );
    expect(clientAddress(new Headers())).toBe('direct');
    expect(clientAddress(undefined)).toBe('direct');
  });
});
