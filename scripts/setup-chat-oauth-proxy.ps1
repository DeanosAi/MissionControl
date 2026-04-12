# Run this script as Administrator to set up the Chat OAuth Proxy to run automatically

$ErrorActionPreference = 'Stop'

if (-NOT ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")) {
    Write-Host "ERROR: This script must be run as Administrator" -ForegroundColor Red
    Write-Host "`nRight-click PowerShell and select 'Run as Administrator', then run this script again." -ForegroundColor Yellow
    exit 1
}

Write-Host "Setting up Mission Control Chat OAuth Proxy..." -ForegroundColor Cyan

$scriptPath = "A:\Desktop\Mission Control VPS\vps-app\scripts\chat-oauth-proxy.js"

# Task action - run the proxy server
$action = New-ScheduledTaskAction -Execute "node.exe" -Argument "`"$scriptPath`"" -WorkingDirectory "A:\Desktop\Mission Control VPS\vps-app"

# Trigger - start at user logon
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME

# Settings
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Hours 0)

# Principal - run as the logged-in user
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited

# Register the task
Register-ScheduledTask -TaskName "Mission Control Chat OAuth Proxy" -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force

Write-Host "`nChat OAuth Proxy startup task created!" -ForegroundColor Green
Write-Host "`nThe proxy will start automatically when you log in." -ForegroundColor Cyan
Write-Host "It runs in the background and allows Mission Control chat to use OpenClaw OAuth (no API credits)." -ForegroundColor Cyan

Write-Host "`nNext steps:" -ForegroundColor Yellow
Write-Host "1. Find your local IP address: ipconfig (look for IPv4)" -ForegroundColor White
Write-Host "2. On the VPS, add to .env:" -ForegroundColor White
Write-Host "   OPENAI_OAUTH_ENDPOINT=http://YOUR_LOCAL_IP:3001/chat" -ForegroundColor Gray
Write-Host "`nTo start the proxy now without restarting, run:" -ForegroundColor Yellow
Write-Host "  node scripts\chat-oauth-proxy.js" -ForegroundColor White
