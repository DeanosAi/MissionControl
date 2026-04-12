# This script needs to run as Administrator to enable ssh-agent
# Right-click PowerShell and choose "Run as Administrator", then run this script

$ErrorActionPreference = 'Stop'

if (-NOT ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")) {
    Write-Host "ERROR: This script must be run as Administrator" -ForegroundColor Red
    Write-Host "`nRight-click PowerShell and select 'Run as Administrator', then run this script again." -ForegroundColor Yellow
    exit 1
}

Write-Host "Setting up SSH agent service..." -ForegroundColor Cyan

# Enable and start ssh-agent service
Set-Service -Name ssh-agent -StartupType Automatic
Start-Service ssh-agent

Write-Host "SSH agent service is now running and set to start automatically" -ForegroundColor Green
Write-Host "`nNow run this in a NORMAL (non-admin) PowerShell window:" -ForegroundColor Cyan
Write-Host "  ssh-add `$env:USERPROFILE\.ssh\id_ed25519" -ForegroundColor White
Write-Host "`nYou'll be prompted for your passphrase once, then it will be cached." -ForegroundColor Yellow
