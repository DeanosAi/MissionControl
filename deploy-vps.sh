#!/bin/bash
# Mission Control VPS - VPS Deployment Script
# Run on VPS after git push

set -e  # Exit on error

echo "=== Mission Control VPS - Deployment ==="
echo ""

# Navigate to app directory
cd ~/apps/mission-control-vps

# Pull latest code
echo "=== Pulling latest code from GitHub ==="
git fetch origin
git reset --hard origin/main
echo "✅ Code updated"
echo ""

# Run database migrations
echo "=== Running database migrations ==="
docker cp database/migrations/001_task_executions.sql mission-control-db:/tmp/
docker cp database/migrations/002_journal_memory.sql mission-control-db:/tmp/

echo "Running migration 001_task_executions.sql..."
docker exec mission-control-db psql -U dean -d mission_control -f /tmp/001_task_executions.sql || echo "Migration 001 may have already run (OK if tables exist)"

echo "Running migration 002_journal_memory.sql..."
docker exec mission-control-db psql -U dean -d mission_control -f /tmp/002_journal_memory.sql || echo "Migration 002 may have already run (OK if tables exist)"

echo "✅ Migrations complete"
echo ""

# Verify tables
echo "=== Verifying database tables ==="
docker exec mission-control-db psql -U dean -d mission_control -c "\dt"
echo ""

# Rebuild Docker containers
echo "=== Rebuilding Docker containers ==="
docker-compose down
docker-compose up -d --build
echo "✅ Docker rebuild complete"
echo ""

# Wait for app to start
echo "=== Waiting for app to start ==="
sleep 10

# Show logs
echo "=== Recent app logs ==="
docker-compose logs app --tail=30
echo ""

echo "=== Deployment Complete! ==="
echo ""
echo "🎉 Mission Control VPS v1 is now deployed!"
echo ""
echo "Next steps:"
echo "  1. Visit: https://app.missioncontroldb.online"
echo "  2. Test login and features"
echo "  3. Check Systems page for health status"
echo "  4. Set up backups with: ./scripts/backup-database.sh"
echo "  5. Add cron job for nightly backups"
echo ""
