CREATE SCHEMA IF NOT EXISTS mission_control;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

COMMENT ON SCHEMA mission_control IS 'Application schema for Mission Control.';

CREATE TABLE IF NOT EXISTS mission_control.admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mission_control.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('backlog', 'in-progress', 'review', 'done', 'archived')),
  priority TEXT NOT NULL CHECK (priority IN ('low', 'medium', 'high')),
  assigned_ai TEXT,
  notes TEXT,
  recurring TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mission_control.usage_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,
  openai_window_left TEXT NOT NULL,
  openai_reset_in TEXT NOT NULL,
  openai_weekly_left TEXT NOT NULL,
  openai_weekly_reset_in TEXT NOT NULL,
  claude_status TEXT NOT NULL,
  claude_note TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mission_control.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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

CREATE TABLE IF NOT EXISTS mission_control.journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  detail TEXT NOT NULL,
  entry_type TEXT NOT NULL CHECK (entry_type IN ('milestone', 'ops', 'decision', 'auto', 'note')) DEFAULT 'note',
  source TEXT NOT NULL DEFAULT 'manual',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_journal_entries_created_at ON mission_control.journal_entries(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_journal_entries_type ON mission_control.journal_entries(entry_type);

CREATE TABLE IF NOT EXISTS mission_control.memory_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  content TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('context', 'preference', 'fact', 'instruction')) DEFAULT 'context',
  pinned BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_memory_notes_category ON mission_control.memory_notes(category);
CREATE INDEX IF NOT EXISTS idx_memory_notes_pinned ON mission_control.memory_notes(pinned) WHERE pinned = true;
