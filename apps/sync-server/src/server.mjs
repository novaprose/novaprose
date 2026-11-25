// Сервер совместного редактирования NovaProse.
//
// Протокол — Hocuspocus (Yjs поверх WebSocket); клиент — @novaprose/collab.
// Хранение — встроенная в Node SQLite (node:sqlite), без нативных модулей.
// Авторизация — JWT вашего бэкенда (HS256): сервер не знает ваших пользователей, он доверяет подписи.
//
// Переменные окружения:
//   PORT                 порт (по умолчанию 1234)
//   NOVA_SYNC_SECRET     секрет HS256 для проверки JWT (обязателен, кроме режима разработки)
//   NOVA_SYNC_DB         путь к файлу SQLite (по умолчанию ./data/novaprose-sync.db)
//   NOVA_SYNC_DEV=1      режим разработки (или флаг --dev): без токенов, все — редакторы.
//                        Никогда в продакшене.
//   NOVA_SYNC_VERSION_INTERVAL  минимум минут между автоматическими версиями (по умолчанию 10)
//   NOVA_SYNC_PUBLIC_PREFIX  документы с этим префиксом (например "demo/") открыты всем без токена
//                        и не сохраняются: живут в памяти, пока в комнате есть участники. Для демо.
//
// Формат токена (claims):
//   sub   — id пользователя;   name — имя (для логов)
//   doc   — имя документа, список имён или префикс с «*» в конце: "post-42", ["a", "b"], "team-7/*"
//   role  — "editor" (по умолчанию) или "viewer" (только чтение)
//   exp   — срок действия (обязателен)

import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Database } from '@hocuspocus/extension-database';
import { Server } from '@hocuspocus/server';
import { jwtVerify } from 'jose';
import { memoryVersions, sqliteVersions, versionHistory } from './versions.mjs';
import { handleWaitlist, rateLimiter, waitlistStorage } from './waitlist.mjs';

// Через getBuiltinModule: сборщики (vite/vitest) не знают node:sqlite как встроенный модуль.
const { DatabaseSync } = process.getBuiltinModule('node:sqlite');

/** Подходит ли имя документа под claim doc из токена. */
export function documentAllowed(claim, documentName) {
  const patterns = Array.isArray(claim) ? claim : [claim];
  return patterns.some((pattern) => {
    if (typeof pattern !== 'string' || !pattern) return false;
    if (pattern.endsWith('*')) return documentName.startsWith(pattern.slice(0, -1));
    return pattern === documentName;
  });
}

/** Хранилище документов: одна таблица, состояние Yjs целиком (бинарное). */
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
 * Создать сервер (не запуская). Для тестов и встраивания: createSyncServer({...}).listen(port).
 * @param {{ secret?: string, dev?: boolean, database?: string, quiet?: boolean,
 *   publicPrefix?: string, versionInterval?: number }} options
 *   versionInterval — минимум минут между автоматическими версиями.
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
    // Запись в базу не чаще раза в 2 с, но не позже чем через 10 с после первого изменения.
    debounce: 2000,
    maxDebounce: 10000,
    extensions: [
      new Database({
        // Публичные (демо) документы не читаются и не пишутся в базу.
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

    // ----- История версий -----
    async onChange({ documentName, context }) {
      history.noteEditor(documentName, context?.user);
    },
    async onStoreDocument({ documentName, document, clientsCount }) {
      // Последний участник ушёл — версия сразу, иначе не чаще интервала.
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
      // Лист ожидания облака (форма на novaprose.com).
      if (request.url === '/waitlist') {
        await handleWaitlist(request, response, storage.waitlist, allowWaitlist);
        throw null;
      }
      // Проверка живости для мониторинга и балансировщика.
      if (request.url === '/health') {
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ ok: true }));
        // null — «запрос обработан», Hocuspocus не отвечает сам.
        throw null;
      }
    },

    async onDestroy() {
      storage.close();
    },
  });
  return server;
}

// Запуск как программы: node src/server.mjs
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
