# Mission Control — Start GPT OAuth (proxy + tunnel)
# Runs on your local Windows PC. Launches both:
#   1. The OAuth proxy (chat-oauth-proxy.js) 
#   2. The SSH reverse tunnel to the VPS
#
# Usage:
#   .\start-gpt-oauth.ps1
#
# To stop: Close this window (kills both processes)

$ErrorActionPreference = 'Stop'
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host ""
Write-Host "=== Mission Control GPT OAuth Startup ===" -ForegroundColor Cyan
Write-Host ""

# Start the OAuth proxy in the background
Write-Host "Starting OAuth proxy..." -ForegroundColor Gray
$proxyJob = Start-Job -ScriptBlock {
    param($dir)
    Set-Location $dir
    node scripts/chat-oauth-proxy.js 2>&1
} -ArgumentList (Split-Path -Parent $scriptDir)

Start-Sleep -Seconds 2

# Check if proxy started
try {
    $health = Invoke-RestMethod -Uri "http://localhost:3001/health" -TimeoutSec 3
    Write-Host "[OK] OAuth proxy started (status: $($health.status))" -ForegroundColor Green
} catch {
    Write-Host "[WARNING] OAuth proxy may still be starting..." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Starting SSH tunnel to VPS..." -ForegroundColor Gray
Write-Host "(Press Ctrl+C to stop everything)" -ForegroundColor Yellow
Write-Host ""

try {
    # Run the tunnel in the foreground (blocks here)
    & "$scriptDir\start-gpt-tunnel.ps1"
} finally {
    # Cleanup: stop the proxy job when tunnel stops
    Write-Host ""
    Write-Host "Stopping OAuth proxy..." -ForegroundColor Yellow
    Stop-Job $proxyJob -ErrorAction SilentlyContinue
    Remove-Job $proxyJob -ErrorAction SilentlyContinue
    Write-Host "GPT OAuth shutdown complete." -ForegroundColor Cyan
}
