-- Mission Control V3 - Sprint 1 schema for fresh database installations.
-- Keep this file aligned with database/migrations/004_conversational_bridge.sql.

CREATE TABLE IF NOT EXISTS mission_control.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  summary TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'proposal'
    CHECK (status IN ('proposal', 'planning', 'active', 'paused', 'completed', 'archived')),
  owner TEXT NOT NULL DEFAULT 'Dean + Mission Control',
  parent_project_id UUID REFERENCES mission_control.projects(id) ON DELETE SET NULL,
  source TEXT NOT NULL DEFAULT 'manual',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_projects_parent_project_id
  ON mission_control.projects(parent_project_id);
CREATE INDEX IF NOT EXISTS idx_projects_status
  ON mission_control.projects(status);

INSERT INTO mission_control.projects (title, slug, summary, status, owner, source)
VALUES
  ('Mission Control', 'mission-control', 'Private self-hosted AI operating system for ideas, projects, builds, systems, automations, and memory.', 'active', 'Dean + Scot', 'v2-migration'),
  ('Backup architecture', 'backup-architecture', 'Nightly compressed backups with resilient recovery and local sync.', 'planning', 'Scot', 'v2-migration'),
  ('Content dashboard module', 'content-dashboard-module', 'Reserved for the real content workflow once its operating shape is clear.', 'planning', 'Dean', 'v2-migration')
ON CONFLICT (slug) DO NOTHING;

CREATE TABLE IF NOT EXISTS mission_control.orchestration_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES mission_control.projects(id) ON DELETE CASCADE,
  original_request TEXT NOT NULL,
  normalized_intent TEXT NOT NULL,
  classification TEXT NOT NULL
    CHECK (classification IN ('new-project', 'child-project', 'existing-project')),
  status TEXT NOT NULL DEFAULT 'received'
    CHECK (status IN ('received', 'planning', 'proposal-ready', 'changes-requested', 'approved', 'rejected', 'failed')),
  proposal JSONB,
  ui_preview JSONB,
  selected_model_id TEXT,
  selected_model_name TEXT,
  selected_model_provider TEXT,
  revision INTEGER NOT NULL DEFAULT 1,
  decision_note TEXT,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orchestration_requests_project_id ON mission_control.orchestration_requests(project_id);
CREATE INDEX IF NOT EXISTS idx_orchestration_requests_status ON mission_control.orchestration_requests(status);
CREATE INDEX IF NOT EXISTS idx_orchestration_requests_created_at ON mission_control.orchestration_requests(created_at DESC);

ALTER TABLE mission_control.tasks ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES mission_control.projects(id) ON DELETE SET NULL;
ALTER TABLE mission_control.journal_entries ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES mission_control.projects(id) ON DELETE SET NULL;
ALTER TABLE mission_control.journal_entries ADD COLUMN IF NOT EXISTS orchestration_request_id UUID REFERENCES mission_control.orchestration_requests(id) ON DELETE SET NULL;
ALTER TABLE mission_control.chat_messages ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES mission_control.projects(id) ON DELETE SET NULL;
ALTER TABLE mission_control.chat_messages ADD COLUMN IF NOT EXISTS orchestration_request_id UUID REFERENCES mission_control.orchestration_requests(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON mission_control.tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_project_id ON mission_control.journal_entries(project_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_orchestration_request_id ON mission_control.journal_entries(orchestration_request_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_orchestration_request_id ON mission_control.chat_messages(orchestration_request_id);
