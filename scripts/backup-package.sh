#!/usr/bin/env bash
set -euo pipefail

# WBOS Single-Package Backup Script
# Usage: ./scripts/backup-package.sh [backup-root]
#
# Produces a single, version-aware package identical in shape to the one the
# Backup & Restore settings page creates:
#   <backup-root>/packages/wbos-backup-<YYYYMMDD_HHMMSS>.tar.gz
# containing:
#   wbos-backup-<ts>/manifest.json
#   wbos-backup-<ts>/config.json
#   wbos-backup-<ts>/database.dump      (pg_dump custom format)
#   wbos-backup-<ts>/uploads.tar.gz     (optional, if storage dir exists)
#
# This is the fallback / cross-platform equivalent to the tiered backup.sh and
# is intended to be run from cron without the app running.
#
# Environment variables:
#   WBOS_DATABASE_URL       — PostgreSQL connection string (required)
#   WBOS_BACKUP_DIR         — backup root (default ./backups)
#   WBOS_STORAGE_ROOT       — uploads directory to include (optional)
#   WBOS_APP_VERSION        — version recorded in the manifest (optional)

BACKUP_ROOT="${1:-${WBOS_BACKUP_DIR:-./backups}}"
STORAGE_ROOT="${WBOS_STORAGE_ROOT:-}"
DATABASE_URL="${WBOS_DATABASE_URL:-${DATABASE_URL:-}}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
PACKAGE_NAME="wbos-backup-${TIMESTAMP}"
PACKAGES_DIR="${BACKUP_ROOT}/packages"
MANIFEST_FILE="${PACKAGES_DIR}/${PACKAGE_NAME}/manifest.json"
CONFIG_FILE="${PACKAGES_DIR}/${PACKAGE_NAME}/config.json"

if [ -z "${DATABASE_URL}" ]; then
  echo "Error: WBOS_DATABASE_URL (or DATABASE_URL) is required." >&2
  exit 1
fi

command -v pg_dump >/dev/null 2>&1 || { echo "Error: pg_dump not found." >&2; exit 1; }

echo "=== WBOS Package Backup: $(date) ==="
echo "  Backup root: $BACKUP_ROOT"

mkdir -p "${PACKAGES_DIR}/${PACKAGE_NAME}"

# ── 1. Database dump (custom format, compressed) ─────────────────────────────
DUMP_FILE="${PACKAGES_DIR}/${PACKAGE_NAME}/database.dump"
echo "--- Database dump ---"
pg_dump -Fc --no-owner --no-privileges -f "$DUMP_FILE" "$DATABASE_URL"
DB_SIZE=$(ls -lh "$DUMP_FILE" | awk '{print $5}')
echo "  Saved: $DUMP_FILE ($DB_SIZE)"

# ── 2. Uploads archive (if storage exists) ───────────────────────────────────
UPLOADS_FILE=""
if [ -n "$STORAGE_ROOT" ] && [ -d "$STORAGE_ROOT" ] && [ "$(find "$STORAGE_ROOT" -mindepth 1 -maxdepth 1 2>/dev/null | head -c1)" ]; then
  echo "--- Uploads archive ---"
  UPLOADS_FILE="${PACKAGES_DIR}/${PACKAGE_NAME}/uploads.tar.gz"
  tar czf "$UPLOADS_FILE" -C "$(dirname "$STORAGE_ROOT")" "$(basename "$STORAGE_ROOT")"
  echo "  Saved: $UPLOADS_FILE ($(ls -lh "$UPLOADS_FILE" | awk '{print $5}'))"
else
  echo "  Skipped (directory empty or missing)"
fi

# ── 3. Config snapshot (non-secret) ──────────────────────────────────────────
cat > "$CONFIG_FILE" <<EOF
{
  "wbosStorageRoot": "${WBOS_STORAGE_ROOT:-}",
  "wbosBackupDir": "${WBOS_BACKUP_DIR:-}",
  "nodeEnv": "${NODE_ENV:-}"
}
EOF

# ── 4. Manifest ──────────────────────────────────────────────────────────────
MIGRATIONS="[]"
if [ -d "./prisma/migrations" ]; then
  MIGRATIONS=$(find ./prisma/migrations -maxdepth 1 -type d -name '20*' -printf '%f\n' 2>/dev/null | sort | jq -Rn '[inputs]' 2>/dev/null || echo "[]")
fi

UPLOADS_JSON="null"
if [ -n "$UPLOADS_FILE" ]; then
  UPLOADS_SIZE=$(ls -lh "$UPLOADS_FILE" | awk '{print $5}')
  UPLOADS_JSON="{\"file\":\"uploads.tar.gz\",\"bytes\":$(stat -c%s "$UPLOADS_FILE" 2>/dev/null || echo 0)}"
fi

DB_BYTES=$(stat -c%s "$DUMP_FILE" 2>/dev/null || echo 0)
cat > "$MANIFEST_FILE" <<EOF
{
  "formatVersion": 1,
  "appVersion": "${WBOS_APP_VERSION:-0.1.0}",
  "createdAt": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "database": { "file": "database.dump", "bytes": ${DB_BYTES}, "migrations": ${MIGRATIONS} },
  "uploads": ${UPLOADS_JSON},
  "config": { "file": "config.json" }
}
EOF
echo "  Manifest: $MANIFEST_FILE"

# ── 5. Package ───────────────────────────────────────────────────────────────
echo "--- Packaging ---"
tar czf "${PACKAGES_DIR}/${PACKAGE_NAME}.tar.gz" -C "${PACKAGES_DIR}" "$PACKAGE_NAME"
rm -rf "${PACKAGES_DIR}/${PACKAGE_NAME}"
echo "  Package: ${PACKAGES_DIR}/${PACKAGE_NAME}.tar.gz ($(ls -lh "${PACKAGES_DIR}/${PACKAGE_NAME}.tar.gz" | awk '{print $5}'))"

echo ""
echo "=== Backup complete ==="
