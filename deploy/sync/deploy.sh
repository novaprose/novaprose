#!/usr/bin/env bash
# Выкатить сервер синхронизации: bash deploy/sync/deploy.sh root@HOST
# Копирует исходники и конфиги в /opt/novaprose и пересобирает контейнеры. .env на сервере не трогает.
set -euo pipefail
HOST="${1:?usage: deploy.sh user@host}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/novaprose_ed25519}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
tar -C "$ROOT" -czf - deploy/sync/compose.yml deploy/sync/Caddyfile \
  apps/sync-server/package.json apps/sync-server/Dockerfile apps/sync-server/.dockerignore apps/sync-server/src |
  ssh -i "$SSH_KEY" "$HOST" 'set -e
    mkdir -p /opt/novaprose && cd /opt/novaprose
    tar -xzf - --transform "s|^deploy/sync/||" --transform "s|^apps/sync-server|sync-server|"
    test -f .env || { echo "/opt/novaprose/.env is missing"; exit 1; }
    docker compose up -d --build --remove-orphans
    docker image prune -f >/dev/null
    docker compose ps'
