---
title: Video, web pages and link cards
description: YouTube, Vimeo and video files with the media plugin, any web page in a sandboxed frame with pageembed, and a card for any link with mediaembed.
---

Three plugins put something from another site into a document: `media` for video, `pageembed` for
a web page (a map, a form, a calendar, a dashboard), and `mediaembed` for a card that shows what a
link leads to. They show it in the editor as it will look: a click selects the block, so it can be
moved, deleted or edited, and a page or player in it doesn't take the click.

```ts
createEditor({ element, plugins: ['media', 'pageembed'] });
```

The **Video** and **Embedded page** buttons are added to the toolbar, and both are in the
**Insert** menu. Link cards are below, in [Link cards](#link-cards).

## Video

**Video** takes a YouTube or Vimeo link, as copied from the address bar, or the address of an
`.mp4`, `.webm` or `.ogg` file over https. YouTube plays from `youtube-nocookie.com`, which sets no
cookies until the video is played. Any other address is refused: the plugin embeds only these
players, and an `<iframe>` from anywhere else, pasted or in HTML you load, is dropped.

```html
<iframe
  src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"
  width="560"
  height="315"
  title="Launch"
  allow="…"
  allowfullscreen=""
  loading="lazy"
  …
></iframe>
```

## Embedded page

**Embedded page** asks for the page's address and a title for screen readers (the site's name
when you leave it empty), and how big it is:

- **Full width** with a ratio (21:9, 16:9, 4:3, 1:1): the page fills the width of the text and
  keeps its shape on any screen;
- **Fixed size**: a width and a height in pixels.

and whether to show a border and scroll bars. A page embedded at full width comes out like this:

```html
<div
  class="nova-pageembed nova-pageembed--16by9"
  style="position: relative; width: 100%; padding-top: 56.25%; overflow: hidden"
>
  <iframe
    src="https://maps.example.com/embed?q=office"
    title="Office map"
    sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-presentation"
    allow="fullscreen"
    allowfullscreen=""
    loading="lazy"
    referrerpolicy="strict-origin-when-cross-origin"
    frameborder="0"
    style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: 0"
  ></iframe>
</div>
```

The sizes are inline styles too, so the page that shows the HTML needs no CSS for them. In Word,
Markdown and email, where frames don't work, an embedded page becomes a link to it.

Some sites don't allow their pages to be shown on other sites (with the `X-Frame-Options` or
`Content-Security-Policy: frame-ancestors` headers): the frame then stays empty, and the site's own
"embed" link is the one to use. For YouTube and Vimeo, use **Video**.

### Settings

```ts
pluginOptions: {
  pageembed: {
    sizes: [
      { value: 'nova-pageembed--16by9' },
      { text: 'Tall', value: 'embed-tall' }, // your own class, styled by your CSS
    ],
    allowUrl: (url) => ['maps.example.com', 'forms.example.com'].includes(new URL(url).hostname),
  },
}
```

| Option         | Meaning                                                                                                  |
| -------------- | -------------------------------------------------------------------------------------------------------- |
| `sizes`        | the sizes besides a fixed one: a class each; `…--16by9` fills the width at 16:9. `[]`: only a fixed size |
| `inlineStyles` | `false`: the sizes only as classes, for your CSS                                                         |
| `className`    | the wrapper's class (`nova-pageembed`)                                                                   |
| `sandbox`      | the frame's sandbox, `allow-*` words; `false`: no sandbox                                                |
| `allowUrl`     | which addresses may be embedded (every `http` and `https` one by default)                                |

### What the frame can and can't do

Only absolute `http` and `https` addresses are embedded, and never one with a name and password in
it; the check runs when HTML is read, when a document arrives as JSON and on output. An `<iframe>`
on its own isn't an embedded page, so pasting a web page doesn't bring along its ads and trackers:
only the plugin's wrapper with a frame in it is.

The sandbox lets the page run its scripts, use its own cookies and storage, send its forms and open
links in a new tab, which most embeddable pages need. It doesn't let the page navigate the page that
shows it, start downloads, show alert dialogs, or use the camera, microphone or location.

If people who can't be trusted write your documents, use `allowUrl` to name the sites they may
embed. And if your own site serves files people upload (HTML among them) from its own domain, keep
that domain out of `allowUrl`: a page from your own domain, with `allow-scripts` and
`allow-same-origin`, can reach the page it is shown on.

## Link cards

A link alone on its line becomes a card when you press <kbd>Enter</kbd>: the page's title, a few
words about it, its picture and the site's name, as the page describes itself (with Open Graph
tags, like the previews in chats and social networks). With the `media` plugin, the **Video**
dialog takes any page too, and a YouTube, Vimeo or video file link becomes a player.

```ts
createEditor({
  element,
  plugins: ['media', 'mediaembed'],
  pluginOptions: {
    mediaembed: { serviceUrl: '/api/link-card' },
  },
});
```

What a page says about itself comes from your server: a browser can't read another site's pages.
The editor sends the address and gets back what the card shows:

```http
POST /api/link-card
Content-Type: application/json

{ "url": "https://example.com/blog/hello" }
```

```json
{
  "title": "Hello, world",
  "description": "What the post is about.",
  "image": "https://example.com/images/hello.png",
  "site": "Example Blog",
  "author": "Ann Lee"
}
```

| Field         | Meaning                                                                                         |
| ------------- | ----------------------------------------------------------------------------------------------- |
| `title`       | the page's title (the site's domain when there is none)                                         |
| `description` | a few words about the page                                                                      |
| `image`       | a picture for the card: an absolute `http` or `https` address                                   |
| `site`        | the site's name (its domain when there is none)                                                 |
| `author`      | who wrote it                                                                                    |
| `type`        | `"photo"`: the link is a picture (`image`) and is shown as one; `"video"`: a player for `video` |
| `video`       | with `"video"`: the player's address, one the media plugin plays (YouTube, Vimeo, a video file) |

Every field may be left out. `null` (or `204 No Content`) means there is nothing to show: the link
stays as it was typed, and the dialog says it couldn't get a preview. A card is its own undo step:
<kbd>Ctrl</kbd>+<kbd>Z</kbd> brings the link back.

Instead of a server address, `resolve` is a function of your own that answers the same way:

```ts
mediaembed: {
  resolve: async (url, signal) => {
    const response = await fetch(`/api/preview?url=${encodeURIComponent(url)}`, { signal });
    return response.ok ? response.json() : null;
  },
},
```

A card comes out as a link with its parts, styled inline so the page that shows it needs no CSS:

```html
<a class="nova-card" href="https://example.com/blog/hello" rel="noopener noreferrer" style="…">
  <img
    class="nova-card-thumbnail"
    src="https://example.com/images/hello.png"
    alt=""
    loading="lazy"
    style="…"
  />
  <span style="…">
    <span class="nova-card-title" style="…">Hello, world</span>
    <span class="nova-card-description" style="…">What the post is about.</span>
    <span class="nova-card-website" style="…">Example Blog</span>
    <span class="nova-card-author" style="…">Ann Lee</span>
  </span>
</a>
```

On a narrow screen the text goes under the picture. In Word and Markdown a card is a link to the
page with its title.

### Settings

| Option         | Meaning                                                                                                     |
| -------------- | ----------------------------------------------------------------------------------------------------------- |
| `serviceUrl`   | your server: it gets `POST { url }` and answers as above                                                    |
| `resolve`      | your function instead of `serviceUrl`: `(url, signal) => Promise<card or null>`                             |
| `maxWidth`     | the widest a card gets, in pixels (650)                                                                     |
| `inlineStyles` | `false`: only the classes, for your CSS                                                                     |
| `className`    | the card's class (`nova-card`); its parts add `-title`, `-description`, `-thumbnail`, `-website`, `-author` |

### Buttons

A click on a card selects it and shows its toolbar:

| Name             | What it does                    |
| ---------------- | ------------------------------- |
| `linkcardopen`   | opens the page in a new tab     |
| `linkcardunwrap` | turns the card back into a link |
| `linkcarddelete` | removes the card                |

### What gets into the document

Nothing from the server is put in as HTML: the card is built from its text, so a page that puts a
script in its title shows it as text. The card's address and picture are checked like any link and
image, when HTML is read, when a document arrives as JSON and on output, so `javascript:` and
`data:` addresses never get through.

The picture is shown from the site it is on, so a reader's browser asks that site for it, as for
any image in a page. If that matters to you, have your server keep a copy and answer with its
address.

### A server that reads pages safely

A card server requests whatever links writers type, so it needs the same care as a
[link checker](/guides/link-checker/#a-server-that-checks-links-safely): without it, a link to
`http://localhost:8080/admin` or `http://169.254.169.254/` makes your server read its own network
for the writer. The example below, for Node.js 20 or later:

- asks only public addresses, over `http` and `https` on the usual ports: the address a name
  resolves to is checked when connecting (so `127.1`, `[::ffff:127.0.0.1]` and names that change
  their address are refused), and so is every redirect, at most five;
- reads only HTML, and only its first 512 KB (the tags are in the page's head), eight seconds per
  page at most;
- takes only text from the page: its Open Graph tags (`og:title`, `og:description`, `og:image`,
  `og:site_name`), then its `<title>` and description;
- asks at most eight sites at once and keeps answers for ten minutes.

```js
// link-card.js
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

const LIMIT = 512 * 1024; // a page's tags are in its head, near the start

/** One GET: the status, the type, the redirect address and, for HTML, its first 512 KB as text. */
function get(url, signal) {
  return new Promise((resolve, reject) => {
    const client = url.protocol === 'https:' ? https : http;
    const req = client.get(
      url,
      {
        signal,
        lookup: safeLookup,
        headers: { 'User-Agent': 'link-cards', Accept: 'text/html,application/xhtml+xml' },
      },
      (res) => {
        const type = String(res.headers['content-type'] ?? '').toLowerCase();
        const answer = { status: res.statusCode ?? 0, type, location: res.headers.location };
        if (answer.status !== 200 || !type.includes('html')) {
          res.destroy();
          return resolve({ ...answer, body: '' });
        }
        const chunks = [];
        let size = 0;
        res.on('data', (chunk) => {
          chunks.push(chunk);
          size += chunk.length;
          if (size >= LIMIT) res.destroy();
        });
        res.on('error', () => {}); // a cut connection: what arrived is read
        res.on('close', () => {
          const charset = /charset=["']?([\w-]+)/.exec(type)?.[1] ?? 'utf-8';
          let decoder;
          try {
            decoder = new TextDecoder(charset);
          } catch {
            decoder = new TextDecoder('utf-8');
          }
          resolve({ ...answer, body: decoder.decode(Buffer.concat(chunks).subarray(0, LIMIT)) });
        });
      },
    );
    req.on('error', reject);
  });
}

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
const decode = (text) =>
  text.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (whole, name) => {
    if (name[0] !== '#') return ENTITIES[name.toLowerCase()] ?? whole;
    const code = /x/i.test(name[1]) ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10);
    return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
  });

/** A page's <meta property|name="…" content="…"> tags and its <title>. Only text is taken. */
export function readPage(html) {
  const meta = {};
  for (const [tag] of html.matchAll(/<meta\b[^>]*>/gi)) {
    const attrs = {};
    for (const m of tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g)) {
      attrs[m[1].toLowerCase()] = decode(m[2] ?? m[3] ?? m[4] ?? '');
    }
    const key = (attrs.property ?? attrs.name ?? '').toLowerCase();
    if (key && attrs.content && !(key in meta)) meta[key] = attrs.content;
  }
  const title = /<title[^>]*>([^<]*)<\/title>/i.exec(html)?.[1];
  return { meta, title: title ? decode(title) : '' };
}

const clip = (text, max) => (text ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

/** The card: Open Graph first, then the page's title and description. */
export function cardOf({ meta, title }, url) {
  const pick = (...keys) => keys.map((key) => meta[key]).find(Boolean) ?? '';
  let image = '';
  try {
    image = new URL(pick('og:image:secure_url', 'og:image', 'twitter:image'), url).href;
  } catch {}
  return {
    title: clip(pick('og:title', 'twitter:title') || title, 300),
    description: clip(pick('og:description', 'twitter:description', 'description'), 500),
    image: /^https?:\/\//.test(image) && image !== url.href ? image : '',
    site: clip(pick('og:site_name') || url.hostname.replace(/^www\./, ''), 100),
    author: clip(pick('author'), 100),
  };
}

/** What the card for a page shows, or null when there is nothing to show (the link stays a link). */
async function describe(href) {
  let url;
  try {
    url = new URL(href);
  } catch {
    return null;
  }
  const signal = AbortSignal.timeout(8000);
  try {
    for (let hop = 0; hop <= 5; hop++) {
      if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
      if (url.port && url.port !== '80' && url.port !== '443') return null;
      if (url.username || url.password) return null;
      const host = url.hostname.replace(/^\[|\]$/g, '');
      if (isIP(host) && isBlocked(host)) return null;
      const answer = await get(url, signal);
      if (answer.status >= 300 && answer.status < 400 && answer.location) {
        url = new URL(answer.location, url);
        continue;
      }
      if (answer.status !== 200) return null;
      // A link to a picture shows the picture.
      if (answer.type.startsWith('image/')) return { type: 'photo', image: url.href };
      if (!answer.body) return null;
      const card = cardOf(readPage(answer.body), url);
      return card.title ? card : null;
    }
    return null; // too many redirects
  } catch {
    return null; // no such site, refused, too slow
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

/** The card for one address, as the editor expects it, or null. */
export async function linkCard(url) {
  if (typeof url !== 'string' || url.length > 2000) return null;
  const kept = cache.get(url);
  if (kept && Date.now() - kept.at < KEEP) return kept.card;
  const card = await limited(() => describe(url));
  cache.delete(url);
  cache.set(url, { card, at: Date.now() });
  if (cache.size > 10_000) cache.delete(cache.keys().next().value);
  return card;
}
```

Then the route, behind your sign-in and a rate limit (here with Express):

```js
import express from 'express';
import { linkCard } from './link-card.js';

app.post('/api/link-card', requireSignedIn, express.json({ limit: '10kb' }), async (req, res) => {
  res.json(await linkCard(req.body?.url));
});
```

`requireSignedIn` is your own middleware. A rate limit per user (`express-rate-limit`, for example)
keeps one account from using your server to read other sites thousands of times.

## Coming from TinyMCE

`plugins: 'media pageembed'` with `tinymce.init()` works. Embedded pages saved by TinyMCE keep their
`tiny-pageembed` classes and sizes: `tiny_pageembed_classes` lists the sizes and
`tiny_pageembed_inline_styles` turns the inline styles on (they are off there by default, so the
classes and your CSS for them keep working).

`plugins: 'mediaembed'` works too, and brings the media plugin's **Video** button along. Point
`mediaembed_service_url` at a server that answers as described in [Link cards](#link-cards);
`mediaembed_max_width` sets the widest a card gets, and `mediaembed_inline_styles` turns the inline
styles on (they are off there by default). Cards saved with TinyMCE's `ephox-summary-card`
classes are read, and new cards keep those classes, so your CSS for them keeps working.
