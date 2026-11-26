// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import { createSyncServer } from '../src/server.mjs';
import { validateWaitlist } from '../src/waitlist.mjs';
import { freePort } from './port';

/** The waitlist: accepting entries from the site, validation, CORS, spam protection. */

const SECRET = 'test-secret-that-is-long-enough-for-hs256';
const cleanups: (() => unknown)[] = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});

async function start() {
  const server = createSyncServer({ secret: SECRET, database: ':memory:' });
  const port = await freePort();
  await server.listen(port);
  cleanups.push(() => server.destroy());
  return `http://127.0.0.1:${port}/waitlist`;
}

const post = (url: string, body: unknown, origin = 'https://novaprose.com') =>
  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: origin },
    body: JSON.stringify(body),
  });

describe('the waitlist', () => {
  it('accepts an entry from the site and allows CORS only for its own site', async () => {
    const url = await start();
    const ok = await post(url, {
      email: 'Anna@Example.com',
      role: 'developer',
      team: '2-10',
      locale: 'ru',
      consent: true,
    });
    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual({ ok: true });
    expect(ok.headers.get('access-control-allow-origin')).toBe('https://novaprose.com');
    const foreign = await post(
      url,
      { email: 'b@example.com', consent: true },
      'https://evil.example',
    );
    expect(foreign.headers.get('access-control-allow-origin')).toBeNull();
    const preflight = await fetch(url, {
      method: 'OPTIONS',
      headers: { Origin: 'https://novaprose.com' },
    });
    expect(preflight.status).toBe(204);
  });

  it('without consent or with a wrong email: a clear error; GET gives 405', async () => {
    const url = await start();
    expect(await (await post(url, { email: 'a@example.com' })).json()).toEqual({
      ok: false,
      error: 'consent',
    });
    expect(await (await post(url, { email: 'not-an-email', consent: true })).json()).toEqual({
      ok: false,
      error: 'email',
    });
    expect((await fetch(url)).status).toBe(405);
  });

  it('rate limiting: no more than 10 entries an hour from one address', async () => {
    const url = await start();
    const statuses: number[] = [];
    for (let i = 0; i < 11; i += 1) {
      statuses.push((await post(url, { email: `u${i}@example.com`, consent: true })).status);
    }
    expect(statuses.slice(0, 10).every((s) => s === 200)).toBe(true);
    expect(statuses[10]).toBe(429);
  });

  it('data checks: the bot trap, email normalization, unknown values', () => {
    expect(validateWaitlist({ email: 'a@example.com', consent: true, website: 'x' })).toEqual({
      ok: false,
      error: 'spam',
    });
    expect(
      validateWaitlist({
        email: ' A@Example.COM ',
        consent: true,
        role: 'hacker',
        team: '9999',
        locale: 'de',
      }),
    ).toEqual({
      ok: true,
      entry: { email: 'a@example.com', role: 'other', team: '1', locale: 'en' },
    });
    expect(validateWaitlist({ email: '<script>@x.com', consent: true }).ok).toBe(false);
  });
});
