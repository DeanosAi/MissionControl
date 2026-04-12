#!/usr/bin/env pwsh
# Mission Control VPS - Deployment Upload Script

Write-Host "=== Mission Control VPS Deployment ===" -ForegroundColor Cyan
Write-Host ""

$VPS_HOST = "dean@app.missioncontroldb.online"
$VPS_PATH = "~/apps/mission-control-vps"
$LOCAL_PATH = "C:\Users\deano\Projects\mission-control\"

# Test SSH connection first
Write-Host "Testing SSH connection..." -ForegroundColor Yellow
$sshTest = ssh -o ConnectTimeout=5 $VPS_HOST "echo 'OK'" 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Cannot connect to VPS. Please check:" -ForegroundColor Red
    Write-Host "  1. VPS is online" -ForegroundColor Red
    Write-Host "  2. SSH key is loaded (ssh-add -l)" -ForegroundColor Red
    Write-Host "  3. Internet connection is working" -ForegroundColor Red
    exit 1
}
Write-Host "✅ SSH connection OK" -ForegroundColor Green
Write-Host ""

# Check if directory exists
Write-Host "Checking VPS directory..." -ForegroundColor Yellow
ssh $VPS_HOST "mkdir -p $VPS_PATH"
Write-Host "✅ Directory ready" -ForegroundColor Green
Write-Host ""

# Backup existing .env if it exists
Write-Host "Backing up existing .env file..." -ForegroundColor Yellow
ssh $VPS_HOST "cd $VPS_PATH && [ -f .env ] && cp .env .env.backup || echo 'No existing .env found'"
Write-Host "✅ Backup complete" -ForegroundColor Green
Write-Host ""

# Upload files using rsync
Write-Host "Uploading files to VPS..." -ForegroundColor Yellow
Write-Host "(This may take a few minutes...)" -ForegroundColor Gray
Write-Host ""

# Check if rsync is available
$rsyncAvailable = Get-Command rsync -ErrorAction SilentlyContinue
if ($null -eq $rsyncAvailable) {
    Write-Host "⚠️  rsync not found. Using SCP instead..." -ForegroundColor Yellow
    Write-Host "   (This will be slower. Consider installing rsync for future deployments)" -ForegroundColor Gray
    Write-Host ""
    
    # Use tar + scp as alternative
    Write-Host "Creating deployment archive..." -ForegroundColor Yellow
    $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $archiveName = "mission-control-$timestamp.tar.gz"
    
    # Create tar archive excluding unnecessary files
    tar -czf $archiveName `
        --exclude=node_modules `
        --exclude=.git `
        --exclude=.next `
        --exclude=data `
        --exclude=*.log `
        --exclude=.env.backup `
        *
    
    Write-Host "✅ Archive created: $archiveName" -ForegroundColor Green
    Write-Host ""
    
    Write-Host "Uploading archive to VPS..." -ForegroundColor Yellow
    scp $archiveName "${VPS_HOST}:/tmp/"
    
    Write-Host "Extracting on VPS..." -ForegroundColor Yellow
    ssh $VPS_HOST "cd $VPS_PATH && tar -xzf /tmp/$archiveName && rm /tmp/$archiveName"
    
    # Clean up local archive
    Remove-Item $archiveName
    
    Write-Host "✅ Files uploaded via SCP" -ForegroundColor Green
    
} else {
    # Use rsync (faster and smarter)
    rsync -avz --progress `
        --exclude='node_modules' `
        --exclude='.git' `
        --exclude='.next' `
        --exclude='data' `
        --exclude='*.log' `
        --exclude='.env.backup' `
        $LOCAL_PATH `
        "${VPS_HOST}:${VPS_PATH}/"
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Files uploaded via rsync" -ForegroundColor Green
    } else {
        Write-Host "❌ Upload failed" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""
Write-Host "=== Upload Complete ===" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. SSH into VPS: ssh $VPS_HOST" -ForegroundColor White
Write-Host "  2. Restore .env: cd $VPS_PATH && cp .env.backup .env" -ForegroundColor White
Write-Host "  3. Run migrations (see DEPLOYMENT-STEPS.md Phase 4)" -ForegroundColor White
Write-Host "  4. Rebuild Docker: docker-compose down && docker-compose up -d --build" -ForegroundColor White
Write-Host ""
