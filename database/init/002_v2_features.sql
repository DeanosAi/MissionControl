-- Mission Control V2 feature schema for fresh database installations.
-- Keep aligned with database/migrations/003_v2_features.sql.

CREATE TABLE IF NOT EXISTS mission_control.google_auth (
  id SERIAL PRIMARY KEY,
  refresh_token TEXT NOT NULL,
  access_token TEXT,
  expires_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mission_control.google_folders (
  name TEXT PRIMARY KEY,
  folder_id TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mission_control.ideas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'submitted'
    CHECK (status IN ('submitted', 'researching', 'researched', 'building', 'built', 'archived')),
  research_data JSONB,
  conversation_history JSONB DEFAULT '[]'::jsonb,
  mvp_code TEXT,
  codex_prompt TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ideas_status ON mission_control.ideas(status);
CREATE INDEX IF NOT EXISTS idx_ideas_created_at ON mission_control.ideas(created_at DESC);

CREATE TABLE IF NOT EXISTS mission_control.automations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  cron_schedule TEXT NOT NULL,
  model_id TEXT NOT NULL DEFAULT 'kimi-k2.5',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'archived')),
  last_run TIMESTAMPTZ,
  next_run TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_automations_next_run
  ON mission_control.automations(next_run)
  WHERE status = 'active';

CREATE TABLE IF NOT EXISTS mission_control.automation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id UUID NOT NULL
    REFERENCES mission_control.automations(id) ON DELETE CASCADE,
  task_id UUID REFERENCES mission_control.tasks(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'completed', 'failed')),
  output TEXT,
  error TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_automation_runs_automation_id
  ON mission_control.automation_runs(automation_id);

CREATE TABLE IF NOT EXISTS mission_control.n8n_workflow_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id TEXT NOT NULL,
  workflow_name TEXT,
  execution_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  input_data JSONB,
  output_data JSONB,
  error TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_n8n_runs_started
  ON mission_control.n8n_workflow_runs(started_at DESC);

CREATE TABLE IF NOT EXISTS mission_control.local_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  model_id TEXT NOT NULL,
  context_window INTEGER DEFAULT 4096,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
