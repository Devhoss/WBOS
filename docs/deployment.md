# Deployment Guide

> Production deployment documentation for WBOS (Wholesale Business Operating System).

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

# 5. Set up the project directory
mkdir -p /opt/wbos
cd /opt/wbos
# Copy docker-compose.yml, .env, and scripts from the repository

# 6. Load the image
docker load -i /home/user/wbos/wbos.tar

# 7. Start the stack
docker compose up -d

# 8. Run database migrations
docker compose exec app npx prisma migrate deploy

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
| `WBOS_BACKUP_DIR` | No | `./backups` | Backup output directory. |
| `WBOS_BACKUP_RETENTION_DAYS` | No | `30` | Number of days to retain backups. |

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

### Seed Data

```bash
# Bootstrap seed (organization, settings, warehouses, etc.)
docker compose exec app node prisma/seed.mjs

# Demo seed (products, customers, orders, invoices, etc.)
docker compose exec app node prisma/demo-seed.mjs
```

---

## Backup

### Automatic Daily Backup (Linux)

Add a cron job:

```bash
sudo crontab -e

# Add this line to run backup daily at 2:00 AM
0 2 * * * cd /path/to/wbos && docker compose exec -T postgres pg_dump -U wbos wbos | gzip > ./backups/wbos_backup_$(date +\%Y\%m\%d_\%H\%M\%S).sql.gz
```

### Manual Backup

```bash
# Via npm (requires DATABASE_URL in environment)
npm run backup

# Via Docker
docker compose exec -T postgres pg_dump -U wbos wbos | gzip > ./backups/wbos_manual_$(date +%Y%m%d_%H%M%S).sql.gz

# Via script (Linux)
./scripts/backup.sh

# Via script (Windows PowerShell)
.\scripts\backup.ps1
```

### Backup Retention

The backup scripts automatically clean up files older than the retention period (default: 30 days). Override with:

```bash
WBOS_BACKUP_RETENTION_DAYS=90 ./scripts/backup.sh
```

### Backup Directory

Backups are stored in `./backups/` by default. Override with:

```bash
WBOS_BACKUP_DIR=/mnt/nas/backups ./scripts/backup.sh
```

---

## Restore

### Prerequisites

- A `.sql.gz` backup file in the `./backups/` directory
- A running PostgreSQL instance (can be empty)

### Restore Latest Backup

```bash
# Via npm
npm run restore

# Via Docker
gunzip -c ./backups/wbos_backup_20250101_020000.sql.gz | docker compose exec -T postgres psql -U wbos wbos

# Via script (Linux)
./scripts/restore.sh

# Via script (Windows)
.\scripts\restore.ps1
```

### Restore a Specific Backup

```bash
./scripts/restore.sh ./backups/wbos_backup_20250101_020000.sql.gz
```

### Restore into Empty Database

```bash
# 1. Stop the app
docker compose down app

# 2. Drop and recreate the database
docker compose exec postgres psql -U wbos -c "DROP DATABASE IF EXISTS wbos;"
docker compose exec postgres psql -U wbos -c "CREATE DATABASE wbos;"

# 3. Restore
gunzip -c ./backups/wbos_backup_latest.sql.gz | docker compose exec -T postgres psql -U wbos wbos

# 4. Restart the app
docker compose up -d app

# 5. Run migrations (in case schema changed)
docker compose exec app npx prisma migrate deploy
```

### Verify Restore

```bash
# Check that data exists
docker compose exec postgres psql -U wbos wbos -c "SELECT count(*) FROM \"Organization\";"
docker compose exec postgres psql -U wbos wbos -c "SELECT count(*) FROM \"Product\";"

# Check app health
curl http://localhost:3000/api/health
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

# 2. Restore from latest backup (see Restore section)
gunzip -c ./backups/wbos_backup_latest.sql.gz | docker compose exec -T postgres psql -U wbos wbos

# 3. Restart
docker compose up -d

# 4. Run migrations if needed
docker compose exec app npx prisma migrate deploy
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

# 3. Restore from backup
gunzip -c ./backups/wbos_backup_latest.sql.gz | docker compose exec -T postgres psql -U wbos wbos

# 4. Start the app
docker compose up -d app

# 5. Run migrations
docker compose exec app npx prisma migrate deploy
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
# Check if backups directory exists
ls -la ./backups/

# Check disk space
df -h

# Run backup manually with verbose output
docker compose exec -T postgres pg_dump -U wbos wbos -v
```

### Restore Fails

```bash
# Verify the backup file is valid
file ./backups/wbos_backup_*.sql.gz
gunzip -t ./backups/wbos_backup_*.sql.gz || echo "File is corrupt"

# Check that the database is accessible
docker compose exec postgres psql -U wbos -c "SELECT 1;"

# Try restoring with verbose output
gunzip -c ./backups/wbos_backup_latest.sql.gz | docker compose exec -T postgres psql -U wbos wbos -v ON_ERROR_STOP=1
```

### Disk Space Low

```bash
# Check disk usage
df -h

# Clean up old backups
find ./backups -name "wbos_backup_*.sql.gz" -type f -mtime +30 -delete

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
  "database": { "connected": true, "latency": "3ms" },
  "prisma": { "connected": true },
  "playwright": { "available": true },
  "storage": { "path": "./storage", "exists": true, "writable": true },
  "version": "0.1.0",
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
| `./backups/` | Database dumps | Host directory (mounted) |

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
| `scripts/backup.sh` | Linux backup script |
| `scripts/backup.ps1` | Windows backup script |
| `scripts/restore.sh` | Linux restore script |
| `scripts/restore.ps1` | Windows restore script |
| `scripts/startup-validate.js` | Container startup validation |
| `src/app/api/health/route.ts` | Health check API endpoint |
| `src/app/health/page.tsx` | Health dashboard page |
| `src/app/audit/page.tsx` | Audit log viewer page |
| `docs/deployment.md` | This document |
