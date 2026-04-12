#!/usr/bin/env pwsh
# Mission Control - Setup Auto-Start for Permanent Tunnel
# Updates the scheduled task to use the permanent tunnel instead of quick tunnel

$ErrorActionPreference = 'Stop'

Write-Host ""
Write-Host "=== Mission Control - Update Auto-Start to Permanent Tunnel ===" -ForegroundColor Cyan
Write-Host ""

# Paths
$scriptPath = "$PSScriptRoot\start-permanent-tunnel.ps1"
$taskName = "MissionControl-GPT-OAuth"
$taskDescription = "Auto-start Mission Control GPT OAuth tunnel (permanent) on login"

# Check if script exists
if (-not (Test-Path $scriptPath)) {
    Write-Host "Error: Script not found at $scriptPath" -ForegroundColor Red
    exit 1
}

Write-Host "Updating scheduled task: $taskName" -ForegroundColor Yellow
Write-Host "  Old script: start-gpt-oauth-cloudflare.ps1" -ForegroundColor Gray
Write-Host "  New script: start-permanent-tunnel.ps1" -ForegroundColor Gray
Write-Host ""

try {
    # Define the action (what to run)
    $action = New-ScheduledTaskAction `
        -Execute "powershell.exe" `
        -Argument "-WindowStyle Hidden -ExecutionPolicy Bypass -File `"$scriptPath`""

    # Define the trigger (when to run)
    $trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME

    # Define settings
    $settings = New-ScheduledTaskSettingsSet `
        -AllowStartIfOnBatteries `
        -DontStopIfGoingOnBatteries `
        -StartWhenAvailable `
        -RestartCount 3 `
        -RestartInterval (New-TimeSpan -Minutes 1)

    # Register/update the task
    Register-ScheduledTask `
        -TaskName $taskName `
        -Description $taskDescription `
        -Action $action `
        -Trigger $trigger `
        -Settings $settings `
        -User $env:USERNAME `
        -RunLevel Limited `
        -Force | Out-Null

    Write-Host "[OK] Scheduled task updated!" -ForegroundColor Green
    Write-Host ""
    Write-Host "The permanent tunnel will now start automatically on login." -ForegroundColor Cyan
    Write-Host "The tunnel URL will NEVER change (even after restarts)!" -ForegroundColor Green
    Write-Host ""
    Write-Host "To test: Log out and back in, or restart your PC" -ForegroundColor Yellow
    Write-Host ""

} catch {
    Write-Host "[ERROR] Failed to update scheduled task:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host ""
    Write-Host "You may need to run PowerShell as Administrator." -ForegroundColor Yellow
    exit 1
}
