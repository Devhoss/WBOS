#!/usr/bin/env bash
set -euo pipefail

# WBOS Database Restore Script
# Usage:
#   ./scripts/restore.sh                  # restore latest backup
#   ./scripts/restore.sh <file>           # restore specific backup file

BACKUP_DIR="${WBOS_BACKUP_DIR:-./backups}"

if [ -n "${1:-}" ]; then
    RESTORE_FILE="$1"
elif [ -f "${BACKUP_DIR}/latest" ]; then
    RESTORE_FILE=$(cat "${BACKUP_DIR}/latest")
    echo "Using latest backup: ${RESTORE_FILE}"
else
    RESTORE_FILE=$(ls -t "${BACKUP_DIR}"/wbos_backup_*.sql.gz 2>/dev/null | head -1)
    if [ -z "$RESTORE_FILE" ]; then
        echo "Error: No backup files found in ${BACKUP_DIR}"
        echo "Usage: $0 [path-to-backup.sql.gz]"
        exit 1
    fi
    echo "Using most recent backup: ${RESTORE_FILE}"
fi

if [ ! -f "$RESTORE_FILE" ]; then
    echo "Error: Backup file not found: ${RESTORE_FILE}"
    exit 1
fi

echo "WARNING: This will overwrite the current database!"
read -rp "Are you sure? (yes/no): " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
    echo "Restore cancelled."
    exit 0
fi

if [ -n "${DATABASE_URL:-}" ]; then
    DB_URL="$DATABASE_URL"
elif command -v docker &>/dev/null && docker ps --format '{{.Names}}' 2>/dev/null | grep -q wbos-db; then
    echo "Restoring via Docker container wbos-db..."
    gunzip -c "$RESTORE_FILE" | docker exec -i wbos-db psql -U wbos wbos
    echo "Restore complete from: ${RESTORE_FILE}"
    exit 0
else
    echo "Error: DATABASE_URL not set and no wbos-db container found."
    exit 1
fi

gunzip -c "$RESTORE_FILE" | psql "$DB_URL"

echo "Restore complete from: ${RESTORE_FILE}"
