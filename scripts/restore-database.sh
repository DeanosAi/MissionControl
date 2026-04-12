#!/bin/bash
# Mission Control VPS — Database Restore Script
# Milestone G: Operations and resilience
#
# Usage: ./restore-database.sh /path/to/mc-backup-2026-04-12_020000.sql.gz
#
# WARNING: This will DROP and recreate all data in the mission_control schema.
# Make sure you have the right backup file before running.

set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Usage: $0 <backup-file.sql.gz>"
  echo ""
  echo "Available backups:"
  BACKUP_DIR="${BACKUP_DIR:-/home/dean/backups/mission-control}"
  ls -lht "$BACKUP_DIR"/mc-backup-*.sql.gz 2>/dev/null || echo "  No backups found in $BACKUP_DIR"
  exit 1
fi

BACKUP_FILE="$1"
DB_CONTAINER="${DB_CONTAINER:-mission-control-postgres}"
DB_NAME="${POSTGRES_DB:-mission_control}"
DB_USER="${POSTGRES_USER:-mission_control}"

if [ ! -f "$BACKUP_FILE" ]; then
  echo "ERROR: Backup file not found: $BACKUP_FILE"
  exit 1
fi

echo "=== Mission Control Database Restore ==="
echo "Backup file: $BACKUP_FILE"
echo "Target DB:   $DB_NAME in container $DB_CONTAINER"
echo ""
echo "WARNING: This will replace ALL data in the database."
read -p "Continue? (y/N): " confirm

if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
  echo "Restore cancelled."
  exit 0
fi

echo ""
echo "[$(date)] Starting restore..."

if gunzip -c "$BACKUP_FILE" | docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" --quiet 2>&1; then
  echo "[$(date)] Restore completed successfully."
else
  echo "[$(date)] ERROR: Restore may have encountered issues. Check the output above."
  exit 1
fi
