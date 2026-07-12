#!/usr/bin/env bash
set -euo pipefail

# WBOS Database Backup Script
# Usage: ./scripts/backup.sh [output-dir]

BACKUP_DIR="${1:-${WBOS_BACKUP_DIR:-./backups}}"
RETENTION_DAYS="${WBOS_BACKUP_RETENTION_DAYS:-30}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
FILENAME="wbos_backup_${TIMESTAMP}.sql.gz"

mkdir -p "$BACKUP_DIR"

if [ -n "${DATABASE_URL:-}" ]; then
    DB_URL="$DATABASE_URL"
elif command -v docker &>/dev/null && docker ps --format '{{.Names}}' 2>/dev/null | grep -q wbos-db; then
    echo "Detected wbos-db container. Attempting backup via Docker..."
    docker exec wbos-db pg_dump -U wbos wbos | gzip > "${BACKUP_DIR}/${FILENAME}"
    echo "Backup saved: ${BACKUP_DIR}/${FILENAME}"
    # Cleanup old backups
    find "$BACKUP_DIR" -name "wbos_backup_*.sql.gz" -type f -mtime "+${RETENTION_DAYS}" -delete
    exit 0
else
    echo "Error: DATABASE_URL not set and no wbos-db container found."
    echo "Set DATABASE_URL or run inside the Docker network."
    exit 1
fi

pg_dump "$DB_URL" | gzip > "${BACKUP_DIR}/${FILENAME}"

echo "Backup saved: ${BACKUP_DIR}/${FILENAME} ($(ls -lh "$BACKUP_DIR/$FILENAME" | awk '{print $5}'))"

# Retention cleanup
find "$BACKUP_DIR" -name "wbos_backup_*.sql.gz" -type f -mtime "+${RETENTION_DAYS}" -delete
echo "Cleaned up backups older than ${RETENTION_DAYS} days."
