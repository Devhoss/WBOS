#!/usr/bin/env bash
set -euo pipefail

# WBOS Off-Host Backup Sync
#
# Copies the package backups (and optional tiered backups) to an off-host
# destination so a host failure does not take the backups with it.
#
# Usage: ./scripts/sync-backups.sh [method]
#
# Methods (via WBOS_BACKUP_SYNC_TARGET):
#   rsync://user@nas:/path        — rsync over SSH (recommended for NAS)
#   s3://bucket/path              — rclone to S3-compatible object storage
#   file:///mnt/backup            — local mount / second disk
#
# Environment variables:
#   WBOS_BACKUP_DIR        — local backup root (default ./backups)
#   WBOS_BACKUP_SYNC_TARGET — destination URI (required)
#   WBOS_BACKUP_SYNC_EXTRA — extra rclone/rsync args (optional)
#
# Retention on the off-host side mirrors the local packages/ folder: it is a
# mirror sync, so deleted local packages are also removed off-host. Keep the
# local retention job (backup.sh / backup-package.sh) as the source of truth.

BACKUP_ROOT="${WBOS_BACKUP_DIR:-./backups}"
TARGET="${WBOS_BACKUP_SYNC_TARGET:-}"
EXTRA="${WBOS_BACKUP_SYNC_EXTRA:-}"
PACKAGES_DIR="${BACKUP_ROOT}/packages"

if [ -z "$TARGET" ]; then
  echo "Error: WBOS_BACKUP_SYNC_TARGET is not set." >&2
  echo "Examples:" >&2
  echo "  rsync://user@nas.local:/volume1/wbos-backups" >&2
  echo "  s3://wbos-backups/prod" >&2
  echo "  file:///mnt/nas-backup/wbos" >&2
  exit 1
fi

if [ ! -d "$PACKAGES_DIR" ]; then
  echo "  packages/ not found at $PACKAGES_DIR — nothing to sync."
  exit 0
fi

echo "=== WBOS Off-Host Backup Sync: $(date) ==="
echo "  Local:  $PACKAGES_DIR"
echo "  Target: $TARGET"

case "$TARGET" in
  rsync://*)
    # rsync://user@host:/path  -> rsync user@host:/path
    RSYNC_PATH="${TARGET#rsync://}"
    echo "--- Syncing via rsync ---"
    # shellcheck disable=SC2086
    rsync -a --delete $EXTRA "$PACKAGES_DIR/" "$RSYNC_PATH/"
    ;;
  s3://*)
    echo "--- Syncing via rclone ---"
    # shellcheck disable=SC2086
    rclone copy --progress $EXTRA "$PACKAGES_DIR/" "$TARGET"
    ;;
  file://*)
    DEST="${TARGET#file://}"
    echo "--- Syncing to local mount ---"
    mkdir -p "$DEST"
    # shellcheck disable=SC2086
    rsync -a --delete $EXTRA "$PACKAGES_DIR/" "$DEST/"
    ;;
  *)
    echo "Error: unsupported target scheme in WBOS_BACKUP_SYNC_TARGET: $TARGET" >&2
    exit 1
    ;;
esac

echo ""
echo "=== Sync complete ==="
