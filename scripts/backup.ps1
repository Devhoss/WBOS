# WBOS Database Backup Script (Windows)
# Usage: .\scripts\backup.ps1 [[-OutputDir] <string>]

param(
    [string]$OutputDir = ${env:WBOS_BACKUP_DIR},
    [int]$RetentionDays = ${env:WBOS_BACKUP_RETENTION_DAYS}
)

$OutputDir = if ($OutputDir) { $OutputDir } else { ".\backups" }
if (-not $RetentionDays) { $RetentionDays = 30 }
$Timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$Filename = "wbos_backup_$Timestamp.sql.gz"

if (-not (Test-Path -LiteralPath $OutputDir)) {
    New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
}

$DbUrl = $env:DATABASE_URL
if (-not $DbUrl) {
    Write-Error "DATABASE_URL environment variable is not set."
    exit 1
}

Write-Host "Backing up database to ${OutputDir}\${Filename} ..."

# Use pg_dump via pipe to gzip
$env:PGPASSWORD = [System.Uri]::new($DbUrl).Password
$escaped = [System.Management.Automation.SecurityElement]::Escape($DbUrl)
$process = Start-Process -FilePath "pg_dump" -ArgumentList $DbUrl -NoNewWindow -RedirectStandardOutput "temp_$Timestamp.dump" -Wait -PassThru

if ($process.ExitCode -ne 0) {
    Write-Error "pg_dump failed with exit code $($process.ExitCode)"
    Remove-Item "temp_$Timestamp.dump" -ErrorAction SilentlyContinue
    exit 1
}

# Compress
& gzip -c "temp_$Timestamp.dump" > "${OutputDir}\${Filename}"
Remove-Item "temp_$Timestamp.dump"

Write-Host "Backup saved: ${OutputDir}\${Filename}"

# Retention cleanup
$cutoff = (Get-Date).AddDays(-$RetentionDays)
Get-ChildItem -Path $OutputDir -Filter "wbos_backup_*.sql.gz" | Where-Object {
    $_.CreationTime -lt $cutoff
} | Remove-Item -Force

Write-Host "Cleaned up backups older than ${RetentionDays} days."
