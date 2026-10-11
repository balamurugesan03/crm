#!/usr/bin/env bash
# Install or update NexusCRM on the server from a release tarball.
#   sudo bash update.sh /tmp/nexuscrm-YYYYMMDDHHMM.tar.gz
# Keeps server/.env and the uploads folder; previous release is kept for rollback.
set -euo pipefail

TARBALL="${1:?usage: update.sh <release.tar.gz>}"
APP_DIR=/var/www/nexuscrm
STAMP=$(date +%Y%m%d%H%M%S)
WORK=$(mktemp -d)

echo "> Unpacking $TARBALL"
tar -xzf "$TARBALL" -C "$WORK"
SRC=$(find "$WORK" -maxdepth 1 -mindepth 1 -type d | head -1)

mkdir -p "$APP_DIR" /var/log/nexuscrm
if [ -d "$APP_DIR/server" ]; then
  echo "> Backing up current release to $APP_DIR.prev-$STAMP"
  cp -a "$APP_DIR" "$APP_DIR.prev-$STAMP"
fi

# Preserve the live .env
ENV_BACKUP=""
if [ -f "$APP_DIR/server/.env" ]; then ENV_BACKUP=$(mktemp); cp "$APP_DIR/server/.env" "$ENV_BACKUP"; fi

rm -rf "$APP_DIR/server/src" "$APP_DIR/client" "$APP_DIR/deploy"
mkdir -p "$APP_DIR/server"
cp -a "$SRC/server/." "$APP_DIR/server/"
cp -a "$SRC/client" "$APP_DIR/client"
cp -a "$SRC/deploy" "$APP_DIR/deploy"
cp -a "$SRC/README.md" "$APP_DIR/" 2>/dev/null || true
if [ -n "$ENV_BACKUP" ]; then cp "$ENV_BACKUP" "$APP_DIR/server/.env"; rm -f "$ENV_BACKUP"; fi

if [ ! -f "$APP_DIR/server/.env" ]; then
  echo "! $APP_DIR/server/.env is missing — copy server/.env.production.example to .env and fill it in, then re-run."
  exit 1
fi

echo "> Installing server dependencies"
cd "$APP_DIR/server"
npm ci --omit=dev --no-audit --no-fund

echo "> (Re)starting API with PM2"
if pm2 describe nexuscrm-api >/dev/null 2>&1; then
  pm2 reload "$APP_DIR/deploy/ecosystem.config.cjs" --env production
else
  pm2 start "$APP_DIR/deploy/ecosystem.config.cjs" --env production
  pm2 save
fi

sleep 3
if curl -fsS http://127.0.0.1:5050/api/health >/dev/null; then
  echo "✔ API healthy. Open https://unizova.com/crm/"
else
  echo "! Health check failed — see: pm2 logs nexuscrm-api --lines 100"
  exit 1
fi
rm -rf "$WORK"

# Keep the 3 most recent backups
ls -dt "$APP_DIR".prev-* 2>/dev/null | tail -n +4 | xargs -r rm -rf
