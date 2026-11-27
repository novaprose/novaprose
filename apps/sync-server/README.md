# NovaProse sync server

Real-time collaboration server for [`@novaprose/collab`](../../packages/collab). It speaks the
Hocuspocus protocol (Yjs over WebSocket), stores documents in SQLite (built into Node 22.13+, no
native modules) and trusts JWTs signed by **your** backend — it has no user database of its own.

```bash
# local development: no auth, everyone is an editor
pnpm --filter @novaprose/sync-server dev

# production
docker build -t novaprose-sync apps/sync-server
docker run -d -p 1234:1234 -e NOVA_SYNC_SECRET="$(openssl rand -hex 32)" \
  -v novaprose-sync:/data novaprose-sync
```

A ready Docker Compose setup with Caddy (automatic HTTPS) is in [`deploy/sync`](../../deploy/sync).
Or put it behind any TLS proxy (Caddy, nginx, Cloudflare) and connect with `wss://`.

| Variable                     | Default                    | Meaning                                                                                 |
| ---------------------------- | -------------------------- | --------------------------------------------------------------------------------------- |
| `PORT`                       | `1234`                     | Port to listen on                                                                       |
| `NOVA_SYNC_SECRET`           | —                          | HS256 secret shared with your backend. Required                                         |
| `NOVA_SYNC_DB`               | `./data/novaprose-sync.db` | SQLite file (`:memory:` for tests)                                                      |
| `NOVA_SYNC_DEV`              | —                          | `1` disables auth. Never in production                                                  |
| `NOVA_SYNC_PUBLIC_PREFIX`    | —                          | Documents with this prefix (e.g. `demo/`) need no token and are never stored. For demos |
| `NOVA_SYNC_PUBLIC_ORIGINS`   | —                          | Sites allowed to open public rooms, comma-separated (`https://example.com`). Empty: any |
| `NOVA_SYNC_VERSION_INTERVAL` | `10`                       | Minimum minutes between automatic versions                                              |

`GET /health` returns `{"ok":true}` for monitoring.

## Public rooms

Public rooms need no token, so the server limits them and they can't turn into free hosting for other
sites. Rooms with a token have none of these limits.

- Only the sites in `NOVA_SYNC_PUBLIC_ORIGINS` may open them (the browser's `Origin` header).
- At most 50 rooms at once, 25 people in a room and 20 connections from one address.
- A message over 512 KB, or a room whose edits pass 2 MB, closes the room for an hour.

Refused clients get a reason in `onAuthenticationFailed`: `demo-origin`, `demo-busy`, `demo-room-full`,
`demo-too-many-connections` or `demo-room-closed`. The numbers are in
[`src/public-limits.mjs`](src/public-limits.mjs); `createSyncServer({ publicLimits })` changes them.

## Tokens

Your backend signs a short-lived token for each user and document:

```js
import { SignJWT } from 'jose';

const token = await new SignJWT({ sub: user.id, name: user.name, doc: 'post-42', role: 'editor' })
  .setProtectedHeader({ alg: 'HS256' })
  .setExpirationTime('1h')
  .sign(new TextEncoder().encode(process.env.NOVA_SYNC_SECRET));
```

- `doc` — a document name, a list of names, or a prefix ending in `*` (`"team-7/*"`).
- `role` — `editor` (default) or `viewer` (read-only: the server ignores their changes).
- `exp` — required.
