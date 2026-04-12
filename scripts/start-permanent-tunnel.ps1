#!/usr/bin/env pwsh
# Mission Control - Start Permanent Cloudflare Tunnel
# Uses the named tunnel configuration

$ErrorActionPreference = 'Stop'
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host ""
Write-Host "=== Mission Control GPT OAuth (Permanent Tunnel) ===" -ForegroundColor Cyan
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
Write-Host "Starting permanent Cloudflare tunnel..." -ForegroundColor Cyan
Write-Host "  Using named tunnel: mission-control-gpt" -ForegroundColor Gray
Write-Host "  URL: Fixed (see cloudflare-tunnel-info.txt)" -ForegroundColor Gray
Write-Host ""
Write-Host "(Press Ctrl+C to stop everything)" -ForegroundColor Yellow
Write-Host ""

try {
    # Start the named tunnel using the config file
    cloudflared tunnel run mission-control-gpt
} finally {
    # Cleanup: stop the proxy job when tunnel stops
    Write-Host ""
    Write-Host "Stopping OAuth proxy..." -ForegroundColor Yellow
    Stop-Job $proxyJob -ErrorAction SilentlyContinue
    Remove-Job $proxyJob -ErrorAction SilentlyContinue
    Write-Host "GPT OAuth shutdown complete." -ForegroundColor Cyan
}
