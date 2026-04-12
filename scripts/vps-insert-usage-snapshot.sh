#!/bin/bash
# This script runs ON THE VPS to insert usage snapshot data into the database
# It will be configured to run via sudo without password for security

set -euo pipefail

# Use absolute path instead of ~ (which becomes /root when run via sudo)
APP_DIR="/home/deanadmin/apps/mission-control-vps"

# Read SQL from stdin
SQL=$(cat)

# Validate that it's an INSERT statement for usage_snapshots (security check)
if ! echo "$SQL" | grep -q "INSERT INTO mission_control.usage_snapshots"; then
  echo "ERROR: Only INSERT statements for usage_snapshots are allowed" >&2
  exit 1
fi

# Execute the SQL
cd "$APP_DIR"
docker compose exec -T postgres psql -U mission_control -d mission_control <<< "$SQL"

echo "Usage snapshot updated successfully"
