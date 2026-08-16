#!/usr/bin/env bash
set -euo pipefail

# WBOS Restore Test
#
# Restores a WBOS backup package (the single-file format produced by the
# Backup & Restore settings page / scripts/backup-package.sh) into a THROWAWAY
# database, verifies the data is intact, and records the result. It never
# touches the real production database.
#
# Usage:
#   ./scripts/restore-test.sh <package.tar.gz>
#   ./scripts/restore-test.sh <package.tar.gz> --keep-scratch
#   ./scripts/restore-test.sh <package.tar.gz> --scratch-db <name>
#
# Options:
#   --keep-scratch     keep the scratch database after the test (default: drop)
#   --scratch-db <name> override the scratch database name
#
# Environment:
#   WBOS_DATABASE_URL / DATABASE_URL   PostgreSQL connection string of a server
#                                      you may create/drop databases on.
#   WBOS_BACKUP_DIR                    backup root; the test result is appended
#                                      to restore-history.json here (JSONL,
#                                      same file the Settings UI reads)
#                                      (default ./backups)
#
# Recommended execution (tooling guaranteed):
#   docker compose exec -T app ./scripts/restore-test.sh /app/backups/packages/wbos-backup-*.tar.gz
#
# Exit codes: 0 = restore verified OK · 1 = error · 2 = package not found

PACKAGE="${1:-}"
if [ -z "$PACKAGE" ]; then
  echo "Usage: $0 <package.tar.gz> [--keep-scratch] [--scratch-db <name>]" >&2
  exit 2
fi
if [ ! -f "$PACKAGE" ]; then
  echo "Error: package not found: $PACKAGE" >&2
  exit 2
fi

KEEP_SCRATCH=0
SCRATCH_DB=""
shift || true
while [ "$#" -gt 0 ]; do
  case "$1" in
    --keep-scratch) KEEP_SCRATCH=1; shift ;;
    --scratch-db) SCRATCH_DB="${2:?--scratch-db requires a name}"; shift 2 ;;
    *) echo "Error: unknown argument: $1" >&2; exit 1 ;;
  esac
done

DATABASE_URL="${WBOS_DATABASE_URL:-${DATABASE_URL:-}}"
if [ -z "$DATABASE_URL" ]; then
  echo "Error: WBOS_DATABASE_URL (or DATABASE_URL) is required." >&2
  exit 1
fi

BACKUP_ROOT="${WBOS_BACKUP_DIR:-./backups}"
HISTORY_FILE="$BACKUP_ROOT/restore-history.json"
STAGING=""
RESULT="failed"
REASON="test did not complete"
RECORDED=0
DUMP_OBJECTS=0
RESTORED_ORGS=0
UPLOADS_RESTORED="n/a"

# Append one JSONL record to restore-history.json — the same file the Settings
# UI (Last Restore Test) and /api/health read.
#
# This runs for FAILURES as well as successes. A failed restore test that is
# never recorded leaves the last successful run showing in the UI, so the one
# signal that is supposed to prove the backups work would keep saying "PASS"
# while the restore path is broken.
record_result() {
  # Plain `if` rather than `[ ... ] && return 0`: under `set -e` a false test
  # makes the AND-list return non-zero, which can abort the caller.
  if [ "$RECORDED" = "1" ]; then
    return 0
  fi
  RECORDED=1
  local record
  record=$(node -e '
    const entry = {
      at: new Date().toISOString(),
      packageName: process.argv[1],
      packageBytes: Number(process.argv[2]),
      result: process.argv[3],
      performedBy: "restore-test.sh",
      dumpObjects: Number(process.argv[4]),
      restoredOrganizations: Number(process.argv[5]),
      uploadsFiles: process.argv[6] === "n/a" ? null : Number(process.argv[6]),
      database: process.argv[7],
      reason: process.argv[8] || null,
    };
    process.stdout.write(JSON.stringify(entry));
  ' "$(basename "$PACKAGE")" "$(stat -c%s "$PACKAGE" 2>/dev/null || stat -f%z "$PACKAGE" 2>/dev/null || echo 0)" \
    "$RESULT" "$DUMP_OBJECTS" "$RESTORED_ORGS" "$UPLOADS_RESTORED" "${SCRATCH_DB:-}" "$REASON" 2>/dev/null) || return 0
  mkdir -p "$(dirname "$HISTORY_FILE")" 2>/dev/null || return 0
  printf '%s\n' "$record" >> "$HISTORY_FILE" 2>/dev/null || return 0
  echo "  Recorded ($RESULT) in: $HISTORY_FILE"
}

# Cleanup runs even on failure: record the outcome, drop the scratch DB, and
# remove staging.
cleanup() {
  local code=$?
  if [ "$code" -ne 0 ] && [ "$RESULT" != "success" ]; then
    echo ""
    echo "=== RESTORE TEST FAILED ==="
    echo "  Reason: $REASON"
  fi
  record_result
  if [ -n "${SCRATCH_URL:-}" ] && [ "$KEEP_SCRATCH" = "0" ]; then
    psql "$ADMIN_URL" -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS \"$SCRATCH_DB\";" >/dev/null 2>&1 \
      && echo "  Dropped scratch database: $SCRATCH_DB" || true
  fi
  if [ -n "${STAGING:-}" ] && [ -d "$STAGING" ]; then
    rm -rf "$STAGING"
  fi
  exit "$code"
}
trap cleanup EXIT

command -v pg_restore >/dev/null 2>&1 || { echo "Error: pg_restore not found." >&2; exit 1; }
command -v psql >/dev/null 2>&1 || { echo "Error: psql not found." >&2; exit 1; }
command -v tar >/dev/null 2>&1 || { echo "Error: tar not found." >&2; exit 1; }
command -v node >/dev/null 2>&1 || { echo "Error: node not found (needed for manifest parsing)." >&2; exit 1; }

# Base URL without Prisma-only query params (?schema=... etc), which psql and
# pg_restore reject.
BASE_URL="${DATABASE_URL%%\?*}"
# Server we use to CREATE/DROP the scratch DB. Prefer the URL's own database;
# fall back to the maintenance 'postgres' database if it does not exist.
ADMIN_URL="$BASE_URL"
psql "$ADMIN_URL" -c "SELECT 1;" >/dev/null 2>&1 || ADMIN_URL="${BASE_URL%/*}/postgres"

if [ -z "$SCRATCH_DB" ]; then
  SCRATCH_DB="wbos_restoretest_$(date +%Y%m%d_%H%M%S)"
fi
SCRATCH_URL="${BASE_URL%/*}/${SCRATCH_DB}"

echo "=== WBOS Restore Test: $(date) ==="
echo "  Package:   $PACKAGE ($(ls -lh "$PACKAGE" | awk '{print $5}'))"
echo "  Scratch DB: $SCRATCH_DB"

STAGING=$(mktemp -d)
echo "--- 1/6 Extract package ---"
tar xzf "$PACKAGE" -C "$STAGING"
PACKAGE_DIR=$(find "$STAGING" -maxdepth 1 -type d -name 'wbos-backup-*' | head -1)
if [ -z "$PACKAGE_DIR" ]; then
  REASON="package does not contain a wbos-backup-* directory"
  echo "Error: $REASON." >&2
  exit 1
fi

echo "--- 2/6 Read manifest ---"
MANIFEST=$(node -e '
  const fs = require("fs");
  const p = process.argv[1];
  const m = JSON.parse(fs.readFileSync(p, "utf8"));
  console.log(JSON.stringify({ formatVersion: m.formatVersion, appVersion: m.appVersion,
    dbFile: m.database.file, dbBytes: m.database.bytes,
    uploadsFile: m.uploads ? m.uploads.file : "", uploadsBytes: m.uploads ? m.uploads.bytes : 0 }));
' "$PACKAGE_DIR/manifest.json")
DB_FILE=$(echo "$MANIFEST" | node -e 'const d=JSON.parse(require("fs").readFileSync(0,"utf8"));process.stdout.write(d.dbFile)')
UPLOADS_FILE=$(echo "$MANIFEST" | node -e 'const d=JSON.parse(require("fs").readFileSync(0,"utf8"));process.stdout.write(d.uploadsFile)')
echo "  formatVersion: $(echo "$MANIFEST" | node -e 'const d=JSON.parse(require("fs").readFileSync(0,"utf8"));process.stdout.write(String(d.formatVersion))')"
echo "  appVersion:    $(echo "$MANIFEST" | node -e 'const d=JSON.parse(require("fs").readFileSync(0,"utf8"));process.stdout.write(String(d.appVersion))')"

DUMP_FILE="$PACKAGE_DIR/$DB_FILE"
if [ ! -f "$DUMP_FILE" ]; then
  REASON="database dump missing in package: $DB_FILE"
  echo "Error: $REASON" >&2
  exit 1
fi

echo "--- 3/6 Verify dump readable (pg_restore --list) ---"
REASON="dump is unreadable (pg_restore --list failed)"
DUMP_OBJECTS=$(pg_restore --list "$DUMP_FILE" | grep -v '^;' | grep -v '^$' | wc -l | tr -d ' ')
echo "  Dump objects listed: $DUMP_OBJECTS"
if [ "$DUMP_OBJECTS" -eq 0 ]; then
  REASON="dump is unreadable (pg_restore --list produced no objects)"
  echo "Error: $REASON." >&2
  exit 1
fi

echo "--- 4/6 Create scratch database ---"
REASON="could not create scratch database (does the DB user have CREATEDB?)"
psql "$ADMIN_URL" -v ON_ERROR_STOP=1 -c "CREATE DATABASE \"$SCRATCH_DB\";" >/dev/null
echo "  Created: $SCRATCH_DB"

echo "--- 5/6 Restore into scratch database ---"
REASON="pg_restore failed while restoring the dump into the scratch database"
pg_restore --clean --if-exists --no-owner --no-privileges -d "$SCRATCH_URL" "$DUMP_FILE"
REASON="restore completed but the Organization table could not be queried"
RESTORED_ORGS=$(psql "$SCRATCH_URL" -At -c 'SELECT count(*) FROM "Organization";' | tr -d ' ')
echo "  Restore OK. Organizations in scratch DB: $RESTORED_ORGS"

if [ -n "$UPLOADS_FILE" ]; then
  REASON="uploads archive present in the manifest but could not be extracted"
  UPLOADS_STAGE="${STAGING}/uploads-out"
  mkdir -p "$UPLOADS_STAGE"
  tar xzf "$PACKAGE_DIR/$UPLOADS_FILE" -C "$UPLOADS_STAGE"
  UPLOADS_RESTORED=$(find "$UPLOADS_STAGE" -type f | wc -l | tr -d ' ')
  echo "  Uploads archive restored, files: $UPLOADS_RESTORED"
fi

echo "--- 6/6 Record result ---"
RESULT="success"
REASON=""
record_result

if [ "$KEEP_SCRATCH" = "0" ]; then
  echo ""
  echo "=== RESTORE TEST PASSED ==="
  echo "  Package restored + verified into scratch DB and dropped."
  echo "  Result recorded in: $HISTORY_FILE"
else
  echo ""
  echo "=== RESTORE TEST PASSED (scratch DB kept: $SCRATCH_DB) ==="
  echo "  Result recorded in: $HISTORY_FILE"
fi
