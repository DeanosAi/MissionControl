#!/usr/bin/env pwsh
# Mission Control - Remove Auto-Start for GPT OAuth

$taskName = "MissionControl-GPT-OAuth"

Write-Host ""
Write-Host "=== Removing Auto-Start ===" -ForegroundColor Red
Write-Host ""

try {
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction Stop
    Write-Host "[OK] Auto-start task removed" -ForegroundColor Green
    Write-Host "The scheduled task has been deleted." -ForegroundColor Gray
    Write-Host ""
    Write-Host "To set it up again: .\setup-autostart-gpt-oauth.ps1" -ForegroundColor Cyan
} catch {
    Write-Host "[ERROR] Failed to remove task: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "The task may not exist." -ForegroundColor Yellow
}
Write-Host ""
