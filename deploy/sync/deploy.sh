#!/usr/bin/env bash
# Deploy the sync server: bash deploy/sync/deploy.sh root@HOST
# Copies the sources and configs into /opt/novaprose and rebuilds the containers. Leaves .env on the server alone.
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
