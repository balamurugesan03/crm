# Deploying NexusCRM to https://unizova.com/crm

Target: an Ubuntu 22.04/24.04 VPS where **unizova.com is already served by Nginx with HTTPS**.
The CRM runs as a Node.js process (PM2) on `127.0.0.1:5050`; Nginx serves the built React app at `/crm/`
and forwards `/crm/api/` (REST, Server-Sent Events and WebSockets) to Node. The rest of unizova.com is untouched.

```
Browser ──https──► Nginx (unizova.com)
                    ├─ /           → your existing website (unchanged)
                    ├─ /crm/       → /var/www/nexuscrm/client   (static React build)
                    └─ /crm/api/   → http://127.0.0.1:5050/api/  (Node + Socket.IO)
                                         └─ MongoDB (127.0.0.1:27017, auth on)
```

> If unizova.com is served by Apache/LiteSpeed instead of Nginx, tell me and I'll give you the equivalent config.

---

## 1. On your computer — build the release

```bash
npm run install:all        # once
npm run release            # -> release/nexuscrm-YYYYMMDDHHMM.tar.gz
```

The client is built with base path `/crm/` (from `client/.env.production`).

Upload it:

```bash
scp release/nexuscrm-*.tar.gz  youruser@your-server-ip:/tmp/
```

## 2. On the server — one-time setup

```bash
# Node.js 22 LTS + PM2
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
sudo npm install -g pm2

# MongoDB 8 (skip if you use MongoDB Atlas — then just put the Atlas URI in .env)
curl -fsSL https://www.mongodb.org/static/pgp/server-8.0.asc | sudo gpg -o /usr/share/keyrings/mongodb-server-8.0.gpg --dearmor
echo "deb [ signed-by=/usr/share/keyrings/mongodb-server-8.0.gpg ] https://repo.mongodb.org/apt/ubuntu $(lsb_release -cs)/mongodb-org/8.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-8.0.list
sudo apt-get update && sudo apt-get install -y mongodb-org mongodb-database-tools
sudo systemctl enable --now mongod

# Folders
sudo mkdir -p /var/www/nexuscrm /var/lib/nexuscrm/uploads /var/log/nexuscrm /var/backups/nexuscrm
sudo chown -R $USER:$USER /var/www/nexuscrm /var/lib/nexuscrm /var/log/nexuscrm /var/backups/nexuscrm
```

### Secure MongoDB (local install)

```bash
mongosh <<'JS'
use admin
db.createUser({ user: "admin", pwd: passwordPrompt(), roles: ["root"] })
use nexuscrm
db.createUser({ user: "nexuscrm", pwd: passwordPrompt(), roles: [{ role: "readWrite", db: "nexuscrm" }] })
JS
```

Then turn on auth and keep it bound to localhost — in `/etc/mongod.conf`:

```yaml
net:
  bindIp: 127.0.0.1
security:
  authorization: enabled
```

```bash
sudo systemctl restart mongod
```

### Environment file

```bash
cd /tmp && tar -xzf nexuscrm-*.tar.gz
mkdir -p /var/www/nexuscrm/server
cp /tmp/nexuscrm-*/server/.env.production.example /var/www/nexuscrm/server/.env
nano /var/www/nexuscrm/server/.env
```

Fill in `MONGO_URI` (with the `nexuscrm` user's password) and three different secrets — generate each with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

The server **refuses to start in production** if a secret is missing/weak or `CLIENT_URL` is not `https://`.

## 3. Install / start the app

```bash
sudo bash /tmp/nexuscrm-*/deploy/update.sh /tmp/nexuscrm-*.tar.gz
pm2 startup        # prints a command — run it once so PM2 starts on reboot
pm2 save
```

`update.sh` copies the code to `/var/www/nexuscrm`, keeps your `.env`, installs production dependencies,
starts/reloads PM2 and checks `http://127.0.0.1:5050/api/health`.

## 4. Nginx

1. Add the WebSocket map once (outside any `server` block):

   ```bash
   sudo tee /etc/nginx/conf.d/websocket-map.conf >/dev/null <<'EOF'
   map $http_upgrade $connection_upgrade { default upgrade; '' close; }
   EOF
   ```

2. Open the HTTPS server block for unizova.com (e.g. `/etc/nginx/sites-available/unizova.com`) and paste the
   `location` blocks from **`deploy/nginx-unizova-crm.conf`** inside it.

3. Test and reload:

   ```bash
   sudo nginx -t && sudo systemctl reload nginx
   ```

Firewall: only SSH and Nginx should be open — MongoDB and port 5050 stay private.

```bash
sudo ufw allow OpenSSH && sudo ufw allow 'Nginx Full' && sudo ufw enable
```

## 5. Verify

```bash
curl -s https://unizova.com/crm/api/health      # {"status":"ok","db":"up",...}
```

Open **https://unizova.com/crm/** → *Create one* (signup) → creates your company workspace (you become the owner).

Make yourself platform super-admin (sees all tenant workspaces at `/crm/admin`):

```bash
cd /var/www/nexuscrm/server && NODE_ENV=production node src/utils/promoteSuperAdmin.js you@yourcompany.com
```

Checklist after first login:
- Settings → Organization: business name, **GSTIN**, address, **UPI ID**, bank details
- Settings → Integrations: SMTP (for invoice/portal emails) and optionally WhatsApp Business API
- Settings → Team: invite your users
- Optional AI: add `ANTHROPIC_API_KEY` to `.env`, then `pm2 reload nexuscrm-api`

## 6. Backups (do this on day one)

```bash
sudo crontab -e
# add:
15 2 * * *  bash /var/www/nexuscrm/deploy/backup.sh >> /var/log/nexuscrm/backup.log 2>&1
```

Nightly gzip dump of MongoDB + uploads in `/var/backups/nexuscrm/<date>` (14 days kept).
Copy them off-server too (e.g. `rclone` to Google Drive / S3).

Restore: `mongorestore --uri="$MONGO_URI" --gzip --archive=/var/backups/nexuscrm/<date>/db.archive.gz --drop`

## 7. Updating later

```bash
# your computer
npm run release && scp release/nexuscrm-<new>.tar.gz youruser@server:/tmp/
# server
sudo bash /var/www/nexuscrm/deploy/update.sh /tmp/nexuscrm-<new>.tar.gz
```

Rollback: the previous version is kept as `/var/www/nexuscrm.prev-<timestamp>` —
`sudo mv /var/www/nexuscrm /var/www/nexuscrm.bad && sudo mv /var/www/nexuscrm.prev-<ts> /var/www/nexuscrm && pm2 reload nexuscrm-api`.

## Operations cheat-sheet

| Task | Command |
|---|---|
| Logs | `pm2 logs nexuscrm-api` |
| Restart | `pm2 reload nexuscrm-api` |
| Status / memory | `pm2 status` / `pm2 monit` |
| Health | `curl -s https://unizova.com/crm/api/health` |

## Optional integrations

- **Stripe** webhook URL: `https://unizova.com/crm/api/billing/webhook` (events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`).
- **Customer portal / web forms** links are generated from `CLIENT_URL`, e.g. `https://unizova.com/crm/portal`, `https://unizova.com/crm/f/<key>`.
- **Demo data** is blocked in production. For a separate demo server only: `ALLOW_DEMO_SEED=true npm run seed`.

## Notes / limits

- Run a single PM2 instance (real-time sockets, the daily scheduler and automations run in-process). The app is light — a 2 GB RAM VPS comfortably serves dozens of concurrent users.
- Attachments are stored on local disk (`UPLOAD_DIR`) and included in the nightly backup.
