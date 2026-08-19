# Deployment Guide (homelab / reference)

> Production deployment documentation for WBOS (Wholesale Business Operating System).

> **⚠ Start with [`PRODUCTION_DEPLOYMENT.md`](PRODUCTION_DEPLOYMENT.md) instead.**
> That is the current production runbook: it deploys the image published to GHCR
> by CI (`.github/workflows/docker.yml`).
>
> This document predates the CI/GHCR pipeline and describes the older workflow of
> building an image locally, `docker save`-ing it, and copying it to the server.
> That flow still works for an air-gapped homelab box, and the **Database**,
> **Restore**, **Recovery**, **Reverse Proxy**, and **Troubleshooting** sections
> remain the most detailed reference we have — but where the two documents
> disagree about how a deploy happens, `PRODUCTION_DEPLOYMENT.md` wins.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Cross-Platform Workflow](#cross-platform-workflow)
3. [Quick Start](#quick-start)
4. [Configuration](#configuration)
5. [Docker Deployment](#docker-deployment)
6. [Database](#database)
7. [Backup](#backup)
8. [Restore](#restore)
9. [Updating](#updating)
10. [Recovery](#recovery)
11. [Reverse Proxy](#reverse-proxy)
12. [Local Network](#local-network)
13. [Troubleshooting](#troubleshooting)

---

## Environment Overview

WBOS has **three environment tiers**, each with its own `.env` file and API URL:

| Tier | Env File | API URL | Use Case |
|------|----------|---------|----------|
| **Development** | `.env.development` | `http://192.168.100.10:3000` | Local dev machine, hot-reload |
| **Homelab** | `.env` (production config) | `https://wbos.home.lab` (internal) / `http://192.168.100.36:3000` (LAN) | Self-hosted on Debian homelab server; Pi-hole/DNS resolves `wbos.home.lab` |
| **Production** | `.env.production` (planned) | `https://api.wbos.app` | Future public cloud deployment |

### Homelab Details

The current production instance runs on a **Debian homelab server** at `192.168.100.36`:
- **App**: Docker container (image `ghcr.io/devhoss/wbos`) exposed on host port **3005**
- **Database**: PostgreSQL 17 running on the same host, port **5432**
- **Reverse Proxy**: Configured in Nginx Proxy Manager, Caddy, or Traefik (see [Reverse Proxy](#reverse-proxy))
- **Storage**: `/opt/wbos/storage` mounted into container at `/app/storage` for uploads
- **Backups**: `/opt/wbos/backups` with automatic daily cron
- **Mobile**: configured via `mobile/.env.homelab` → `API_URL=https://wbos.home.lab`

---

## Prerequisites

### Build Machine (Windows / Linux)

- **Docker** (24+) with **Docker Compose** (v2)
- **Git**
- Node.js 22+ (for local development and testing)

### Deploy Target (Debian Homelab Server)

- **Docker** (24+) and **Docker Compose** (v2)
- Debian 12+ (Debian 13 recommended) or Ubuntu 24.04+
- Minimum: 2 CPU cores, 2 GB RAM, 20 GB free disk space
- **curl** (for health checks)

---

## Cross-Platform Workflow

WBOS uses a **build-once, deploy-anywhere** model. The application is built on a Windows development machine and the pre-built Docker image is transferred to the Debian server. The server never builds the application — it only runs pre-built images.

```
Windows Dev Machine
       │
       │ docker compose build
       │
       ▼
   wbos:latest image
       │
       │ docker save -o wbos.tar wbos:latest
       │ scp wbos.tar user@debian-server:~/
       │
       ▼
Debian Homelab Server
       │
       │ docker load -i wbos.tar
       │ docker compose up -d
       │
       ▼
   Application running on Debian
```

### Why this approach?

- **No build tools** required on the server (no Node.js, no TypeScript compiler)
- **Consistent builds** — same image tested on Windows runs identically on Linux
- **Smaller server footprint** — only Docker runtime needed
- **Faster deployments** — image transfer is faster than building on the server

### Prisma Cross-Platform Support

Prisma is configured to generate query engines for multiple platforms in a single build:

```prisma
generator client {
  provider      = "prisma-client-js"
  binaryTargets = ["native", "debian-openssl-3.0.x"]
}
```

- **`native`** — the build platform (Windows during dev, Linux during Docker build)
- **`debian-openssl-3.0.x`** — Debian 13 / OpenSSL 3 runtime (the homelab target)

Both engines are bundled into the Docker image automatically. No manual steps needed.

---

## Quick Start

```bash
# ── On your Windows development machine ──

# 1. Clone and configure
git clone https://github.com/your-org/wbos.git
cd wbos
cp .env.example .env
# Edit .env with your production secrets

# 2. Build the Docker image
docker compose build

# 3. Save and compress the image
docker save wbos:latest -o wbos.tar

# 4. Copy to the Debian server
scp wbos.tar user@debian-server:/home/user/wbos/

# ── On the Debian homelab server ──

# 5. Create storage directories with correct permissions
# The application runs as UID 1001 inside the container.
# Bind-mounted directories must be writable by this user.
mkdir -p /opt/wbos/storage /opt/wbos/backups
sudo chown -R 1001:1001 /opt/wbos/storage /opt/wbos/backups
sudo chmod -R 775 /opt/wbos/storage /opt/wbos/backups

# 6. Set up the project directory
cd /opt/wbos
# Copy docker-compose.yml, .env, and scripts from the repository

# 7. Load the image
docker load -i /home/user/wbos/wbos.tar

# 8. Start the stack
docker compose up -d

# 9. (Optional) Seed demo data
docker compose exec app node prisma/demo-seed.mjs

# 10. Verify
curl http://localhost:3000/api/health
```

---

## Configuration

### Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | **Yes** | — | PostgreSQL connection string. In Docker, use `postgres` as hostname. |
| `BETTER_AUTH_SECRET` | **Yes** | — | Secret for session encryption. Generate with `openssl rand -hex 32`. |
| `POSTGRES_PASSWORD` | **Yes** | — | PostgreSQL password (used by docker-compose to initialize the database). |
| `BETTER_AUTH_URL` | No | `http://localhost:3000` | Public URL of the application. |
| `PORT` | No | `3000` | Host port to bind the application to. |
| `WBOS_STORAGE_ROOT` | No | `./storage` | Upload storage directory. In Docker, this maps to the `uploads` volume. |
| `WBOS_BACKUP_DIR` | No | `./backups` | Backup root directory. Contains tiered subdirectories: `daily/`, `weekly/`, `monthly/`, `yearly/`, `uploads/`. |
| `FIREBASE_ADMIN_PROJECT_ID` | No* | — | Firebase project ID for FCM push notifications. Required for real-time push delivery. |
| `FIREBASE_ADMIN_CLIENT_EMAIL` | No* | — | Firebase service account email for FCM authentication. |
| `FIREBASE_ADMIN_PRIVATE_KEY` | No* | — | Firebase service account private key. Use `\n` for newlines in `.env`. |
| `FIREBASE_ADMIN_KEY_PATH` | No | — | Path to Firebase service account JSON file (alternative to individual vars). Store the file in `.secrets/` (gitignored). |

*\*Required for FCM push. If unset, notifications work via in-app polling only.*

### Database URL Formats

**Docker (internal network):**
```
DATABASE_URL="postgresql://wbos:YOUR_PASSWORD@postgres:5432/wbos?schema=public"
```

**External (development):**
```
DATABASE_URL="postgresql://wbos:YOUR_PASSWORD@192.168.1.100:5432/wbos?schema=public"
```

### Generating Secrets

```bash
openssl rand -hex 32
```

---

## Docker Deployment

### Architecture

```
┌─────────────────────────────────────────────────────┐
│                    wbos-net                          │
│  ┌──────────────┐          ┌──────────────────┐     │
│  │   postgres    │          │       app        │     │
│  │   :5432       │◄────────►│   :3000          │     │
│  │   PostgreSQL  │          │   Next.js +      │     │
│  │   17-alpine   │          │   Playwright     │     │
│  └──────┬───────┘          └────────┬─────────┘     │
│         │                          │                │
│  ┌──────┴───────┐          ┌───────┴─────────┐     │
│  │ postgres-data│          │  uploads         │     │
│  │ (volume)     │          │  (volume)        │     │
│  └──────────────┘          └──────────────────┘     │
└─────────────────────────────────────────────────────┘
```

### Services

| Service | Image | Purpose |
|---|---|---|
| `postgres` | `postgres:17-alpine` | Database (58 MB image) |
| `app` | Built from `Dockerfile` | Next.js application + Playwright for PDF |

### Volumes

| Volume | Path | Purpose |
|---|---|---|
| `postgres-data` | `/var/lib/postgresql/data` | Database persistence |
| `uploads` | `/app/storage` | User uploads |

### Commands

```bash
# Start
docker compose up -d

# Stop
docker compose down

# Restart
docker compose restart

# View logs
docker compose logs -f
docker compose logs -f app
docker compose logs -f postgres

# Rebuild (after code changes)
docker compose build --no-cache app
docker compose up -d

# Check health
curl http://localhost:3000/api/health
```

### Resource Limits

The stack is optimized for low-power homelab servers. Add these to `docker-compose.yml` if needed:

```yaml
services:
  app:
    deploy:
      resources:
        limits:
          memory: 512M
          cpus: "1.0"
  postgres:
    deploy:
      resources:
        limits:
          memory: 512M
          cpus: "0.5"
```

---

## Database

### Access the Database

```bash
# Interactive shell
docker compose exec postgres psql -U wbos wbos

# Run a query
docker compose exec postgres psql -U wbos wbos -c "SELECT count(*) FROM \"Product\";"

# List tables
docker compose exec postgres psql -U wbos wbos -c "\dt"
```

### Run Migrations

```bash
docker compose exec app npx prisma migrate deploy
```

### View Migration Status

```bash
docker compose exec app npx prisma migrate status
```

### Validate Data Integrity

Run before cutting over to a target, and again immediately after
`prisma migrate deploy`. The script is read-only — it issues nothing but
SELECTs — so it is safe against production.

```bash
docker compose exec app node scripts/integrity-diagnostics.mjs
# or, locally against DATABASE_URL
npm run db:integrity
```

It exits non-zero if any invariant is violated or any check fails to run, so it
can gate a deploy script directly. Advisories (for example the one legacy
invoice that does not foot by one fils, `SO-2026-000002`) are reported but do
not fail the run. Add `--json` for machine-readable output.

A useful thing it catches: end-to-end suites create documents with hand-built
numbers, so any document whose number does not match the `SO-YYYY-NNNNNN` shape
produced by `DocumentNumberService` means a test suite has run against that
database.

### Seed Data

```bash
# Bootstrap seed (organization, settings, warehouses, etc.)
docker compose exec app node prisma/seed.mjs

# Demo seed (products, customers, orders, invoices, etc.)
docker compose exec app node prisma/demo-seed.mjs
```

---

## Backup

### Overview

WBOS uses a **tiered retention backup system** with five tiers:

| Tier | Directory | Retention | When Created |
|------|-----------|-----------|-------------|
| **Daily** | `daily/` | Last **7** kept | Every backup run |
| **Weekly** | `weekly/` | Last **4** kept | Sunday promotion |
| **Monthly** | `monthly/` | Last **12** kept | 1st of month promotion |
| **Yearly** | `yearly/` | **Kept forever** | Dec 31 promotion |
| **Uploads** | `uploads/` | Last **7** kept | Every run (if `WBOS_STORAGE_ROOT` is set) |

Backup layout:

```
<backup-root>/
├── daily/
│   └── wbos_db_YYYYMMDD_HHMMSS.sql.gz
├── weekly/
│   └── wbos_db_YYYYMMDD_HHMMSS.sql.gz
├── monthly/
│   └── wbos_db_YYYYMMDD_HHMMSS.sql.gz
├── yearly/
│   └── wbos-YYYY-12-31.sql.gz
├── uploads/
│   └── wbos_uploads_YYYYMMDD_HHMMSS.tar.gz
└── backup-manifest.json
```

The promoted backup is a **copy** of that day's daily backup — no extra database load.

### Automatic Daily Backup (Linux — Recommended)

Add a cron job on the host:

```bash
sudo crontab -e

# Run the backup script daily at 2:00 AM
0 2 * * * cd /opt/wbos && WBOS_STORAGE_ROOT=/opt/wbos/storage WBOS_BACKUP_DIR=/opt/wbos/backups docker compose exec -T app ./scripts/backup.sh
```

> **Tip**: The backup script runs **inside** the container so it has direct access to `DATABASE_URL`. It creates tiered backups and handles retention cleanup automatically.

### Manual Backup

```bash
# Via npm (requires DATABASE_URL in environment)
npm run backup

# Via script (Linux)
./scripts/backup.sh

# Via script with uploads
WBOS_STORAGE_ROOT=./storage ./scripts/backup.sh

# Via script (Windows PowerShell)
.\scripts\backup.ps1
```

### Customizing Backup Root

```bash
WBOS_BACKUP_DIR=/mnt/nas/backups ./scripts/backup.sh
```

---

## Restore

### Prerequisites

- A `.sql.gz` backup file in one of the tiered directories under `<backup-root>/`
- A running PostgreSQL instance (can be empty)

### Interactive Restore

Lists all backups across tiers and lets you pick:

```bash
./scripts/restore.sh
```

### Restore Latest Backup (any tier)

```bash
./scripts/restore.sh --latest
```

### Restore Latest from a Specific Tier

```bash
./scripts/restore.sh --tier daily
./scripts/restore.sh --tier weekly
./scripts/restore.sh --tier monthly
./scripts/restore.sh --tier yearly
```

### Restore a Specific Backup File

```bash
./scripts/restore.sh /path/to/wbos_db_20260725_020000.sql.gz
```

### List Available Backups

```bash
# All tiers
./scripts/restore.sh --list-all

# Specific tier
./scripts/restore.sh --list daily
```

### Restore Uploaded Files

```bash
# Latest uploads backup
./scripts/restore.sh --restore-uploads

# Specific archive
./scripts/restore.sh --restore-uploads /path/to/wbos_uploads_20260725_020000.tar.gz
```

### Full Database Restore Procedure (tested)

This procedure has been tested and verified:

```bash
# 1. Stop the app to prevent connections
docker compose down app

# 2. Drop and recreate the database
docker compose exec postgres psql -U wbos -c "DROP DATABASE IF EXISTS wbos;"
docker compose exec postgres psql -U wbos -c "CREATE DATABASE wbos;"

# 3. Restore the database (latest daily backup in this example)
#    Using --tier picks the most recent backup in that tier
docker compose exec -T app ./scripts/restore.sh --tier daily

# 4. (If applicable) Restore uploaded files
docker compose exec -T app ./scripts/restore.sh --restore-uploads

# 5. Start the app
docker compose up -d app

# 6. Run migrations (in case schema changed between backup and now)
docker compose exec app npx prisma migrate deploy

# 7. Verify
docker compose exec app npx prisma migrate status
curl http://localhost:3000/api/health
docker compose exec postgres psql -U wbos wbos -c "SELECT count(*) FROM \"Organization\";"
docker compose exec postgres psql -U wbos wbos -c "SELECT count(*) FROM \"Product\";"
```

### Via npm

```bash
# Restore latest (interactive)
npm run restore
```

---

## Updating

### Standard Update (Cross-Platform)

```bash
# ── On Windows (build machine) ──

# 1. Pull latest code
git pull

# 2. Rebuild the image
docker compose build

# 3. Save and transfer
docker save wbos:latest -o wbos.tar
scp wbos.tar user@debian-server:/home/user/wbos/

# ── On Debian (server) ──

# 4. Load the new image
docker load -i /home/user/wbos/wbos.tar

# 5. Restart the app
docker compose up -d

# 6. Run any new migrations
docker compose exec app npx prisma migrate deploy

# 7. Verify
curl http://localhost:3000/api/health
```

### Rollback

```bash
# ── On Windows (build machine) ──

# 1. Revert code
git log --oneline -5
git checkout <previous-commit-hash>

# 2. Rebuild previous version
docker compose build

# 3. Save and transfer
docker save wbos:latest -o wbos.tar
scp wbos.tar user@debian-server:/home/user/wbos/

# ── On Debian (server) ──

# 4. Load the previous image
docker load -i /home/user/wbos/wbos.tar

# 5. Restart
docker compose up -d

# 6. If database schema changed, revert the migration
docker compose exec app npx prisma migrate resolve --rolled-back <migration-name>
```

---

## Recovery

### Scenario: Server Restart

Nothing special is needed. Docker is configured with `restart: unless-stopped`, so all services start automatically when the Docker daemon starts.

```bash
# Ensure Docker starts on boot
sudo systemctl enable docker
```

### Scenario: Docker Reinstall

```bash
# 1. Reinstall Docker and Docker Compose
sudo apt install docker.io docker-compose-v2

# 2. Navigate to the project directory
cd /path/to/wbos

# 3. Start services (volumes preserve data)
docker compose up -d
```

### Scenario: Database Corruption

```bash
# 1. Stop the app
docker compose down app

# 2. Restore from latest backup (see full Restore section)
docker compose exec -T app ./scripts/restore.sh --tier daily

# 3. Restart
docker compose up -d

# 4. Run migrations if needed
docker compose exec app npx prisma migrate deploy

# 5. Verify
curl http://localhost:3000/api/health
```

### Scenario: Accidental Container Deletion

```bash
# If only the container was deleted (not the volume):
docker compose up -d
# Data is preserved in named volumes.

# If the volume was deleted as well:
# Restore from backup (see Restore section).
```

### Scenario: Complete Data Loss

```bash
# 1. Ensure PostgreSQL is running
docker compose up -d postgres

# 2. Create the database
docker compose exec postgres psql -U wbos -c "CREATE DATABASE wbos;"

# 3. Restore from latest backup
docker compose exec -T app ./scripts/restore.sh --tier daily

# 4. (If applicable) Restore uploaded files
docker compose exec -T app ./scripts/restore.sh --restore-uploads

# 5. Start the app
docker compose up -d app

# 6. Run migrations
docker compose exec app npx prisma migrate deploy

# 7. Verify
curl http://localhost:3000/api/health
```

---

## Reverse Proxy

### Nginx Proxy Manager

1. **Add a Proxy Host**
   - Domain: `wbos.yourdomain.com` (or your LAN IP)
   - Scheme: `http`
   - Forward IP: `192.168.1.100` (your homelab server IP)
   - Port: `3000`

2. **Enable SSL**
   - Request a Let's Encrypt certificate
   - Force SSL

3. **Advanced Configuration**

   Add these custom Nginx directives for trusted proxy headers:

   ```nginx
   proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
   proxy_set_header X-Forwarded-Proto $scheme;
   proxy_set_header Host $host;
   proxy_buffering off;
   proxy_set_header X-Real-IP $remote_addr;
   ```

4. **Update BETTER_AUTH_URL**

   In `.env`, set the public URL:

   ```
   BETTER_AUTH_URL=https://wbos.yourdomain.com
   ```

### Caddy

```caddyfile
wbos.yourdomain.com {
    reverse_proxy localhost:3000
}
```

### Traefik

```yaml
labels:
  - "traefik.enable=true"
  - "traefik.http.routers.wbos.rule=Host(`wbos.yourdomain.com`)"
  - "traefik.http.services.wbos.loadbalancer.server.port=3000"
```

---

## Local Network

### Static LAN IP

Assign a static IP to your homelab server:

```bash
# Debian/Ubuntu — edit /etc/network/interfaces or use netplan
sudo nano /etc/netplan/01-netcfg.yaml
```

```yaml
network:
  version: 2
  ethernets:
    eth0:
      addresses:
        - 192.168.1.100/24
      routes:
        - to: default
          via: 192.168.1.1
      nameservers:
        addresses: [1.1.1.1, 8.8.8.8]
```

```bash
sudo netplan apply
```

### Tailscale

```bash
# Install Tailscale
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up

# Access WBOS via Tailscale IP
echo "http://$(tailscale ip -4):3000"
```

### Access from LAN

```
http://192.168.1.100:3000
```

Add port forwarding on your router if accessing from outside your LAN (not recommended without a reverse proxy).

---

## Troubleshooting

### Application Won't Start

```bash
# Check logs
docker compose logs app

# Verify database is healthy
docker compose exec postgres pg_isready -U wbos

# Check environment variables
docker compose exec app env | grep -E "DATABASE_URL|BETTER_AUTH"

# Run startup validation
docker compose exec app node scripts/startup-validate.js
```

### Database Connection Refused

```bash
# Check if PostgreSQL is running
docker compose ps

# Check connection string (hostname must be "postgres" inside Docker)
docker compose exec app env | grep DATABASE_URL

# Test connection manually
docker compose exec app bash -c "apt-get update && apt-get install -y postgresql-client && psql \$DATABASE_URL -c 'SELECT 1'"
```

### Playwright / PDF Generation Fails

```bash
# Check if Chromium is installed
docker compose exec app npx playwright install --with-deps chromium

# Verify Playwright works
docker compose exec app node -e "const { chromium } = require('playwright'); (async () => { const b = await chromium.launch({ headless: true, args: ['--no-sandbox'] }); await b.close(); console.log('OK'); })();"
```

### Backup Fails

```bash
# Check if backup root exists
ls -la /opt/wbos/backups/

# Check disk space
df -h

# Run the backup script manually to see error output
docker compose exec -T app ./scripts/backup.sh

# Check the backup manifest for recent entries
docker compose exec app cat /app/backups/backup-manifest.json 2>/dev/null | head -20
```

### Restore Fails

```bash
# Verify the backup file is valid
gunzip -t /opt/wbos/backups/daily/wbos_db_latest.sql.gz 2>/dev/null || echo "File is corrupt"

# Check that the database is accessible
docker compose exec postgres psql -U wbos -c "SELECT 1;"

# List available backups
docker compose exec -T app ./scripts/restore.sh --list-all

# Try restoring with verbose output
gunzip -c /opt/wbos/backups/daily/wbos_db_*.sql.gz | docker compose exec -T postgres psql -U wbos wbos -v ON_ERROR_STOP=1
```

### Disk Space Low

```bash
# Check disk usage
df -h

# Check backup sizes by tier
du -sh /opt/wbos/backups/*/

# Manually prune daily backups older than 14 days
find /opt/wbos/backups/daily -name "wbos_db_*.sql.gz" -type f -mtime +14 -delete

# Prune all uploads backups (only the daily DB is needed for DR)
rm -rf /opt/wbos/backups/uploads/*

# Clean up Docker
docker system prune -f

# Prune everything (careful: removes unused containers, networks, images)
docker system prune -a -f --volumes
```

### Container in Crash Loop

```bash
# Check logs
docker compose logs app --tail=50

# Common causes:
# 1. DATABASE_URL is wrong — verify in .env
# 2. PostgreSQL not ready — increase start_period in healthcheck
# 3. Migration not run — run docker compose exec app npx prisma migrate deploy
# 4. Port conflict — change PORT in .env
```

### Health Check Failing

```bash
# Test health endpoint directly from inside the container
docker compose exec app curl -f http://localhost:3000/api/health

# Check if the app is listening
docker compose exec app ss -tlnp | grep 3000

# Restart the app
docker compose restart app
```

---

## Health Monitoring

### Health Page

Open `http://localhost:3000/health` in a browser for a visual status dashboard showing:

- Database connectivity and latency
- Prisma ORM status
- Playwright availability
- Upload storage status
- Backup status
- App uptime
- Server time
- Environment

### Health API

```bash
curl http://localhost:3000/api/health
```

Returns JSON:

```json
{
  "healthy": true,
  "app": { "uptime": 3600, "status": "running" },
  "database": { "ok": true, "latency": "3ms" },
  "prisma": { "ok": true, "organizationExists": true },
  "storage": { "root": "./storage", "exists": true, "writable": true, "uploads": true },
  "backups": {
    "root": "./backups",
    "totalFiles": 15,
    "tiers": { "daily": 7, "weekly": 4, "monthly": 3, "yearly": 0, "uploads": 1 },
    "latestAgeHours": 6
  },
  "environment": "production",
  "serverTime": "2025-01-01T00:00:00.000Z"
}
```

### Uptime Monitoring (Optional)

Add an external monitoring service (e.g., Uptime Kuma) to ping `http://your-server:3000/api/health` every 60 seconds.

---

## Architecture Notes

### Storage

| Path | Purpose | Persists |
|---|---|---|
| `./postgres-data/` | Database files | Docker volume |
| `./uploads/` | User-uploaded files | Docker volume |
| `./backups/` | Tiered database dumps (daily/weekly/monthly/yearly/uploads) | Host directory (mounted) |

### Docker Image

The production Docker image uses multi-stage builds:

1. **deps** — Install all dependencies (single `npm ci`)
2. **builder** — Generate Prisma client (multi-platform engines) + build Next.js standalone
3. **runner** — Minimal runtime with Playwright Chromium and the standalone application

Prisma is configured with `binaryTargets: ["native", "debian-openssl-3.0.x"]` so a single build produces engines for both the build platform and the Debian 13 runtime. The image is fully portable.

Final image size: ~650 MB (includes Chromium for PDF generation + both Prisma engines).

### Ports

| Service | Internal Port | External Port (configurable) |
|---|---|---|
| app | 3000 | 3000 |
| postgres | 5432 | — (internal only) |

### Resource Optimization

The stack is tuned for low-power homelab servers:
- PostgreSQL Alpine images (~58 MB)
- Single Next.js process (no clustering)
- No Redis, no Elasticsearch, no message queues
- Minimal Python/perl included in base images
- `restart: unless-stopped` instead of swarm/kubernetes

---

## Files Reference

| File | Purpose |
|---|---|---|
| `Dockerfile` | Multi-stage production build |
| `docker-compose.yml` | Service orchestration (uses pre-built `image: wbos:latest`) |
| `.env.example` | Documented environment template |
| `.dockerignore` | Build context exclusions |
| `prisma/schema.prisma` | Schema + generator config with cross-platform `binaryTargets` |
| `scripts/backup.sh` | Linux tiered backup script |
| `scripts/backup.ps1` | Windows tiered backup script |
| `scripts/restore.sh` | Linux restore script with tier selection |
| `scripts/restore.ps1` | Windows restore script with tier selection |
| `scripts/restore-test.sh` | Non-destructive restore test — restores a backup package into a throwaway DB, verifies, records result (see `docs/DISASTER_RECOVERY.md`) |
| `scripts/backup-package.sh` | Scheduled single-package backup (Settings UI format) |
| `scripts/sync-backups.sh` | Off-host mirror of backup packages (rsync / rclone / local mount) |
| `scripts/health-alert.sh` | Host-cron alerting: polls `/api/health`, notifies on failures (webhook/Telegram/ntfy/email); see `.env.example` Alerting section |
| `scripts/startup-validate.js` | Container startup validation |
| `src/app/api/health/route.ts` | Health check API endpoint |
| `src/app/health/page.tsx` | Health dashboard page |
| `src/app/audit/page.tsx` | Audit log viewer page |
| `docs/deployment.md` | This document |
