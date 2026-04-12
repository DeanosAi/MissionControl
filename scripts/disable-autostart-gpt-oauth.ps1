#!/usr/bin/env pwsh
# Mission Control - Disable Auto-Start for GPT OAuth

$taskName = "MissionControl-GPT-OAuth"

Write-Host ""
Write-Host "=== Disabling Auto-Start ===" -ForegroundColor Yellow
Write-Host ""

try {
    Disable-ScheduledTask -TaskName $taskName -ErrorAction Stop | Out-Null
    Write-Host "[OK] Auto-start disabled" -ForegroundColor Green
    Write-Host "The tunnel will no longer start automatically on login." -ForegroundColor Gray
    Write-Host ""
    Write-Host "To re-enable: .\setup-autostart-gpt-oauth.ps1" -ForegroundColor Cyan
} catch {
    Write-Host "[ERROR] Failed to disable task: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "The task may not exist. Run setup-autostart-gpt-oauth.ps1 first." -ForegroundColor Yellow
}
Write-Host ""
