#!/usr/bin/env bash
# Nightly backup of the database and uploaded files. Add to root's crontab:
#   15 2 * * *  bash /var/www/nexuscrm/deploy/backup.sh >> /var/log/nexuscrm/backup.log 2>&1
set -euo pipefail
source <(grep -E '^(MONGO_URI|UPLOAD_DIR)=' /var/www/nexuscrm/server/.env)
DEST=/var/backups/nexuscrm/$(date +%Y-%m-%d)
mkdir -p "$DEST"
mongodump --uri="$MONGO_URI" --gzip --archive="$DEST/db.archive.gz"
tar -czf "$DEST/uploads.tar.gz" -C "$(dirname "$UPLOAD_DIR")" "$(basename "$UPLOAD_DIR")"
find /var/backups/nexuscrm -maxdepth 1 -type d -mtime +14 -exec rm -rf {} +
echo "$(date -Is) backup ok -> $DEST"
