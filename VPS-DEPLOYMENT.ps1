#!/usr/bin/env pwsh
# Mission Control VPS - Complete Deployment on VPS
# Run this after files are on VPS via git pull

$VPS_HOST = "dean@app.missioncontroldb.online"

Write-Host "=== Mission Control VPS - VPS Deployment ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "✅ Code pushed to GitHub" -ForegroundColor Green
Write-Host "📥 Now pulling on VPS and deploying..." -ForegroundColor Yellow
Write-Host ""

# Commands to run on VPS
$commands = @"
cd ~/apps/mission-control-vps && \
echo '=== Pulling latest code from GitHub ===' && \
git fetch origin && \
git reset --hard origin/main && \
echo '' && \
echo '✅ Code updated' && \
echo '' && \
echo '=== Running database migrations ===' && \
docker cp database/migrations/001_task_executions.sql mission-control-db:/tmp/ && \
docker cp database/migrations/002_journal_memory.sql mission-control-db:/tmp/ && \
docker exec mission-control-db psql -U dean -d mission_control -f /tmp/001_task_executions.sql && \
docker exec mission-control-db psql -U dean -d mission_control -f /tmp/002_journal_memory.sql && \
echo '' && \
echo '✅ Migrations complete' && \
echo '' && \
echo '=== Verifying tables ===' && \
docker exec mission-control-db psql -U dean -d mission_control -c "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename;" && \
echo '' && \
echo '=== Rebuilding Docker containers ===' && \
docker-compose down && \
docker-compose up -d --build && \
echo '' && \
echo '✅ Docker rebuild complete' && \
echo '' && \
echo '=== Waiting for app to start ===' && \
sleep 5 && \
docker-compose logs app --tail=20
"@

Write-Host "Executing deployment on VPS..." -ForegroundColor Yellow
Write-Host ""

ssh $VPS_HOST $commands

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "=== Deployment Complete! ===" -ForegroundColor Green
    Write-Host ""
    Write-Host "🎉 Mission Control VPS v1 is now deployed!" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Yellow
    Write-Host "  1. Visit: https://app.missioncontroldb.online" -ForegroundColor White
    Write-Host "  2. Test login and basic features" -ForegroundColor White
    Write-Host "  3. Check Systems page for health status" -ForegroundColor White
    Write-Host "  4. Set up backups: ssh to VPS and run backup script" -ForegroundColor White
    Write-Host "  5. Optional: Start GPT OAuth with .\scripts\start-gpt-oauth.ps1" -ForegroundColor White
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "❌ Deployment failed. Check output above for errors." -ForegroundColor Red
    Write-Host ""
    Write-Host "Manual steps:" -ForegroundColor Yellow
    Write-Host "  1. SSH to VPS: ssh $VPS_HOST" -ForegroundColor White
    Write-Host "  2. Follow DEPLOYMENT-STEPS.md Phase 3-6" -ForegroundColor White
    Write-Host ""
}
"@
</invoke>