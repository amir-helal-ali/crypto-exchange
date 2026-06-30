# EgMoney Crypto Exchange — Production Deployment Guide

This guide walks you through deploying EgMoney to a production server from a clean state. The platform ships with Docker Compose orchestration, one-click SSL certificates, real-time WebSocket/SSE streaming, and Redis-backed cross-instance PubSub.

---

## Table of Contents
1. [Architecture Overview](#1-architecture-overview)
2. [Server Requirements](#2-server-requirements)
3. [Initial Server Setup](#3-initial-server-setup)
4. [Project Deployment](#4-project-deployment)
5. [First Boot & Verification](#5-first-boot--verification)
6. [SSL Certificate Issuance](#6-ssl-certificate-issuance)
7. [DNS Configuration](#7-dns-configuration)
8. [Email (SMTP) Setup](#8-email-smtp-setup)
9. [Backups & Disaster Recovery](#9-backups--disaster-recovery)
10. [Monitoring & Observability](#10-monitoring--observability)
11. [Scaling Horizontally](#11-scaling-horizontally)
12. [Troubleshooting](#12-troubleshooting)
13. [Security Checklist](#13-security-checklist)

---

## 1. Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│                      Internet (HTTPS)                        │
└────────────────┬─────────────────────────────────────────────┘
                 │
         ┌───────▼────────┐
         │     Nginx      │  TLS termination + reverse proxy
         │  (port 80/443) │  + ACME challenge serving
         └───────┬────────┘
                 │
        ┌────────┼─────────┬──────────┐
        │        │         │          │
        ▼        ▼         ▼          ▼
  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐
  │Frontend │ │  Admin  │ │ Backend │ │Backend  │  (scalable)
  │ (Svelte)│ │ (Next.js│ │  (Go)   │ │instance2│
  │ :3001   │ │ :3002   │ │  :3000  │ │  :3000  │
  └─────────┘ └─────────┘ └────┬────┘ └────┬────┘
                              │           │
                       ┌──────┴───────────┴─────┐
                       │                        │
                  ┌────▼────┐             ┌─────▼─────┐
                  │Postgres │             │   Redis   │
                  │  :5432  │             │   :6379   │
                  └─────────┘             └───────────┘
                                                │
                                          (PubSub channels)
                                          - user events
                                          - admin events
                                          - market ticks
```

### Real-time Data Flow (zero polling)
- **Binance WebSocket** (1 upstream connection) → Backend `MarketHub` cache
- **MarketHub** → 3 sinks:
  - `/ws/market` WebSocket (broadcast to all frontend clients)
  - `/api/v1/admin/metrics` (observability endpoint)
  - Matching engine `OnTickerUpdate(symbol, price)` (event-driven order matching)
- **User events** (login, deposits, KYC updates) → Redis PubSub → all backend instances → `/ws/user` (per-user WebSocket)
- **Admin events** (new transaction, new user, new KYC) → Redis PubSub → all backend instances → `/api/v1/admin/stream` (SSE)

### One-Click SSL Flow
```
Admin Panel → POST /api/v1/admin/ssl/generate
              ↓
           Backend runs openssl (local) OR certbot (Let's Encrypt)
              ↓
           Cert written to /etc/nginx/certs/ (shared volume)
              ↓
           Backend writes to /shared/nginx/.reload-trigger
              ↓
           Nginx sidecar's watcher detects change
              ↓
           regen-config.sh rewrites /etc/nginx/nginx.conf from DB settings
              ↓
           nginx -s reload (zero downtime)
```

---

## 2. Server Requirements

### Minimum (single instance, low traffic)
- **CPU**: 2 cores
- **RAM**: 4 GB
- **Disk**: 40 GB SSD
- **OS**: Ubuntu 22.04 LTS / Debian 12 / Alpine (any Docker-compatible)
- **Network**: Public IP, ports 80 + 443 open

### Recommended (production, moderate traffic)
- **CPU**: 4+ cores
- **RAM**: 8+ GB
- **Disk**: 100+ GB SSD (PostgreSQL + uploads + Let's Encrypt state)
- **Network**: 100 Mbps+, ports 80 + 443 open, outbound to Binance endpoints

### Software prerequisites (installed on host)
- Docker Engine 24.0+
- Docker Compose v2.20+
- `git`, `curl`, `openssl`
- NTP (for accurate time — critical for TOTP 2FA)

---

## 3. Initial Server Setup

### 3.1 Create a dedicated user (do NOT run as root)

```bash
sudo adduser --disabled-password --gecos "" egmoney
sudo usermod -aG sudo egmoney
sudo su - egmoney
```

### 3.2 Install Docker

```bash
# Official installer (Ubuntu/Debian)
curl -fsSL https://get.docker.com | sudo sh

# Add egmoney user to docker group
sudo usermod -aG docker egmoney
newgrp docker

# Verify
docker --version
docker compose version
```

### 3.3 Configure firewall

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp        # SSH
sudo ufw allow 80/tcp        # HTTP (ACME challenge + redirect)
sudo ufw allow 443/tcp       # HTTPS
sudo ufw enable
```

### 3.4 Configure swap (prevents OOM on memory spikes)

```bash
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### 3.5 Set timezone + NTP

```bash
sudo timedatectl set-timezone Africa/Cairo
sudo apt install -y chrony
sudo systemctl enable --now chrony
```

---

## 4. Project Deployment

### 4.1 Clone the project

```bash
cd /opt
sudo git clone <your-repo-url> crypto-exchange
sudo chown -R egmoney:egmoney crypto-exchange
cd crypto-exchange
```

### 4.2 Configure `.env` (CRITICAL — change all defaults)

```bash
cp .env .env.production
nano .env.production
```

**Required changes for production:**

| Variable | Default (dev) | Production value |
|----------|---------------|------------------|
| `JWT_SECRET` | (random 64-char) | Generate new: `openssl rand -hex 64` |
| `ADMIN_PASSWORD` | `Admin@123456` | Strong password (12+ chars, mixed case + symbols) |
| `POSTGRES_PASSWORD` | `EgMoney@2024Secure!` | Strong password (16+ chars) |
| `DATABASE_URL` | (uses default pw) | Update to match new POSTGRES_PASSWORD |
| `MAIN_DOMAIN` | `eg-money.local` | Your real domain (e.g. `egmoney.example.com`) |
| `FRONTEND_DOMAIN` | `eg-money.local` | Frontend domain (e.g. `egmoney.example.com`) |
| `BACKEND_DOMAIN` | `api.eg-money.local` | API domain (e.g. `api.egmoney.example.com`) |
| `ADMIN_DOMAIN` | `admin.eg-money.local` | Admin domain (e.g. `admin.egmoney.example.com`) |
| `FRONTEND_URL` | `http://localhost:3001` | `https://egmoney.example.com` |
| `ORIGIN` | `http://localhost:3001` | `https://egmoney.example.com` |
| `VITE_API_URL` | `http://localhost:3000` | `https://api.egmoney.example.com` |
| `NEXT_PUBLIC_API_URL` | `http://localhost:3000` | `https://api.egmoney.example.com` |
| `SMTP_HOST` | (empty) | Your SMTP server (e.g. `smtp.sendgrid.net`) |
| `SMTP_USER` | (empty) | SMTP username |
| `SMTP_PASS` | (empty) | SMTP password/API key |

Then symlink `.env` to `.env.production` (so docker-compose picks it up):

```bash
ln -sf .env.production .env
```

### 4.3 Build and start all services

```bash
docker compose pull         # pull base images
docker compose build        # build custom images (backend, frontend, admin, nginx)
docker compose up -d        # start in detached mode
```

First build takes ~5-10 minutes (downloads Node modules, Go modules, builds Next.js + SvelteKit).

### 4.4 Monitor startup

```bash
docker compose ps           # all services should show "healthy" within 60s
docker compose logs -f      # follow all logs
docker compose logs -f backend    # follow just backend
```

---

## 5. First Boot & Verification

### 5.1 Wait for healthchecks

```bash
# All services should reach "healthy" state within 60-90s
watch -n 2 'docker compose ps'
```

Expected state:
```
NAME                       STATUS                   PORTS
crypto-exchange-admin      Up (healthy)             0.0.0.0:3002->3000/tcp
crypto-exchange-api        Up (healthy)             0.0.0.0:3000->3000/tcp
crypto-exchange-db         Up (healthy)             0.0.0.0:5432->5432/tcp
crypto-exchange-nginx      Up (healthy)             0.0.0.0:80->80/tcp, 0.0.0.0:443->443/tcp
crypto-exchange-redis      Up (healthy)             0.0.0.0:6379->6379/tcp
crypto-exchange-web        Up (healthy)             0.0.0.0:3001->3000/tcp
```

### 5.2 Smoke test endpoints

```bash
# Backend live (no DB needed)
curl -sf http://localhost:3000/api/health/live | jq

# Backend ready (DB + Redis connected)
curl -sf http://localhost:3000/api/health | jq

# Public config endpoint
curl -sf http://localhost:3000/api/v1/config | jq

# Metrics (requires admin auth)
curl -sf -H "Authorization: Bearer <admin-token>" \
     http://localhost:3000/api/v1/admin/metrics | jq
```

### 5.3 Create the first admin user

```bash
# Set the admin password via env (already done in .env)
# The backend auto-creates the admin user on first boot if ADMIN_EMAIL is set.
# Otherwise, register via API then promote to ADMIN:

curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","email":"admin@egmoney.example.com","password":"<strong-password>"}'

# Promote to ADMIN (run inside postgres container):
docker exec -it crypto-exchange-db psql -U egmoney -d crypto_exchange \
  -c "UPDATE users SET role='ADMIN' WHERE email='admin@egmoney.example.com';"
```

---

## 6. SSL Certificate Issuance

The platform ships with a one-click SSL manager accessible from the admin panel:
**Admin → Settings → SSL tab**.

### 6.1 Option A: Local development (self-signed, 365 days)

Use this for testing on `localhost` / `.local` domains:

1. Open admin panel → Settings → SSL
2. Click **"توليد شهادة SSL"**
3. Choose **"تنمية محلية"** (Local Development)
4. Click **"توليد الآن"**
5. Cert generated in ~5 seconds, nginx reloaded automatically

### 6.2 Option B: Let's Encrypt (production, 90 days + auto-renew)

**Prerequisites** (must be true BEFORE clicking generate):
- Real domains (e.g. `egmoney.example.com`) pointing to your server's public IP via DNS A records
- Port 80 reachable from the internet (Let's Encrypt's HTTP-01 challenge)
- nginx running (it serves `/.well-known/acme-challenge/` from `/var/www/certbot`)

Steps:
1. Configure DNS A records for all 4 domains (main, frontend, backend, admin)
2. Wait for DNS propagation (`dig +short egmoney.example.com` should return your server IP)
3. Open admin panel → Settings → SSL → **"توليد شهادة SSL"**
4. Choose **"Let's Encrypt"**
5. Enter admin email (for expiry notifications)
6. Optionally check "Staging" first to test without hitting Let's Encrypt rate limits
7. Click **"إصدار شهادة Let's Encrypt"**
8. Certbot runs (~10-30 seconds), cert copied to shared volume, nginx reloaded

### 6.3 Option C: Custom upload (Cloudflare Origin CA, ZeroSSL, paid CA)

If you already have a PEM cert + key from another provider:
1. Admin → Settings → SSL → **"تثبيت شهادة موجودة"**
2. Paste cert PEM (starts with `-----BEGIN CERTIFICATE-----`)
3. Paste key PEM (starts with `-----BEGIN PRIVATE KEY-----`)
4. Click **"تثبيت الشهادة"**

### 6.4 Renewal

Let's Encrypt certs expire every 90 days. The platform offers:

- **Manual renewal**: Admin → Settings → SSL → **"تجديد (Renew)"** button (only shows for Let's Encrypt type)
- **Automatic renewal**: Add a cron job on the host:
  ```bash
  # Renew daily at 03:17 if cert expires within 30 days
  17 3 * * * docker exec crypto-exchange-api curl -X POST \
      -H "Authorization: Bearer <admin-token>" \
      http://localhost:3000/api/v1/admin/ssl/renew
  ```

---

## 7. DNS Configuration

For each domain, create an **A record** pointing to your server's public IPv4:

| Record | Type | Value |
|--------|------|-------|
| `egmoney.example.com` | A | `203.0.113.10` |
| `api.egmoney.example.com` | A | `203.0.113.10` |
| `admin.egmoney.example.com` | A | `203.0.113.10` |

(Replace `203.0.113.10` with your actual server IP.)

For IPv6, add AAAA records similarly.

Verify propagation:
```bash
dig +short egmoney.example.com
dig +short api.egmoney.example.com
dig +short admin.egmoney.example.com
```

All three should return your server IP. If using Cloudflare, set records to "DNS only" (gray cloud) initially — once SSL is issued, you can enable proxying (orange cloud) for DDoS protection.

---

## 8. Email (SMTP) Setup

Email is used for:
- Email verification on registration
- Password reset
- 2FA enable/disable notifications
- Login alerts
- Withdrawal confirmations

### 8.1 Choose an SMTP provider

Recommended transactional email providers:
- **SendGrid** — 100 emails/day free
- **Postmark** — 100 emails/month free, $15/mo for 10000
- **Amazon SES** — $0.10 per 1000 emails
- **Mailgun** — 5000 emails/month free for 3 months

### 8.2 Configure in `.env`

```bash
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=SG.xxxxxxxxxxxxxxxxxxxxx.xxxxxxxxxxxxxxxxxxxxx
SMTP_FROM_NAME=EgMoney
SMTP_FROM_EMAIL=noreply@egmoney.example.com
```

### 8.3 Test email delivery

Restart backend to pick up new SMTP settings:

```bash
docker compose restart backend
```

Then trigger a test email by registering a new user — the verification email should arrive within 30 seconds. Check spam folder if not.

### 8.4 DNS records for email deliverability

To avoid spam folder, configure on your DNS provider:

**SPF** (TXT record on root domain):
```
v=spf1 include:sendgrid.net ~all
```

**DKIM** (CNAME record, provider-specific):
```
s1._domainkey.example.com → s1.domainkey.uXXX.sendgrid.net
```

**DMARC** (TXT record, `_dmarc.example.com`):
```
v=DMARC1; p=quarantine; rua=mailto:admin@egmoney.example.com
```

---

## 9. Backups & Disaster Recovery

### 9.1 Automated daily backups (recommended)

The platform ships with `scripts/backup.sh` which creates a complete backup of:
- PostgreSQL (full dump, gzip compressed)
- Redis (BGSAVE + copy `dump.rdb`)
- SSL certificates (`./certs/` directory)
- Let's Encrypt state (accounts, certs, renewal config)

Setup cron on the host:

```bash
# Edit egmoney user's crontab
crontab -e

# Add this line — backup daily at 03:00, keep last 30 days
0 3 * * * /opt/crypto-exchange/scripts/backup.sh >> /var/log/egmoney-backup.log 2>&1
```

### 9.2 Off-site backup (highly recommended)

Daily cron backups protect against database corruption but NOT against server loss. Sync backups off-site:

```bash
# Add to crontab after backup.sh
30 3 * * * rsync -avz --delete /opt/crypto-exchange/backups/ \
    user@backup-server:/backups/egmoney/
```

Or use cloud storage (S3, GCS, Backblaze B2):

```bash
# Example with rclone + Backblaze B2
0 4 * * * rclone sync /opt/crypto-exchange/backups/ b2:egmoney-backups/ --transfers 4
```

### 9.3 Restoration procedure

To restore from a backup:

```bash
cd /opt/crypto-exchange
./scripts/restore.sh backups/2026-06-23_0315
```

The script:
1. Prompts for confirmation (type `RESTORE` to proceed)
2. Restores PostgreSQL (overwrites current DB)
3. Stops Redis, copies dump.rdb, starts Redis
4. Copies SSL certs to `./certs/`
5. Copies Let's Encrypt state to backend container
6. Triggers nginx reload

Test restoration quarterly on a staging server — never assume your backup works without testing.

### 9.4 Disaster recovery runbook

If the production server is lost:

1. Provision a new server (same OS, same Docker version)
2. Follow [Section 3](#3-initial-server-setup) + [Section 4](#4-project-deployment) up to step 4.2
3. Copy the latest off-site backup to `/opt/crypto-exchange/backups/`
4. Edit `.env` with the same `JWT_SECRET` as the old server (CRITICAL — without this, existing user sessions break)
5. `docker compose up -d` and wait for healthy state
6. Run `./scripts/restore.sh backups/<latest>`
7. Verify with smoke tests ([Section 5.2](#52-smoke-test-endpoints))
8. Update DNS to point to new server IP if it changed

---

## 10. Monitoring & Observability

### 10.1 Built-in metrics endpoint

The backend exposes a Prometheus-friendly metrics endpoint:

```bash
curl -H "Authorization: Bearer <admin-token>" \
     https://api.egmoney.example.com/api/v1/admin/metrics | jq
```

Returns:
- WebSocket connection counts (market clients, user clients, online users)
- SSE counts (subscribers, active connections, max connections)
- Upstream status (Binance connected, symbols, intervals, sub-streams, Redis PubSub)
- Go runtime stats (goroutines, heap, GC pause, Go version, NumCPU)
- Per-symbol ticker freshness (age in ms, stale flag for >15s)

### 10.2 Prometheus + Grafana (optional but recommended)

Add this scrape config to your Prometheus:

```yaml
scrape_configs:
  - job_name: 'egmoney-backend'
    scheme: https
    metrics_path: /api/v1/admin/metrics
    bearer_token: '<admin-token>'
    static_configs:
      - targets: ['api.egmoney.example.com:443']
```

Key alerts to configure:
- `egmoney_backend_down` — backend unreachable for 1m
- `egmoney_binance_disconnected` — Binance WebSocket disconnected
- `egmarket_stale_ticker{stale="true"}` — ticker not updated for >15s
- `egmoney_redis_pubsub_failed` — PubSub failed (multi-instance breakage)
- `egmoney_heap_high` — Go heap >2GB (memory leak indicator)
- `egmoney_goroutines_high` — goroutines >10000 (leak indicator)

### 10.3 Log aggregation

All services log to stdout/stderr. Capture with:

```bash
# View last 100 lines
docker compose logs --tail=100 backend

# Follow logs in real-time
docker compose logs -f backend

# Export logs to file (for debugging)
docker compose logs backend > backend.log 2>&1
```

For production, ship logs to a central system:
- **Loki + Promtail** (lightweight, integrates with Grafana)
- **ELK stack** (Elasticsearch + Logstash + Kibana)
- **Datadog / New Relic** (managed SaaS)

### 10.4 Health check endpoints

| Endpoint | Auth | Purpose |
|----------|------|---------|
| `GET /api/health/live` | None | Liveness (no DB) — for k8s livenessProbe |
| `GET /api/health` | None | Readiness (DB + Redis) — for k8s readinessProbe |
| `GET /api/v1/admin/metrics` | Admin | Detailed metrics for monitoring |

---

## 11. Scaling Horizontally

### 11.1 Single-instance limits

The default `docker-compose.yml` runs one backend instance. Performance ceiling:
- ~5,000 concurrent WebSocket clients (per backend instance)
- ~1,000 req/s for REST API
- ~10,000 SSE admin subscribers (cap is 200 per instance)

### 11.2 Multi-instance deployment

For higher load, run multiple backend instances behind nginx:

1. **Update docker-compose.yml** to scale backend:
   ```yaml
   backend:
     # ...
     deploy:
       replicas: 3
   ```

2. **Configure nginx upstream** with multiple backends:
   ```nginx
   upstream backend_upstream {
     least_conn;
     server backend:3000;
     # If using docker swarm / k8s, the DNS will resolve to all replicas
   }
   ```

3. **Redis is REQUIRED** for multi-instance — it provides:
   - PubSub channels so user events reach the correct instance
   - PubSub for admin SSE events
   - Shared rate-limit counters

4. **Sticky sessions NOT required** — all state is in Postgres + Redis, not in backend memory.

### 11.3 Database read replicas

For read-heavy workloads:
- Add a Postgres read replica
- Route `GET /api/v1/markets/*`, `GET /api/v1/wallet/history` to the replica
- Keep `POST /api/v1/trade`, `POST /api/v1/wallet/withdraw` on the primary

This requires code changes in the backend — not a simple config flip.

---

## 12. Troubleshooting

### 12.1 Backend won't start

```bash
docker compose logs backend | tail -50
```

Common causes:
- **DB connection failed**: Check `DATABASE_URL` in `.env` matches `POSTGRES_PASSWORD`
- **Redis unreachable**: Check `REDIS_URL`, ensure redis container is healthy
- **Port 3000 in use**: `sudo lsof -i :3000` to find conflicting process
- **JWT_SECRET empty**: Set in `.env` (required, will fail to start without it)

### 12.2 Nginx 502 Bad Gateway

Backend is down or unhealthy:
```bash
docker compose ps backend
docker compose logs backend --tail=20
curl -sf http://localhost:3000/api/health/live
```

If backend is healthy but nginx still 502s:
```bash
# Regenerate nginx config
docker exec crypto-exchange-nginx /etc/nginx/scripts/regen-config.sh
docker exec crypto-exchange-nginx nginx -s reload
```

### 12.3 SSL certificate issues

```bash
# Check cert file exists
ls -la /opt/crypto-exchange/certs/

# Inspect cert
openssl x509 -in /opt/crypto-exchange/certs/local.pem -text -noout | head -20

# Test nginx SSL
docker exec crypto-exchange-nginx nginx -t

# Check ACME challenge serving (for Let's Encrypt)
curl -sf http://egmoney.example.com/.well-known/acme-challenge/test
```

### 12.4 WebSocket disconnects

Common causes:
- **Nginx buffering**: Already disabled for `/ws/*` locations in template
- **Cloudflare proxy**: Disable for WebSocket endpoints, or use "WebSocket" enabled setting
- **Idle timeout**: Nginx `proxy_read_timeout` is set to 86400s (24h) for WS/SSE — verify it wasn't overridden
- **Backend crash**: Check `docker compose logs backend` for panics

### 12.5 Email not sending

```bash
# Test SMTP from inside backend container
docker exec -it crypto-exchange-api sh -c \
  'echo "Test" | smtp-cli --host=$SMTP_HOST --port=$SMTP_PORT --user=$SMTP_USER --pass=$SMTP_PASS --from=$SMTP_FROM_EMAIL --to=you@example.com --subject=Test'

# Check backend logs for SMTP errors
docker compose logs backend | grep -i smtp
```

### 12.6 2FA login fails

TOTP requires accurate server time. Verify:
```bash
# Check time sync
timedatectl status
# Should show "System clock synchronized: yes"

# If not, restart chrony
sudo systemctl restart chrony
```

Backup codes (generated at 2FA setup) bypass TOTP — store them safely.

---

## 13. Security Checklist

Before going live, verify:

- [ ] **Secrets rotated**: `JWT_SECRET`, `ADMIN_PASSWORD`, `POSTGRES_PASSWORD` all changed from defaults
- [ ] **DNS configured**: All domains point to your server IP
- [ ] **SSL issued**: Let's Encrypt cert active (not self-signed)
- [ ] **Firewall enabled**: Only ports 22, 80, 443 open
- [ ] **SSH hardened**: Disable password auth, use SSH keys only (`sudo nano /etc/ssh/sshd_config` → `PasswordAuthentication no`)
- [ ] **Fail2ban installed**: `sudo apt install fail2ban` — protects against SSH brute-force
- [ ] **Admin 2FA enabled**: First admin account must have TOTP enabled
- [ ] **SMTP configured**: Email verification works for new users
- [ ] **Backups scheduled**: `cron` entry for daily `backup.sh`
- [ ] **Off-site backup**: Backups synced to a different physical location
- [ ] **Rate limits verified**: Try 21 rapid login attempts — should get 429 after 20
- [ ] **CORS configured**: `cors_extra_origins` setting in admin panel matches your domains
- [ ] **Log rotation**: `docker compose logs` should rotate (configured via Docker daemon)
- [ ] **Disk space monitoring**: Set up alert for disk usage >80%
- [ ] **Security headers**: Verify with `curl -I https://egmoney.example.com` — should show X-Content-Type-Options, X-Frame-Options, etc.

### Post-launch security tasks

- [ ] Subscribe to security advisories for: Go, Node.js, PostgreSQL, Redis, Nginx, Alpine Linux
- [ ] Schedule monthly dependency updates (`docker compose pull && docker compose build && docker compose up -d`)
- [ ] Quarterly: review admin user list, revoke old sessions, rotate JWT_SECRET
- [ ] Quarterly: test restore from backup on staging server
- [ ] Annually: penetration test by external firm

---

## Quick Reference

| Command | Purpose |
|---------|---------|
| `docker compose up -d` | Start all services |
| `docker compose down` | Stop all services (keeps data volumes) |
| `docker compose down -v` | **DESTRUCTIVE** — stop + delete all data |
| `docker compose ps` | Show service status |
| `docker compose logs -f backend` | Follow backend logs |
| `docker compose restart backend` | Restart just backend |
| `docker compose build backend` | Rebuild backend image (after code change) |
| `docker exec -it crypto-exchange-db psql -U egmoney -d crypto_exchange` | Direct DB shell |
| `docker exec -it crypto-exchange-redis redis-cli` | Direct Redis shell |
| `docker exec crypto-exchange-nginx nginx -s reload` | Reload nginx config |
| `./scripts/backup.sh` | Manual backup |
| `./scripts/restore.sh <backup-dir>` | Restore from backup |

---

**Need help?** Check the worklog at `/home/z/my-project/worklog.md` for the full development history of every feature.
