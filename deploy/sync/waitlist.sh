#!/usr/bin/env bash
# Выгрузить лист ожидания NovaProse Cloud в CSV: bash deploy/sync/waitlist.sh root@HOST > waitlist.csv
set -euo pipefail
HOST="${1:?usage: waitlist.sh user@host}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/novaprose_ed25519}"
ssh -i "$SSH_KEY" "$HOST" "cd /opt/novaprose && docker compose exec -T sync node -e \"
const { DatabaseSync } = process.getBuiltinModule('node:sqlite');
const db = new DatabaseSync('/data/novaprose-sync.db', { readOnly: true });
console.log('email,role,team,locale,consent,created_at');
for (const r of db.prepare('SELECT * FROM waitlist ORDER BY created_at').all()) {
  console.log([r.email, r.role, r.team, r.locale, r.consent, new Date(r.created_at).toISOString()].join(','));
}
\""
