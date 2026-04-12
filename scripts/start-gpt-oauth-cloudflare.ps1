#!/usr/bin/env pwsh
# Mission Control — GPT OAuth via Cloudflare Tunnel
# This is MORE RELIABLE than SSH tunnel - no SSH issues!
#
# Prerequisites:
#   1. Install cloudflared: winget install Cloudflare.cloudflared
#   2. Login once: cloudflared tunnel login
#
# Usage:
#   .\start-gpt-oauth-cloudflare.ps1

$ErrorActionPreference = 'Stop'
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host ""
Write-Host "=== Mission Control GPT OAuth (Cloudflare Tunnel) ===" -ForegroundColor Cyan
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
Write-Host "Starting Cloudflare tunnel..." -ForegroundColor Cyan
Write-Host "  This creates a secure tunnel from Cloudflare to your PC" -ForegroundColor Gray
Write-Host "  The tunnel URL will be displayed below" -ForegroundColor Gray
Write-Host ""
Write-Host "(Press Ctrl+C to stop everything)" -ForegroundColor Yellow
Write-Host ""

try {
    # Start cloudflare tunnel
    # This will print the tunnel URL (e.g., https://random-name.trycloudflare.com)
    cloudflared tunnel --url http://localhost:3001
} finally {
    # Cleanup: stop the proxy job when tunnel stops
    Write-Host ""
    Write-Host "Stopping OAuth proxy..." -ForegroundColor Yellow
    Stop-Job $proxyJob -ErrorAction SilentlyContinue
    Remove-Job $proxyJob -ErrorAction SilentlyContinue
    Write-Host "GPT OAuth shutdown complete." -ForegroundColor Cyan
}
