#!/usr/bin/env bash
set -euo pipefail

# WBOS Database Restore Script
# Usage:
#   ./scripts/restore.sh                          # interactive — pick from tiers
#   ./scripts/restore.sh <file>                   # restore specific backup file
#   ./scripts/restore.sh --latest                 # restore newest across all tiers
#   ./scripts/restore.sh --tier daily             # restore newest in tier
#   ./scripts/restore.sh --list                   # list available backups
#   ./scripts/restore.sh --list daily             # list backups in a specific tier
#   ./scripts/restore.sh --list-all               # list all backups grouped by tier
#   ./scripts/restore.sh --restore-uploads <file> # restore uploads archive
#
# Environment variables:
#   WBOS_BACKUP_DIR     — backup root (default ./backups)
#   WBOS_STORAGE_ROOT   — storage root for uploads restore (default ./storage)
#   DATABASE_URL        — PostgreSQL connection string

BACKUP_ROOT="${WBOS_BACKUP_DIR:-./backups}"
STORAGE_ROOT="${WBOS_STORAGE_ROOT:-./storage}"
CMD="${1:-}"

# ── Tier definitions ─────────────────────────────────────────────────────────
TIERS=("daily" "weekly" "monthly" "yearly")
TIER_LABELS=("Daily (last 7)" "Weekly (last 4)" "Monthly (last 12)" "Yearly (kept forever)")

# ── List backups ─────────────────────────────────────────────────────────────
list_backups() {
  local tier="${1:-}"
  if [ -n "$tier" ]; then
    local dir="${BACKUP_ROOT}/${tier}"
    if [ ! -d "$dir" ]; then
      echo "No backups in tier '${tier}'"
      return 0
    fi
    echo "=== ${tier^} backups ==="
    ls -lht "$dir"/wbos_db_*.sql.gz 2>/dev/null || echo "  (none)"
  else
    for i in "${!TIERS[@]}"; do
      local t="${TIERS[$i]}"
      local label="${TIER_LABELS[$i]}"
      local dir="${BACKUP_ROOT}/${t}"
      echo ""
      echo "=== ${label} (${t}/) ==="
      if [ -d "$dir" ]; then
        ls -lht "$dir"/wbos_db_*.sql.gz 2>/dev/null || echo "  (none)"
      else
        echo "  (none)"
      fi
    done
    echo ""
    echo "=== Uploads backups ==="
    ls -lht "${BACKUP_ROOT}/uploads"/wbos_uploads_*.tar.gz 2>/dev/null || echo "  (none)"
  fi
}

# ── Find latest backup across all tiers ──────────────────────────────────────
find_latest() {
  for t in daily weekly monthly yearly; do
    local f
    f=$(ls -t "${BACKUP_ROOT}/${t}"/wbos_db_*.sql.gz 2>/dev/null | head -1)
    if [ -n "$f" ]; then
      echo "$f"
      return 0
    fi
  done
  return 1
}

# ── Find latest backup in a specific tier ────────────────────────────────────
find_latest_in_tier() {
  local tier="$1"
  ls -t "${BACKUP_ROOT}/${tier}"/wbos_db_*.sql.gz 2>/dev/null | head -1 || true
}

# ── Interactive tier picker ──────────────────────────────────────────────────
pick_backup_interactive() {
  local dir
  local candidates=()
  for i in "${!TIERS[@]}"; do
    dir="${BACKUP_ROOT}/${TIERS[$i]}"
    if [ -d "$dir" ]; then
      while IFS= read -r -d '' f; do
        candidates+=("$f")
      done < <(find "$dir" -name 'wbos_db_*.sql.gz' -type f -print0 2>/dev/null | sort -rz)
    fi
  done

  if [ ${#candidates[@]} -eq 0 ]; then
    echo "Error: No backup files found in any tier under ${BACKUP_ROOT}"
    echo "Usage: $0 [path-to-backup.sql.gz]"
    exit 1
  fi

  echo "Available backups (newest first):"
  for i in "${!candidates[@]}"; do
    local tier_label
    tier_label=$(basename "$(dirname "${candidates[$i]}")")
    local size
    size=$(ls -lh "${candidates[$i]}" | awk '{print $5}')
    printf "  [%d] %s  (%s, %s)\n" $((i + 1)) "${candidates[$i]}" "$size" "$tier_label"
  done
  echo ""
  read -rp "Select backup [1-${#candidates[@]}]: " CHOICE
  if ! [[ "$CHOICE" =~ ^[0-9]+$ ]] || [ "$CHOICE" -lt 1 ] || [ "$CHOICE" -gt "${#candidates[@]}" ]; then
    echo "Invalid choice. Exiting."
    exit 1
  fi
  RESTORE_FILE="${candidates[$((CHOICE - 1))]}"
}

# ── Restore database ─────────────────────────────────────────────────────────
restore_database() {
  local file="$1"
  if [ ! -f "$file" ]; then
    echo "Error: Backup file not found: ${file}"
    exit 1
  fi

  local file_size
  file_size=$(ls -lh "$file" | awk '{print $5}')
  echo "Backup file: ${file} (${file_size})"
  echo "WARNING: This will overwrite the current database!"
  read -rp "Are you sure? (yes/no): " CONFIRM
  if [ "$CONFIRM" != "yes" ]; then
    echo "Restore cancelled."
    exit 0
  fi

  echo ""
  echo "Restoring..."

  if [ -n "${DATABASE_URL:-}" ]; then
    gunzip -c "$file" | psql "$DATABASE_URL"
  elif command -v docker &>/dev/null && docker ps --format '{{.Names}}' 2>/dev/null | grep -q wbos-db; then
    gunzip -c "$file" | docker exec -i wbos-db psql -U wbos wbos
  else
    echo "Error: DATABASE_URL not set and no wbos-db container found."
    echo "Set DATABASE_URL or run inside the Docker network."
    exit 1
  fi

  echo "Restore complete from: ${file}"
}

# ── Restore uploads ──────────────────────────────────────────────────────────
restore_uploads() {
  local file="$1"
  if [ ! -f "$file" ]; then
    echo "Error: Uploads archive not found: ${file}"
    exit 1
  fi

  if [ ! -d "$STORAGE_ROOT" ]; then
    echo "Warning: Storage root ${STORAGE_ROOT} does not exist. Creating..."
    mkdir -p "$STORAGE_ROOT"
  fi

  local file_size
  file_size=$(ls -lh "$file" | awk '{print $5}')
  echo "Uploads archive: ${file} (${file_size})"
  echo "Target: ${STORAGE_ROOT}"
  echo "WARNING: This will overwrite existing files in ${STORAGE_ROOT}!"
  read -rp "Are you sure? (yes/no): " CONFIRM
  if [ "$CONFIRM" != "yes" ]; then
    echo "Restore cancelled."
    exit 0
  fi

  echo ""
  echo "Restoring uploads..."
  tar xzf "$file" -C "$(dirname "$STORAGE_ROOT")"
  echo "Uploads restore complete from: ${file}"
}

# ═══════════════════════════════════════════════════════════════════════════════
#  DISPATCH
# ═══════════════════════════════════════════════════════════════════════════════

case "${CMD}" in
  --list)
    list_backups "${2:-}"
    exit 0
    ;;
  --list-all)
    list_backups
    exit 0
    ;;
  --latest)
    RESTORE_FILE=$(find_latest) || {
      echo "Error: No backup files found in any tier under ${BACKUP_ROOT}"
      exit 1
    }
    echo "Using latest backup: ${RESTORE_FILE}"
    ;;
  --tier)
    local tier="${2:-}"
    if [ -z "$tier" ]; then
      echo "Usage: $0 --tier <daily|weekly|monthly|yearly>"
      exit 1
    fi
    RESTORE_FILE=$(find_latest_in_tier "$tier") || true
    if [ -z "$RESTORE_FILE" ]; then
      echo "Error: No backup files found in tier '${tier}'"
      exit 1
    fi
    echo "Using latest ${tier} backup: ${RESTORE_FILE}"
    ;;
  --restore-uploads)
    if [ -z "${2:-}" ]; then
      # Find latest uploads backup
      UPLOADS_FILE=$(ls -t "${BACKUP_ROOT}/uploads"/wbos_uploads_*.tar.gz 2>/dev/null | head -1) || true
      if [ -z "$UPLOADS_FILE" ]; then
        echo "Error: No uploads backups found. Specify a file: $0 --restore-uploads <file>"
        exit 1
      fi
      echo "Using latest uploads backup: ${UPLOADS_FILE}"
    else
      UPLOADS_FILE="$2"
    fi
    restore_uploads "$UPLOADS_FILE"
    exit 0
    ;;
  "")
    pick_backup_interactive
    ;;
  *)
    # Assume it's a file path
    RESTORE_FILE="$CMD"
    if [ ! -f "$RESTORE_FILE" ]; then
      echo "Error: Backup file not found: ${RESTORE_FILE}"
      echo "Usage: $0 [path-to-backup.sql.gz]"
      echo "       $0 --list [tier]"
      echo "       $0 --latest"
      echo "       $0 --tier <daily|weekly|monthly|yearly>"
      echo "       $0 --restore-uploads [file]"
      exit 1
    fi
    ;;
esac

restore_database "$RESTORE_FILE"
