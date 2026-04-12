#!/usr/bin/env pwsh
# Mission Control - Setup Auto-Start for GPT OAuth Tunnel
# This creates a Windows Task Scheduler task that starts the GPT OAuth tunnel
# automatically when you log in to Windows.

$ErrorActionPreference = 'Stop'

Write-Host ""
Write-Host "=== Mission Control - Auto-Start Setup ===" -ForegroundColor Cyan
Write-Host ""

# Paths
$scriptPath = "$PSScriptRoot\start-gpt-oauth-with-vps-update.ps1"
$taskName = "MissionControl-GPT-OAuth"
$taskDescription = "Auto-start Mission Control GPT OAuth tunnel with VPS auto-update on login"

# Check if script exists
if (-not (Test-Path $scriptPath)) {
    Write-Host "Error: Script not found at $scriptPath" -ForegroundColor Red
    exit 1
}

Write-Host "Creating scheduled task: $taskName" -ForegroundColor Yellow
Write-Host "  Script: $scriptPath" -ForegroundColor Gray
Write-Host "  Trigger: At user login" -ForegroundColor Gray
Write-Host ""

# Create the scheduled task
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

    # Register the task
    Register-ScheduledTask `
        -TaskName $taskName `
        -Description $taskDescription `
        -Action $action `
        -Trigger $trigger `
        -Settings $settings `
        -User $env:USERNAME `
        -RunLevel Limited `
        -Force | Out-Null

    Write-Host "[OK] Scheduled task created successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "The GPT OAuth tunnel will now start automatically when you log in." -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Management:" -ForegroundColor Yellow
    Write-Host "  • View task: Open Task Scheduler > Task Scheduler Library > $taskName" -ForegroundColor White
    Write-Host "  • Disable:   Run this script with -Disable" -ForegroundColor White
    Write-Host "  • Remove:    Run this script with -Remove" -ForegroundColor White
    Write-Host ""
    Write-Host "Note: The tunnel runs hidden in the background." -ForegroundColor Gray
    Write-Host "Check if it's running: Get-Process -Name powershell" -ForegroundColor Gray
    Write-Host ""

} catch {
    Write-Host "[ERROR] Failed to create scheduled task:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host ""
    Write-Host "You may need to run PowerShell as Administrator to create scheduled tasks." -ForegroundColor Yellow
    exit 1
}

Write-Host "Setup complete! 🎉" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Restart your PC (or log out and back in)" -ForegroundColor White
Write-Host "  2. The tunnel will start automatically" -ForegroundColor White
Write-Host "  3. Check https://app.missioncontroldb.online/chat for green GPT badge" -ForegroundColor White
Write-Host ""
