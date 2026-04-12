# Mission Control — GPT OAuth Tunnel
# Runs on your local Windows PC to tunnel the OAuth proxy to the VPS.
#
# This creates an SSH reverse tunnel so the VPS can reach your local
# OAuth proxy at localhost:3001 even though your PC has no public IP.
#
# Prerequisites:
#   1. chat-oauth-proxy.js must be running locally (node scripts/chat-oauth-proxy.js)
#   2. SSH key-based auth to the VPS must be working
#
# Usage:
#   .\start-gpt-tunnel.ps1
#
# What it does:
#   - Opens an SSH reverse tunnel: VPS localhost:3001 -> your PC localhost:3001
#   - Keeps the tunnel alive with autossh-style reconnection
#   - The VPS app detects GPT availability via localhost:3001/health
#
# To stop: Ctrl+C or close the PowerShell window

$ErrorActionPreference = 'Stop'

# --- Configuration ---
$VPS_USER = "deanadmin"  # Updated to match actual VPS username
$VPS_HOST = "app.missioncontroldb.online"
$LOCAL_PORT = 3001
$REMOTE_PORT = 3001
$SSH_KEY = "$env:USERPROFILE\.ssh\dean-vps"  # Updated to match actual key name

Write-Host ""
Write-Host "=== Mission Control GPT OAuth Tunnel ===" -ForegroundColor Cyan
Write-Host ""

# Check if the OAuth proxy is running locally
try {
    $health = Invoke-RestMethod -Uri "http://localhost:$LOCAL_PORT/health" -TimeoutSec 3
    Write-Host "[OK] OAuth proxy is running locally (status: $($health.status))" -ForegroundColor Green
} catch {
    Write-Host "[WARNING] OAuth proxy not detected on localhost:$LOCAL_PORT" -ForegroundColor Yellow
    Write-Host "  Start it first: node scripts\chat-oauth-proxy.js" -ForegroundColor Yellow
    Write-Host "  Continuing anyway (proxy can be started later)..." -ForegroundColor Yellow
    Write-Host ""
}

Write-Host "Starting SSH reverse tunnel..." -ForegroundColor Cyan
Write-Host "  Local:  localhost:$LOCAL_PORT (your OAuth proxy)" -ForegroundColor Gray
Write-Host "  Remote: $VPS_HOST localhost:$REMOTE_PORT (VPS)" -ForegroundColor Gray
Write-Host ""
Write-Host "The VPS app will detect GPT as available when this tunnel is open." -ForegroundColor Green
Write-Host "Press Ctrl+C to stop the tunnel." -ForegroundColor Yellow
Write-Host ""

# Reconnection loop
$retryDelay = 5
while ($true) {
    try {
        Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Connecting tunnel..." -ForegroundColor Gray

        # SSH reverse tunnel: -R binds remote port to local port
        # -N = no remote command, -o = keepalive settings
        ssh -i $SSH_KEY `
            -R ${REMOTE_PORT}:localhost:${LOCAL_PORT} `
            -N `
            -o "ServerAliveInterval=30" `
            -o "ServerAliveCountMax=3" `
            -o "ExitOnForwardFailure=yes" `
            -o "StrictHostKeyChecking=accept-new" `
            "${VPS_USER}@${VPS_HOST}"

        # If SSH exits cleanly, reconnect after delay
        Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Tunnel disconnected. Reconnecting in ${retryDelay}s..." -ForegroundColor Yellow
    } catch {
        Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Connection error: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host "  Retrying in ${retryDelay}s..." -ForegroundColor Yellow
    }
    Start-Sleep -Seconds $retryDelay
}
