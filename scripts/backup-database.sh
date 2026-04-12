#!/bin/bash
# Mission Control VPS — Automated Postgres Backup Script
# Milestone G: Operations and resilience
#
# Usage: Run via cron (e.g. daily at 2am):
#   0 2 * * * /home/dean/apps/mission-control-vps/scripts/backup-database.sh >> /var/log/mc-backup.log 2>&1
#
# What it does:
#   1. Dumps the mission_control database to a compressed SQL file
#   2. Keeps the last 7 daily backups (rolling retention)
#   3. Writes a JSON status file that the app can read for health visibility
#
# Requirements:
#   - pg_dump available (installed with postgresql-client)
#   - Docker postgres container running as "mission-control-postgres"
#   - Backup directory exists

set -euo pipefail

# --- Configuration ---
BACKUP_DIR="${BACKUP_DIR:-/home/dean/backups/mission-control}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"
DB_CONTAINER="${DB_CONTAINER:-mission-control-postgres}"
DB_NAME="${POSTGRES_DB:-mission_control}"
DB_USER="${POSTGRES_USER:-mission_control}"
STATUS_FILE="${BACKUP_DIR}/backup-status.json"
TIMESTAMP=$(date +%Y-%m-%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/mc-backup-${TIMESTAMP}.sql.gz"

# --- Setup ---
mkdir -p "$BACKUP_DIR"

echo "[$(date)] Starting Mission Control backup..."

# --- Dump database ---
if docker exec "$DB_CONTAINER" pg_dump -U "$DB_USER" -d "$DB_NAME" --clean --if-exists | gzip > "$BACKUP_FILE"; then
  BACKUP_SIZE=$(stat -c%s "$BACKUP_FILE" 2>/dev/null || stat -f%z "$BACKUP_FILE" 2>/dev/null || echo "0")
  BACKUP_SIZE_MB=$(echo "scale=2; $BACKUP_SIZE / 1048576" | bc 2>/dev/null || echo "unknown")
  echo "[$(date)] Backup created: $BACKUP_FILE ($BACKUP_SIZE_MB MB)"
  STATUS="success"
  ERROR=""
else
  echo "[$(date)] ERROR: Backup failed!"
  STATUS="failed"
  ERROR="pg_dump failed"
  BACKUP_SIZE_MB="0"
fi

# --- Cleanup old backups ---
DELETED_COUNT=0
if [ "$STATUS" = "success" ]; then
  while IFS= read -r old_file; do
    rm -f "$old_file"
    DELETED_COUNT=$((DELETED_COUNT + 1))
    echo "[$(date)] Deleted old backup: $old_file"
  done < <(find "$BACKUP_DIR" -name "mc-backup-*.sql.gz" -mtime +${RETENTION_DAYS} -type f 2>/dev/null)
fi

# --- Count remaining backups ---
BACKUP_COUNT=$(find "$BACKUP_DIR" -name "mc-backup-*.sql.gz" -type f 2>/dev/null | wc -l)

# --- Write status file ---
cat > "$STATUS_FILE" << EOF
{
  "lastBackup": "${TIMESTAMP}",
  "lastBackupFile": "${BACKUP_FILE}",
  "status": "${STATUS}",
  "error": "${ERROR}",
  "sizeMb": "${BACKUP_SIZE_MB}",
  "retainedBackups": ${BACKUP_COUNT},
  "retentionDays": ${RETENTION_DAYS},
  "deletedThisRun": ${DELETED_COUNT},
  "updatedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF

echo "[$(date)] Backup complete. Status: $STATUS, Retained: $BACKUP_COUNT backups"
