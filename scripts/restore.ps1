# WBOS Database Restore Script (Windows)
# Usage:
#   .\scripts\restore.ps1                          # interactive — pick from tiers
#   .\scripts\restore.ps1 -RestoreFile <file>      # restore specific backup file
#   .\scripts\restore.ps1 -Latest                  # restore newest across all tiers
#   .\scripts\restore.ps1 -Tier daily              # restore newest in tier
#   .\scripts\restore.ps1 -List                    # list available backups
#   .\scripts\restore.ps1 -RestoreUploads [file]   # restore uploads archive

param(
    [string]$RestoreFile,
    [switch]$Latest,
    [string]$Tier,
    [switch]$List,
    [string]$RestoreUploads
)

$BackupRoot = if ($env:WBOS_BACKUP_DIR) { $env:WBOS_BACKUP_DIR } else { ".\backups" }
$StorageRoot = if ($env:WBOS_STORAGE_ROOT) { $env:WBOS_STORAGE_ROOT } else { ".\storage" }

$TierDirs = @("daily", "weekly", "monthly", "yearly")
$TierLabels = @("Daily (last 7)", "Weekly (last 4)", "Monthly (last 12)", "Yearly (kept forever)")

function Show-BackupList {
    param([string]$TierFilter)
    if ($TierFilter) {
        $dir = Join-Path $BackupRoot $TierFilter
        Write-Host "=== $($TierFilter.Substring(0,1).ToUpper() + $TierFilter.Substring(1)) backups ==="
        if (Test-Path $dir) {
            Get-ChildItem -Path $dir -Filter "wbos_db_*.sql.gz" | Sort-Object LastWriteTime -Descending | ForEach-Object {
                Write-Host "  $($_.FullName)  ($($_.Length / 1KB) KB, $($_.LastWriteTime))"
            }
        } else {
            Write-Host "  (none)"
        }
    } else {
        for ($i = 0; $i -lt $TierDirs.Length; $i++) {
            $dir = Join-Path $BackupRoot $TierDirs[$i]
            Write-Host ""
            Write-Host "=== $($TierLabels[$i]) ($($TierDirs[$i])/) ==="
            if (Test-Path $dir) {
                $files = Get-ChildItem -Path $dir -Filter "wbos_db_*.sql.gz" | Sort-Object LastWriteTime -Descending
                if ($files.Count -gt 0) {
                    $files | ForEach-Object { Write-Host "  $($_.Name)  ($($_.Length / 1KB) KB, $($_.LastWriteTime))" }
                } else {
                    Write-Host "  (none)"
                }
            } else {
                Write-Host "  (none)"
            }
        }
        Write-Host ""
        Write-Host "=== Uploads backups ==="
        $upDir = Join-Path $BackupRoot "uploads"
        if (Test-Path $upDir) {
            Get-ChildItem -Path $upDir -Filter "wbos_uploads_*.tar.gz" | Sort-Object LastWriteTime -Descending | ForEach-Object {
                Write-Host "  $($_.Name)  ($($_.Length / 1KB) KB)"
            }
        } else {
            Write-Host "  (none)"
        }
    }
}

function Find-LatestBackup {
    $latest = $null
    foreach ($t in $TierDirs) {
        $dir = Join-Path $BackupRoot $t
        if (Test-Path $dir) {
            $f = Get-ChildItem -Path $dir -Filter "wbos_db_*.sql.gz" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
            if ($f) {
                if (-not $latest -or $f.LastWriteTime -gt $latest.LastWriteTime) {
                    $latest = $f
                }
            }
        }
    }
    return $latest
}

function Find-LatestInTier {
    param([string]$TierName)
    $dir = Join-Path $BackupRoot $TierName
    if (Test-Path $dir) {
        return Get-ChildItem -Path $dir -Filter "wbos_db_*.sql.gz" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    }
    return $null
}

function Select-BackupInteractive {
    $candidates = @()
    foreach ($t in $TierDirs) {
        $dir = Join-Path $BackupRoot $t
        if (Test-Path $dir) {
            $candidates += Get-ChildItem -Path $dir -Filter "wbos_db_*.sql.gz"
        }
    }
    $candidates = $candidates | Sort-Object LastWriteTime -Descending

    if ($candidates.Count -eq 0) {
        Write-Error "No backup files found in any tier under ${BackupRoot}"
        exit 1
    }

    Write-Host "Available backups (newest first):"
    for ($i = 0; $i -lt $candidates.Count; $i++) {
        $tierLabel = $candidates[$i].Directory.Name
        $size = "{0:N0}" -f ($candidates[$i].Length / 1KB) + " KB"
        Write-Host "  [$($i+1)] $($candidates[$i].FullName)  ($size, $tierLabel)"
    }
    $choice = Read-Host "Select backup [1-$($candidates.Count)]"
    $idx = [int]$choice - 1
    if ($idx -lt 0 -or $idx -ge $candidates.Count) {
        Write-Error "Invalid choice."
        exit 1
    }
    return $candidates[$idx].FullName
}

function Restore-Database {
    param([string]$FilePath)
    if (-not (Test-Path $FilePath)) {
        Write-Error "Backup file not found: $FilePath"
        exit 1
    }

    $size = "{0:N0}" -f ((Get-Item $FilePath).Length / 1KB) + " KB"
    Write-Host "Backup file: $FilePath ($size)"
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

    Write-Host "Restoring..."
    $tempDump = Join-Path $env:TEMP "wbos_restore_$(Get-Date -Format 'yyyyMMdd_HHmmss').dump"
    try {
        & gzip -d -c $FilePath > $tempDump
        $env:PGPASSWORD = ([System.Uri]::new($DbUrl)).Password
        $proc = Start-Process -FilePath "psql" -ArgumentList $DbUrl -NoNewWindow -RedirectStandardInput $tempDump -Wait -PassThru
        if ($proc.ExitCode -ne 0) {
            throw "psql exit code $($proc.ExitCode)"
        }
        Write-Host "Restore complete from: $FilePath" -ForegroundColor Green
    } finally {
        Remove-Item $tempDump -ErrorAction SilentlyContinue
    }
}

function Restore-Uploads {
    param([string]$ArchiveFile)
    if (-not $ArchiveFile) {
        $upDir = Join-Path $BackupRoot "uploads"
        if (Test-Path $upDir) {
            $latest = Get-ChildItem -Path $upDir -Filter "wbos_uploads_*.tar.gz" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
            if (-not $latest) {
                Write-Error "No uploads backups found."
                exit 1
            }
            $ArchiveFile = $latest.FullName
            Write-Host "Using latest uploads backup: $ArchiveFile"
        } else {
            Write-Error "No uploads backups found."
            exit 1
        }
    }

    if (-not (Test-Path $ArchiveFile)) {
        Write-Error "Uploads archive not found: $ArchiveFile"
        exit 1
    }

    if (-not (Test-Path $StorageRoot)) {
        Write-Host "Warning: Storage root $StorageRoot does not exist. Creating..."
        New-Item -ItemType Directory -Path $StorageRoot -Force | Out-Null
    }

    $size = "{0:N0}" -f ((Get-Item $ArchiveFile).Length / 1KB) + " KB"
    Write-Host "Uploads archive: $ArchiveFile ($size)"
    Write-Host "Target: $StorageRoot"
    Write-Host "WARNING: This will overwrite existing files in $StorageRoot!" -ForegroundColor Yellow
    $confirm = Read-Host "Are you sure? (yes/no)"
    if ($confirm -ne "yes") {
        Write-Host "Restore cancelled."
        exit 0
    }

    Write-Host "Restoring uploads..."
    $parent = Split-Path $StorageRoot -Parent
    & tar xzf $ArchiveFile -C $parent
    Write-Host "Uploads restore complete from: $ArchiveFile" -ForegroundColor Green
}

# ═══════════════════════════════════════════════════════════════════════════
#  DISPATCH
# ═══════════════════════════════════════════════════════════════════════════

if ($List) {
    Show-BackupList -TierFilter $Tier
    exit 0
}

if ($Latest) {
    $backup = Find-LatestBackup
    if (-not $backup) {
        Write-Error "No backup files found in any tier under ${BackupRoot}"
        exit 1
    }
    Write-Host "Using latest backup: $($backup.FullName)"
    Restore-Database -FilePath $backup.FullName
    exit 0
}

if ($Tier) {
    $backup = Find-LatestInTier -TierName $Tier
    if (-not $backup) {
        Write-Error "No backup files found in tier '$Tier'"
        exit 1
    }
    Write-Host "Using latest $Tier backup: $($backup.FullName)"
    Restore-Database -FilePath $backup.FullName
    exit 0
}

if ($RestoreUploads) {
    Restore-Uploads -ArchiveFile $RestoreUploads
    exit 0
}

if ($RestoreFile) {
    Restore-Database -FilePath $RestoreFile
    exit 0
}

# Interactive mode
$selected = Select-BackupInteractive
Restore-Database -FilePath $selected
