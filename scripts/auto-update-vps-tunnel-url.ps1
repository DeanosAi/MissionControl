#!/usr/bin/env pwsh
# Mission Control - Auto-Update VPS with New Tunnel URL
# This script detects the Cloudflare tunnel URL and updates the VPS automatically

param(
    [int]$WaitSeconds = 10
)

$ErrorActionPreference = 'Stop'

Write-Host ""
Write-Host "=== Auto-Update VPS Tunnel URL ===" -ForegroundColor Cyan
Write-Host ""

# Wait for tunnel to start and get URL
Write-Host "Waiting $WaitSeconds seconds for tunnel to establish..." -ForegroundColor Yellow
Start-Sleep -Seconds $WaitSeconds

# Find the tunnel URL from cloudflared process or logs
Write-Host "Detecting tunnel URL..." -ForegroundColor Yellow

# Try to get URL from cloudflared metrics
try {
    $metricsResponse = Invoke-RestMethod -Uri "http://127.0.0.1:20241/metrics" -TimeoutSec 3
    $tunnelUrl = ($metricsResponse | Select-String -Pattern "https://([a-z0-9-]+\.trycloudflare\.com)").Matches.Groups[1].Value
    
    if ($tunnelUrl) {
        $fullUrl = "https://$tunnelUrl"
        Write-Host "[OK] Found tunnel URL: $fullUrl" -ForegroundColor Green
    } else {
        throw "URL not found in metrics"
    }
} catch {
    Write-Host "[WARNING] Could not auto-detect URL from metrics" -ForegroundColor Yellow
    Write-Host "Please check the tunnel startup output for the URL" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Manual update command:" -ForegroundColor Cyan
    Write-Host '  ssh deanadmin@app.missioncontroldb.online "cd ~/apps/mission-control-vps && sed -i ''s|OPENAI_OAUTH_ENDPOINT=.*|OPENAI_OAUTH_ENDPOINT=https://YOUR-URL.trycloudflare.com/chat|'' .env && sudo docker compose restart"' -ForegroundColor Gray
    exit 1
}

# Update VPS via SSH
Write-Host ""
Write-Host "Updating VPS .env file..." -ForegroundColor Yellow

$sshCommand = "cd ~/apps/mission-control-vps && sed -i 's|OPENAI_OAUTH_ENDPOINT=.*|OPENAI_OAUTH_ENDPOINT=$fullUrl/chat|' .env && sudo docker compose restart"

try {
    ssh deanadmin@app.missioncontroldb.online $sshCommand
    
    Write-Host "[OK] VPS updated and restarted!" -ForegroundColor Green
    Write-Host ""
    Write-Host "GPT OAuth should now be online at:" -ForegroundColor Cyan
    Write-Host "  https://app.missioncontroldb.online/chat" -ForegroundColor White
    Write-Host ""
} catch {
    Write-Host "[ERROR] Failed to update VPS" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host ""
    Write-Host "Manual commands:" -ForegroundColor Yellow
    Write-Host "  ssh deanadmin@app.missioncontroldb.online" -ForegroundColor Gray
    Write-Host "  cd ~/apps/mission-control-vps" -ForegroundColor Gray
    Write-Host "  nano .env" -ForegroundColor Gray
    Write-Host "  # Change OPENAI_OAUTH_ENDPOINT=$fullUrl/chat" -ForegroundColor Gray
    Write-Host "  sudo docker compose restart" -ForegroundColor Gray
}
