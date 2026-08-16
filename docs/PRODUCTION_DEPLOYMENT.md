# WBOS Production Deployment Guide

Goal: from a fresh machine to a running, backed-up WBOS in a handful of commands. This is the reference for the
**Day-0 runbook** and the **Release gate** in `PRODUCTION_READINESS.md`.

---

## 1. Prerequisites (host)

- Docker Engine ≥ 24 + Docker Compose v2.
- `git`, `curl`.
- `rsync` + SSH keys (off-host NAS sync) or `rclone` (S3-compatible storage) — only if you use that sync method.
- Postgres client tools (`pg_dump`, `pg_restore`) **only** if you run host-cron backups. Inside the app container they
  already exist. `tar` is bundled with Linux.

## 2. Directory layout

```
/srv/wbos/
  .env                  # secrets (never committed)
  docker-compose.prod.yml
  scripts/              # backup-package.sh, sync-backups.sh, deploy.sh
  storage/              # mounted as wbos_storage into the container
  backups/              # mounted as wbos_backups into the container
```

Host directories are bind-optional; the compose file uses named volumes (`wbos_storage`, `wbos_backups`), so the
container paths `/app/storage` and `/app/backups` are where the app actually writes. If you prefer bind mounts, change
`volumes:` to `- ${PWD}/storage:/app/storage`.

## 3. Provision secrets — `.env`

Copy from `../.env.example` and fill in real values:

```dotenv
# Must point at the db service of this stack (host: db, not localhost)
DATABASE_URL="postgresql://wbos:CHANGE-ME@db:5432/wbos?schema=public"
BETTER_AUTH_SECRET="$(openssl rand -hex 32)"
BETTER_AUTH_URL="https://appwbos.com"

# Postgres service in docker-compose.prod.yml must match the DATABASE_URL credentials
POSTGRES_USER="wbos"
POSTGRES_PASSWORD="CHANGE-ME"          # same password as in DATABASE_URL
POSTGRES_DB="wbos"

# Optional: off-host sync (see §7)
WBOS_BACKUP_SYNC_TARGET="rsync://backup@nas.local:/volume1/wbos-backups"
```

`scripts/startup-validate.js` runs at container start and fails fast if `DATABASE_URL`, `BETTER_AUTH_SECRET`, or
`BETTER_AUTH_URL` is missing, if `pg_dump`/`pg_restore`/`tar` are absent, or if disk is below 10% free. It also warns
on a PostgreSQL client/server major version mismatch (§11).

## 4. Start the stack

```bash
docker network create wbos-prod 2>/dev/null || true   # once, external network
cd /srv/wbos
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

The app waits for `db` to be healthy, runs `prisma migrate deploy` (via `docker-entrypoint.sh`), then serves on
host port `3005`. Healthcheck: `curl http://localhost:3005/api/health`.

A failed migration aborts container startup rather than running against a half-migrated database.

## 5. Reverse proxy + TLS (recommended)

Terminate TLS in front of port 3005 (Caddy or nginx). Set `X-Forwarded-Proto: https` and keep
`BETTER_AUTH_URL=https://appwbos.com` — Better Auth validates origins against it and the cookie is Secure.

Example Caddy:

```caddy
appwbos.com {
    reverse_proxy 127.0.0.1:3005
}
```

Validate `https://appwbos.com/api/health` returns `200` and the `/health` page shows all blocks green.

Set `WBOS_TRUSTED_PROXY_HOPS` to the number of trusted proxies in front of the app (default 1). Per-IP rate limiting
reads the client address that many hops from the **right** of `X-Forwarded-For`, because anything to the left is
attacker-supplied.

## 6. First deploy from a dev machine

`scripts/deploy.sh` runs the full gate and a pre-deploy backup:

```bash
cd /srv/wbos
WBOS_DATABASE_URL="$DATABASE_URL" WBOS_BACKUP_DIR=/srv/wbos/backups \
WBOS_STORAGE_ROOT=/srv/wbos/storage WBOS_BACKUP_SYNC_TARGET=... \
  ./scripts/deploy.sh
```

Steps: unit tests → typecheck → lint → pre-deploy backup (`backup-package.sh`) → image pull → compose up →
health poll → optional off-host sync. Use `--skip-tests` once trusted.

## 7. Backups

### In-app

- Settings → Backup & Restore → **Create Backup Now** — packages DB dump + uploads + config into
  `wbos-backup-<timestamp>.tar.gz` under `<WBOS_BACKUP_DIR>/packages`, then **verifies** the package
  (`pg_restore --list` + archive check) and deletes it if corrupt.
- Download (ADMIN+), restore (OWNER, type `RESTORE`), Last Backup / Last Restore Test indicators.

### Scheduled (host cron)

```cron
# Daily 02:00 package backup, 02:30 off-host mirror
0 2 * * *  WBOS_DATABASE_URL='...' WBOS_BACKUP_DIR=/srv/wbos/backups WBOS_STORAGE_ROOT=/srv/wbos/storage /srv/wbos/scripts/backup-package.sh
30 2 * * * WBOS_BACKUP_DIR=/srv/wbos/backups WBOS_BACKUP_SYNC_TARGET='rsync://backup@nas.local:/volume1/wbos-backups' /srv/wbos/scripts/sync-backups.sh
```

Host must have `pg_dump` (matching the server major — see §11) + `tar`.

### Off-host

`sync-backups.sh` mirrors `packages/` to a NAS (`rsync://`), object storage (`s3://` via rclone), or a second mount
(`file://`). This closes the Critical "same-host backups" audit item.

The sync is a **mirror** (`--delete`), so local retention is the source of truth.

### Verify

- `/health` page: Backups block (freshness < 48h), Backup Tools ✓, Last Restore Test, Disk blocks for storage +
  backups (>= 10% free).
- A restore test that **fails** is recorded and displayed as FAILED — the indicator no longer falls back to the last
  successful run.
- Perform a real restore at least once before go-live and record it in PRODUCTION_READINESS **Restore Verification**.

## 8. Updates / rollback

```bash
cd /srv/wbos
WBOS_DATABASE_URL="$DATABASE_URL" WBOS_BACKUP_DIR=/srv/wbos/backups \
WBOS_STORAGE_ROOT=/srv/wbos/storage ./scripts/deploy.sh    # backups first
```

`deploy.sh` pulls the image explicitly. `up --build` is a no-op for this stack — the app service has `image:` and no
`build:` — so an explicit `pull` is what actually picks up a new CI build.

Rollback: set `WBOS_IMAGE_TAG=<previous-sha>` and re-run `up -d`, then, if the migration failed, restore the
pre-deploy backup (Settings → Backup & Restore → Restore, type `RESTORE`).

## 9. Day-0 checklist (fresh install from scratch)

- [ ] Prerequisites installed (Docker, curl, rsync)
- [ ] `docker network create wbos-prod` once
- [ ] `.env` created with real secrets; `DATABASE_URL` points at `db:5432`
- [ ] DNS `appwbos.com` → host; TLS proxy in front of 3005
- [ ] `docker compose -f docker-compose.prod.yml pull && up -d`; containers healthy
- [ ] `https://appwbos.com/api/health` returns healthy; `/health` page all green
- [ ] Backup cron lines installed (`crontab -l`) and off-host sync verified (files land on NAS)
- [ ] A restore test executed and recorded in PRODUCTION_READINESS
- [ ] First user (OWNER) created, signed in over HTTPS

## 10. Release gate

Run before every deploy — see **Release gate** in PRODUCTION_READINESS.md. `scripts/deploy.sh` automates tests +
typecheck + lint + pre-deploy backup + image pull + up + health.

## 11. PostgreSQL major version

The project standardizes on **PostgreSQL 17** everywhere:

| Where | Pin |
| ----- | --- |
| Production database | `docker-compose.prod.yml` → `${POSTGRES_IMAGE:-postgres:17-alpine}` |
| CI end-to-end tests | `.github/workflows/docker.yml` → `postgres:17` service |
| Client tools in the app image | `Dockerfile` → `postgresql-client-17` from the PostgreSQL APT repo, pinned by `ARG EXPECTED_PG_MAJOR` |
| Restore rehearsals | `scripts/restore-test.sh`, run inside the app container |

**Why it must be one version:** `pg_dump` **refuses** to dump from a server newer than itself, and `pg_restore` cannot
reliably load a dump into a server older than the `pg_dump` that produced it. Either way a client/server split breaks
backups — and it breaks them where you are least likely to look until a disaster.

**This was a live defect, not a hypothetical.** The image previously installed Debian's `postgresql-client`
meta-package, which tracks the *base image's* release: `node:24-slim` is bookworm, so the image shipped client **15**
while the database was 16/17. Every backup attempt in production would have failed with a server-version mismatch.
The Dockerfile now installs `postgresql-client-17` explicitly and **fails the build** if the installed major is not 17
— which is exactly how the defect surfaced.

`scripts/startup-validate.js` additionally compares `pg_dump`'s major against `SHOW server_version` on every boot and
warns on a mismatch. It warns rather than fails: the mismatch threatens restore, not runtime, and refusing to boot
would turn a latent DR risk into an immediate outage.

### ⚠ Changing the major version on an existing deployment

PostgreSQL **refuses to start** on a data directory written by a different major version. Swapping the image alone
will not work — the container will crash-loop. To move an existing database between majors:

```bash
# 1. Take a backup and confirm it restores BEFORE touching anything
docker compose -f docker-compose.prod.yml exec -T app \
  ./scripts/restore-test.sh /app/backups/packages/wbos-backup-<ts>.tar.gz

# 2. Dump with the OLD server still running
docker compose -f docker-compose.prod.yml exec -T db \
  pg_dumpall -U "$POSTGRES_USER" > /srv/wbos/pre-upgrade.sql

# 3. Stop the stack and move the old volume aside (do NOT delete it)
docker compose -f docker-compose.prod.yml down
docker volume create wbos_db_data_pg16_backup
# copy wbos_db_data -> wbos_db_data_pg16_backup, then remove wbos_db_data

# 4. Start ONLY the new db so it initializes a fresh data dir
POSTGRES_IMAGE=postgres:17-alpine docker compose -f docker-compose.prod.yml up -d db

# 5. Load the dump, then start the app
cat /srv/wbos/pre-upgrade.sql | \
  docker compose -f docker-compose.prod.yml exec -T db psql -U "$POSTGRES_USER"
docker compose -f docker-compose.prod.yml up -d
```

Keep the old volume until the new stack is verified and a fresh backup has passed a restore test. **If WBOS has not
gone live yet, none of this applies** — the current pin is already 17, so a fresh install just starts on 17.
