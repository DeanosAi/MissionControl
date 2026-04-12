# Run this script as Administrator to set up automatic usage updates every 10 minutes

$ErrorActionPreference = 'Stop'

if (-NOT ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")) {
    Write-Host "ERROR: This script must be run as Administrator" -ForegroundColor Red
    Write-Host "`nRight-click PowerShell and select 'Run as Administrator', then run this script again." -ForegroundColor Yellow
    exit 1
}

Write-Host "Creating scheduled task for Mission Control usage updates..." -ForegroundColor Cyan

$scriptPath = "A:\Desktop\Mission Control VPS\vps-app\scripts\run-usage-update-with-log.ps1"

$existingTask = Get-ScheduledTask -TaskName "Mission Control Usage Update" -ErrorAction SilentlyContinue
if ($existingTask) {
    Unregister-ScheduledTask -TaskName "Mission Control Usage Update" -Confirm:$false
}

$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$scriptPath`""
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 10) -RepetitionDuration (New-TimeSpan -Days 3650)
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -RunOnlyIfNetworkAvailable
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited

$null = Register-ScheduledTask -TaskName "Mission Control Usage Update" -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force -ErrorAction Stop

$taskInfo = Get-ScheduledTask -TaskName "Mission Control Usage Update" | Get-ScheduledTaskInfo

Write-Host "`nScheduled task created successfully!" -ForegroundColor Green
Write-Host "Next run time: $($taskInfo.NextRunTime)" -ForegroundColor Cyan
Write-Host "The task will run every 10 minutes and update Mission Control usage data." -ForegroundColor Cyan
Write-Host "`nLog file:" -ForegroundColor Yellow
Write-Host "  A:\Desktop\Mission Control VPS\vps-app\logs\usage-update.log" -ForegroundColor White
Write-Host "`nIMPORTANT: After each restart, you need to unlock your SSH key once if ssh-agent is empty:" -ForegroundColor Yellow
Write-Host "  ssh-add `$env:USERPROFILE\.ssh\id_ed25519" -ForegroundColor White
