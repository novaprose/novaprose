// Document version history: snapshots of the Yjs state.
//
// A snapshot is taken when the document is saved, but no more often than every `interval` (10 minutes by default),
// and always when the last participant leaves the document or someone presses "Save version".
// The client (@novaprose/collab) gets the list and the content of versions through stateless messages over the
// already open connection, with the same rights as for the document.

import * as Y from 'yjs';

/** How many versions to keep per document (old ones are deleted). */
export const MAX_VERSIONS = 500;

const sameBytes = (a, b) => a.length === b.length && a.every((value, index) => value === b[index]);

/** Versions in SQLite (the same database as the documents). */
export function sqliteVersions(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    authors TEXT NOT NULL,
    label TEXT,
    state BLOB NOT NULL,
    sv BLOB NOT NULL
  )`);
  db.exec('CREATE INDEX IF NOT EXISTS versions_by_name ON versions (name, id)');
  const insert = db.prepare(
    'INSERT INTO versions (name, created_at, authors, label, state, sv) VALUES (?, ?, ?, ?, ?, ?)',
  );
  const list = db.prepare(
    'SELECT id, created_at, authors, label FROM versions WHERE name = ? ORDER BY id DESC LIMIT ?',
  );
  const one = db.prepare(
    'SELECT id, created_at, authors, label, state FROM versions WHERE name = ? AND id = ?',
  );
  const last = db.prepare(
    'SELECT id, created_at, sv FROM versions WHERE name = ? ORDER BY id DESC LIMIT 1',
  );
  const trim = db.prepare(
    `DELETE FROM versions WHERE name = ? AND id NOT IN
       (SELECT id FROM versions WHERE name = ? ORDER BY id DESC LIMIT ?)`,
  );
  const toMeta = (row) => ({
    id: Number(row.id),
    createdAt: Number(row.created_at),
    authors: JSON.parse(row.authors),
    label: row.label ?? null,
  });
  return {
    add(name, version) {
      const result = insert.run(
        name,
        version.createdAt,
        JSON.stringify(version.authors),
        version.label,
        version.state,
        version.sv,
      );
      trim.run(name, name, MAX_VERSIONS);
      return Number(result.lastInsertRowid);
    },
    list: (name, limit = 100) => list.all(name, limit).map(toMeta),
    get(name, id) {
      const row = one.get(name, id);
      return row ? { ...toMeta(row), state: new Uint8Array(row.state) } : null;
    },
    last(name) {
      const row = last.get(name);
      return row
        ? { id: Number(row.id), createdAt: Number(row.created_at), sv: new Uint8Array(row.sv) }
        : null;
    },
    drop() {},
  };
}

/** Versions in memory, for public (demo) documents: they disappear together with the document. */
export function memoryVersions() {
  const byName = new Map();
  let nextId = 1;
  const meta = ({ id, createdAt, authors, label }) => ({ id, createdAt, authors, label });
  return {
    add(name, version) {
      const list = byName.get(name) ?? [];
      const id = nextId++;
      list.push({ id, ...version });
      byName.set(name, list.slice(-MAX_VERSIONS));
      return id;
    },
    list: (name, limit = 100) => [...(byName.get(name) ?? [])].reverse().slice(0, limit).map(meta),
    get(name, id) {
      const version = (byName.get(name) ?? []).find((v) => v.id === id);
      return version ? { ...meta(version), state: version.state } : null;
    },
    last(name) {
      const list = byName.get(name) ?? [];
      return list.length ? list[list.length - 1] : null;
    },
    drop: (name) => byName.delete(name),
  };
}

/**
 * Snapshots and the versions protocol for the server.
 * @param {{ storeFor: (name: string) => ReturnType<typeof memoryVersions>, interval: number }} options
 */
export function versionHistory({ storeFor, interval }) {
  // Who edited the document since the last snapshot: the authors of the next version.
  const editors = new Map();

  /** Takes a snapshot if there is something to save. Returns the id of the new (or the latest) version. */
  function snapshot(name, document, { force = false, label = null } = {}) {
    const store = storeFor(name);
    const last = store.last(name);
    const sv = Y.encodeStateVector(document);
    // An empty document nothing has been written to yet is not a version.
    if (!last && sv.length <= 1) return null;
    const changed = !last || !sameBytes(last.sv, sv);
    if (!changed && !label) return last.id;
    if (!force && last && Date.now() - last.createdAt < interval) return null;
    const authors = [...(editors.get(name) ?? [])].slice(0, 20);
    editors.delete(name);
    return store.add(name, {
      createdAt: Date.now(),
      authors,
      label,
      state: Y.encodeStateAsUpdate(document),
      sv,
    });
  }

  return {
    snapshot,
    noteEditor(name, user) {
      const set = editors.get(name) ?? new Set();
      set.add(String(user?.name || 'Guest').slice(0, 80));
      editors.set(name, set);
    },
    forget(name) {
      editors.delete(name);
      storeFor(name).drop(name);
    },

    /** The answer to a client's stateless message. null means the message isn't about versions. */
    handle(name, document, connection, payload) {
      let message;
      try {
        message = JSON.parse(payload);
      } catch {
        return null;
      }
      if (!message || typeof message.nova !== 'string') return null;
      const rid = typeof message.rid === 'number' ? message.rid : 0;
      const store = storeFor(name);
      switch (message.nova) {
        case 'versions':
          return { nova: 'versions', rid, versions: store.list(name) };
        case 'version': {
          const version = store.get(name, Number(message.id));
          if (!version) return { nova: 'error', rid, error: 'not-found' };
          const { state, ...meta } = version;
          return {
            nova: 'version',
            rid,
            version: meta,
            state: Buffer.from(state).toString('base64'),
          };
        }
        case 'save-version': {
          if (connection.readOnly) return { nova: 'error', rid, error: 'read-only' };
          const label = typeof message.label === 'string' ? message.label.trim().slice(0, 80) : '';
          const id = snapshot(name, document, { force: true, label: label || null });
          return { nova: 'saved', rid, id };
        }
        default:
          return { nova: 'error', rid, error: 'unknown' };
      }
    },
  };
}
