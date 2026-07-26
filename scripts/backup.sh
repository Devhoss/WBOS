#!/usr/bin/env bash
set -euo pipefail

# WBOS Tiered Backup Script
# Usage: ./scripts/backup.sh [backup-root]
#
# Produces tiered backups under <backup-root>/:
#   daily/   — last 7 kept
#   weekly/  — last 4 kept  (promoted every Sunday)
#   monthly/ — last 12 kept (promoted on 1st of month)
#   yearly/  — kept forever  (promoted on Dec 31)
#   uploads/ — last 7 kept  (optional, if storage dir exists)
#
# Environment variables:
#   WBOS_BACKUP_DIR        — backup root (default ./backups)
#   WBOS_STORAGE_ROOT      — uploads directory to include (optional)
#   DATABASE_URL           — PostgreSQL connection string
#
# shellcheck disable=SC2012

BACKUP_ROOT="${1:-${WBOS_BACKUP_DIR:-./backups}}"
STORAGE_ROOT="${WBOS_STORAGE_ROOT:-}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
DAY_OF_WEEK=$(date +"%u")          # 1=Mon … 7=Sun
DAY_OF_MONTH=$(date +"%d")         # 01-31
MONTH=$(date +"%m")                # 01-12
YEAR=$(date +"%Y")

# ── Directories ──────────────────────────────────────────────────────────────
DAILY_DIR="${BACKUP_ROOT}/daily"
WEEKLY_DIR="${BACKUP_ROOT}/weekly"
MONTHLY_DIR="${BACKUP_ROOT}/monthly"
YEARLY_DIR="${BACKUP_ROOT}/yearly"
UPLOADS_DIR="${BACKUP_ROOT}/uploads"
MANIFEST="${BACKUP_ROOT}/backup-manifest.json"

mkdir -p "$DAILY_DIR" "$WEEKLY_DIR" "$MONTHLY_DIR" "$YEARLY_DIR" "$UPLOADS_DIR"

# ── Helper: determine if today is the last day of the year ──────────────────
is_last_day_of_year() {
  [ "$MONTH" = "12" ] && [ "$DAY_OF_MONTH" = "31" ]
}

# ── Helper: tear-off a DB backup, return the file path ──────────────────────
take_db_backup() {
  local outdir="$1"
  local infix="${2:-db}"
  local filename="wbos_${infix}_${TIMESTAMP}.sql.gz"
  local outpath="${outdir}/${filename}"

  if [ -n "${DATABASE_URL:-}" ]; then
    pg_dump "$DATABASE_URL" | gzip > "$outpath"
  elif command -v docker &>/dev/null && docker ps --format '{{.Names}}' 2>/dev/null | grep -q wbos-db; then
    docker exec wbos-db pg_dump -U wbos wbos | gzip > "$outpath"
  else
    echo "Error: DATABASE_URL not set and no wbos-db container found."
    echo "Set DATABASE_URL or run inside the Docker network."
    return 1
  fi

  echo "$outpath"
}

# ── Helper: backup uploads directory ────────────────────────────────────────
take_uploads_backup() {
  local srcdir="$1"
  local outdir="$2"
  local filename="wbos_uploads_${TIMESTAMP}.tar.gz"
  local outpath="${outdir}/${filename}"

  if [ -d "$srcdir" ] && [ "$(find "$srcdir" -mindepth 1 -maxdepth 1 2>/dev/null | head -c1)" ]; then
    tar czf "$outpath" -C "$(dirname "$srcdir")" "$(basename "$srcdir")"
    echo "$outpath"
  else
    echo ""
  fi
}

# ── Helper: retention cleanup (keep newest N files) ─────────────────────────
retention_limit() {
  local dir="$1"
  local keep="$2"
  local pattern="${3:-wbos_db_*.sql.gz}"
  if [ -d "$dir" ]; then
    ls -t "${dir}/${pattern}" 2>/dev/null | tail -n +$((keep + 1)) | while read -r f; do
      rm -f "$f"
      echo "  Pruned: $f"
    done
  fi
}

# ── Helper: record this run in the manifest (NDJSON format) ─────────────────
record_manifest() {
  local db_file="$1" uploads_file="$2" tier="$3"
  local db_size uploads_size uploads_name
  db_size=$(ls -lh "$db_file" 2>/dev/null | awk '{print $5}' || echo "?")
  if [ -n "$uploads_file" ] && [ -f "$uploads_file" ]; then
    uploads_name=$(basename "$uploads_file")
    uploads_size=$(ls -lh "$uploads_file" 2>/dev/null | awk '{print $5}' || echo "?")
  else
    uploads_name=""
    uploads_size=""
  fi

  local entry
  entry=$(cat <<ENTRY
{"timestamp":"$(date -u +"%Y-%m-%dT%H:%M:%SZ")","tier":"$tier","database":"$(basename "$db_file")","database_size":"$db_size","uploads":$( [ -n "$uploads_name" ] && echo "\"$uploads_name\"" || echo null ),"uploads_size":$( [ -n "$uploads_size" ] && echo "\"$uploads_size\"" || echo null )}
ENTRY
)

  # Prepend to the manifest (most recent first), keep max 200 lines
  local tmp
  tmp=$(mktemp)
  echo "$entry" > "$tmp"
  if [ -f "$MANIFEST" ]; then
    head -n 199 "$MANIFEST" >> "$tmp"
  fi
  mv "$tmp" "$MANIFEST"
}

# ═══════════════════════════════════════════════════════════════════════════════
#  MAIN
# ═══════════════════════════════════════════════════════════════════════════════

echo "=== WBOS Backup: $(date) ==="
echo "  Backup root: $BACKUP_ROOT"
echo ""

# ── 1. Daily backup (always) ────────────────────────────────────────────────
echo "--- Daily backup ---"
DB_FILE=$(take_db_backup "$DAILY_DIR" "db") || exit 1
echo "  Saved: $DB_FILE ($(ls -lh "$DB_FILE" | awk '{print $5}'))"

# ── 2. Uploads backup (if storage exists) ───────────────────────────────────
UPLOADS_FILE=""
if [ -n "$STORAGE_ROOT" ]; then
  echo "--- Uploads backup ---"
  UPLOADS_FILE=$(take_uploads_backup "$STORAGE_ROOT" "$UPLOADS_DIR")
  if [ -n "$UPLOADS_FILE" ]; then
    echo "  Saved: $UPLOADS_FILE ($(ls -lh "$UPLOADS_FILE" | awk '{print $5}'))"
  else
    echo "  Skipped (directory empty or missing)"
  fi
fi

# ── 3. Tier promotion ───────────────────────────────────────────────────────
CURRENT_TIER="daily"

if [ "$DAY_OF_WEEK" = "7" ]; then
  echo "--- Promoting to weekly (Sunday) ---"
  cp "$DB_FILE" "$WEEKLY_DIR/"
  echo "  Copied to: $WEEKLY_DIR/$(basename "$DB_FILE")"
  CURRENT_TIER="weekly"
fi

if [ "$DAY_OF_MONTH" = "01" ]; then
  echo "--- Promoting to monthly (1st of month) ---"
  cp "$DB_FILE" "$MONTHLY_DIR/"
  echo "  Copied to: $MONTHLY_DIR/$(basename "$DB_FILE")"
  CURRENT_TIER="monthly"
fi

if is_last_day_of_year; then
  echo "--- Promoting to yearly snapshot (Dec 31) ---"
  YEARLY_FILENAME="wbos-${YEAR}-12-31.sql.gz"
  cp "$DB_FILE" "${YEARLY_DIR}/${YEARLY_FILENAME}"
  echo "  Snapshot: ${YEARLY_DIR}/${YEARLY_FILENAME}"
  CURRENT_TIER="yearly"

  # Also record a separate manifest entry for the snapshot
  record_manifest "${YEARLY_DIR}/${YEARLY_FILENAME}" "$UPLOADS_FILE" "yearly-snapshot"
fi

# ── 4. Retention cleanup ────────────────────────────────────────────────────
echo "--- Retention cleanup ---"
retention_limit "$DAILY_DIR" 7
retention_limit "$WEEKLY_DIR" 4
retention_limit "$MONTHLY_DIR" 12
retention_limit "$UPLOADS_DIR" 7 "wbos_uploads_*.tar.gz"
echo "  Done"

# ── 5. Record manifest ──────────────────────────────────────────────────────
echo "--- Recording manifest ---"
record_manifest "$DB_FILE" "$UPLOADS_FILE" "$CURRENT_TIER"
echo "  Manifest: $MANIFEST"

echo ""
echo "=== Backup complete ==="
