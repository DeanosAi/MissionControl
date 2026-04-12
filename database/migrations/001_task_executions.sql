-- Migration: Add task_executions table for Milestone D (Task Execution Engine)
-- Run this migration on the VPS Postgres instance before deploying.

CREATE TABLE IF NOT EXISTS mission_control.task_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES mission_control.tasks(id) ON DELETE CASCADE,
  model_id TEXT NOT NULL,
  model_name TEXT NOT NULL,
  provider TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed')) DEFAULT 'running',
  prompt TEXT NOT NULL,
  result TEXT,
  error TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER
);

CREATE INDEX IF NOT EXISTS idx_task_executions_task_id ON mission_control.task_executions(task_id);
CREATE INDEX IF NOT EXISTS idx_task_executions_started_at ON mission_control.task_executions(started_at DESC);
