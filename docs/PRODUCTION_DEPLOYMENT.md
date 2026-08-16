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
# PostgreSQL 17 runs as the `db` service on this VPS (see §5). `db` is the compose
# service name; the database publishes no port to the host.
DATABASE_URL="postgresql://wbos:CHANGE-ME@db:5432/wbos?schema=public"

# Must match DATABASE_URL above
POSTGRES_USER="wbos"
POSTGRES_PASSWORD="CHANGE-ME"
POSTGRES_DB="wbos"

BETTER_AUTH_SECRET="$(openssl rand -hex 32)"

# MUST be https:// — Better Auth only marks the session cookie Secure when it is
BETTER_AUTH_URL="https://wbos.example.com"
BETTER_AUTH_TRUSTED_ORIGINS="https://wbos.example.com"
BETTER_AUTH_DISABLE_CSRF="0"          # enable origin validation (see §6, CSRF_DECISION.md)

# Reverse proxy / TLS — the Caddyfile never hardcodes a hostname
WBOS_DOMAIN="wbos.example.com"
WBOS_TLS="ops@example.com"            # ACME email, or "internal" for a local CA

# Exactly one trusted proxy hop (caddy). Increment if you add another in front.
WBOS_TRUSTED_PROXY_HOPS="1"

# Optional: off-host sync (see §8)
WBOS_BACKUP_SYNC_TARGET="rsync://backup@nas.local:/volume1/wbos-backups"
```

`scripts/startup-validate.js` runs at container start and fails fast if `DATABASE_URL`, `BETTER_AUTH_SECRET`, or
`BETTER_AUTH_URL` is missing, if `pg_dump`/`pg_restore`/`tar` are absent, or if disk is below 10% free. It also
reports the CSRF posture, the trusted-proxy hop count, and any PostgreSQL client/server version mismatch.

## 4. Start the stack

```bash
docker network create wbos-prod 2>/dev/null || true   # once, external network
cd /srv/wbos
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

Three services start: **caddy** (public, ports 80/443), **app** (loopback only, `127.0.0.1:3005`) and
**db** (no published port). The app waits for the database to be healthy (up to `WBOS_DB_WAIT_SECONDS`,
default 90s), runs
`prisma migrate deploy`, then serves. A failed migration aborts startup rather than running against a
half-migrated database.

Verify:

```bash
curl -sI http://wbos.example.com/            # expect 308 -> https
curl -s  https://wbos.example.com/sign-in -o /dev/null -w '%{http_code}\n'   # 200
curl -s  http://127.0.0.1:3005/api/health | head -c 200                      # operator-only
```

`/api/health` is deliberately **not** reachable through the proxy — it returns 404 there. It exposes
storage paths, disk figures and backup state, which is operator information. Host cron
(`scripts/health-alert.sh`) reads it on `127.0.0.1:3005`, which is why the app keeps a loopback port.

## 5. Database: PostgreSQL 17 on the VPS

PostgreSQL runs as the `db` service in `docker-compose.prod.yml`, on the **same VPS** as the app and
proxy. The production stack has no dependency on the homelab or on any other machine.

```
                          ── VPS (self-contained) ──
internet ──443/80──> caddy ──http──> app ──5432──> db (postgres:17)
                     (TLS)           (loopback     (no published port —
                     PUBLIC           only)          container network only)

                          off-host: backups replicated to separate storage (§8)
```

### 5.1 Why the database is not publicly exposed

The `db` service deliberately declares **no `ports:` mapping at all**. Docker only publishes what you
ask it to, so with no mapping there is no host listener and nothing for the internet — or the VPS's own
network neighbours — to reach. The app connects over the `wbos-prod` container network as `db:5432`.

This is stronger than binding to `127.0.0.1:5432`: even a local process on the VPS cannot reach the
database without going through Docker.

```dotenv
DATABASE_URL="postgresql://wbos:CHANGE-ME@db:5432/wbos?schema=public"
```

`db` is the compose **service name**, resolved by Docker's internal DNS. The credentials must match
`POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` in the same `.env`.

Connections still require a password (`scram-sha-256`), so a compromised sibling container cannot
connect anonymously.

Operator access, when you need a shell:

```bash
docker compose -f docker-compose.prod.yml exec db psql -U wbos wbos
```

Verify nothing is listening, from the VPS and then from outside it:

```bash
ss -tlnp | grep 5432                 # expect no output on the host
nc -vz -w 5 <vps-public-ip> 5432     # must time out or be refused
```

VPS firewall — allow only what is public:

```bash
sudo ufw allow 22/tcp     # SSH (consider restricting to your own IP)
sudo ufw allow 80/tcp     # HTTP -> HTTPS redirect + ACME
sudo ufw allow 443/tcp    # HTTPS
sudo ufw allow 443/udp    # HTTP/3
sudo ufw enable
```

Note that Docker's published ports bypass `ufw` by writing directly to iptables — which is precisely why
the database publishes nothing and the app publishes on `127.0.0.1` only. The firewall is a second layer,
not the primary control.

### 5.2 Keeping `DATABASE_URL` configurable

Nothing in the app assumes a local database; it reads `DATABASE_URL` like any other setting. Only
`depends_on` in the compose file ties the app to the `db` service. To move to a managed PostgreSQL later,
point `DATABASE_URL` elsewhere and drop the `db` service and its `depends_on` block — no code changes.

The startup wait (`WBOS_DB_WAIT_SECONDS`, default 90s) works either way: it covers a slow database start
after a VPS reboot as readily as a remote endpoint coming back.

### 5.3 If the database is unavailable while the app is up

| When | Behavior |
| ---- | -------- |
| At container start | The entrypoint waits up to `WBOS_DB_WAIT_SECONDS` for `pg_isready`, then exits non-zero. `restart: unless-stopped` retries, so the app self-heals once the database is accepting connections — no manual deploy needed. `depends_on: condition: service_healthy` already handles the normal boot ordering. |
| While running | Requests that touch the database fail. `/api/health` reports `database.ok: false` and returns 503; the container is marked unhealthy but is **not** killed, so it recovers by itself. |
| Alerting | `scripts/health-alert.sh` (host cron) raises **"Database is DOWN"** and sends a recovery notice when it clears. It runs on the host and polls the loopback port, so it still fires when the app is unhealthy. |
| Caddy | Keeps serving TLS and returns 502 for app requests. Certificates renew independently of the database. |

There is no local write buffer — WBOS is not usable while its database is down. Co-locating the database
removes the network as a failure mode: the realistic remaining causes are the VPS itself being down (which
takes everything anyway) or a full disk, which `/api/health` already alerts on.

### 5.4 Backups: on-host job, off-host copy

Because everything runs on one VPS, **off-host backup replication is what makes the deployment
recoverable**. A VPS loss otherwise takes the app, the database, the uploads and the backups together.

- Backup jobs run **on the VPS**. A package contains the database dump *and* `WBOS_STORAGE_ROOT/uploads`,
  and both live here.
- The app image ships `postgresql-client-17`, so in-app **Create Backup Now** works with no host setup.
  For host cron (`backup-package.sh`), either install `postgresql-client-17` on the VPS or run the script
  inside the container:

  ```bash
  docker compose -f docker-compose.prod.yml exec -T app ./scripts/backup-package.sh
  ```

- `scripts/sync-backups.sh` then copies packages to **separate storage** — object storage (S3/B2 via
  rclone) or a NAS. This is not optional in a single-VPS design; it is the whole disaster-recovery story.
  Configure `WBOS_BACKUP_SYNC_TARGET` and wire the cron line in §8.
- `scripts/restore-test.sh` creates and drops a scratch database on the same server, so the configured
  user needs `CREATEDB` (the compose `POSTGRES_USER` is a superuser and satisfies this). It never touches
  the production database.
- Off-site storage credentials should be **write/append-oriented** where the provider supports it, so a
  compromised VPS cannot delete the backup history. Note that `sync-backups.sh` mirrors with `--delete`,
  so local retention is the source of truth — consider provider-side versioning or object lock.

### 5.5 What is publicly exposed

| Port | Exposure | Purpose |
| ---- | -------- | ------- |
| 443 | **Public** | HTTPS — the only public entry point |
| 80 | **Public** | HTTP → HTTPS redirect + ACME challenge |
| 22 | Public (restrict by IP if possible) | SSH administration |
| 3005 | `127.0.0.1` only | Operator/health-cron access to the app |
| 5432 | **Not published** | PostgreSQL — container network only |

### 5.6 The homelab is development only

The homelab PostgreSQL stays exactly as it is and is **not** a production dependency. Point a development
`.env` at it; production never reaches outside the VPS.

One observation, not a production blocker: that instance currently publishes `0.0.0.0:5432`, so it accepts
connections on every interface of the homelab host. That is fine on a trusted LAN behind a router that
forwards nothing, but it would be exposed if the host ever gets a public address or the router forwards
5432. Worth a look when convenient — it does not affect the production VPS.

## 6. TLS, origins and cookies

Caddy terminates TLS and obtains certificates automatically; there is no certbot cron. The hostname is
configuration (`WBOS_DOMAIN`), never hardcoded in the `Caddyfile`.

Prerequisites for a publicly trusted certificate:

- DNS `A`/`AAAA` for `WBOS_DOMAIN` → the app host's public IP.
- Ports 80 and 443 reachable from the internet (ACME uses 80).
- `WBOS_TLS` set to a real email address. Leave it as `internal` and Caddy issues a **self-signed**
  certificate from its own CA — fine for LAN or rehearsal, browser warnings in production.

Certificates and the ACME account key live in the `caddy_data` volume. **Do not delete it** — re-issuing
repeatedly can hit Let's Encrypt rate limits.

Three settings must agree, or authentication breaks in confusing ways:

| Setting | Value | Why |
| ------- | ----- | --- |
| `WBOS_DOMAIN` | `wbos.example.com` | What Caddy serves and requests a certificate for |
| `BETTER_AUTH_URL` | `https://wbos.example.com` | Better Auth marks the session cookie **Secure** only when this is `https`, and validates origins against it |
| `BETTER_AUTH_TRUSTED_ORIGINS` | `https://wbos.example.com` | Consulted once CSRF/origin validation is enabled |

With `BETTER_AUTH_DISABLE_CSRF="0"` the origin check is active — see `CSRF_DECISION.md`. If
`BETTER_AUTH_TRUSTED_ORIGINS` is then empty or wrong, sign-in returns **403 `INVALID_ORIGIN`** and the
server log names the origin it rejected. Startup validation fails fast on that combination rather than
letting you discover it at the sign-in screen.

Client-IP handling: Caddy **appends** the real client address to any `X-Forwarded-For` the caller sent, so
the rightmost entry is the trustworthy one. That is one hop, hence `WBOS_TRUSTED_PROXY_HOPS=1`. Adding
Cloudflare or a load balancer in front means **two** hops — increment it, or per-IP rate limiting keys on
the wrong address.

## 6b. SMTP and password recovery

Without SMTP there is **no way to recover a forgotten password** — WBOS has no other reset path, so a
forgotten owner password is an unrecoverable lockout. Configuring it is strongly recommended before
go-live.

`WBOS_SMTP_HOST` is the switch:

| State | Behavior |
| ----- | -------- |
| Unset | Password recovery is off. The app runs normally; `/forgot-password` says recovery is unavailable rather than pretending to send mail. Startup logs a warning. |
| Set and complete | Recovery enabled. Startup logs `Password recovery enabled via SMTP <host>:<port>`. |
| Set but incomplete | Startup **fails** and names the missing variables. A half-configured mailer would otherwise only reveal itself when someone is already locked out. |

```dotenv
WBOS_SMTP_HOST="smtp.example.com"
WBOS_SMTP_PORT="587"                                # 587 STARTTLS (default) / 465 implicit TLS
WBOS_SMTP_FROM="WBOS <no-reply@yourdomain.com>"     # required
WBOS_SMTP_USER="apikey"                             # optional, but with PASSWORD
WBOS_SMTP_PASSWORD="..."                            # never committed; .env only
# WBOS_RESET_TOKEN_TTL_SECONDS="3600"               # link lifetime, default 1 hour
```

The integration is plain SMTP via Nodemailer with no provider-specific code, so any SMTP service works
(Resend, Postmark, SES, Mailgun, Fastmail, Google Workspace). The `From` address must be one the provider
is allowed to send as, or mail will be silently dropped or spam-filed — check SPF/DKIM for your domain.

### Example: Resend (the chosen production provider)

```dotenv
WBOS_SMTP_HOST="smtp.resend.com"
WBOS_SMTP_PORT="465"                                 # implicit TLS; 587 for STARTTLS
WBOS_SMTP_USER="resend"                              # literally the word "resend"
WBOS_SMTP_PASSWORD="re_..."                          # the Resend API key — from the secret store
WBOS_SMTP_FROM="WBOS <no-reply@yourdomain.com>"      # must be on a domain verified in Resend
```

Nothing here is Resend-specific in code — these are the same four variables any provider uses, so
switching later is a configuration change with no redeploy of application logic.

Two provider-side prerequisites, both needing the real domain:

1. **Verify the sending domain in Resend** and publish the SPF/DKIM records it gives you. Until that is
   done, mail either fails outright or lands in spam.
2. **`WBOS_SMTP_FROM` must match a verified domain.** A `From` on an unverified domain is rejected.

The API key is a credential: inject it from the production secret store into the container environment.
It must never be committed — `.env` is gitignored, and nothing in the repository contains a real value.

**Verify before go-live** — this connects, authenticates, and optionally sends a real message:

```bash
docker compose -f docker-compose.prod.yml exec -T app node scripts/smtp-check.mjs you@example.com
```

Exit codes: `0` OK · `1` misconfigured or delivery failed · `2` SMTP intentionally disabled.

### The flow

1. `/sign-in` → **Forgot password?** → `/forgot-password`.
2. The user submits an email. The response is identical whether or not the address is registered — WBOS
   never discloses which emails have accounts.
3. Better Auth mints a single-use token and emails a link to
   `https://<domain>/api/auth/reset-password/<token>?callbackURL=/reset-password`.
4. Following it validates the token and redirects to `/reset-password?token=…`, or to
   `?error=INVALID_TOKEN` if it has expired or been used.
5. Setting a new password revokes **every existing session** for that user
   (`revokeSessionsOnPasswordReset`), so a stolen session cannot outlive the recovery.

Tokens are single-use and expire after `WBOS_RESET_TOKEN_TTL_SECONDS` (default 1 hour). The email states
the same lifetime it enforces. Rate limits already cover these endpoints: 5/60s per IP on
`request-password-reset`, 10/60s per IP on `reset-password`.

Mobile is unaffected: Bearer requests send no cookie, so the origin check skips them and password
recovery changes nothing about the mobile authentication model.

## 7. First deploy from a dev machine

`../scripts/deploy.sh` runs the full gate and a pre-deploy backup:

```bash
cd /srv/wbos
WBOS_DATABASE_URL="$DATABASE_URL" WBOS_BACKUP_DIR=/srv/wbos/backups \
WBOS_STORAGE_ROOT=/srv/wbos/storage WBOS_BACKUP_SYNC_TARGET=... \
  ./scripts/deploy.sh
```

Steps: unit tests → typecheck → lint → pre-deploy backup (`backup-package.sh`) → `npm run build` → compose up →
health poll → optional off-host sync. Use `--skip-tests` once trusted.

## 8. Backups

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

The VPS needs `postgresql-client-17` + `tar` for host cron (see PRODUCTION_READINESS "Backup
dependencies"). The `db` service publishes no port, so a host-run `pg_dump` cannot reach it — either
run the script inside the app container, which already has the right client and network access:

```cron
0 2 * * * cd /srv/wbos && docker compose -f docker-compose.prod.yml exec -T app ./scripts/backup-package.sh
```

…or add a temporary `127.0.0.1:5432:5432` mapping to the `db` service if you prefer host-side dumps.
Running it in the container is the recommended option: fewer moving parts, no host listener, and a
guaranteed client/server version match.

### Off-host — mandatory on a single VPS

`sync-backups.sh` mirrors `packages/` to object storage (`s3://` via rclone), a NAS (`rsync://`), or a
second mount (`file://`).

With everything on one VPS, this is **the entire disaster-recovery story**: without it, losing the VPS
loses the app, the database, the uploads and the backups in one stroke. Treat the off-host copy as a
launch blocker, not a nice-to-have.

Two cautions:

- The sync is a **mirror** (`--delete`), so anything deleted locally is deleted remotely. Local retention
  is the source of truth.
- Because the VPS holds credentials that can delete the remote copy, prefer a target with versioning or
  object-lock (S3/B2) so a compromised or misbehaving host cannot erase the backup history.

### Verify

- `/health` page: Backups block (freshness < 48h), Backup Tools ✓, Last Restore Test, Disk blocks for storage +
  backups (>= 10% free).
- Perform a real restore at least once before go-live and record it in PRODUCTION_READINESS **Restore Verification**.

## 9. Updates / rollback

```bash
cd /srv/wbos
WBOS_DATABASE_URL="$DATABASE_URL" WBOS_BACKUP_DIR=/srv/wbos/backups \
WBOS_STORAGE_ROOT=/srv/wbos/storage ./scripts/deploy.sh    # backups first
docker compose -f docker-compose.prod.yml pull              # new image
docker compose -f docker-compose.prod.yml up -d
```

Rollback: set `WBOS_IMAGE_TAG=<previous-sha>` and re-run `up -d`, then, if the migration failed, restore
the pre-deploy backup (Settings → Backup & Restore → Restore, type `RESTORE`). A failed migration aborts
container startup rather than running against a half-migrated database, so the pre-deploy backup is a
valid restore point.

## 10. Day-0 checklist (fresh VPS from scratch)

**Infrastructure**
- [ ] VPS provisioned; Docker Engine ≥ 24 + Compose v2, `curl`, `rsync` installed
- [ ] `ufw` allows 22/80/443 only; verify `nc -vz <vps-ip> 5432` times out (§5.1)
- [ ] `docker network create wbos-prod` (once)

**Configuration**
- [ ] `.env` created with real secrets (`BETTER_AUTH_SECRET` from `openssl rand -hex 32`)
- [ ] `DATABASE_URL` points at `db:5432`; `POSTGRES_*` match it
- [ ] `WBOS_DOMAIN` set; DNS A/AAAA → VPS public IP; ports 80/443 reachable
- [ ] `WBOS_TLS` set to a real email (not `internal`) for a publicly trusted certificate
- [ ] `BETTER_AUTH_URL` and `BETTER_AUTH_TRUSTED_ORIGINS` both set to `https://<domain>`
- [ ] `BETTER_AUTH_DISABLE_CSRF="0"` (see §6 and `CSRF_DECISION.md`)
- [ ] `WBOS_TRUSTED_PROXY_HOPS=1` (increment only if another proxy sits in front of Caddy)

**Bring-up**
- [ ] `docker compose -f docker-compose.prod.yml pull && up -d`; all three services healthy
- [ ] `curl -sI http://<domain>/` returns 308 to https
- [ ] `https://<domain>/sign-in` loads with a valid certificate
- [ ] `curl http://127.0.0.1:3005/api/health` healthy; `/health` page all green when signed in
- [ ] `https://<domain>/api/health` returns 404 (not published through the proxy)
- [ ] Container logs show no `Invalid origin:` errors after a sign-in

**Data safety — do not skip on a single-VPS deployment**
- [ ] Backup cron installed (`crontab -l`) and a package appears under `backups/packages`
- [ ] Off-host sync configured and verified: a package is readable **from the remote storage**
- [ ] A restore test executed against a real package and recorded in PRODUCTION_READINESS
- [ ] Alerting channel configured; `./scripts/health-alert.sh --test` delivers a message

**Go-live — establish the first OWNER**
- [ ] Set `WBOS_BOOTSTRAP_OWNER_EMAIL` in `.env` to the intended owner's email **before** anyone signs up
- [ ] That person signs up at `https://<domain>/sign-up` and completes onboarding
- [ ] **Verify the membership exists** (below) — do not skip this; a missing membership looks like an
      authentication bug rather than a setup step
- [ ] Mobile app pointed at `https://<domain>` and signed in successfully

### First-owner verification (exact step)

Run this immediately after the owner signs in. It is the single check that proves Day-0 onboarding
succeeded:

```bash
docker compose -f docker-compose.prod.yml exec -T db psql -U wbos -d wbos -c \
  'SELECT u.email, m.role, m."organizationId"
     FROM "user" u
     LEFT JOIN organization_memberships m ON m."userId" = u.id
    ORDER BY u."createdAt";'
```

Expected — exactly one row, with a role:

```
        email         | role  |  organizationId
----------------------+-------+-------------------
 owner@yourdomain.com | OWNER | bootstrap-org-001
```

A row with an empty `role` means that account has **no membership**: the web UI will bounce it to
`/onboarding`, and every org-scoped API call — `/api/v1/auth/me` and everything the mobile app uses —
returns **401 Unauthorized**.

Equivalent check from the application side, using a bearer token from a mobile sign-in:

```bash
curl -s https://<domain>/api/v1/auth/me -H "Authorization: Bearer <token>"
# expect: {"role":"OWNER","organizationName":"...", ...}   not {"error":"Unauthorized"}
```

### Fixing a missing owner

`prisma/seed.mjs` reconciles ownership on **every** run, including when the organization already exists,
so re-running it is the supported repair:

```bash
# Name the intended owner explicitly, then re-run the seed
docker compose -f docker-compose.prod.yml exec -T \
  -e WBOS_BOOTSTRAP_OWNER_EMAIL=owner@yourdomain.com app node prisma/seed.mjs
```

It resolves the owner deterministically and tells you exactly what it did:

| Situation | Behavior |
| --------- | -------- |
| `WBOS_BOOTSTRAP_OWNER_EMAIL` set and that user exists | Attaches them as OWNER |
| `WBOS_BOOTSTRAP_OWNER_EMAIL` set, user has not signed up yet | Says so; sign up, then re-run |
| Not set, exactly one user exists | Attaches that user (unambiguous) |
| Not set, several users exist | **Refuses to guess** and tells you to set the variable |
| The user already has a membership | No-op, reports the existing role |

### Who else can join

Once the organization has an owner, a new signup is **not** auto-attached: onboarding returns
"This workspace already has an owner." This is deliberate — sign-up is reachable by anyone who can load
the public HTTPS URL, and auto-attaching granted OWNER (ledgers, backups, restore) to whoever signed up.

To add a second team member today, name them in `WBOS_BOOTSTRAP_OWNER_EMAIL` and re-run the seed as
above — note that this grants **OWNER**, so it suits a co-owner rather than a warehouse user. Proper
role-scoped user management is not built yet; see PRODUCTION_READINESS **Operations**.

## 11. Release gate

Run before every deploy — see **Release gate** in PRODUCTION_READINESS.md. `scripts/deploy.sh` automates tests +
typecheck + lint + pre-deploy backup + image pull + up + health.

## 12. PostgreSQL major version

The project standardizes on **PostgreSQL 17** everywhere:

| Where | Pin |
| ----- | --- |
| Production database | `docker-compose.prod.yml` → `${POSTGRES_IMAGE:-postgres:17-alpine}` |
| CI end-to-end tests | `.github/workflows/docker.yml` → `postgres:17` service |
| Client tools in the app image | `Dockerfile` → `postgresql-client-17` from the PostgreSQL APT repo, pinned by `ARG EXPECTED_PG_MAJOR` |
| Restore rehearsals | `scripts/restore-test.sh`, run inside the app container |

**Why it must be one version:** `pg_dump` **refuses** to dump from a server newer
than itself, and `pg_restore` cannot reliably load a dump into a server older
than the `pg_dump` that produced it. Either way a client/server split breaks
backups — and it breaks them where you are least likely to look until a disaster.

**This was a live defect, not a hypothetical.** The image previously installed
Debian's `postgresql-client` meta-package, which tracks the *base image's*
release: `node:24-slim` is bookworm, so the image shipped client **15** while the
database was 16/17. Every backup attempt in production would have failed with a
server-version mismatch. The Dockerfile now installs `postgresql-client-17`
explicitly from the PostgreSQL APT repository and **fails the build** if the
installed major is not 17 — which is exactly how the defect surfaced.

`scripts/startup-validate.js` additionally compares `pg_dump`'s major against
`SHOW server_version` on every boot and warns on a mismatch. It warns rather
than fails: the mismatch threatens restore, not runtime, and refusing to boot
would turn a latent DR risk into an immediate outage.

`scripts/startup-validate.js` compares `pg_dump`'s major version against
`SHOW server_version` on every boot and warns on a mismatch. It warns rather
than fails: the mismatch threatens restore, not runtime, and refusing to boot
would turn a latent DR risk into an immediate outage.

### ⚠ Changing the major version on an existing deployment

PostgreSQL **refuses to start** on a data directory written by a different major
version. Swapping the image alone will not work — the container will crash-loop.
To move an existing database between majors:

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

Keep the old volume until the new stack is verified and a fresh backup has passed
a restore test. **If WBOS has not gone live yet, none of this applies** — the
current pin is already 17, so a fresh install just starts on 17.
