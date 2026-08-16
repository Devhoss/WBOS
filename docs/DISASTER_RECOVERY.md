# WBOS Disaster Recovery

> Milestone: **Production Validation / Disaster Recovery.** The restore path must be proven before new
> product features are added. This runbook covers (1) provisioning the off-host backup target and
> (2) running the first real restore test. Follow the steps in order; nothing here depends on new product code.

## Principles

- **A backup that has never been restored is only a theory.** The restore test is the acceptance test for the
  whole backup pipeline.
- The restore test is **non-destructive by design** — it restores into a throwaway database and drops it.
- Do not build infrastructure we do not need yet (replication, failover, object storage tiering) until the
  off-host + restore baseline is proven.

---

## 1. Off-host backup target

`scripts/sync-backups.sh` mirrors `$WBOS_BACKUP_DIR/packages/` to an off-host destination. It is a
**mirror** (`--delete`): files removed locally are removed off-host, so local retention is the source of truth.

Supported targets (choose ONE):

| Target | URI scheme | Tool | Best for |
| ------ | ---------- | ---- | -------- |
| NAS / another Linux host | `rsync://user@nas.local:/path` | rsync | LAN homelab |
| S3-compatible object storage | `s3://bucket/prod` | rclone | off-site / cloud |
| Second disk / external mount | `file:///mnt/nas-backup/wbos` | rsync | cheap, same site |

> **2026-08-10:** `sync-backups.sh` mirror semantics were validated end-to-end (sync → add → delete →
> empty-source) against a local `file://` target, and the `rsync://` URI transform + `rclone sync` (S3)
> branches were verified. The real remote target still needs to be provisioned by the operator.

### Provisioning checklist (operator, on the server)

- [ ] **NAS / rsync:**
  - [ ] Create a dedicated backup user + directory on the NAS (e.g. `wbos-backups/`).
  - [ ] Install `rsync` on the WBOS host if missing (`sudo apt-get install -y rsync`).
  - [ ] Test SSH key auth: `ssh backup@nas.local` succeeds without a password.
  - [ ] Run the sync once manually and confirm the `packages/` contents appear on the NAS.
- [ ] **S3 / rclone:**
  - [ ] Create a bucket + access key with limited permissions (only this bucket).
  - [ ] `rclone config` on the host; confirm `rclone lsd wbosbackups:` lists the bucket.
  - [ ] Run the sync once manually; confirm an object per package file.
- [ ] **Second disk:** mount it, add to `fstab` (or `systemd`), confirm write access for the backup user.
- [ ] **Retrieval test:** download/verify a file from the target (this is what matters — *can you read it back?*).

### Cron wiring

```cron
# 02:00 daily — package backup (Settings-UI format)
0 2 * * * WBOS_DATABASE_URL='postgresql://wbos:***@127.0.0.1:5432/wbos' WBOS_BACKUP_DIR=/srv/wbos/backups WBOS_STORAGE_ROOT=/srv/wbos/storage /srv/wbos/scripts/backup-package.sh
# 02:30 daily — mirror packages off-host
30 2 * * * WBOS_BACKUP_DIR=/srv/wbos/backups WBOS_BACKUP_SYNC_TARGET='rsync://backup@nas.local:/volume1/wbos-backups' /srv/wbos/scripts/sync-backups.sh
```

### Verify the pipeline

1. `crontab -l` shows both lines.
2. Next morning, `/api/health` (or the `/health` page) shows a fresh backup (`latestAgeHours` < 24).
3. The package appears off-host.
4. A file can be retrieved from the off-host target.

---

## 2. Restore test

`scripts/restore-test.sh` restores a backup package into a **throwaway database**, verifies the data, and
records the result. It never touches the production database.

### What it verifies

1. Package extracts and `manifest.json` parses (`formatVersion`, `appVersion`).
2. The database dump is readable (`pg_restore --list` reports objects).
3. A scratch database is created and the dump restores into it cleanly.
4. Data is present (the `Organization` table returns rows).
5. The uploads archive, if present, extracts to the expected number of files.
6. The scratch database is dropped and the result is appended as a JSONL record to
   `$WBOS_BACKUP_DIR/restore-history.json` — the same file the Settings → Backup & Restore page
   (**Last Restore Test**) and `/api/health` read, so a shell-side restore test shows up in the UI.

**Failures are recorded too.** The record is written from the script's exit trap, so a test that dies
at any step still lands in `restore-history.json` with `result: "failed"` and a `reason`. The UI and
`/api/health` report the **most recent** record whatever its outcome, and `health-alert.sh` raises a
`restore_failed` alert. This matters: until 2026-08-16 only successes were recorded and the reader
skipped back to the last successful run, so a broken restore path kept showing **PASS** — the one
indicator meant to prove the backups work was the one that could not report that they don't.

### Usage

```bash
# From the server (tooling guaranteed inside the app container):
docker compose exec -T app ./scripts/restore-test.sh /app/backups/packages/wbos-backup-<ts>.tar.gz

# Or from the host with client tools on PATH:
WBOS_DATABASE_URL='postgresql://wbos:***@127.0.0.1:5432/wbos' ./scripts/restore-test.sh /srv/wbos/backups/packages/wbos-backup-<ts>.tar.gz

# Keep the scratch DB around for manual inspection after a failure:
docker compose exec -T app ./scripts/restore-test.sh /app/backups/packages/wbos-backup-<ts>.tar.gz --keep-scratch
```

### Requirements

- The PostgreSQL user in `WBOS_DATABASE_URL` must have `CREATEDB` privilege (the compose default `POSTGRES_USER`
  is a superuser and satisfies this).
- Tools: `pg_restore`, `psql`, `tar`, `node`. All present in the app container (postgresql-client + tar + Node).
- Exit codes: `0` = restore verified OK · `1` = error · `2` = package not found / bad usage.

### First production restore test (operator)

> **2026-08-10:** `restore-test.sh` was validated end-to-end against PostgreSQL 17 in a throwaway container
> (package → restore → verify → drop). The first test against a real production package still needs to be
> executed on the server.

1. Create a backup from the Settings UI (**Backup & Restore → Create Backup Now**) or wait for the daily cron.
2. Run the restore test against that package (command above).
3. Confirm the script prints `=== RESTORE TEST PASSED ===`.
4. Record the result in the **Restore Verification** table in `PRODUCTION_READINESS.md`.

### Interpreting failures

| Symptom | Likely cause |
| ------- | ------------ |
| `package not found` / exit 2 | Wrong path; check `/app/backups/packages/`. |
| `dump is unreadable` | Corrupt package — create a fresh backup, then delete the bad one. |
| `pg_restore` errors | Version mismatch or missing extension. The project standardizes on PostgreSQL **17** everywhere — see `PRODUCTION_DEPLOYMENT.md` §11; `startup-validate.js` warns at boot if the client and server majors differ. |
| `CREATE DATABASE` permission denied | `WBOS_DATABASE_URL` user lacks `CREATEDB`. |
| Scratch DB left behind | Add `--keep-scratch` to inspect, then drop manually. |

---

## 3. Full production restore (disaster recovery)

For a real disaster (full host loss), follow `deployment.md` → **Restore** / **Recovery**:
stop the app, drop/recreate the DB, restore the package (or the tiered dump), restore uploads, start the app,
run migrations, verify. The restore-test above is the safe rehearsal of that procedure.

---

## 4. Remaining gaps (documented, not yet built)

These follow after the DR baseline is proven. They are tracked in `PRODUCTION_READINESS.md`:

- Off-host target provisioning + first production-data restore test (this runbook, step 1 & 2).
- Alerting channel + cron wiring on the production host (script `scripts/health-alert.sh` exists and is validated; the
  operator configures one channel + the cron line — see Operations → Alerting wiring in `PRODUCTION_READINESS.md`).
- Rate limiting on sign-in + mobile API endpoints — **done 2026-08-10** (in-memory limiter, see Rate limiting section in `PRODUCTION_READINESS.md`).
- SMTP / password-reset provisioning.
- Invoice PDF (Playwright/Chromium) verification in the deployed container.
- Encrypted backup at rest if the off-site target is untrusted.
- Automated orphaned-file cleanup sweep (manual procedure documented below).

---

## 5. Storage capacity policy (uploads)

`WBOS_STORAGE_ROOT` maps to the `wbos_storage` named Docker volume (`docker-compose.prod.yml`, mounted at
`/app/storage`), which sits on the **same host disk** as the database and backups. Attachments cannot silently fill
that disk because of the layered controls below.

| Level | Condition | Behavior |
| ----- | --------- | -------- |
| Monitor | Uploads size is exposed in `/api/health` (`storage.uploads.sizeBytes`, `fileCount`, `pctOfDisk`) and on the `/health` page (Uploads Size block) | Operator can see growth at a glance |
| Warning alert | Uploads ≥ `WBOS_ALERT_UPLOADS_WARN_PCT` (default **60%**) of the storage disk | Notify — review retention/cleanup |
| Critical alert | Uploads ≥ `WBOS_ALERT_UPLOADS_CRITICAL_PCT` (default **75%**) of the storage disk | Notify — free up space soon |
| Low disk | Free space < `WBOS_ALERT_DISK_THRESHOLD` (default **10%**) of the disk | `healthy=false`; alert fires |
| **Hard stop** | A write would leave < `WBOS_STORAGE_MIN_FREE_BYTES` (default **512 MB**) free | Uploads are **rejected** with a friendly "Storage is nearly full" message (`STORAGE_FULL`) — no ENOSPC, no silent disk fill |

No per-user quotas or tiered object storage: for a small deployment a single reserved floor plus size-based alerts is
the right level of protection.

**When uploads grow (operator procedure):**
1. Check `/health` → Uploads Size, and `GET /api/health` → `storage.uploads` / `storage.disk`.
2. Find the biggest consumers: `du -h <storageRoot>/uploads/*/ | sort -h` (per org/entity).
3. Attachments are archived in every backup package; deleting them from disk is only safe after the restore-test of a
   package that contains them (see §2).
4. If attachment growth is permanent, add disk capacity (expand the volume / re-create the `wbos_storage` volume
   with a larger backing filesystem) rather than raising the floor.

**Orphaned files (files without DB rows)** can appear after canceled/failed restores. Manual sweep:
`find <storageRoot>/uploads -type f` and cross-check against `SELECT storage_key FROM attachment;` — remove only files
older than the latest verified restore-test and not referenced by any row. An automated sweep is a future item.
