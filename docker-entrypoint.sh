#!/bin/sh
set -e

echo ""
echo "=========================================="
echo "  WBOS — Storage Validation"
echo "=========================================="

STORAGE_ROOT="${WBOS_STORAGE_ROOT:-/app/public}"
BACKUP_ROOT="${WBOS_BACKUP_DIR:-/app/backups}"
UID_CURRENT=$(id -u)
GID_CURRENT=$(id -g)

validate_dir() {
  DIR="$1"
  LABEL="$2"
  if [ -d "$DIR" ]; then
    echo "  ✓ $LABEL exists"
    if [ -w "$DIR" ]; then
      echo "  ✓ $LABEL is writable"
    else
      echo "  ✗ $LABEL is NOT writable"
      echo "    Path: $DIR"
      echo "    Running as: uid=$UID_CURRENT gid=$GID_CURRENT"
      FAIL=1
    fi
  else
    mkdir -p "$DIR" 2>/dev/null && echo "  ✓ $LABEL created" || {
      echo "  ✗ $LABEL could not be created"
      echo "    Path: $DIR"
      echo "    Running as: uid=$UID_CURRENT gid=$GID_CURRENT"
      FAIL=1
    }
    if [ -w "$DIR" ]; then
      echo "  ✓ $LABEL is writable"
    fi
  fi
}

FAIL=0

validate_dir "$STORAGE_ROOT" "Storage root"
validate_dir "${STORAGE_ROOT}/uploads" "Uploads directory"

# Backup subdirectories for tiered retention
for subdir in daily weekly monthly yearly uploads; do
  validate_dir "${BACKUP_ROOT}/${subdir}" "${subdir} backup directory"
done

if [ "$FAIL" -ne 0 ]; then
  echo ""
  echo "  ✗ Storage validation FAILED."
  echo ""
  echo "  On fresh deployments, fix permissions:"
  echo "    mkdir -p storage backups"
  echo "    sudo chown -R 1001:1001 storage backups"
  echo "    sudo chmod -R 775 storage backups"
  echo ""
  exit 1
fi

echo ""
echo "  ✓ Storage validation passed."
echo "=========================================="
echo ""

# Wait for the database before validating or migrating.
#
# In production the database is the `db` service on the same VPS and compose
# already gates startup on its healthcheck, but "not reachable yet" is still a
# normal transient state — after a VPS reboot, or when DATABASE_URL points at a
# database somewhere else. Without this the container would crash-loop through
# startup validation while PostgreSQL finishes coming up.
#
# This is a bounded wait: if the database is genuinely gone we still exit
# non-zero, and the restart policy keeps retrying with backoff.
DB_WAIT_SECONDS="${WBOS_DB_WAIT_SECONDS:-90}"
if [ -n "${DATABASE_URL:-}" ] && [ "$DB_WAIT_SECONDS" -gt 0 ] 2>/dev/null; then
  echo "[entrypoint] Waiting up to ${DB_WAIT_SECONDS}s for the database..."
  DB_WAITED=0
  # Strip Prisma-only query params (?schema=...) that pg_isready does not accept.
  DB_CONN="${DATABASE_URL%%\?*}"
  while ! pg_isready -d "$DB_CONN" >/dev/null 2>&1; do
    if [ "$DB_WAITED" -ge "$DB_WAIT_SECONDS" ]; then
      echo ""
      echo "  ✗ Database not reachable after ${DB_WAIT_SECONDS}s."
      echo "    Check DATABASE_URL, that the db service is running and healthy"
      echo "    (docker compose ps), and that the host in DATABASE_URL matches"
      echo "    the compose service name (db) rather than localhost."
      echo "    See docs/PRODUCTION_DEPLOYMENT.md §5."
      echo ""
      exit 1
    fi
    sleep 3
    DB_WAITED=$((DB_WAITED + 3))
  done
  echo "  ✓ Database reachable after ${DB_WAITED}s"
fi

# Validate environment + backup tools (fails fast on missing pieces)
echo "[entrypoint] Running startup validation..."
if ! node /app/scripts/startup-validate.js; then
  echo ""
  echo "  ✗ Startup validation FAILED. See messages above."
  echo ""
  exit 1
fi

# Apply database migrations.
#
# This must FAIL the container on error. Do not pipe `prisma migrate deploy`
# into grep: a pipeline reports the exit status of the LAST command, so a failed
# migration would look successful and the app would boot against a half-migrated
# database. Capture the output, check the real exit code, then filter for noise.
echo "[entrypoint] Running database migrations..."
MIGRATE_LOG=$(mktemp)
set +e
# NOTE: no --skip-generate. `prisma migrate deploy` does not accept that flag
# (only `migrate dev` does) and exits with a usage error if given it. Combined
# with the old `| grep … || true` pipeline this meant migrations had NEVER been
# applied by the entrypoint — the failure was swallowed and "Migrations
# complete." printed regardless. deploy does not run generate anyway; the client
# is generated at image build time.
npx prisma migrate deploy >"$MIGRATE_LOG" 2>&1
MIGRATE_STATUS=$?
set -e

if [ "$MIGRATE_STATUS" -ne 0 ]; then
  echo ""
  echo "=========================================="
  echo "  ✗ DATABASE MIGRATION FAILED (exit $MIGRATE_STATUS)"
  echo "=========================================="
  cat "$MIGRATE_LOG"
  rm -f "$MIGRATE_LOG"
  echo ""
  echo "  The application will NOT start against a half-migrated database."
  echo "  Restore the pre-deploy backup or fix the migration, then redeploy."
  echo ""
  exit 1
fi

grep -v "already exists" "$MIGRATE_LOG" || true
rm -f "$MIGRATE_LOG"
echo "[entrypoint] Migrations complete."

# Start the application
echo "[entrypoint] Starting WBOS..."
exec node server.js
