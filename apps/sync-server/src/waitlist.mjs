// Лист ожидания NovaProse Cloud: форма на novaprose.com → POST /waitlist.
//
// Храним минимум: почту, роль, размер команды, язык, время и версию согласия. IP не сохраняем
// (только держим в памяти для ограничения частоты). Повторная заявка с той же почтой обновляет запись.

/** Сайты, с которых принимаем заявки (CORS). */
export const WAITLIST_ORIGINS = [
  'https://novaprose.com',
  'http://localhost:4321',
  'http://localhost:4329',
];

const ROLES = new Set(['developer', 'product', 'founder', 'other']);
const TEAMS = new Set(['1', '2-10', '11-50', '51-200', '200+']);
const LOCALES = new Set(['en', 'ru']);
const EMAIL_RE = /^[^\s@<>"]{1,64}@[^\s@<>"]{1,190}\.[^\s@<>"]{2,24}$/;
/** Версия текста согласия: при изменении политики увеличиваем — видно, на что соглашался человек. */
export const CONSENT_VERSION = '2026-11-25';

export function waitlistStorage(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS waitlist (
    email TEXT PRIMARY KEY,
    role TEXT NOT NULL,
    team TEXT NOT NULL,
    locale TEXT NOT NULL,
    consent TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`);
  const upsert = db.prepare(
    `INSERT INTO waitlist (email, role, team, locale, consent, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(email) DO UPDATE SET role = excluded.role, team = excluded.team,
       locale = excluded.locale, consent = excluded.consent, updated_at = excluded.updated_at`,
  );
  const count = db.prepare('SELECT COUNT(*) AS n FROM waitlist');
  return {
    add(entry) {
      const now = Date.now();
      upsert.run(entry.email, entry.role, entry.team, entry.locale, CONSENT_VERSION, now, now);
    },
    count: () => Number(count.get().n),
  };
}

/** Проверка заявки: { ok: true, entry } или { ok: false, error }. */
export function validateWaitlist(body) {
  if (!body || typeof body !== 'object') return { ok: false, error: 'invalid' };
  // Ловушка для ботов: скрытое поле, которое человек не заполняет.
  if (body.website) return { ok: false, error: 'spam' };
  const email = String(body.email ?? '')
    .trim()
    .toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 254) return { ok: false, error: 'email' };
  if (body.consent !== true) return { ok: false, error: 'consent' };
  const role = ROLES.has(body.role) ? body.role : 'other';
  const team = TEAMS.has(body.team) ? body.team : '1';
  const locale = LOCALES.has(body.locale) ? body.locale : 'en';
  return { ok: true, entry: { email, role, team, locale } };
}

/** Не больше `limit` заявок с одного адреса за окно. */
export function rateLimiter(limit = 10, windowMs = 60 * 60_000) {
  const hits = new Map();
  return (key) => {
    const now = Date.now();
    const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
    recent.push(now);
    hits.set(key, recent);
    if (hits.size > 10_000) hits.clear();
    return recent.length <= limit;
  };
}

function readBody(request, max = 4096) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    request.on('data', (chunk) => {
      size += chunk.length;
      if (size > max) {
        reject(new Error('too large'));
        request.destroy();
      } else chunks.push(chunk);
    });
    request.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    request.on('error', reject);
  });
}

/** Обработчик HTTP-запроса к /waitlist. Возвращает true, если запрос обработан. */
export async function handleWaitlist(request, response, store, allow) {
  const origin = request.headers.origin ?? '';
  const cors = WAITLIST_ORIGINS.includes(origin)
    ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' }
    : {};
  const send = (status, body) => {
    response.writeHead(status, { 'Content-Type': 'application/json', ...cors });
    response.end(JSON.stringify(body));
  };
  if (request.method === 'OPTIONS') {
    response.writeHead(204, {
      ...cors,
      'Access-Control-Allow-Methods': 'POST',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    });
    response.end();
    return true;
  }
  if (request.method !== 'POST') {
    send(405, { ok: false, error: 'method' });
    return true;
  }
  // За Caddy реальный адрес клиента — первый в X-Forwarded-For.
  const ip =
    String(request.headers['x-forwarded-for'] ?? '')
      .split(',')[0]
      .trim() ||
    request.socket.remoteAddress ||
    '';
  if (!allow(ip)) {
    send(429, { ok: false, error: 'rate' });
    return true;
  }
  let body;
  try {
    body = JSON.parse(await readBody(request));
  } catch {
    send(400, { ok: false, error: 'invalid' });
    return true;
  }
  const result = validateWaitlist(body);
  if (!result.ok) {
    // Боту отвечаем «успехом», чтобы он не подбирал обход.
    if (result.error === 'spam') send(200, { ok: true });
    else send(400, { ok: false, error: result.error });
    return true;
  }
  store.add(result.entry);
  send(200, { ok: true });
  return true;
}
