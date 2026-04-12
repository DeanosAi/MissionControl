# This script adds your SSH key to ssh-agent on startup
# It will prompt for your passphrase once when you log in

$ErrorActionPreference = 'Stop'

# Ensure ssh-agent is running
$sshAgent = Get-Service ssh-agent -ErrorAction SilentlyContinue
if ($sshAgent.Status -ne 'Running') {
    Write-Host "Starting ssh-agent..." -ForegroundColor Yellow
    Start-Service ssh-agent
}

# Add the SSH key
$keyPath = "$env:USERPROFILE\.ssh\id_ed25519"
if (Test-Path $keyPath) {
    Write-Host "Adding SSH key to agent..." -ForegroundColor Cyan
    Write-Host "You will be prompted for your SSH key passphrase." -ForegroundColor Yellow
    ssh-add $keyPath
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "SSH key added successfully!" -ForegroundColor Green
    } else {
        Write-Host "Failed to add SSH key" -ForegroundColor Red
    }
} else {
    Write-Host "SSH key not found at $keyPath" -ForegroundColor Red
}
