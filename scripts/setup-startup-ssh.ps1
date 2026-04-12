# Run this script as Administrator to set up automatic SSH key loading on startup

$ErrorActionPreference = 'Stop'

if (-NOT ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")) {
    Write-Host "ERROR: This script must be run as Administrator" -ForegroundColor Red
    Write-Host "`nRight-click PowerShell and select 'Run as Administrator', then run this script again." -ForegroundColor Yellow
    exit 1
}

Write-Host "Setting up automatic SSH key loading on startup..." -ForegroundColor Cyan

$scriptPath = "A:\Desktop\Mission Control VPS\vps-app\scripts\add-ssh-key-on-startup.ps1"

# Create a startup task that runs when the user logs in
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Normal -File `"$scriptPath`""

# Trigger at user logon
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME

# Settings
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries

# Principal - run as the logged-in user
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited

# Register the task
Register-ScheduledTask -TaskName "Mission Control SSH Key Startup" -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force

Write-Host "`nStartup task created successfully!" -ForegroundColor Green
Write-Host "`nWhen you restart and log in, a PowerShell window will appear asking for your SSH passphrase." -ForegroundColor Cyan
Write-Host "After entering it once, all Mission Control updates will work automatically." -ForegroundColor Cyan
Write-Host "`nTo test, you can run the task now from Task Scheduler, or just restart your computer." -ForegroundColor Gray
