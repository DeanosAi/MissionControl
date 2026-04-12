#!/usr/bin/env pwsh
# Mission Control - Setup Permanent Cloudflare Tunnel
# Creates a named tunnel with a fixed URL that never changes

$ErrorActionPreference = 'Stop'

Write-Host ""
Write-Host "=== Mission Control - Permanent Cloudflare Tunnel Setup ===" -ForegroundColor Cyan
Write-Host ""

# Configuration
$tunnelName = "mission-control-gpt"
$configDir = "$env:USERPROFILE\.cloudflared"
$configFile = "$configDir\config.yml"

# Ensure config directory exists
if (-not (Test-Path $configDir)) {
    New-Item -ItemType Directory -Path $configDir -Force | Out-Null
}

Write-Host "Step 1: Creating tunnel '$tunnelName'..." -ForegroundColor Yellow

# Create the tunnel
try {
    $createOutput = cloudflared tunnel create $tunnelName 2>&1
    Write-Host "[OK] Tunnel created!" -ForegroundColor Green
    
    # Extract tunnel ID from output
    $tunnelId = ($createOutput | Select-String -Pattern "([a-f0-9-]{36})").Matches.Groups[1].Value
    
    if (-not $tunnelId) {
        # Try to get tunnel ID from list
        $listOutput = cloudflared tunnel list --output json | ConvertFrom-Json
        $tunnel = $listOutput | Where-Object { $_.name -eq $tunnelName } | Select-Object -First 1
        $tunnelId = $tunnel.id
    }
    
    Write-Host "  Tunnel ID: $tunnelId" -ForegroundColor Gray
    Write-Host ""
    
} catch {
    if ($_ -match "already exists") {
        Write-Host "[OK] Tunnel already exists (using existing)" -ForegroundColor Green
        
        # Get tunnel ID from existing tunnel
        $listOutput = cloudflared tunnel list --output json | ConvertFrom-Json
        $tunnel = $listOutput | Where-Object { $_.name -eq $tunnelName } | Select-Object -First 1
        $tunnelId = $tunnel.id
        
        Write-Host "  Tunnel ID: $tunnelId" -ForegroundColor Gray
        Write-Host ""
    } else {
        throw $_
    }
}

Write-Host "Step 2: Creating configuration file..." -ForegroundColor Yellow

# Create config.yml
$configContent = @"
tunnel: $tunnelId
credentials-file: $configDir\$tunnelId.json

ingress:
  - service: http://localhost:3001
"@

$configContent | Out-File -FilePath $configFile -Encoding UTF8 -Force

Write-Host "[OK] Config file created: $configFile" -ForegroundColor Green
Write-Host ""

Write-Host "Step 3: Getting your permanent tunnel URL..." -ForegroundColor Yellow

# Route DNS (this creates the permanent URL)
try {
    # Check if route already exists
    $routes = cloudflared tunnel route dns $tunnelName 2>&1
    
    if ($routes -match "already exists") {
        Write-Host "[OK] DNS route already configured" -ForegroundColor Green
    } else {
        Write-Host "[OK] DNS route created" -ForegroundColor Green
    }
} catch {
    Write-Host "[INFO] DNS routing will be automatic" -ForegroundColor Gray
}

# Get the tunnel info
$tunnelInfo = cloudflared tunnel info $tunnelName 2>&1

Write-Host ""
Write-Host "=====================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "✅ Permanent Tunnel Created!" -ForegroundColor Green
Write-Host ""
Write-Host "Your PERMANENT URL is:" -ForegroundColor Yellow
Write-Host "  https://$tunnelId.cfargotunnel.com" -ForegroundColor White
Write-Host ""
Write-Host "This URL will NEVER change - even when you restart your PC!" -ForegroundColor Green
Write-Host ""
Write-Host "=====================================================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Update VPS .env file:" -ForegroundColor White
Write-Host "   OPENAI_OAUTH_ENDPOINT=https://$tunnelId.cfargotunnel.com/chat" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Restart Docker on VPS:" -ForegroundColor White
Write-Host "   sudo docker compose restart" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Update auto-start to use permanent tunnel:" -ForegroundColor White
Write-Host "   .\scripts\setup-autostart-permanent-tunnel.ps1" -ForegroundColor Gray
Write-Host ""

# Save tunnel info for reference
$infoFile = "$PSScriptRoot\cloudflare-tunnel-info.txt"
@"
Mission Control - Permanent Cloudflare Tunnel

Tunnel Name: $tunnelName
Tunnel ID: $tunnelId
Permanent URL: https://$tunnelId.cfargotunnel.com

VPS Configuration:
OPENAI_OAUTH_ENDPOINT=https://$tunnelId.cfargotunnel.com/chat

Created: $(Get-Date)
"@ | Out-File -FilePath $infoFile -Encoding UTF8 -Force

Write-Host "Tunnel info saved to: $infoFile" -ForegroundColor Gray
Write-Host ""
