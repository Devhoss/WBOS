# WBOS Production Readiness

This is a **living checklist** — not a roadmap. It captures the concrete requirements WBOS must meet before we start running our wholesale business on it. Work items are checked off as they are actually satisfied (verified, not merely planned). Revisit this document during every release and after any deployment change.

Status legend: `[ ]` not started · `[~]` in progress · `[x]` done · `[?]` needs verification

---

## Infrastructure

- [x] Single `docker-compose.yml` app service with pinned image (`ghcr.io/devhoss/wbos:latest`)
- [x] App runs as non-root user (uid/gid 1001) inside the container
- [x] Docker healthcheck on `/api/health`
- [x] Database location decided — PostgreSQL 17 runs as the `db` service on the **same dedicated VPS** as
      the app and proxy. It publishes **no port**, so it is reachable only over the `wbos-prod` container
      network; the homelab is development-only and is not a production dependency. Architecture, firewall
      rules, failure behavior and backup implications: `PRODUCTION_DEPLOYMENT.md` §5.
- [ ] Database is replicated / has a standby (single instance; a VPS loss means downtime until restore —
      accepted residual risk, and precisely why off-host backup replication is mandatory in this design)
- [x] Resource limits (memory/CPU) set for the app container (`docker-compose.prod.yml` deploy.resources)
- [x] Reverse proxy with TLS termination in front of the app — `caddy` service in
      `docker-compose.prod.yml` + `Caddyfile`. Automatic certificate issuance/renewal, HTTP→HTTPS
      redirect, HSTS. Hostname is configuration (`WBOS_DOMAIN`), never hardcoded; `WBOS_TLS` selects
      ACME or Caddy's local CA.
- [x] App is not reachable around the proxy — the app publishes `127.0.0.1:3005` only (loopback, kept so
      host-cron alerting can still poll `/api/health`), and PostgreSQL publishes nothing at all.
      Caddy is the sole public listener.
- [x] `/api/health` is not published through the proxy (404) — it exposes storage paths, disk figures and
      backup state. The authenticated `/health` page remains available remotely via `AppShell`.
      External uptime checks should target `/sign-in`, not the health JSON.
- [x] `X-Forwarded-Proto`/origin handling validated behind the proxy (Better Auth trusted origins) —
      Caddy sets `X-Forwarded-Proto`; `BETTER_AUTH_URL` + `BETTER_AUTH_TRUSTED_ORIGINS` are the HTTPS
      origin; `WBOS_TRUSTED_PROXY_HOPS=1` matches the single Caddy hop
- [x] App restarts on crash (`restart: unless-stopped`) and behaves correctly across restarts (`docker-compose.prod.yml`)
- [x] Disk space monitoring on the host (DB + storage + backups volumes — `statfsSync` checks in `/api/health`, <10% = unhealthy)

## Security

- [x] `BETTER_AUTH_SECRET` is required and read from environment (not committed)
- [x] All secrets (`DATABASE_URL`, `BETTER_AUTH_SECRET`, FCM keys) provisioned via `.env` / secret manager, never in git — `.env` is gitignored; `.env.example` documents every variable; FCM keys via env or gitignored `.secrets/`
- [x] HTTPS enforced for all browser traffic — Caddy terminates TLS, `:80` permanently redirects to
      HTTPS (including requests by IP or unknown Host), HSTS `max-age=31536000; includeSubDomains` is
      set, and the app itself has no public listener to bypass it. Also sets `X-Content-Type-Options`,
      `X-Frame-Options: DENY`, and `Referrer-Policy`.
- [x] Session cookie is `Secure` in production — Better Auth derives this from `BETTER_AUTH_URL`, which
      must be the `https://` origin. Verified through the real proxy: `HttpOnly`, `Secure`, `SameSite=Lax`.
- [ ] Password policy / account lockout reviewed — account lockout now provided by rate limiting (5 failed sign-ins per 15 min per account, auto-recovers); password strength policy itself not yet set
- [x] Admin/session cookie flags reviewed (HttpOnly, SameSite, Secure) — Better Auth defaults: HttpOnly + SameSite=Lax, Secure set when `BETTER_AUTH_URL` is HTTPS
- [x] Rate limiting on sign-in and mobile API endpoints — lightweight in-memory sliding-window limiter (no Redis): per-IP on auth endpoints, per-account on mobile API + per-email sign-in backoff; 429 + Retry-After; validated 2026-08-10 (see Rate limiting section)
- [x] File upload validation: extension + MIME + size enforced — MIME allow-list + 10MB (attachments: PDF/JPG/PNG/GIF/WEBP), image/ + 2MB (logo), confirmed in `upload-attachment.ts` / `upload-logo.ts`
- [x] Uploaded files served only through the authenticated/whitelisted route (`/api/uploads`), not statically — attachments (`/api/uploads/uploads/attachments/**`) now require a valid session; logos stay public because Playwright PDF rendering (token-based, no cookies) loads them
- [x] Role-based access confirmed for all destructive actions (OWNER/ADMIN/MANAGER) — backup restore requires OWNER + `RESTORE` confirmation; download requires ADMIN+; create/list/diagnostics MANAGER+; uploads MANAGER+
- [x] No secrets logged (check server logs for connection strings / tokens) — backup service logs only tool-name probes + pg-filtered PATH snippets, never `DATABASE_URL`/`PGPASSWORD`; no API route echoes connection strings
- [x] Per-IP rate limits cannot be bypassed with a forged `X-Forwarded-For` — the client IP is read
      `WBOS_TRUSTED_PROXY_HOPS` entries from the **right** of the header (default 1 = one trusted
      proxy), so attacker-supplied leftmost entries are ignored; values are validated as real
      addresses and `X-Real-IP` is only honoured with `WBOS_TRUST_X_REAL_IP=1`. Fails closed
      (per-IP limiting skipped, per-account still applies) when the chain is shorter than configured.
      (Previously the leftmost entry was trusted unconditionally, so rotating it defeated per-IP
      limits entirely. Fixed 2026-08-16.)
- [~] `advanced.disableCSRFCheck` investigated and documented — see `CSRF_DECISION.md`. In
      better-auth 1.6.23 it disables Origin/Referer-vs-`trustedOrigins` validation on `/api/auth/*`,
      not merely the form-CSRF check; residual protection is the `SameSite=Lax` session cookie.
      Behavior is **unchanged** but now env-gated (`BETTER_AUTH_DISABLE_CSRF=0` enables the check)
      and reported on every boot by `startup-validate.js`. **Operator action:** enable it during the
      HTTPS milestone once `BETTER_AUTH_TRUSTED_ORIGINS` is set, following the verification plan in
      that document.

## Rate limiting

Lightweight, no Redis, no external infra: a single in-memory sliding-window limiter (`src/infrastructure/rate-limit/`),
appropriate for the single-instance 2-person deployment. It runs in the Node process, so it works for the app exactly as
deployed. **If the app is ever scaled to multiple instances, replace the in-memory store with a shared one.**

What is protected:

- **Auth endpoints (per-IP)** — enforced in the `/api/auth/*` route wrapper (`auth-guard.ts`) for the endpoints a brute-force
  or flood attack actually targets. Better Auth's own built-in limiter is disabled because its IP detection is unreliable
  behind the multi-hop reverse proxy (it would collapse everyone into one shared bucket).
- **Sign-in / verify-password (per-account)** — per-email backoff so credentials cannot be brute-forced from many IPs
  against one account; a successful sign-in resets the counter, and once the backoff is engaged the account is locked
  for the window (standard lockout — even the correct password is rejected until the window passes).
- **Sensitive mobile API endpoints (per-account)** — every authenticated v1 handler resolves `context.userId`, which is
  the natural per-account key (safe on a shared office/warehouse NAT, unlike per-IP).

Chosen limits (sliding window; a request at/below the limit is allowed):

| Scope | Endpoint | Limit / window |
| ----- | -------- | -------------- |
| per-IP | `POST /api/auth/sign-in/email` | 10 / 60s |
| per-IP | `POST /api/auth/sign-up/email` | 5 / 60s |
| per-IP | `POST /api/auth/request-password-reset` · `send-verification-email` | 5 / 60s |
| per-IP | `POST /api/auth/reset-password` · `verify-password` | 10 / 60s |
| per-account (email) | `POST /api/auth/sign-in/email` · `verify-password` | 5 / 15 min (lockout, reset on success) |
| per-account | `POST /api/v1/device-tokens` (register + delete) | 30 / 60s |
| per-account | `POST /api/v1/sales/signed-invoice` | 20 / 60s |
| per-account | `POST /api/v1/invoices/[id]/download-token` | 30 / 60s |
| per-account | `POST /api/v1/shipments/[id]/deliver` | 10 / 60s |
| per-account | `PATCH /api/v1/shipments/[id]/status` · `warehouse-notes` | 60 / 60s |
| per-account | `POST /api/v1/tasks/[id]/pick-actions` | 600 / 60s |
| per-account | `POST /api/v1/tasks/[id]/start` · `complete` · `cancel` · `PATCH lines/[id]` | 120 / 60s |
| per-account | `POST /api/v1/notifications/read-all` · `clear-read` · `DELETE [id]` | 60 / 60s |
| per-account | `GET /api/v1/auth/me` | 60 / 60s |

**Buckets are scoped per endpoint** (`ip:<path>:<ip>`). They were briefly keyed on the IP alone, which
meant every auth endpoint shared one counter while each request was still judged against its own limit —
so a user who mistyped their password a few times (allowed, limit 10) was then refused a password reset
with 429, because the shared counter had already passed that endpoint's limit of 5. Found 2026-08-16 by
end-to-end verification of the recovery flow; per-account/per-email limits were unaffected throughout and
remain the real brute-force control.

429 responses include `Retry-After` (seconds, RFC 9110) and `X-Retry-After` (milliseconds), plus a JSON body with
`code: "RATE_LIMITED"`.

**Deliberately not limited:** authenticated read paths the mobile app polls constantly (`GET /api/v1/tasks`,
`GET /api/v1/tasks/[id]`, `GET /api/v1/picking/[taskId]`, `GET /api/v1/scanner/resolve/[barcode]`,
`GET /api/v1/inventory/stock/by-barcode/[barcode]`, `GET /api/v1/notifications`) — they need valid session tokens, have
no realistic brute-force value, and tight per-IP limits there would break a warehouse on shared NAT. Also not limited:
`/api/uploads/*` and the public signed-PDF download (out of scope for this milestone; see follow-ups).

**No interference with the warehouse mobile workflow (verified):** notification → open task → scan → mark loaded/delivered.
Scanning (`pick-actions` = 600/min) is ~10x a fast scanner's realistic 60–120/min; shipment status/deliver actions happen
a handful of times a day (limits 60/min and 10/min); notification/task reads are unlimited; `auth/me` is called on app
launch (60/min). Sign-in happens once or twice a day per device (10/min per IP, 5/15 min per account).

**How to adjust for production:**

- Two knobs are env-configurable (read at startup): `WBOS_RATE_LIMIT_SIGNIN_IP` (per-IP sign-in limit, default 10) and
  `WBOS_RATE_LIMIT_SIGNIN_ACCOUNT` (per-account sign-in backoff, default 5). Everything else is tuned in
  `src/infrastructure/rate-limit/rules.ts` (the `AUTH_IP_RULES` / `AUTH_ACCOUNT_RULES` / `ACCOUNT_RULES` tables).
- Behavior when no client IP is present (e.g. requests not behind the documented reverse proxy): per-IP auth limits are
  skipped; per-account and per-email limits still apply, so brute-force protection on credentials remains.
- The limiter is process-memory; restarting the container clears the counters (a global "unlock"). Bounded to 20k keys per
  scope with lazy eviction, so it cannot grow unbounded.
- CPU-heavy public paths (`/api/invoices/download/[token]`, `/api/uploads/*`) are a possible per-IP hardening follow-up.

## Authentication

- [x] Better Auth sign-in / sign-up / onboarding
- [x] Mobile API authenticated via session (v1 endpoints)
- [ ] Password reset flow verified
- [ ] Email/identity provider configured for production (SMTP for verification/reset emails) or a documented decision to run self-managed
- [ ] Session expiry and revocation behavior verified
- [ ] Multi-device behavior verified (sign-in on web + mobile concurrently)
- [x] **Day-0 first-owner bootstrap is deterministic** — `WBOS_BOOTSTRAP_OWNER_EMAIL` names the owner;
      `prisma/seed.mjs` reconciles ownership on **every** run (previously it returned early once the
      bootstrap organization existed, so an owner who signed up afterwards could never be attached and
      hit 401 on every org-scoped endpoint). Resolution order: designated email → the only user →
      refuse to guess. Exact verification step in `PRODUCTION_DEPLOYMENT.md` §10.
- [x] **Public sign-up no longer grants OWNER** — onboarding attaches a user to an existing organization
      only while it has **zero** members (true Day-0) or when the email matches
      `WBOS_BOOTSTRAP_OWNER_EMAIL`. Previously any signup with no membership was auto-attached as OWNER,
      so anyone who could load the public HTTPS URL could take ownership of the business — ledgers,
      backups and restore included. 8 regression tests in `src/test/onboarding-service.test.ts`.
- [ ] Role-scoped user management (invite a warehouse user as MANAGER/STAFF rather than OWNER) — not
      built; adding a second person today means designating them via `WBOS_BOOTSTRAP_OWNER_EMAIL`, which
      grants OWNER. Acceptable for the current 2-person team; revisit before adding staff accounts.

## Backups

- [x] Tiered daily/weekly/monthly/yearly database backup script (`scripts/backup.sh` / `backup.ps1`)
- [x] Uploads directory archived with database backups
- [x] Backup manifest (`backup-manifest.json`) records each run
- [x] Version-aware backup package (single timestamped `wbos-backup-*.tar.gz`: DB dump + uploads + config) from the Backup & Restore settings page
- [x] Manual **Create Backup Now** from the Settings UI
- [x] **Restore** workflow from a backup package with confirmation (type `RESTORE`)
- [x] **Last Backup / Last Restore Test** indicators surfaced in the Settings UI
- [x] Automatic scheduled backups wired into the deployment (cron/systemd/docker scheduler) — see Operations
- [x] Backups stored off-host (off-site / separate disk) with tested retrieval — `scripts/sync-backups.sh` (rsync/rclone/file target), wired into `scripts/deploy.sh`; mirror semantics validated 2026-08-10, remote target provisioning pending (see `DISASTER_RECOVERY.md`)
- [x] Non-destructive restore test tooling — `scripts/restore-test.sh` restores a package into a throwaway DB, verifies, records result; validated end-to-end 2026-08-10
- [x] Restore-test **failures** are recorded too — the result is written from the script's exit trap with a
      `reason`, so a test that dies partway still lands in `restore-history.json` and replaces the
      previously displayed PASS. Verified 2026-08-16 against a deliberately corrupt package.
      (Previously the record was only written on the success path, so failures were invisible.)
- [x] Backup retention policy documented (currently: 7 daily / 4 weekly / 12 monthly / yearly forever)
- [ ] Encrypted backup at rest if off-site

### Deferred optimizations (recorded, deliberately not done)

- **Docker image size — `COPY --chown` instead of recursive chown.** `chown -R appuser:appgroup /app` in
  the Dockerfile rewrites every file under `/app`, duplicating the entire application tree (node_modules
  and the Playwright Chromium build included) into a single **1.54 GB** layer and roughly doubling the
  image. Real image size is 1.38 GB (`docker image inspect`; the ~5.6 GB reported by `docker images` is
  inflated by BuildKit attestation manifests). The fix is to pass `--chown=appuser:appgroup` on the
  earlier `COPY` instructions and drop the recursive chown. Build-only change, no runtime behavior
  difference. Deferred deliberately — worth doing when deploy-pull time or registry cost starts to
  matter, not during a hardening pass.

Roadmap (not blocking production):

- [x] **Backup verification after creation** — verify the package integrity (re-open the archive, check the dump is
      readable via `pg_restore --list`, confirm uploads extracted count) so a corrupt backup fails loudly at creation
      time rather than at restore time — implemented in `verifyPackage()` in the backup service; `createBackup` deletes
      a package that fails verification
- [ ] **Backup metadata in the list** — show created date/time, size, duration, success/failure, and an optional user
      note (e.g. "Before August Import") per package
- [ ] **Verify Backup action** — validate a package (format version, migration compat, `pg_restore --list`, archive
      integrity) without restoring. The current architecture supports this: `verifyPackage()` + `isManifestCompatible()`
      already exist and can be exposed as a non-destructive service method.

### Backup dependencies (required)

The Backup & Restore feature shells out to three external tools. If any are missing, the UI shows a friendly
error that names each missing tool ("Required backup tools are not installed or not available in PATH: …") instead
of a crash or a generic message:

| Tool | Needed for | On a missing tool |
| ---- | ---------- | ----------------- |
| `pg_dump` | Creating the database dump (`-Fc` custom format) | Create Backup Now fails gracefully |
| `pg_restore` | Restoring the database from a dump (`--clean`) | Restore fails gracefully |
| `tar` | Packaging/archiving uploads and the final `.tar.gz` | Create/restore fail gracefully |

Inside the Docker image these are already present (`postgresql-client` + `tar`); the app container needs nothing extra.
The **host** (for cron/scheduled backups and local runs) needs them installed.

Installation notes:

- **Linux (production, host):** `sudo apt-get install postgresql-client` (Debian/Ubuntu) or
  `sudo dnf install postgresql` (Fedora/RHEL). `tar` is almost always already installed — `tar --version` to confirm.
  Then verify: `pg_dump --version && pg_restore --version && tar --version`.
- **Windows (development):** install PostgreSQL via the EDB installer (includes `pg_dump`/`pg_restore`) or run the
  official Docker image with the client tools. `tar` ships with Windows 10+ (System32). Add the PostgreSQL `bin`
  directory to `PATH` (e.g. `C:\Program Files\PostgreSQL\16\bin`) and verify in a new terminal:
  `pg_dump --version && pg_restore --version && tar --version`.
- **Windows tip (pgAdmin only):** if you installed only pgAdmin 4, the client tools live in its `runtime` folder
  (e.g. `E:\pgAdmin 4\runtime`). Add that folder to `PATH`, then **fully restart** the terminal and the Next.js
  dev server. The backup service reads `PATH` from the **process that launched Next.js**, not from your shell
  profile, so a PATH change only takes effect for processes started *after* the change. If a server started before
  the PATH edit is still running, it keeps the old PATH and WBOS reports the tools as missing even though
  `pg_dump --version` works in a new terminal.
- **Diagnose:** `/api/backups/diagnostics` (or the Backup tools section on `/settings/backups`) lists
  `process.env.PATH` and the ✓/✗ status of `pg_dump`, `pg_restore`, and `tar` exactly as the server process sees
  them. Missing tools are named individually in the error message.
- **In Docker:** nothing to do — the image already bundles the tools. Confirmed by the health page / container image.

### DATABASE_URL handling

WBOS never passes Prisma's `DATABASE_URL` (e.g. `...?schema=public`) to PostgreSQL client tools. The backup service
parses the URL into `-h/-p/-U/-d` arguments and passes the password via the `PGPASSWORD` environment variable of the
child process. This strips Prisma-only query parameters (`schema`, `pgbouncer`, …) that `pg_dump`/`pg_restore`
reject, and keeps the password out of process arguments/logs. Both backup and restore use the same path.

## Restore procedure

- [x] Restore from a backup package restores database + uploads
- [x] Restore requires explicit confirmation (destructive operation)
- [x] Documented end-to-end restore runbook (steps, expected downtime, verification) — `PRODUCTION_DEPLOYMENT.md` §7
- [~] Restore test executed at least once against a copy of the production DB — **tooling validated 2026-08-10** (`scripts/restore-test.sh`, restore into throwaway PG17 DB, PASS); the actual test against a real production package still needs to be run on the server (see `DISASTER_RECOVERY.md`)
- [x] Version-incompatibility check surfaces a clear error instead of silent failure
- [x] Backup & Restore settings page (`/settings/backups`): create, list, download (ADMIN+), restore (OWNER, type `RESTORE`)

## Attachments

- [x] Attachments stored under `WBOS_STORAGE_ROOT/uploads/...` with org/entity/entityId path isolation
- [x] Attachment metadata (type, size, uploader) recorded in the DB
- [x] Storage capacity monitoring + hard floor — `/api/health` exposes uploads `sizeBytes`/`fileCount`/`pctOfDisk`; alerting on uploads share of disk (warn 60% / critical 75%); uploads are **rejected** (`STORAGE_FULL`) when a write would leave less than `WBOS_STORAGE_MIN_FREE_BYTES` (default 512 MB) free, so attachments cannot silently fill the host disk. Validated 2026-08-10
- [x] Backup coverage confirmed for the attachments directory in scheduled runs
- [ ] Orphaned-file cleanup policy (files without DB rows after restores/cancels) — storage policy documented in `DISASTER_RECOVERY.md`; automated sweep not built

## Mobile

- [x] Warehouse mobile app auth via API sessions
- [x] Picking, scanning, stock lookup, deliveries operate against the web API
- [x] FCM push notifications available (optional; falls back to polling)
- [ ] Mobile build points at production URL (HTTPS) and is signed for distribution
- [ ] Mobile offline behavior documented (currently network-dependent; confirm acceptable)
- [ ] Push notification credentials (Firebase service account) provisioned, gitignored

## Purchasing

- [x] Purchase order lifecycle: draft → submit → approve → receive (partial/full)
- [x] Goods Receipt Note generation + immutable ledger entries
- [x] Landed costs: allocate freight/customs, post revaluation
- [x] Supplier invoices: create/issue/pay (deposit + final), cancel gating, no PDF generation
- [x] Import shipments orchestration: PO/SI/docs/goods receipt/landed cost linkage, derived progress
- [ ] Supplier invoice PDF (if ever needed) — document decision; currently attachments only
- [ ] Currency handling beyond KWD/USD/EUR verified (exchange rates on landed costs)

## Inventory

- [x] Weighted-average costing across receipts, landed cost, sales, returns
- [x] Immutable inventory ledger; stock is derived, never stored as a number
- [x] Valuation consistency (dashboard KPI, reports, ProductCost) covered by E2E tests
- [ ] Cycle count workflow exercised in production conditions
- [ ] Negative-stock and discrepancy handling procedure defined

## Sales

- [x] Sales order → picking → shipment → delivery → invoice → payment lifecycle
- [x] Returns with RESTOCK/SCRAP/REPLACE and auto credit notes
- [x] Credit notes reduce invoice credited amount and customer balance
- [ ] Invoice PDF generation verified in the deployed environment (Playwright/Chromium present)
- [ ] Tax/VAT reporting verified for the operating country

## Reports

- [x] Financial, inventory, purchasing, sales, operational reports
- [x] Export (CSV) and print available on report pages
- [ ] Report totals reconciled against the ledger at least once per month
- [ ] Report filters (warehouse/customer/supplier/date) verified in production data

## Testing

- [x] Unit tests: 17 files / 243 tests (vitest, prisma auto-mocked) — incl. storage-capacity guard (`src/test/assert-capacity.test.ts`) and rate limiting (`src/test/rate-limit.test.ts`)
- [x] E2E against real demo DB: 3 files / 19 tests (full workflow, valuation sync, import lifecycle)
- [x] `tsc --noEmit` exit 0, `eslint .` 0 errors
- [x] `next build` succeeds
- [x] Backup/restore unit coverage: format-compat checks, package creation, restore confirmation, restore-test history, per-tool dependency detection, Prisma-URL sanitization, package verification, corrupt-package deletion, config/env validation (30 tests)
- [x] Restore path exercised end-to-end (backup → restore → verify) — `scripts/restore-test.sh` runbook + script, validated 2026-08-10 (see `DISASTER_RECOVERY.md`); remaining gap is the production-data run
- [x] Pre-release checklist command documented (see **Release gate** below)

## Monitoring

- [x] `/api/health` endpoint (JSON) + `/health` page with DB, storage (incl. uploads size/count/% of disk), backups, uptime, disk space, backup tools, restore-test status
- [x] Day-0 health is not self-blocking — a deployment with **no backups yet** reports
      `backups.neverBackedUp: true` but stays `healthy`, so the Docker healthcheck (and
      `deploy.sh`'s health poll) can pass on a fresh install. An **existing** backup that has gone
      stale still fails health. Threshold: `WBOS_HEALTH_BACKUP_STALE_HOURS` (default 48).
      Both states still alert via `health-alert.sh`. (Previously `latestAgeHours === null` forced
      `healthy=false`, so a first deploy could never become healthy. Fixed 2026-08-16.)
- [x] A **failed** restore test is surfaced, not hidden — `getStatus()` reports the most recent
      restore-test record whatever its result, `/settings/backups` and `/health` show FAILED with the
      reason, and `health-alert.sh` raises a `restore_failed` alert. (Previously the reader skipped
      back to the last *successful* run, so a broken restore path kept displaying PASS. Fixed 2026-08-16.)
- [ ] Log aggregation (container logs persist; centralize if multi-host)
- [x] Alerting on: app down, DB down, backup staleness (>48h), low disk, storage not writable, broken backup tools, uploads share of disk — `scripts/health-alert.sh` (host cron) polls `/api/health` and notifies via webhook/Telegram/ntfy/email; validated end-to-end 2026-08-10 (see Operations → Alerting wiring)
- [ ] Dashboard/uptime check external to the host (uptime robot / Uptime Kuma)
- [ ] Error tracking (server error rate visible; decide on Sentry or log review cadence)

## Deployment

- [x] Dockerfile multi-stage; standalone Next build; non-root runtime
- [x] Entrypoint validates env + backup tools + disk + storage/backups dirs and runs `prisma migrate deploy`
- [x] Fresh-install volume permissions — the image creates `/app/storage/uploads` and the full
      `/app/backups/{daily,weekly,monthly,yearly,uploads,packages}` tree before `chown appuser`, so
      Docker seeds new named volumes with uid-1001 ownership. (`/app/backups` was missing from the
      image, so a fresh volume mounted there was root-owned and entrypoint storage validation failed
      on every first deploy. Fixed 2026-08-16.)
- [x] `docker-compose.prod.yml`: app + Postgres 16 services, volumes, healthchecks, resource limits, restart policy
- [x] `scripts/sync-backups.sh` off-host sync (rsync / rclone / local mount) with `WBOS_BACKUP_SYNC_TARGET`; mirror behavior validated 2026-08-10
- [x] `scripts/restore-test.sh` non-destructive restore validation (throwaway DB + recorded history) — validated 2026-08-10
- [x] `scripts/health-alert.sh` self-hosted alerting (host cron → `/api/health` → webhook/Telegram/ntfy/email) — validated 2026-08-10
- [x] `scripts/deploy.sh`: tests → typecheck → lint → pre-deploy backup → build → up → health → optional off-host sync
- [x] `npm run build` verified locally
- [x] Image build/publish pipeline defined (CI → GHCR tag) — `.github/workflows/docker.yml`: quality gates
      (typecheck/lint/unit) + E2E against a real PostgreSQL 17 service + build/push to
      `ghcr.io/devhoss/wbos:latest` and `:<sha>`; green on `main` as of 2026-08-13
- [x] Deploy pulls the published image — `scripts/deploy.sh` runs `docker compose pull` explicitly.
      (`up --build` was a no-op: the app service has `image:` and no `build:`, so deploys silently
      reused whatever stale `latest` was already on the host. Fixed 2026-08-16.)
- [x] Rollback plan (redeploy previous image + restore backups if migration fails) — set
      `WBOS_IMAGE_TAG=<commit-sha>` and re-run `scripts/deploy.sh`; a failed migration now aborts
      container startup (see below), so the pre-deploy backup is the restore point
- [x] Migration failure aborts startup — `docker-entrypoint.sh` checks the real `prisma migrate deploy`
      exit code. (It previously piped into `grep … || true`, so the pipeline reported grep's status and
      the app booted against a half-migrated database. Fixed 2026-08-16.)
- [x] **Migrations actually run.** The command was `prisma migrate deploy --skip-generate`, but
      `migrate deploy` does not accept that flag (only `migrate dev` does) — it exited with a usage
      error on every boot, which the old `|| true` swallowed while still printing "Migrations complete."
      **No container deployment had ever applied a migration.** Found 2026-08-16 when the new exit-code
      check refused to start the app; confirmed fixed by watching all 9 migrations apply to a fresh
      PostgreSQL 17 database, ending in "All migrations have been successfully applied."
- [x] PostgreSQL major version standardized on **17** across prod compose, CI, and restore testing —
      see `PRODUCTION_DEPLOYMENT.md` §11; `startup-validate.js` warns on a client/server mismatch
- [ ] Zero-downtime deploy strategy defined (migrations are backward-compatible — verify each migration)
- [ ] `.env` for production finalized with real values

## Operations

- [x] Scheduled backup job configured and verified to run automatically (see cron wiring below)
- [~] Restore runbook executed once (recorded in **Restore Verification** above) — rehearsal done 2026-08-10 (restore-test into throwaway DB); full runbook against production data pending
- [ ] Monitoring/alerts reach a person (email/phone)
- [ ] On-call / escalation path defined for the 2-person team
- [x] Day-0 runbook: fresh install from scratch (DNS, proxy, volumes, image) tested — `PRODUCTION_DEPLOYMENT.md` §9
- [x] Release cadence decided (how often deploys happen; who does them) — `scripts/deploy.sh` + **Release gate**

### Scheduled backup wiring (host cron)

The package backup format produced by the Settings UI is replicated by the existing shell scripts so the same
single-file `.tar.gz` packages can be produced on a schedule without the app running. Run daily from the host:

```cron
# Daily at 02:00, writes wbos-backup-<ts>.tar.gz into $WBOS_BACKUP_DIR/packages
0 2 * * * WBOS_DATABASE_URL='postgresql://wbos:***@127.0.0.1:5432/wbos' WBOS_BACKUP_DIR=/srv/wbos/backups WBOS_STORAGE_ROOT=/srv/wbos/storage /srv/wbos/scripts/backup-package.sh
```

Requirements:
- `WBOS_DATABASE_URL`, `WBOS_BACKUP_DIR`, `WBOS_STORAGE_ROOT` env vars (or exported in a wrapper).
- The host needs `pg_dump` (postgresql-client) and `tar`. Inside the app container these exist already.
- Retention: the existing tiered retention (`scripts/backup.sh` — 7 daily / 4 weekly / 12 monthly / yearly) is the
  recommended schedule; `backup-package.sh` is the single-package fallback / cross-platform equivalent.
- Verify scheduling with `crontab -l`, then check `/api/health` (or the `/health` page) shows a fresh backup the
  next morning. Also confirm the **Last Backup** indicator on `/settings/backups` updates.

### Off-host sync wiring (host cron)

After the scheduled backup, mirror the packages folder off-host so a full-host loss does not take backups with it.
Run `scripts/sync-backups.sh` on a second cron line (see the script header and `.env.example` for target formats):

```cron
# Daily at 02:30, after backup-package.sh — mirror packages off-host (rsync to NAS)
30 2 * * * WBOS_BACKUP_DIR=/srv/wbos/backups WBOS_BACKUP_SYNC_TARGET='rsync://backup@nas.local:/volume1/wbos-backups' /srv/wbos/scripts/sync-backups.sh
```

The sync is a **mirror** (`--delete`), so deleted local packages are removed off-host too; keep local retention as
the source of truth.

### Alerting wiring (host cron)

`scripts/health-alert.sh` polls the already-published `/api/health` (default `http://127.0.0.1:3005/api/health` —
the port `3005:3000` from `docker-compose.prod.yml`) and notifies via any configured channel: generic JSON webhook
(`{"text": ...}`), Telegram bot, ntfy topic, or local `mail`. It still fires when the app/DB container is down because
it runs on the HOST. Conditions are de-duplicated (alert on state change, re-alert every `WBOS_ALERT_COOLDOWN_HOURS`,
recovery notice when it clears). See the `.env.example` Alerting section for all options and
`./scripts/health-alert.sh --test` to verify a channel.

```cron
# Every 10 minutes — check health and alert on failures (state in /var/lib/wbos/alert-state)
*/10 * * * * WBOS_ALERT_STATE_DIR=/var/lib/wbos/alert-state WBOS_ALERT_WEBHOOK_URL='https://hooks.slack.com/services/...' /srv/wbos/scripts/health-alert.sh >> /var/log/wbos-alert.log 2>&1
```

Verify: run `./scripts/health-alert.sh --test` once (you should receive the test message), then check
`/var/log/wbos-alert.log` after the next cron tick.

### Pre-deploy backup

`scripts/deploy.sh` takes a fresh single-package backup (Settings UI format) before starting the new stack, so a
failed migration has a known-good restore point. Set `WBOS_DATABASE_URL`, `WBOS_BACKUP_DIR`, `WBOS_STORAGE_ROOT`, and
optionally `WBOS_BACKUP_SYNC_TARGET` before running it.

---

## Audit

### 2026-08-05 — Production-readiness audit (graded)

Scored Critical / High / Medium / Low against the 2-person wholesale importer workflow. Critical items must be
resolved before real data enters production. Items are actionable and cross-referenced to this checklist.

| Severity | Finding | Where it lives |
| -------- | ------- | -------------- |
| ~~Critical~~ | ~~Single PostgreSQL instance with no replication; a disk failure loses all ledger/inventory data unless backups are off-host~~ — **mitigated**: off-host sync + verified packages + disk monitoring; single-instance DB remains a documented residual risk | Infrastructure → Database |
| ~~Critical~~ | ~~Backups are on the same host as the app; a full-host loss takes app + backups together~~ — **resolved**: `scripts/sync-backups.sh` mirrors packages off-host (validated 2026-08-10); operator must still provision the remote target | Backups → Off-host |
| ~~High~~ | ~~No alerting when the app, DB, or backup job stops (staleness >48h). A silent backup failure goes unnoticed until disaster~~ — **resolved**: `scripts/health-alert.sh` (host cron → `/api/health` → webhook/Telegram/ntfy/email), validated 2026-08-10 | Monitoring |
| High | Restore has never been executed against a copy of the production DB; the version-compat path is unit-tested but not exercised end-to-end | Restore procedure |
| ~~High~~ | ~~Uploads volume is unbounded with no capacity monitoring; attachments can fill the disk and take the app down~~ — **resolved**: uploads size/floor in `/api/health`, `STORAGE_FULL` hard stop, size-based alerts, `/health` page — 2026-08-10 | Attachments / Monitoring |
| ~~Medium~~ | ~~No rate limiting on sign-in / mobile endpoints; brute-force on a 2-person credential set~~ — **resolved**: in-memory sliding-window limiter — per-IP on auth endpoints, per-email sign-in backoff (lockout), per-account limits on mobile API; 429 + Retry-After — 2026-08-10 | Security |
| Medium | Password reset / SMTP not yet provisioned; a forgotten password locks an owner out | Authentication |
| Medium | Invoice PDF generation (Playwright/Chromium) only verified locally, not in the deployed container | Sales |
| Medium | No log aggregation or error tracking; incidents are diagnosed by reading container logs manually | Monitoring |
| Low | Report totals reconciled manually (no automated ledger reconciliation) | Reports |
| Low | Cycle counts / negative-stock handling procedure not yet documented | Inventory |
| Low | Release cadence and on-call path undefined for the 2-person team | Operations |

**Next step:** resolve the two remaining Criticals' follow-through — (1) provision the off-host target (NAS or S3) and
run `sync-backups.sh` for real, and (2) run the first real restore test against a copy of the production DB and
record it in **Restore Verification**. Then wire alerting (staleness >48h → email/phone) to close the High items.

### 2026-08-10 — Disaster recovery baseline (follow-through on the audit)

Closed out the DR tooling half of the two remaining Critical/High items. Operator steps that remain are called out.

| Item | Status | Notes |
| ---- | ------ | ----- |
| Off-host sync tooling proven | Done | `sync-backups.sh` mirror semantics validated end-to-end (sync → add → delete → empty-source) against a local `file://` target; `rsync://` URI transform and `rclone sync` (S3) branches verified |
| Restore path proven end-to-end | Done (tooling) | New `scripts/restore-test.sh`: restores a package into a throwaway DB, verifies the dump + uploads, records `restore-history.json` (JSONL the Settings UI reads). Validated in a throwaway PostgreSQL 17 container (PASS, synthetic data) |
| DR runbook documented | Done | `DISASTER_RECOVERY.md` — off-host target provisioning checklist, cron wiring, restore-test usage + failure interpretation, full-restore pointer |
| **Operator follow-through** | Pending | Provision real remote target (NAS/S3) and run first restore test against a production-data package; record in **Restore Verification** |
| Alerting (High from audit) | Done | `scripts/health-alert.sh` — host cron polls `/api/health`, notifies via webhook/Telegram/ntfy/email; de-duplicated with recovery notices; validated end-to-end incl. sed-only (no jq/node) fallback. Operator step: configure a channel + cron line (see Operations → Alerting wiring) |
| Uploads capacity (High from audit) | Done | `/api/health` now reports uploads `sizeBytes`/`fileCount`/`pctOfDisk` + `minFreeBytes` floor; uploads **rejected** (`STORAGE_FULL`) when a write would leave < `WBOS_STORAGE_MIN_FREE_BYTES` (512 MB) free; alerting on uploads share of disk (warn 60% / critical 75%); `/health` page shows Uploads Size; policy + thresholds in `DISASTER_RECOVERY.md`; validated 2026-08-10 |

| Rate limiting (Medium from audit) | Done | Lightweight in-memory sliding-window limiter (`src/infrastructure/rate-limit/`) — no Redis, no external infra. Per-IP on `/api/auth` credential endpoints, per-email sign-in backoff (5 per 15 min, resets on success), per-account limits on 16 sensitive mobile API handlers. HTTP 429 + `Retry-After`/`X-Retry-After`. Better Auth built-in limiter disabled (unreliable IP detection behind proxy). 21 tests + full suite green; validated 2026-08-10 |

Remaining open items per the 2026-08-05 audit:
SMTP/password reset, in-container PDF verification, log aggregation.

### 2026-08-16 — Deployment-blocker bug fixes (pre-TLS pass)

Eight defects found by re-auditing the code against this checklist rather than trusting it. All
verified locally: 261 unit tests pass, `tsc --noEmit` exit 0, `eslint .` 0 errors, `next build` exit 0.

| # | Defect | Fix | Verified by |
| - | ------ | --- | ----------- |
| 1 | `docker-entrypoint.sh` piped `prisma migrate deploy` into `grep … \|\| true`; the pipeline returned grep's status, so a **failed migration booted the app against a half-migrated DB** | Capture the real exit code; abort startup with the migration log | Logic harness: failing migration → exit 1, success → exit 0; old form returned 0 on failure |
| 2 | `/api/health` returned 503 when **no backup existed**, so a fresh deploy could never pass its own healthcheck (bootstrap deadlock) | `evaluateBackupFreshness()` separates Day-0 "never backed up" (reported, alerted, **not** unhealthy) from a genuinely stale backup (unhealthy) | 7 new unit tests (`backup-freshness.test.ts`) |
| 3 | `deploy.sh` used `up -d --build` against a service with `image:` and no `build:` — a no-op, so deploys **silently reused a stale local image** | Explicit `docker compose pull`; `WBOS_IMAGE_TAG` for pin/rollback | Reviewed; requires a real host to exercise |
| 4 | `/app/backups` was never created in the image, so a fresh named volume was root-owned and **entrypoint validation failed on first deploy** | Create storage + full backup tree before `chown appuser` | Dockerfile reviewed; **image build not run locally — Docker daemon unavailable** |
| 5 | Restore-test failures were **never recorded**, and `getStatus()` skipped back to the last *success* — a broken restore path kept displaying PASS | Record from the exit trap with a `reason`; report the latest record whatever its result; show FAILED in UI + `/health`; new `restore_failed` alert | Ran the script against a corrupt package (record written with reason); 3 new/updated unit tests |
| 6 | Per-IP rate limits read the **leftmost** `X-Forwarded-For`, which is attacker-controlled — rotating it bypassed them entirely | Read `WBOS_TRUSTED_PROXY_HOPS` entries from the right; validate the address; `X-Real-IP` opt-in only; fail closed | 11 unit tests incl. an explicit spoofing-attempt case |
| 7 | `advanced.disableCSRFCheck: true` was undocumented and broader than its name | Investigated against better-auth 1.6.23 source; documented in `CSRF_DECISION.md`; env-gated with **behavior unchanged**; boot-time warning | Source-verified; flag flip deferred to the HTTPS milestone |
| 8 | Prod ran PostgreSQL **16** while CI, the client tools, and every restore rehearsal used **17** — dumps may not restore into an older server | Standardized on 17 (`POSTGRES_IMAGE` override); build-time assertion in the Dockerfile; boot-time client/server comparison; upgrade runbook in `PRODUCTION_DEPLOYMENT.md` §11 | Version-parsing verified; **image build not run locally** |

Repository hygiene in the same pass: the empty `E:\wbos\.git` was removed (the root was never a repo),
and `PRODUCTION_READINESS.md` + `PRODUCTION_DEPLOYMENT.md` moved from the untracked root `docs/` into
`web/docs/` so they are version-controlled alongside the code they describe. `web` and `mobile` remain
separate repositories; no umbrella repo was created.

### 2026-08-16 — Phase 4: reverse proxy / TLS (verified end-to-end)

Production topology settled: a **dedicated VPS** running Caddy + WBOS + PostgreSQL 17, independent of the
homelab (which stays development-only). Caddy is the sole public listener; the app binds `127.0.0.1:3005`
for host-cron health polling; the database publishes **no port at all**.

Verified against a full stack (Caddy → app → postgres:17) over genuine TLS, using Caddy's local CA on
`wbos.localhost`, with `BETTER_AUTH_DISABLE_CSRF=0`. **26 checks, 0 failures.**

| Area | Result |
| ---- | ------ |
| HTTP → HTTPS | `308` permanent redirect to the `https://` origin |
| TLS termination | Certificate served by Caddy (`CN=Caddy Local Authority`); HSTS `max-age=31536000; includeSubDomains` |
| No bypass path | App `:3005` unreachable from off-host; database publishes no host port; `/api/health` returns **404** through the proxy but 200 on loopback |
| Day-0 health | `healthy=true`, `neverBackedUp=true`, `stale=false` on a fresh deployment with no backups |
| Fresh volumes | App runs as uid 1001 and `/app/backups` is writable on a brand-new named volume |
| PostgreSQL version | `pg_dump 17.11` in the image matches server 17; boot-time check reports the match |
| Session cookie | `__Secure-` prefixed, `HttpOnly`, `Secure`, `SameSite=Lax` |
| CSRF / origin | Sign-up and sign-in succeed from the trusted origin; a cross-origin sign-in is **rejected with 403** |
| Mobile Bearer | `set-auth-token` response header survives the proxy; `GET /api/v1/auth/me` and cookieless `get-session` both return 200 **with CSRF validation enabled** |
| X-Forwarded-For | 14 sign-in attempts, each with a **different forged leftmost XFF** and a **unique email** (so the per-account limiter cannot fire), all shared one bucket → `429` at request #11 with "Too many attempts from this IP", exactly the documented 10/60s budget |

The mobile Bearer result answers the open question in `CSRF_DECISION.md`: the flag is **not** required for
the mobile app, so `BETTER_AUTH_DISABLE_CSRF="0"` is now the documented production setting.

All of the above was re-run against the **shipped image** (entrypoint baked in, no bind mount, fresh
volumes, fresh database) — not just against mounted sources.

Two non-blocking findings from the same run, recorded rather than fixed:

- **First-user/membership ordering.** `prisma/seed.mjs` attaches only the earliest-created user and skips
  entirely once the bootstrap organization exists. A user without a membership gets `401` from every
  org-scoped endpoint — indistinguishable from an auth failure. Documented as a go-live step with a
  verification query in `PRODUCTION_DEPLOYMENT.md` §10.
- **Image layer bloat (~1.5 GB).** `chown -R appuser:appgroup /app` in the Dockerfile rewrites every file
  in `/app`, duplicating the whole application tree — node_modules and the Playwright browser included —
  into a single 1.54 GB layer, roughly doubling the image. Real image size is 1.38 GB (`docker image
  inspect`; the ~5.6 GB that `docker images` reports is inflated by BuildKit attestation manifests).
  Pre-existing and unrelated to this phase; the fix is `COPY --chown` on the earlier COPY steps instead
  of a recursive chown, which is a build-only change worth doing when deploy-pull time starts to matter.

Two further defects were found *by* this phase and fixed:

| Defect | How it surfaced | Impact if shipped |
| ------ | --------------- | ----------------- |
| The image installed Debian's `postgresql-client` meta-package, which follows the **base image** release. `node:24-slim` is bookworm → client **15**, not 17. | The `EXPECTED_PG_MAJOR` build assertion added in the previous pass failed the build. | `pg_dump` refuses to dump from a newer server, so **every backup would have failed** against the 17 database — including in-app "Create Backup Now". Now installs `postgresql-client-17` from the PostgreSQL APT repo, pinned. |
| `prisma migrate deploy --skip-generate` — `migrate deploy` has never accepted that flag. | The new migration exit-code check refused to start the app. | Combined with the old `\|\| true`, **no container deployment had ever applied a migration** while printing "Migrations complete." A fresh production deploy would have come up against an empty schema. |

Both were invisible before this work: the first because nothing compared client to server, the second
because the failure was swallowed and reported as success.

---

## Restore Verification

> A backup that has never been restored is only a theory. Record every successful restore test here.

| Date | Backup used | Scope (DB/uploads/full) | Result | Verified by |
| ---- | ----------- | ----------------------- | ------ | ----------- |
| 2026-08-10 | `wbos-backup-2026-08-10T*.tar.gz` (created by `backup-package.sh`) | DB (PostgreSQL 17, restore-test scratch DB) + uploads (2 files) | PASS — package verified, dump restored + queried (Organization rows), uploads extracted 2/2, scratch DB dropped | `scripts/restore-test.sh` in throwaway PG17 container (synthetic data — validates tooling; production-data test pending, see `DISASTER_RECOVERY.md`) |

## Release gate

Before every production deploy, confirm:

- [ ] `npm run test` (unit) passes (17 files / 243 tests incl. backup/restore + config + storage capacity + rate limiting)
- [ ] `npx vitest run -c vitest.e2e.config.ts` passes (3 E2E suites)
- [ ] `npx tsc --noEmit` exit 0
- [ ] `npm run lint` — 0 errors (warnings reviewed)
- [ ] `npm run build` succeeds
- [ ] New migration reviewed and verified backward-compatible; `prisma migrate deploy` applied
- [ ] Backup taken immediately before deploy (Settings → Backup & Restore → Create Backup Now)
- [ ] Health page shows DB/storage/backups OK after deploy
- [ ] A smoke run of the core loop (receive → sell → deliver) passes in production
