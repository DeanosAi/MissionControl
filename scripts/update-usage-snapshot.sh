#!/bin/bash
set -euo pipefail

# This script reads OpenClaw models status from the host and writes a usage snapshot into the database.
# It should run on the host where OpenClaw is installed, not inside the container.

COMPOSE_DIR="$HOME/apps/mission-control-vps"

# Get OpenClaw status
STATUS_OUTPUT=$(openclaw models status 2>&1 || echo "")

# Parse OpenAI usage
OPENAI_LINE=$(echo "$STATUS_OUTPUT" | grep -i 'openai-codex' | grep -i 'usage:' | head -n1 || echo "")

if [[ -n "$OPENAI_LINE" ]]; then
  # Strip ANSI codes
  CLEAN_LINE=$(echo "$OPENAI_LINE" | sed 's/\x1b\[[0-9;]*m//g')
  
  # Extract: usage: 93% left ⏱ 4h 59m · Week 37% left ⏱ 6d 4h 59m
  if [[ "$CLEAN_LINE" =~ usage:[[:space:]]*([0-9]+%[[:space:]]left)[[:space:]]*⏱[[:space:]]*([^·]+)·[[:space:]]*Week[[:space:]]*([0-9]+%[[:space:]]left)[[:space:]]*⏱[[:space:]]*(.+)$ ]]; then
    WINDOW_LEFT="${BASH_REMATCH[1]}"
    RESET_IN="${BASH_REMATCH[2]}"
    WEEKLY_LEFT="${BASH_REMATCH[3]}"
    WEEKLY_RESET="${BASH_REMATCH[4]}"
  else
    WINDOW_LEFT="Unavailable"
    RESET_IN="Unknown"
    WEEKLY_LEFT="Unavailable"
    WEEKLY_RESET="Unknown"
  fi
else
  WINDOW_LEFT="Unavailable"
  RESET_IN="Unknown"
  WEEKLY_LEFT="Unavailable"
  WEEKLY_RESET="Unknown"
fi

# Parse Claude status
if echo "$STATUS_OUTPUT" | grep -q 'anthropic:default='; then
  CLAUDE_STATUS="Connected"
  CLAUDE_NOTE="Anthropic key is active. Exact remaining spend/credits are not exposed by the current verified host-side status source."
else
  CLAUDE_STATUS="Unavailable"
  CLAUDE_NOTE="Anthropic provider details unavailable."
fi

# Escape single quotes for SQL
WINDOW_LEFT="${WINDOW_LEFT//\'/\'\'}"
RESET_IN="${RESET_IN//\'/\'\'}"
WEEKLY_LEFT="${WEEKLY_LEFT//\'/\'\'}"
WEEKLY_RESET="${WEEKLY_RESET//\'/\'\'}"
CLAUDE_STATUS="${CLAUDE_STATUS//\'/\'\'}"
CLAUDE_NOTE="${CLAUDE_NOTE//\'/\'\'}"

# Build SQL
SQL="INSERT INTO mission_control.usage_snapshots (
  source,
  openai_window_left,
  openai_reset_in,
  openai_weekly_left,
  openai_weekly_reset_in,
  claude_status,
  claude_note
)
VALUES (
  'host-openclaw-models-status',
  '$WINDOW_LEFT',
  '$RESET_IN',
  '$WEEKLY_LEFT',
  '$WEEKLY_RESET',
  '$CLAUDE_STATUS',
  '$CLAUDE_NOTE'
);"

# Execute SQL in the postgres container
cd "$COMPOSE_DIR"
echo "$SQL" | sudo docker compose exec -T postgres psql -U mission_control -d mission_control

echo "✓ Usage snapshot updated"
