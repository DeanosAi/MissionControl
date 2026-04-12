# Run this script as Administrator to set up the interactive usage-update loop at login

$ErrorActionPreference = 'Stop'

if (-NOT ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")) {
    Write-Host "ERROR: This script must be run as Administrator" -ForegroundColor Red
    Write-Host "`nRight-click PowerShell and select 'Run as Administrator', then run this script again." -ForegroundColor Yellow
    exit 1
}

Write-Host "Setting up Mission Control usage update loop..." -ForegroundColor Cyan

$scriptPath = "A:\Desktop\Mission Control VPS\vps-app\scripts\usage-update-loop.ps1"

$existingTask = Get-ScheduledTask -TaskName "Mission Control Usage Update Loop" -ErrorAction SilentlyContinue
if ($existingTask) {
    Unregister-ScheduledTask -TaskName "Mission Control Usage Update Loop" -Confirm:$false
}

$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$scriptPath`""
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited

$null = Register-ScheduledTask -TaskName "Mission Control Usage Update Loop" -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force -ErrorAction Stop

Write-Host "`nUsage update loop startup task created successfully!" -ForegroundColor Green
Write-Host "It will start when you log in and run the snapshot refresh every 10 minutes in your interactive session." -ForegroundColor Cyan
Write-Host "`nImportant:" -ForegroundColor Yellow
Write-Host "1. Keep using the SSH key startup helper so your key is unlocked after login." -ForegroundColor White
Write-Host "2. Logs are written to:" -ForegroundColor White
Write-Host "   A:\Desktop\Mission Control VPS\vps-app\logs\usage-update.log" -ForegroundColor Gray
Write-Host "   A:\Desktop\Mission Control VPS\vps-app\logs\usage-update-runner.log" -ForegroundColor Gray
Write-Host "`nTo start it immediately without rebooting, run this in a normal PowerShell window:" -ForegroundColor Yellow
Write-Host "  Start-Process powershell -ArgumentList '-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File ""A:\Desktop\Mission Control VPS\vps-app\scripts\usage-update-loop.ps1""'" -ForegroundColor White
