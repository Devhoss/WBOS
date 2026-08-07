#!/usr/bin/env bash
set -euo pipefail

# WBOS Deploy Helper
#
# Runs the pre-deploy checklist: unit checks, a fresh backup, then starts the
# production stack. Use before each release.
#
# Usage: ./scripts/deploy.sh [--skip-tests]
#
# Environment variables:
#   WBOS_BACKUP_DIR         — local backup root (for the pre-deploy backup)
#   WBOS_STORAGE_ROOT       — storage root (for the pre-deploy backup)
#   WBOS_DATABASE_URL       — database URL for the pre-deploy backup
#   WBOS_BACKUP_SYNC_TARGET — if set, sync backups off-host after starting

cd "$(dirname "$0")/.."

echo "=== WBOS Deploy: $(date) ==="

if [ "${1:-}" != "--skip-tests" ]; then
  echo "--- 1/6 Checks ---"
  npm run test >/dev/null && echo "  ✓ unit tests" || { echo "  ✗ unit tests failed"; exit 1; }
  npx tsc --noEmit && echo "  ✓ typecheck" || { echo "  ✗ typecheck failed"; exit 1; }
  npm run lint >/dev/null && echo "  ✓ lint" || { echo "  ✗ lint failed"; exit 1; }
fi

echo "--- 2/6 Pre-deploy backup ---"
if [ -n "${WBOS_DATABASE_URL:-}" ]; then
  WBOS_DATABASE_URL="${WBOS_DATABASE_URL}" WBOS_BACKUP_DIR="${WBOS_BACKUP_DIR:-./backups}" WBOS_STORAGE_ROOT="${WBOS_STORAGE_ROOT:-./storage}" ./scripts/backup-package.sh
else
  echo "  Skipped (WBOS_DATABASE_URL not set — set it to take a pre-deploy backup)"
fi

echo "--- 3/6 Build ---"
npm run build >/dev/null && echo "  ✓ build" || { echo "  ✗ build failed"; exit 1; }

echo "--- 4/6 Start stack ---"
docker compose -f docker-compose.prod.yml up -d --build

echo "--- 5/6 Health check ---"
sleep 5
for i in $(seq 1 12); do
  if curl -fs http://localhost:3005/api/health >/dev/null 2>&1; then
    echo "  ✓ app is healthy"
    break
  fi
  if [ "$i" = "12" ]; then
    echo "  ✗ app did not become healthy"
    exit 1
  fi
  sleep 5
done

echo "--- 6/6 Off-host sync (optional) ---"
if [ -n "${WBOS_BACKUP_SYNC_TARGET:-}" ]; then
  ./scripts/sync-backups.sh
else
  echo "  Skipped (WBOS_BACKUP_SYNC_TARGET not set)"
fi

echo ""
echo "=== Deploy complete ==="
