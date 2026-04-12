#!/usr/bin/env pwsh
# Mission Control — Start GPT OAuth + Auto-Update VPS
# This starts the tunnel AND automatically updates the VPS with the new URL

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
Write-Host "Starting Cloudflare tunnel..." -ForegroundColor Cyan
Write-Host ""

# Start cloudflared in background
$tunnelJob = Start-Job -ScriptBlock {
    cloudflared tunnel --url http://localhost:3001 2>&1
}

# Wait for tunnel URL to appear
Write-Host "Waiting for tunnel URL..." -ForegroundColor Yellow
$tunnelUrl = $null
$maxAttempts = 30
$attempt = 0

while (-not $tunnelUrl -and $attempt -lt $maxAttempts) {
    Start-Sleep -Seconds 1
    $attempt++
    
    # Check job output for URL
    $output = Receive-Job -Job $tunnelJob
    if ($output -match "https://([a-z0-9-]+\.trycloudflare\.com)") {
        $tunnelUrl = $matches[1]
        break
    }
}

if (-not $tunnelUrl) {
    Write-Host "[ERROR] Could not detect tunnel URL after $maxAttempts seconds" -ForegroundColor Red
    Write-Host "Check the tunnel job output manually" -ForegroundColor Yellow
    Stop-Job $proxyJob -ErrorAction SilentlyContinue
    Remove-Job $proxyJob -ErrorAction SilentlyContinue
    Stop-Job $tunnelJob -ErrorAction SilentlyContinue
    Remove-Job $tunnelJob -ErrorAction SilentlyContinue
    exit 1
}

$fullUrl = "https://$tunnelUrl"
Write-Host "[OK] Tunnel URL: $fullUrl" -ForegroundColor Green
Write-Host ""

# Auto-update VPS
Write-Host "Auto-updating VPS with new tunnel URL..." -ForegroundColor Yellow

$sshCommand = @"
cd ~/apps/mission-control-vps && \
sed -i 's|OPENAI_OAUTH_ENDPOINT=.*|OPENAI_OAUTH_ENDPOINT=$fullUrl/chat|' .env && \
sudo docker compose restart
"@

try {
    $updateResult = ssh deanadmin@app.missioncontroldb.online $sshCommand 2>&1
    
    # Check if SSH worked (it will hang in PowerShell, so we can't wait for it)
    # Instead, just show the command was sent
    Write-Host "[OK] VPS update command sent" -ForegroundColor Green
    Write-Host ""
    Write-Host "Tunnel is now running!" -ForegroundColor Cyan
    Write-Host "  Local OAuth: http://localhost:3001" -ForegroundColor Gray
    Write-Host "  Public URL:  $fullUrl" -ForegroundColor Gray
    Write-Host "  VPS will update in ~30 seconds" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Check: https://app.missioncontroldb.online/chat" -ForegroundColor White
    Write-Host ""
    Write-Host "(Press Ctrl+C to stop everything)" -ForegroundColor Yellow
    Write-Host ""
    
} catch {
    Write-Host "[WARNING] VPS auto-update may have failed" -ForegroundColor Yellow
    Write-Host "Manual update command:" -ForegroundColor Cyan
    Write-Host "  ssh deanadmin@app.missioncontroldb.online" -ForegroundColor Gray
    Write-Host "  cd ~/apps/mission-control-vps" -ForegroundColor Gray
    Write-Host "  nano .env" -ForegroundColor Gray
    Write-Host "  # Change to: OPENAI_OAUTH_ENDPOINT=$fullUrl/chat" -ForegroundColor Gray
    Write-Host "  sudo docker compose restart" -ForegroundColor Gray
    Write-Host ""
}

try {
    # Keep tunnel running in foreground
    # Output tunnel logs
    while ($true) {
        $output = Receive-Job -Job $tunnelJob
        if ($output) {
            Write-Host $output
        }
        
        # Check if tunnel job is still running
        if ($tunnelJob.State -ne 'Running') {
            Write-Host "[WARNING] Tunnel stopped unexpectedly" -ForegroundColor Yellow
            break
        }
        
        Start-Sleep -Seconds 1
    }
} finally {
    # Cleanup: stop both jobs
    Write-Host ""
    Write-Host "Stopping OAuth proxy and tunnel..." -ForegroundColor Yellow
    Stop-Job $proxyJob -ErrorAction SilentlyContinue
    Remove-Job $proxyJob -ErrorAction SilentlyContinue
    Stop-Job $tunnelJob -ErrorAction SilentlyContinue
    Remove-Job $tunnelJob -ErrorAction SilentlyContinue
    Write-Host "GPT OAuth shutdown complete." -ForegroundColor Cyan
}
