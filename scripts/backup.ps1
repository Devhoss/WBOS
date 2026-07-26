# WBOS Tiered Backup Script (Windows)
# Usage: .\scripts\backup.ps1 [[-BackupRoot] <string>] [[-StorageRoot] <string>]
#
# Produces tiered backups under <BackupRoot>/:
#   daily/   — last 7 kept
#   weekly/  — last 4 kept (promoted every Sunday)
#   monthly/ — last 12 kept (promoted on 1st of month)
#   yearly/  — kept forever (promoted on Dec 31)
#   uploads/ — last 7 kept (optional, if StorageRoot is provided)

param(
    [string]$BackupRoot = ${env:WBOS_BACKUP_DIR},
    [string]$StorageRoot = ${env:WBOS_STORAGE_ROOT}
)

$BackupRoot = if ($BackupRoot) { $BackupRoot } else { ".\backups" }

$Timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$DayOfWeek = (Get-Date).DayOfWeek.value__  # 0=Sun ... 6=Sat
$DayOfMonth = (Get-Date).Day
$Month = (Get-Date).Month
$Year = (Get-Date).Year

# ── Directories ──
$DailyDir = Join-Path $BackupRoot "daily"
$WeeklyDir = Join-Path $BackupRoot "weekly"
$MonthlyDir = Join-Path $BackupRoot "monthly"
$YearlyDir = Join-Path $BackupRoot "yearly"
$UploadsDir = Join-Path $BackupRoot "uploads"
$Manifest = Join-Path $BackupRoot "backup-manifest.json"

foreach ($dir in @($DailyDir, $WeeklyDir, $MonthlyDir, $YearlyDir, $UploadsDir)) {
    New-Item -ItemType Directory -Path $dir -Force | Out-Null
}

# ── Helper: check if last day of year ──
function Is-LastDayOfYear {
    param($month, $day)
    return ($month -eq 12 -and $day -eq 31)
}

# ── Helper: retention limit (keep newest N) ──
function Invoke-RetentionLimit {
    param([string]$Dir, [int]$Keep, [string]$Pattern = "wbos_db_*.sql.gz")
    if (-not (Test-Path $Dir)) { return }
    $files = Get-ChildItem -Path $Dir -Filter $Pattern | Sort-Object LastWriteTime -Descending
    if ($files.Count -gt $Keep) {
        $files | Select-Object -Skip $Keep | ForEach-Object {
            Remove-Item -LiteralPath $_.FullName -Force
            Write-Host "  Pruned: $($_.FullName)"
        }
    }
}

# ── Helper: record manifest entry ──
function Add-ManifestEntry {
    param([string]$ManifestPath, [string]$DbFile, [string]$UploadsFile, [string]$Tier)

    $dbName = Split-Path $DbFile -Leaf
    $dbSize = if (Test-Path $DbFile) { "{0:N0}" -f ((Get-Item $DbFile).Length / 1KB) + " KB" } else { "?" }

    $uploadsName = $null
    $uploadsSize = $null
    if ($UploadsFile -and (Test-Path $UploadsFile)) {
        $uploadsName = Split-Path $UploadsFile -Leaf
        $uploadsSize = "{0:N0}" -f ((Get-Item $UploadsFile).Length / 1KB) + " KB"
    }

    $entry = @{
        timestamp      = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
        tier           = $Tier
        database       = $dbName
        database_size  = $dbSize
        uploads        = $uploadsName
        uploads_size   = $uploadsSize
    } | ConvertTo-Json -Compress

    # NDJSON format — one JSON object per line, newest first
    $lines = @($entry)
    if (Test-Path $ManifestPath) {
        $lines += Get-Content $ManifestPath
    }
    $lines | Select-Object -First 200 | Set-Content $ManifestPath -Force
}

# ═══════════════════════════════════════════════════════════════════
#  MAIN
# ═══════════════════════════════════════════════════════════════════

Write-Host "=== WBOS Backup: $(Get-Date) ==="
Write-Host "  Backup root: $BackupRoot"
Write-Host ""

$DbUrl = $env:DATABASE_URL
if (-not $DbUrl) {
    Write-Error "DATABASE_URL environment variable is not set."
    exit 1
}

# ── 1. Daily backup ──
Write-Host "--- Daily backup ---"
$DbFile = Join-Path $DailyDir "wbos_db_$Timestamp.sql.gz"
$env:PGPASSWORD = ([System.Uri]::new($DbUrl)).Password
$tempDump = Join-Path $env:TEMP "wbos_dump_$Timestamp.dump"
try {
    $proc = Start-Process -FilePath "pg_dump" -ArgumentList $DbUrl -NoNewWindow -RedirectStandardOutput $tempDump -Wait -PassThru
    if ($proc.ExitCode -ne 0) { throw "pg_dump exit code $($proc.ExitCode)" }
    & gzip -c $tempDump | Set-Content $DbFile -AsByteStream
    $size = "{0:N0}" -f ((Get-Item $DbFile).Length / 1KB) + " KB"
    Write-Host "  Saved: $DbFile ($size)"
} finally {
    Remove-Item $tempDump -ErrorAction SilentlyContinue
}

# ── 2. Uploads backup ──
$UploadsFile = $null
if ($StorageRoot -and (Test-Path $StorageRoot)) {
    Write-Host "--- Uploads backup ---"
    $UploadsFile = Join-Path $UploadsDir "wbos_uploads_$Timestamp.tar.gz"
    $parent = Split-Path $StorageRoot -Parent
    $leaf = Split-Path $StorageRoot -Leaf
    & tar czf $UploadsFile -C $parent $leaf
    if (Test-Path $UploadsFile) {
        $size = "{0:N0}" -f ((Get-Item $UploadsFile).Length / 1KB) + " KB"
        Write-Host "  Saved: $UploadsFile ($size)"
    } else {
        Write-Host "  Skipped (directory empty or missing)"
        $UploadsFile = $null
    }
}

# ── 3. Tier promotion ──
$CurrentTier = "daily"

if ($DayOfWeek -eq 0) {
    Write-Host "--- Promoting to weekly (Sunday) ---"
    Copy-Item $DbFile $WeeklyDir\
    Write-Host "  Copied to: $WeeklyDir\$(Split-Path $DbFile -Leaf)"
    $CurrentTier = "weekly"
}

if ($DayOfMonth -eq 1) {
    Write-Host "--- Promoting to monthly (1st of month) ---"
    Copy-Item $DbFile $MonthlyDir\
    Write-Host "  Copied to: $MonthlyDir\$(Split-Path $DbFile -Leaf)"
    $CurrentTier = "monthly"
}

if (Is-LastDayOfYear -month $Month -day $DayOfMonth) {
    Write-Host "--- Promoting to yearly snapshot (Dec 31) ---"
    $YearlyFilename = "wbos-$Year-12-31.sql.gz"
    Copy-Item $DbFile (Join-Path $YearlyDir $YearlyFilename)
    Write-Host "  Snapshot: $(Join-Path $YearlyDir $YearlyFilename)"
    $CurrentTier = "yearly"
    Add-ManifestEntry -ManifestPath $Manifest -DbFile (Join-Path $YearlyDir $YearlyFilename) -UploadsFile $UploadsFile -Tier "yearly-snapshot"
}

# ── 4. Retention cleanup ──
Write-Host "--- Retention cleanup ---"
Invoke-RetentionLimit -Dir $DailyDir -Keep 7
Invoke-RetentionLimit -Dir $WeeklyDir -Keep 4
Invoke-RetentionLimit -Dir $MonthlyDir -Keep 12
Invoke-RetentionLimit -Dir $UploadsDir -Keep 7 -Pattern "wbos_uploads_*.tar.gz"
Write-Host "  Done"

# ── 5. Record manifest ──
Write-Host "--- Recording manifest ---"
Add-ManifestEntry -ManifestPath $Manifest -DbFile $DbFile -UploadsFile $UploadsFile -Tier $CurrentTier
Write-Host "  Manifest: $Manifest"

Write-Host ""
Write-Host "=== Backup complete ==="
