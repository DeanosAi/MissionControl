$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $scriptDir
$logDir = Join-Path $projectRoot 'logs'
$logPath = Join-Path $logDir 'usage-update.log'
$runnerLogPath = Join-Path $logDir 'usage-update-runner.log'

if (-not (Test-Path $logDir)) {
    New-Item -ItemType Directory -Path $logDir -Force | Out-Null
}

function Write-RunnerLog([string]$message) {
    $timestamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
    Add-Content -Path $runnerLogPath -Value "[$timestamp] $message"
}

Write-RunnerLog "Usage update loop started"

while ($true) {
    try {
        Write-RunnerLog "Triggering usage snapshot update"
        & (Join-Path $scriptDir 'update-usage-snapshot-remote-v2.ps1') *>> $logPath
        Write-RunnerLog "Usage snapshot update completed"
    } catch {
        Write-RunnerLog "Usage snapshot update failed: $($_.Exception.Message)"
    }

    Start-Sleep -Seconds 600
}
