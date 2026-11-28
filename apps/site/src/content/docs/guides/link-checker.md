---
title: Link checker
description: Broken links found as you write, by a check on your own server, with a server example that keeps your network out of reach.
---

With the `linkchecker` plugin, the links in a document are checked as it changes. A link that seems
broken gets a wavy red underline, and its bubble says **This link seems broken**, next to the
usual buttons to edit or remove the link, with **Ignore** to stop marking it.

- Marked links carry `aria-invalid="true"`, so screen readers announce them.
- Only absolute `http` and `https` addresses are checked: `mailto:`, anchors and relative addresses
  are left alone.
- The mark is only on screen: `getHTML()` and what is saved never contain it.
- **Ignore** stops marking that address in this editor. The **Check links** button (and the item
  in the **Tools** menu) turns checking off and on.

A page can't find out by itself whether another site's page answers: browsers don't let it read
other sites' answers. So the editor asks your server, and your server asks the sites.

```ts
createEditor({
  element,
  plugins: ['linkchecker'],
  pluginOptions: {
    linkchecker: { serviceUrl: '/api/check-links' },
  },
});
```

## What the server gets and answers

The editor sends a `POST` with the addresses as JSON:

```json
{ "urls": ["https://example.com/pricing", "https://example.com/old-page"] }
```

and expects the status of each one:

```json
{ "results": { "https://example.com/pricing": "valid", "https://example.com/old-page": "invalid" } }
```

| Status    | Meaning                                                   |
| --------- | --------------------------------------------------------- |
| `valid`   | the page answers                                          |
| `invalid` | the page or the site isn't there: the link is underlined  |
| `unknown` | the server couldn't tell (a timeout, a login): not marked |

Anything else in the answer counts as `unknown`, so a broken answer never marks a link. If the
server can't be reached, the editor says so once and keeps working.

Each address is asked about once and the answer is kept for ten minutes, so typing doesn't send the
same links again. Addresses go fifty to a request, at most five hundred per document, a second after
the last change. The request carries the page's cookies when the server is on the same origin, so
it can require a signed-in user; a server on another origin needs CORS.

To call the server yourself (to add a header, say), give `check` instead of `serviceUrl`:

```ts
linkchecker: {
  check: async (urls, signal) => {
    const response = await fetch('/api/check-links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
      body: JSON.stringify({ urls }),
      signal,
    });
    return (await response.json()).results;
  },
}
```

| Option       | Meaning                                                               |
| ------------ | --------------------------------------------------------------------- |
| `serviceUrl` | a server that answers as above                                        |
| `check`      | your own function: the addresses in, their statuses out               |
| `preprocess` | changes an address before it is sent (the link itself stays as it is) |
| `active`     | `false`: start with checking off                                      |
| `delay`      | how long after a change the links are checked, in milliseconds (1000) |

`preprocess` keeps what isn't the server's business out of the request, a token in an address for
example:

```ts
preprocess: (url) => {
  const address = new URL(url);
  address.searchParams.delete('token');
  return address.href;
},
```

## A server that checks links safely

A link checker requests whatever addresses documents contain, and anyone who can write a document
chooses them. Without care, a link to `http://localhost:8080/admin` or `http://169.254.169.254/`
(where a cloud server keeps its credentials) makes your server request its own network on the
writer's behalf. This is called server-side request forgery. The example below, for Node.js 20 or
later, keeps that out of reach:

- only `http` and `https` on the usual ports;
- the address a name resolves to is checked when the connection is made, so private, loopback and
  link-local addresses are refused, in every spelling (`127.1`, `0x7f000001`, `[::ffff:127.0.0.1]`),
  and a name that changes its address between two lookups gets nowhere;
- every redirect is checked the same way, at most five of them;
- only the status is read, never the page; eight seconds per link at most;
- at most eight sites are asked at once, and answers are kept for ten minutes.

A link is called broken only when the answer is clear: no such site, or the page answers 404 or 410.
A login page, a refusal or a slow site is `unknown`, so writers don't see false alarms.

```js
// check-links.js
import { lookup } from 'node:dns';
import http from 'node:http';
import https from 'node:https';
import { BlockList, isIP } from 'node:net';

// A link may never lead into your own network: private and loopback addresses, link-local ones
// (cloud metadata lives there) and other special ranges are refused.
const blocked = new BlockList();
for (const [address, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.88.99.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
]) {
  blocked.addSubnet(address, prefix, 'ipv4');
}
for (const [address, prefix] of [
  // IPv4-mapped addresses (::ffff:127.0.0.1) are checked against the IPv4 ranges by BlockList itself.
  ['::', 96], // unspecified, loopback, IPv4-compatible
  ['64:ff9b::', 96], // NAT64
  ['64:ff9b:1::', 48],
  ['100::', 64],
  ['2001::', 32], // Teredo
  ['2001:db8::', 32],
  ['2002::', 16], // 6to4
  ['fc00::', 7], // unique local
  ['fe80::', 10], // link-local
  ['fec0::', 10],
  ['ff00::', 8], // multicast
]) {
  blocked.addSubnet(address, prefix, 'ipv6');
}
const isBlocked = (address) => blocked.check(address, isIP(address) === 6 ? 'ipv6' : 'ipv4');

// The address a connection goes to is checked when it is resolved, so a name that resolves to a
// public address at first and to an internal one later (DNS rebinding) is refused too.
function safeLookup(hostname, options, callback) {
  lookup(hostname, { ...options, all: true }, (error, addresses) => {
    if (error) return callback(error);
    if (!addresses.length || addresses.some((a) => isBlocked(a.address))) {
      return callback(Object.assign(new Error(`${hostname}: not allowed`), { code: 'EBLOCKED' }));
    }
    if (options.all) callback(null, addresses);
    else callback(null, addresses[0].address, addresses[0].family);
  });
}

/** One request: only the status and the redirect address are read, never the page. */
function request(url, method, signal) {
  return new Promise((resolve, reject) => {
    const client = url.protocol === 'https:' ? https : http;
    const req = client.request(
      url,
      { method, signal, lookup: safeLookup, headers: { 'User-Agent': 'link-checker' } },
      (res) => {
        res.destroy();
        resolve({ status: res.statusCode ?? 0, location: res.headers.location });
      },
    );
    req.on('error', reject);
    req.end();
  });
}

/** 'valid', 'invalid' or 'unknown': a link is called broken only when the answer is clear. */
async function checkOne(href) {
  let url;
  try {
    url = new URL(href);
  } catch {
    return 'invalid';
  }
  const signal = AbortSignal.timeout(8000);
  try {
    for (let hop = 0; hop <= 5; hop++) {
      if (url.protocol !== 'http:' && url.protocol !== 'https:') return 'unknown';
      if (url.port && url.port !== '80' && url.port !== '443') return 'unknown';
      const host = url.hostname.replace(/^\[|\]$/g, '');
      if (isIP(host) && isBlocked(host)) return 'unknown';
      let answer = await request(url, 'HEAD', signal);
      // Some servers don't answer HEAD properly: a failure is confirmed with GET.
      if (answer.status >= 400) answer = await request(url, 'GET', signal);
      if (answer.status >= 300 && answer.status < 400 && answer.location) {
        url = new URL(answer.location, url);
        continue;
      }
      if (answer.status >= 200 && answer.status < 400) return 'valid';
      if (answer.status === 404 || answer.status === 410) return 'invalid';
      return 'unknown'; // 401, 403, 429, 5xx: the page may well be there
    }
    return 'unknown'; // too many redirects
  } catch (error) {
    // No such host: the link leads nowhere. A timeout or a refused connection may pass.
    return error?.code === 'ENOTFOUND' ? 'invalid' : 'unknown';
  }
}

// Answers are kept for ten minutes; at most eight sites are asked at once.
const KEEP = 10 * 60 * 1000;
const cache = new Map();
const waiting = [];
let running = 0;

function limited(task) {
  return new Promise((resolve) => {
    const run = () => {
      running++;
      task()
        .then(resolve)
        .finally(() => {
          running--;
          waiting.shift()?.();
        });
    };
    if (running < 8) run();
    else waiting.push(run);
  });
}

async function status(url) {
  const kept = cache.get(url);
  if (kept && Date.now() - kept.at < KEEP) return kept.status;
  const value = await limited(() => checkOne(url));
  cache.delete(url);
  cache.set(url, { status: value, at: Date.now() });
  if (cache.size > 10_000) cache.delete(cache.keys().next().value);
  return value;
}

/** The statuses of up to 50 addresses, as the link checker expects them. */
export async function checkLinks(urls) {
  const list = Array.isArray(urls) ? urls : [];
  const unique = [...new Set(list.filter((u) => typeof u === 'string' && u.length <= 2000))];
  const entries = await Promise.all(unique.slice(0, 50).map(async (u) => [u, await status(u)]));
  return Object.fromEntries(entries);
}
```

Then the route, behind your sign-in and a rate limit (here with Express):

```js
import express from 'express';
import { checkLinks } from './check-links.js';

app.post(
  '/api/check-links',
  requireSignedIn,
  express.json({ limit: '200kb' }),
  async (req, res) => {
    res.json({ results: await checkLinks(req.body?.urls) });
  },
);
```

`requireSignedIn` is your own middleware. A rate limit per user (`express-rate-limit`, for example)
keeps one account from using your server to ask other sites thousands of times.

## Buttons

| Name          | What it does                                  |
| ------------- | --------------------------------------------- |
| `linkchecker` | turns checking on and off (also in **Tools**) |

Coming from TinyMCE: `plugins: 'linkchecker'` with `tinymce.init()` works. Point
`linkchecker_service_url` at a server that answers as described here, and `linkchecker_preprocess`
gets `{ url }` and gives `{ url }` back, as there. `linkchecker_content_css` isn't needed: the
underline comes with the editor's styles.
