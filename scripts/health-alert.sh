#!/usr/bin/env bash
set -euo pipefail

# WBOS Health Alert
#
# Simple self-hosted alerting for a small deployment. No Prometheus/Grafana/ELK:
# this script polls the existing /api/health endpoint (the same one the /health
# page and Docker healthcheck use), compares a few conditions, and sends
# notifications through one or more plain channels (webhook / Telegram / ntfy /
# email). It is designed to run from the HOST cron so it still fires when the
# app container is down.
#
# Usage:
#   ./scripts/health-alert.sh            run a check (from cron, every 5-10 min)
#   ./scripts/health-alert.sh --test     send a test notification
#
# Environment variables (see .env.example for the full reference):
#   WBOS_ALERT_HEALTH_URL             health endpoint (default http://127.0.0.1:3005/api/health)
#   WBOS_ALERT_STATE_DIR              state dir for de-duplication (default $WBOS_BACKUP_DIR/alert-state)
#   WBOS_ALERT_BACKUP_STALE_HOURS     alert when latest backup older than this (default 48)
#   WBOS_ALERT_DISK_THRESHOLD         alert when available disk % below this (default 10)
#   WBOS_ALERT_UPLOADS_WARN_PCT       alert when uploads use this % of the storage disk (default 60)
#   WBOS_ALERT_UPLOADS_CRITICAL_PCT   alert when uploads use this % of the storage disk (default 75)
#   WBOS_ALERT_COOLDOWN_HOURS         re-alert interval while a condition persists (default 6)
#   WBOS_ALERT_RECOVERY               1 = send recovery notices (default 1)
#   WBOS_ALERT_ALERT_ON_NO_RESTORE_TEST  1 = alert if no restore test on record (default 0)
#   WBOS_ALERT_WEBHOOK_URL            generic JSON webhook (Slack/Teams-compatible: {"text": ...})
#   WBOS_ALERT_TELEGRAM_BOT_TOKEN     Telegram bot token (with WBOS_ALERT_TELEGRAM_CHAT_ID)
#   WBOS_ALERT_TELEGRAM_CHAT_ID       Telegram chat id
#   WBOS_ALERT_NTFY_URL               ntfy server (default https://ntfy.sh)
#   WBOS_ALERT_NTFY_TOPIC             ntfy topic (push notifications)
#   WBOS_ALERT_EMAIL_TO               email recipient (requires a local `mail`/MTA; best-effort)
#
# At least one notification channel must be configured, otherwise the script
# runs in log-only mode (it still prints every alert to stdout for cron logs).
#
# Exit codes: 0 = checked and notified (or nothing to report) · 1 = config/usage error

# ── Config ──────────────────────────────────────────────────────────────────
HEALTH_URL="${WBOS_ALERT_HEALTH_URL:-http://127.0.0.1:3005/api/health}"
STATE_DIR="${WBOS_ALERT_STATE_DIR:-}"
if [ -z "$STATE_DIR" ]; then
  STATE_DIR="${WBOS_BACKUP_DIR:+${WBOS_BACKUP_DIR}/alert-state}"
  STATE_DIR="${STATE_DIR:-/tmp/wbos-alert-state}"
fi
STALE_HOURS="${WBOS_ALERT_BACKUP_STALE_HOURS:-48}"
DISK_THRESHOLD="${WBOS_ALERT_DISK_THRESHOLD:-10}"
UPLOADS_WARN_PCT="${WBOS_ALERT_UPLOADS_WARN_PCT:-60}"
UPLOADS_CRITICAL_PCT="${WBOS_ALERT_UPLOADS_CRITICAL_PCT:-75}"
COOLDOWN_HOURS="${WBOS_ALERT_COOLDOWN_HOURS:-6}"
SEND_RECOVERY="${WBOS_ALERT_RECOVERY:-1}"
ALERT_NO_RESTORE="${WBOS_ALERT_ALERT_ON_NO_RESTORE_TEST:-0}"
CURL_TIMEOUT="${WBOS_ALERT_CURL_TIMEOUT:-20}"

WEBHOOK_URL="${WBOS_ALERT_WEBHOOK_URL:-}"
TELEGRAM_TOKEN="${WBOS_ALERT_TELEGRAM_BOT_TOKEN:-}"
TELEGRAM_CHAT="${WBOS_ALERT_TELEGRAM_CHAT_ID:-}"
NTFY_URL="${WBOS_ALERT_NTFY_URL:-https://ntfy.sh}"
NTFY_TOPIC="${WBOS_ALERT_NTFY_TOPIC:-}"
EMAIL_TO="${WBOS_ALERT_EMAIL_TO:-}"

# ── Notifiers (all curl, no extra infrastructure) ───────────────────────────
notify() {
  local msg="$1"
  local sent=0

  if [ -n "$WEBHOOK_URL" ]; then
    curl -sS --max-time 15 -X POST -H 'Content-Type: application/json' \
      -d "{\"text\":\"$(escape_json "$msg")\"}" "$WEBHOOK_URL" >/dev/null 2>&1 || true
    sent=1
  fi

  if [ -n "$TELEGRAM_TOKEN" ] && [ -n "$TELEGRAM_CHAT" ]; then
    curl -sS --max-time 15 -X POST \
      "https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage" \
      --data-urlencode "chat_id=$TELEGRAM_CHAT" \
      --data-urlencode "text=$msg" >/dev/null 2>&1 || true
    sent=1
  fi

  if [ -n "$NTFY_TOPIC" ]; then
    curl -sS --max-time 15 -d "$msg" -H "Title: WBOS" \
      "$NTFY_URL/$NTFY_TOPIC" >/dev/null 2>&1 || true
    sent=1
  fi

  if [ -n "$EMAIL_TO" ]; then
    if command -v mail >/dev/null 2>&1; then
      printf '%s\n' "$msg" | mail -s "[WBOS] $msg" "$EMAIL_TO" >/dev/null 2>&1 || true
      sent=1
    else
      echo "  (mail not found; skipping email to $EMAIL_TO)" >&2
    fi
  fi

  echo "[$(date -Iseconds)] $msg"
  if [ "$sent" -eq 0 ]; then
    echo "  (no notification channel configured — WBOS_ALERT_WEBHOOK_URL / TELEGRAM / NTFY_TOPIC / EMAIL_TO)" >&2
  fi
}

escape_json() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

fmt_bytes() {
  local b="${1:-0}" m
  m=$(( b / 1048576 ))
  if [ "$m" -ge 1024 ]; then echo "$(( m / 1024 ))GB"; else echo "${m}MB"; fi
}

# ── JSON helpers: node (best) -> jq -> minimal sed (only compact one-line JSON) ──
# All tiers are fail-safe: on a parse error they print nothing (exit 0) so the
# caller can treat an unparseable body as "unexpected response".
jpath() {
  local file="$1" key="$2" out=""
  if command -v node >/dev/null 2>&1; then
    out=$(node -e 'const fs=require("fs");const j=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));const v=process.argv[2].split(".").reduce((a,k)=>a==null?undefined:a[k],j);console.log(v===undefined?"":String(v));' "$file" "$key" 2>/dev/null) || out=""
    printf '%s' "$out"
    return
  fi
  if command -v jq >/dev/null 2>&1; then
    out=$(jq -r --arg k "$key" 'getpath($k|split("."))' "$file" 2>/dev/null) || out=""
    printf '%s' "$out"
    return
  fi
  case "$key" in
    healthy)                  sed -n 's/.*"healthy":\(true\|false\).*/\1/p' "$file" ;;
    database.ok)              sed -n 's/.*"database":{[^}]*"ok":\(true\|false\).*/\1/p' "$file" ;;
    database.error)           sed -n 's/.*"database":{"ok":false,"error":"\([^"]*\)".*/\1/p' "$file" ;;
    storage.writable)         sed -n 's/.*"storage":{[^}]*"writable":\(true\|false\).*/\1/p' "$file" ;;
    storage.root)             sed -n 's/.*"storage":{"root":"\([^"]*\)".*/\1/p' "$file" ;;
    backups.latestAgeHours)   sed -n 's/.*"latestAgeHours":\([0-9][0-9]*\|null\).*/\1/p' "$file" ;;
    backups.stale)            sed -n 's/.*"backups":{[^}]*"stale":\(true\|false\).*/\1/p' "$file" ;;
    backups.lastRestoreTest)  sed -n 's/.*"lastRestoreTest":\(null\|{[^}]*}\).*/\1/p' "$file" ;;
    storage.uploads.pctOfDisk)   sed -n 's/.*"uploads":{[^}]*"pctOfDisk":\([0-9][0-9]*\|null\).*/\1/p' "$file" ;;
    storage.uploads.sizeBytes)   sed -n 's/.*"uploads":{[^}]*"sizeBytes":\([0-9][0-9]*\).*/\1/p' "$file" ;;
    storage.uploads.fileCount)   sed -n 's/.*"uploads":{[^}]*"fileCount":\([0-9][0-9]*\).*/\1/p' "$file" ;;
    *) echo "" ;;
  esac
}

# worst disk -> "path|availablePercent" (or empty)
disk_worst() {
  local file="$1"
  if command -v node >/dev/null 2>&1; then
    node -e 'const fs=require("fs");const j=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));const d=((j.storage&&j.storage.disk)||[]).filter(x=>x.availablePercent!=null).sort((a,b)=>a.availablePercent-b.availablePercent)[0];console.log(d?d.path+"|"+d.availablePercent:"");' "$file" 2>/dev/null || true
    return
  fi
  if command -v jq >/dev/null 2>&1; then
    jq -r '[.storage.disk[]? | select(.availablePercent != null)] | sort_by(.availablePercent)[0] | "\(.path)|\(.availablePercent)"' "$file" 2>/dev/null || true
    return
  fi
  local paths pcts min=100 minpath="" i
  mapfile -t paths < <(grep -oE '"path":"[^"]*"' "$file" | sed 's/"path":"//; s/"$//' || true)
  mapfile -t pcts < <(grep -oE '"availablePercent":[0-9]+' "$file" | sed 's/"availablePercent"://' || true)
  for i in "${!pcts[@]}"; do
    if [ "${pcts[$i]}" -lt "$min" ]; then min="${pcts[$i]}"; minpath="${paths[$i]:-?}"; fi
  done
  [ -n "$minpath" ] && echo "$minpath|$min" || echo ""
}

# comma-separated list of broken backup tools (or empty)
tools_bad() {
  local file="$1"
  if command -v node >/dev/null 2>&1; then
    node -e 'const fs=require("fs");const j=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));console.log(((j.backups&&j.backups.tools)||[]).filter(t=>t.ok===false).map(t=>t.tool).join(","));' "$file" 2>/dev/null || true
    return
  fi
  if command -v jq >/dev/null 2>&1; then
    jq -r '[.backups.tools[]? | select(.ok==false) | .tool] | join(",")' "$file" 2>/dev/null || true
    return
  fi
  grep -oE '"tool":"[^"]*","ok":false' "$file" | sed 's/"tool":"//; s/","ok":false//' | paste -sd, - 2>/dev/null || true
}

# ── Condition state machine ─────────────────────────────────────────────────
# De-duplicates alerts: fires on ok->failing, re-fires every COOLDOWN_HOURS
# while still failing, and sends a recovery notice on failing->ok.
now_epoch=$(date +%s)

cond_state_file() { echo "$STATE_DIR/$1.state"; }

check_cond() {
  local cond="$1" failing="$2" fail_msg="$3" recover_msg="$4"
  local file
  file=$(cond_state_file "$cond")

  if [ "$failing" = "0" ]; then
    if [ -f "$file" ]; then
      [ "$SEND_RECOVERY" = "1" ] && notify "[WBOS RECOVERED] $recover_msg [health: $HEALTH_URL]"
      rm -f "$file"
    fi
    return
  fi

  if [ -f "$file" ]; then
    local last
    last=$(cat "$file")
    if [ $((now_epoch - last)) -ge $((COOLDOWN_HOURS * 3600)) ]; then
      notify "[WBOS ALERT] $fail_msg (still failing) [health: $HEALTH_URL]"
      echo "$now_epoch" > "$file"
    fi
  else
    notify "[WBOS ALERT] $fail_msg [health: $HEALTH_URL]"
    echo "$now_epoch" > "$file"
  fi
}

# ── Main ────────────────────────────────────────────────────────────────────
command -v curl >/dev/null 2>&1 || { echo "Error: curl not found." >&2; exit 1; }

if [ "${1:-}" = "--test" ]; then
  notify "WBOS alert test — if you received this, alerting is configured correctly."
  exit 0
fi

mkdir -p "$STATE_DIR"

TMP=$(mktemp)
trap 'rm -f "$TMP"' EXIT

HTTP_CODE="000"
HTTP_CODE=$(curl -sS --max-time "$CURL_TIMEOUT" -o "$TMP" -w "%{http_code}" "$HEALTH_URL" 2>/dev/null) || HTTP_CODE="000"

if [ "$HTTP_CODE" = "000" ] || [ ! -s "$TMP" ]; then
  check_cond app_down 1 "WBOS app is unreachable at $HEALTH_URL (no HTTP response)." \
    "WBOS app is reachable again at $HEALTH_URL."
  exit 0
fi

check_cond app_down 0 "WBOS app is unreachable at $HEALTH_URL (no HTTP response)." \
  "WBOS app is reachable again at $HEALTH_URL."

HEALTHY=$(jpath "$TMP" healthy)
if [ -z "$HEALTHY" ]; then
  check_cond unexpected_response 1 "Unexpected /api/health response (HTTP $HTTP_CODE, could not parse JSON)." \
    "/api/health is parsing normally again."
  exit 0
fi

DB_OK=$(jpath "$TMP" database.ok)
if [ "$DB_OK" != "true" ]; then
  DB_ERR=$(jpath "$TMP" database.error)
  check_cond database 1 "Database is DOWN: ${DB_ERR:-no error detail}." \
    "Database is responding again."
else
  check_cond database 0 "Database is DOWN: no error detail." "Database is responding again."
fi

STORAGE_OK=$(jpath "$TMP" storage.writable)
if [ "$STORAGE_OK" != "true" ]; then
  STORAGE_ROOT=$(jpath "$TMP" storage.root)
  check_cond storage 1 "Storage root is not writable: ${STORAGE_ROOT:-unknown}." \
    "Storage root is writable again."
else
  check_cond storage 0 "Storage root is not writable." "Storage root is writable again."
fi

DISK=$(disk_worst "$TMP")
if [ -n "$DISK" ]; then
  DISK_PATH="${DISK%|*}"
  DISK_PCT="${DISK##*|}"
  if [ "$DISK_PCT" -lt "$DISK_THRESHOLD" ]; then
    check_cond disk 1 "Disk is low: $DISK_PATH has only $DISK_PCT% available (threshold ${DISK_THRESHOLD}%)." \
      "Disk is back above ${DISK_THRESHOLD}% available ($DISK_PATH)."
  else
    check_cond disk 0 "Disk is low: $DISK_PATH at ${DISK_PCT}%." "Disk is back above ${DISK_THRESHOLD}% available."
  fi
fi

UPLOADS_PCT=$(jpath "$TMP" storage.uploads.pctOfDisk)
if [ -n "$UPLOADS_PCT" ] && [ "$UPLOADS_PCT" != "null" ]; then
  UPLOADS_BYTES=$(jpath "$TMP" storage.uploads.sizeBytes)
  UPLOADS_FILES=$(jpath "$TMP" storage.uploads.fileCount)
  UP_DETAIL="$(fmt_bytes "${UPLOADS_BYTES:-0}") across ${UPLOADS_FILES:-0} files, ${UPLOADS_PCT}% of disk"
  if [ "$UPLOADS_PCT" -ge "$UPLOADS_CRITICAL_PCT" ]; then
    check_cond uploads_critical 1 "Uploads at critical level: $UP_DETAIL (threshold ${UPLOADS_CRITICAL_PCT}%). Free up space." \
      "Uploads back below ${UPLOADS_CRITICAL_PCT}% of disk."
  else
    check_cond uploads_critical 0 "Uploads at critical level: ${UPLOADS_PCT}% of disk." "Uploads back below ${UPLOADS_CRITICAL_PCT}%."
  fi
  if [ "$UPLOADS_PCT" -ge "$UPLOADS_WARN_PCT" ] && [ "$UPLOADS_PCT" -lt "$UPLOADS_CRITICAL_PCT" ]; then
    check_cond uploads_warn 1 "Uploads growing: $UP_DETAIL (warning threshold ${UPLOADS_WARN_PCT}%). Review attachment retention/cleanup." \
      "Uploads back below ${UPLOADS_WARN_PCT}% of disk."
  else
    check_cond uploads_warn 0 "Uploads growing: ${UPLOADS_PCT}% of disk." "Uploads back below ${UPLOADS_WARN_PCT}%."
  fi
fi

AGE=$(jpath "$TMP" backups.latestAgeHours)
if [ "$AGE" = "" ] || [ "$AGE" = "null" ] || [ "$AGE" -gt "$STALE_HOURS" ]; then
  if [ "$AGE" = "" ] || [ "$AGE" = "null" ]; then
    AGE_TEXT="no backups found"
  else
    AGE_TEXT="latest backup is ${AGE}h old"
  fi
  check_cond backup_stale 1 "Backup is stale: $AGE_TEXT (threshold ${STALE_HOURS}h)." \
    "Backup is fresh again (latest ${AGE_TEXT})."
else
  check_cond backup_stale 0 "Backup is stale: ${AGE}h old." "Backup is fresh again."
fi

TOOLS=$(tools_bad "$TMP")
if [ -n "$TOOLS" ]; then
  check_cond backup_tools 1 "Backup tools missing or broken: $TOOLS." \
    "All backup tools are available again."
else
  check_cond backup_tools 0 "Backup tools missing or broken." "All backup tools are available again."
fi

if [ "$ALERT_NO_RESTORE" = "1" ]; then
  RESTORE=$(jpath "$TMP" backups.lastRestoreTest)
  if [ -z "$RESTORE" ] || [ "$RESTORE" = "null" ]; then
    check_cond restore_untested 1 "No restore test on record — run scripts/restore-test.sh and verify a package." \
      "A restore test is on record."
  else
    check_cond restore_untested 0 "No restore test on record." "A restore test is on record."
  fi
fi

exit 0
