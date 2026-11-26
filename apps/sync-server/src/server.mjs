// The NovaProse collaboration server.
//
// Protocol: Hocuspocus (Yjs over WebSocket); the client is @novaprose/collab.
// Storage: the SQLite built into Node (node:sqlite), no native modules.
// Authorization: a JWT from your backend (HS256): the server doesn't know your users, it trusts the signature.
//
// Environment variables:
//   PORT                 the port (1234 by default)
//   NOVA_SYNC_SECRET     the HS256 secret for checking JWTs (required, except in development mode)
//   NOVA_SYNC_DB         the path to the SQLite file (./data/novaprose-sync.db by default)
//   NOVA_SYNC_DEV=1      development mode (or the --dev flag): no tokens, everyone is an editor.
//                        Never in production.
//   NOVA_SYNC_VERSION_INTERVAL  the minimum minutes between automatic versions (10 by default)
//   NOVA_SYNC_PUBLIC_PREFIX  documents with this prefix (for example "demo/") are open to everyone without a token
//                        and aren't saved: they live in memory while the room has participants. For demos.
//
// The token format (claims):
//   sub   the user id;   name: the name (for logs)
//   doc   a document name, a list of names or a prefix ending with "*": "post-42", ["a", "b"], "team-7/*"
//   role  "editor" (the default) or "viewer" (read only)
//   exp   the expiry (required)

import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Database } from '@hocuspocus/extension-database';
import { Server } from '@hocuspocus/server';
import { jwtVerify } from 'jose';
import { memoryVersions, sqliteVersions, versionHistory } from './versions.mjs';
import { handleWaitlist, rateLimiter, waitlistStorage } from './waitlist.mjs';

// Through getBuiltinModule: bundlers (vite/vitest) don't know node:sqlite as a built-in module.
const { DatabaseSync } = process.getBuiltinModule('node:sqlite');

/** Whether a document name matches the doc claim of the token. */
export function documentAllowed(claim, documentName) {
  const patterns = Array.isArray(claim) ? claim : [claim];
  return patterns.some((pattern) => {
    if (typeof pattern !== 'string' || !pattern) return false;
    if (pattern.endsWith('*')) return documentName.startsWith(pattern.slice(0, -1));
    return pattern === documentName;
  });
}

/** Document storage: one table, the whole Yjs state (binary). */
export function sqliteStorage(path) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(`CREATE TABLE IF NOT EXISTS documents (
    name TEXT PRIMARY KEY,
    state BLOB NOT NULL,
    updated_at INTEGER NOT NULL
  )`);
  const select = db.prepare('SELECT state FROM documents WHERE name = ?');
  const upsert = db.prepare(
    `INSERT INTO documents (name, state, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(name) DO UPDATE SET state = excluded.state, updated_at = excluded.updated_at`,
  );
  return {
    versions: sqliteVersions(db),
    waitlist: waitlistStorage(db),
    fetch: async ({ documentName }) => {
      const row = select.get(documentName);
      return row ? new Uint8Array(row.state) : null;
    },
    store: async ({ documentName, state }) => {
      upsert.run(documentName, state, Date.now());
    },
    close: () => db.close(),
  };
}

/**
 * Creates a server (without starting it). For tests and embedding: createSyncServer({...}).listen(port).
 * @param {{ secret?: string, dev?: boolean, database?: string, quiet?: boolean,
 *   publicPrefix?: string, versionInterval?: number }} options
 *   versionInterval: the minimum minutes between automatic versions.
 */
export function createSyncServer(options = {}) {
  const secret = options.secret ? new TextEncoder().encode(options.secret) : null;
  if (!secret && !options.dev) {
    throw new Error('NOVA_SYNC_SECRET is required (or set NOVA_SYNC_DEV=1 for local development)');
  }
  const storage = sqliteStorage(options.database ?? ':memory:');
  const publicPrefix = options.publicPrefix || '';
  const isPublic = (name) => publicPrefix !== '' && name.startsWith(publicPrefix);
  const demoVersions = memoryVersions();
  const allowWaitlist = rateLimiter(10, 60 * 60_000);
  const history = versionHistory({
    storeFor: (name) => (isPublic(name) ? demoVersions : storage.versions),
    interval: (options.versionInterval ?? 10) * 60_000,
  });

  const server = new Server({
    name: 'novaprose-sync',
    quiet: options.quiet ?? true,
    // Writes to the database at most once every 2 s, but no later than 10 s after the first change.
    debounce: 2000,
    maxDebounce: 10000,
    extensions: [
      new Database({
        // Public (demo) documents are neither read from nor written to the database.
        fetch: async (data) => (isPublic(data.documentName) ? null : storage.fetch(data)),
        store: async (data) => {
          if (!isPublic(data.documentName)) await storage.store(data);
        },
      }),
    ],

    async onAuthenticate({ token, documentName, connectionConfig }) {
      if (!secret) return { user: { id: 'dev', name: 'Developer' } };
      if (isPublic(documentName)) return { user: { id: 'guest', name: 'Guest' } };
      if (!token) throw new Error('Token required');
      let payload;
      try {
        ({ payload } = await jwtVerify(token, secret, {
          algorithms: ['HS256'],
          requiredClaims: ['exp'],
        }));
      } catch {
        throw new Error('Invalid token');
      }
      if (!documentAllowed(payload.doc, documentName))
        throw new Error('No access to this document');
      if (payload.role === 'viewer') connectionConfig.readOnly = true;
      return { user: { id: String(payload.sub ?? ''), name: String(payload.name ?? '') } };
    },

    // ----- Version history -----
    async onChange({ documentName, context }) {
      history.noteEditor(documentName, context?.user);
    },
    async onStoreDocument({ documentName, document, clientsCount }) {
      // The last participant left: a version right away, otherwise no more often than the interval.
      history.snapshot(documentName, document, { force: clientsCount === 0 });
    },
    async afterUnloadDocument({ documentName }) {
      if (isPublic(documentName)) history.forget(documentName);
    },
    async onStateless({ connection, documentName, document, payload }) {
      if (payload.length > 4096) return;
      const reply = history.handle(documentName, document, connection, payload);
      if (reply) connection.sendStateless(JSON.stringify(reply));
    },

    async onRequest({ request, response }) {
      // The Cloud waitlist (the form on novaprose.com).
      if (request.url === '/waitlist') {
        await handleWaitlist(request, response, storage.waitlist, allowWaitlist);
        throw null;
      }
      // A liveness check for monitoring and the load balancer.
      if (request.url === '/health') {
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ ok: true }));
        // null means "request handled": Hocuspocus doesn't answer by itself.
        throw null;
      }
    },

    async onDestroy() {
      storage.close();
    },
  });
  return server;
}

// Run as a program: node src/server.mjs
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const dev = process.env.NOVA_SYNC_DEV === '1' || process.argv.includes('--dev');
  const port = Number(process.env.PORT ?? 1234);
  const server = createSyncServer({
    secret: process.env.NOVA_SYNC_SECRET,
    dev,
    database: process.env.NOVA_SYNC_DB ?? './data/novaprose-sync.db',
    publicPrefix: process.env.NOVA_SYNC_PUBLIC_PREFIX,
    versionInterval: Number(process.env.NOVA_SYNC_VERSION_INTERVAL ?? 10),
    quiet: false,
  });
  await server.listen(port);
  console.log(`NovaProse sync server on ws://localhost:${port}${dev ? ' (DEV: no auth)' : ''}`);
}
