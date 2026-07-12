# WBOS Database Restore Script (Windows)
# Usage:
#   .\scripts\restore.ps1                    # restore latest backup
#   .\scripts\restore.ps1 -RestoreFile <file> # restore specific backup

param(
    [string]$RestoreFile
)

$BackupDir = if ($env:WBOS_BACKUP_DIR) { $env:WBOS_BACKUP_DIR } else { ".\backups" }

if (-not $RestoreFile) {
    $latestLink = Join-Path $BackupDir "latest"
    $RestoreFile = Get-Content $latestLink -ErrorAction SilentlyContinue
    if (-not $RestoreFile) {
        $latest = Get-ChildItem -Path $BackupDir -Filter "wbos_backup_*.sql.gz" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
        if (-not $latest) {
            Write-Error "No backup files found in ${BackupDir}"
            exit 1
        }
        $RestoreFile = $latest.FullName
    }
}

if (-not (Test-Path $RestoreFile)) {
    Write-Error "Backup file not found: ${RestoreFile}"
    exit 1
}

Write-Host "WARNING: This will overwrite the current database!" -ForegroundColor Yellow
$confirm = Read-Host "Are you sure? (yes/no)"
if ($confirm -ne "yes") {
    Write-Host "Restore cancelled."
    exit 0
}

$DbUrl = $env:DATABASE_URL
if (-not $DbUrl) {
    Write-Error "DATABASE_URL environment variable is not set."
    exit 1
}

Write-Host "Restoring from: ${RestoreFile}"

# Decompress and restore
$tempDump = "temp_restore_$(Get-Date -Format 'yyyyMMdd_HHmmss').dump"
& gzip -d -c $RestoreFile > $tempDump

$env:PGPASSWORD = [System.Uri]::new($DbUrl).Password
$process = Start-Process -FilePath "psql" -ArgumentList $DbUrl -NoNewWindow -RedirectStandardInput $tempDump -Wait -PassThru

Remove-Item $tempDump -ErrorAction SilentlyContinue

if ($process.ExitCode -ne 0) {
    Write-Error "Restore failed with exit code $($process.ExitCode)"
    exit 1
}

Write-Host "Restore complete from: ${RestoreFile}" -ForegroundColor Green
