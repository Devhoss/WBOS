#!/bin/sh
set -e

echo ""
echo "=========================================="
echo "  WBOS — Storage Validation"
echo "=========================================="

STORAGE_ROOT="${WBOS_STORAGE_ROOT:-/app/public}"
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
validate_dir "${STORAGE_ROOT}/backups" "Backups directory"

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

# Apply database migrations
echo "[entrypoint] Running database migrations..."
npx prisma migrate deploy --skip-generate 2>&1 | grep -v "already exists" || true
echo "[entrypoint] Migrations complete."

# Start the application
echo "[entrypoint] Starting WBOS..."
exec node server.js
