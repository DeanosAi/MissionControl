-- Mission Control V3 - Sprint 1.5: Decision Engine & Intelligence Layer
-- Canonical idempotent schema for fresh installations and migration 005.
-- This extends the existing architecture; it does not replace any V2 or Sprint 1 tables.

ALTER TABLE mission_control.orchestration_requests
  DROP CONSTRAINT IF EXISTS orchestration_requests_status_check;

ALTER TABLE mission_control.orchestration_requests
  ADD CONSTRAINT orchestration_requests_status_check
  CHECK (status IN (
    'received',
    'planning',
    'cost-approval-required',
    'proposal-ready',
    'changes-requested',
    'approved',
    'rejected',
    'failed'
  ));

ALTER TABLE mission_control.orchestration_requests
  ADD COLUMN IF NOT EXISTS decision_analysis JSONB,
  ADD COLUMN IF NOT EXISTS routing_decision JSONB,
  ADD COLUMN IF NOT EXISTS estimated_planning_cost_usd NUMERIC(12, 6),
  ADD COLUMN IF NOT EXISTS cost_threshold_usd NUMERIC(12, 6),
  ADD COLUMN IF NOT EXISTS cost_approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS constitution_version TEXT NOT NULL DEFAULT '1.0.0';

CREATE TABLE IF NOT EXISTS mission_control.decision_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orchestration_request_id UUID NOT NULL
    REFERENCES mission_control.orchestration_requests(id) ON DELETE CASCADE,
  project_id UUID NOT NULL
    REFERENCES mission_control.projects(id) ON DELETE CASCADE,
  revision INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'cost-approval-required', 'completed', 'failed')),
  intent JSONB,
  context_summary JSONB,
  alternatives JSONB,
  critique JSONB,
  recommendation JSONB,
  routing_decision JSONB,
  research_summary TEXT,
  error TEXT,
  constitution_version TEXT NOT NULL DEFAULT '1.0.0',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_decision_runs_request
  ON mission_control.decision_runs(orchestration_request_id, revision DESC);
CREATE INDEX IF NOT EXISTS idx_decision_runs_project
  ON mission_control.decision_runs(project_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_decision_runs_status
  ON mission_control.decision_runs(status);

CREATE TABLE IF NOT EXISTS mission_control.decision_intake_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_message_id UUID NOT NULL
    REFERENCES mission_control.chat_messages(id) ON DELETE CASCADE,
  orchestration_request_id UUID
    REFERENCES mission_control.orchestration_requests(id) ON DELETE SET NULL,
  route TEXT NOT NULL
    CHECK (route IN ('product-decision', 'task-command', 'memory-command', 'conversation')),
  understood_intent TEXT NOT NULL,
  context_domains TEXT[] NOT NULL DEFAULT ARRAY[
    'user', 'project', 'decision', 'research', 'operational'
  ]::TEXT[],
  requires_approval BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_decision_intake_chat_message
  ON mission_control.decision_intake_events(chat_message_id);
CREATE INDEX IF NOT EXISTS idx_decision_intake_orchestration
  ON mission_control.decision_intake_events(orchestration_request_id)
  WHERE orchestration_request_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS mission_control.memory_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain TEXT NOT NULL
    CHECK (domain IN ('user', 'project', 'decision', 'research', 'operational')),
  key TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  summary TEXT,
  project_id UUID REFERENCES mission_control.projects(id) ON DELETE CASCADE,
  orchestration_request_id UUID
    REFERENCES mission_control.orchestration_requests(id) ON DELETE SET NULL,
  source TEXT NOT NULL DEFAULT 'manual',
  importance SMALLINT NOT NULL DEFAULT 5 CHECK (importance BETWEEN 1 AND 10),
  lifecycle_state TEXT NOT NULL DEFAULT 'current'
    CHECK (lifecycle_state IN ('current', 'archived')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_accessed_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_memory_records_scope_key
  ON mission_control.memory_records(
    domain,
    key,
    COALESCE(project_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );
CREATE INDEX IF NOT EXISTS idx_memory_records_domain_state
  ON mission_control.memory_records(domain, lifecycle_state, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_memory_records_project
  ON mission_control.memory_records(project_id, updated_at DESC)
  WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_memory_records_request
  ON mission_control.memory_records(orchestration_request_id)
  WHERE orchestration_request_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_memory_records_search
  ON mission_control.memory_records
  USING GIN (to_tsvector('simple', title || ' ' || COALESCE(summary, '') || ' ' || content));

-- Preserve all existing curated memory while moving new reads and writes to domains.
INSERT INTO mission_control.memory_records (
  domain,
  key,
  title,
  content,
  source,
  importance,
  metadata,
  occurred_at,
  created_at,
  updated_at
)
SELECT
  'user',
  notes.key,
  notes.key,
  notes.content,
  'legacy-memory-migration',
  CASE WHEN notes.pinned THEN 10 ELSE 6 END,
  jsonb_build_object('legacyCategory', notes.category, 'pinned', notes.pinned, 'legacyId', notes.id),
  notes.created_at,
  notes.created_at,
  notes.updated_at
FROM mission_control.memory_notes notes
WHERE NOT EXISTS (
  SELECT 1
  FROM mission_control.memory_records records
  WHERE records.domain = 'user'
    AND records.key = notes.key
    AND records.project_id IS NULL
);

CREATE TABLE IF NOT EXISTS mission_control.capability_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id TEXT NOT NULL UNIQUE,
  model_name TEXT NOT NULL,
  provider TEXT NOT NULL,
  capabilities TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  input_cost_usd_per_million NUMERIC(12, 6),
  output_cost_usd_per_million NUMERIC(12, 6),
  speed_score NUMERIC(4, 3) NOT NULL DEFAULT 0.500 CHECK (speed_score BETWEEN 0 AND 1),
  reliability_score NUMERIC(4, 3) NOT NULL DEFAULT 0.500 CHECK (reliability_score BETWEEN 0 AND 1),
  quality_score NUMERIC(4, 3) NOT NULL DEFAULT 0.500 CHECK (quality_score BETWEEN 0 AND 1),
  privacy_score NUMERIC(4, 3) NOT NULL DEFAULT 0.500 CHECK (privacy_score BETWEEN 0 AND 1),
  context_window INTEGER,
  is_local BOOLEAN NOT NULL DEFAULT FALSE,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_capability_registry_capabilities
  ON mission_control.capability_registry USING GIN(capabilities);
CREATE INDEX IF NOT EXISTS idx_capability_registry_enabled
  ON mission_control.capability_registry(enabled, provider);

INSERT INTO mission_control.capability_registry (
  model_id,
  model_name,
  provider,
  capabilities,
  input_cost_usd_per_million,
  output_cost_usd_per_million,
  speed_score,
  reliability_score,
  quality_score,
  privacy_score,
  context_window,
  metadata
)
VALUES
  (
    'gpt-5.4',
    'GPT-5.4',
    'openai',
    ARRAY[
      'reasoning', 'planning', 'coding', 'research', 'vision', 'ui-design',
      'database-design', 'testing', 'security', 'deployment', 'documentation',
      'conversation', 'product-planning'
    ],
    2.500000,
    15.000000,
    0.720,
    0.900,
    0.930,
    0.650,
    1050000,
    '{"pricingSource":"OpenAI model documentation","pricingReviewedAt":"2026-07-23"}'::jsonb
  ),
  (
    'kimi-k2.5',
    'Kimi K2.5',
    'moonshot',
    ARRAY[
      'reasoning', 'planning', 'coding', 'research', 'vision', 'ui-design',
      'database-design', 'testing', 'documentation', 'conversation', 'product-planning'
    ],
    0.600000,
    3.000000,
    0.800,
    0.820,
    0.820,
    0.500,
    262144,
    '{"pricingSource":"Configurable planning estimate","pricingReviewedAt":"2026-07-23"}'::jsonb
  ),
  (
    'claude-opus-4-6',
    'Claude Opus 4.6',
    'anthropic',
    ARRAY[
      'reasoning', 'planning', 'coding', 'research', 'vision', 'ui-design',
      'database-design', 'testing', 'security', 'documentation',
      'conversation', 'product-planning'
    ],
    5.000000,
    25.000000,
    0.480,
    0.880,
    0.950,
    0.700,
    200000,
    '{"pricingSource":"Configurable planning estimate","pricingReviewedAt":"2026-07-23"}'::jsonb
  ),
  (
    'claude-sonnet-4-5',
    'Claude Sonnet 4.5',
    'anthropic',
    ARRAY[
      'reasoning', 'planning', 'coding', 'research', 'vision', 'ui-design',
      'database-design', 'testing', 'security', 'documentation',
      'conversation', 'product-planning'
    ],
    3.000000,
    15.000000,
    0.760,
    0.900,
    0.880,
    0.700,
    200000,
    '{"pricingSource":"Configurable planning estimate","pricingReviewedAt":"2026-07-23"}'::jsonb
  )
ON CONFLICT (model_id) DO UPDATE SET
  model_name = EXCLUDED.model_name,
  provider = EXCLUDED.provider,
  capabilities = EXCLUDED.capabilities,
  input_cost_usd_per_million = EXCLUDED.input_cost_usd_per_million,
  output_cost_usd_per_million = EXCLUDED.output_cost_usd_per_million,
  context_window = EXCLUDED.context_window,
  updated_at = NOW();

CREATE TABLE IF NOT EXISTS mission_control.routing_policies (
  id TEXT PRIMARY KEY,
  cost_threshold_usd NUMERIC(12, 6) NOT NULL DEFAULT 0.250000,
  weights JSONB NOT NULL DEFAULT '{
    "quality": 0.28,
    "reliability": 0.22,
    "cost": 0.18,
    "speed": 0.12,
    "privacy": 0.10,
    "pastPerformance": 0.10
  }'::jsonb,
  prefer_local_for_private BOOLEAN NOT NULL DEFAULT TRUE,
  require_cost_approval BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO mission_control.routing_policies (id)
VALUES ('default')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS mission_control.model_routing_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orchestration_request_id UUID
    REFERENCES mission_control.orchestration_requests(id) ON DELETE SET NULL,
  project_id UUID REFERENCES mission_control.projects(id) ON DELETE SET NULL,
  capability TEXT NOT NULL,
  model_id TEXT NOT NULL,
  model_name TEXT NOT NULL,
  provider TEXT NOT NULL,
  estimated_input_tokens INTEGER NOT NULL DEFAULT 0,
  estimated_output_tokens INTEGER NOT NULL DEFAULT 0,
  estimated_cost_usd NUMERIC(12, 6),
  score NUMERIC(8, 5),
  success BOOLEAN,
  latency_ms INTEGER,
  error TEXT,
  selection_reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_model_routing_events_model
  ON mission_control.model_routing_events(model_id, capability, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_model_routing_events_request
  ON mission_control.model_routing_events(orchestration_request_id)
  WHERE orchestration_request_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS mission_control.decision_outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orchestration_request_id UUID NOT NULL
    REFERENCES mission_control.orchestration_requests(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES mission_control.projects(id) ON DELETE CASCADE,
  outcome_type TEXT NOT NULL
    CHECK (outcome_type IN ('approved', 'changes-requested', 'rejected', 'completed', 'failed')),
  revision INTEGER NOT NULL,
  selected_option_id TEXT,
  notes TEXT,
  metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_decision_outcomes_project
  ON mission_control.decision_outcomes(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_decision_outcomes_request
  ON mission_control.decision_outcomes(orchestration_request_id, created_at DESC);

CREATE TABLE IF NOT EXISTS mission_control.research_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger TEXT NOT NULL CHECK (trigger IN ('weekly', 'manual', 'decision-engine')),
  status TEXT NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'completed', 'partial', 'failed', 'cost-approval-required')),
  topics TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  source_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb,
  routing_decision JSONB,
  summary TEXT,
  error TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_research_runs_started
  ON mission_control.research_runs(started_at DESC);

CREATE TABLE IF NOT EXISTS mission_control.research_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  research_run_id UUID NOT NULL REFERENCES mission_control.research_runs(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  technology TEXT NOT NULL,
  title TEXT NOT NULL,
  what_changed TEXT NOT NULL,
  why_it_matters TEXT NOT NULL,
  advantages JSONB NOT NULL DEFAULT '[]'::jsonb,
  disadvantages JSONB NOT NULL DEFAULT '[]'::jsonb,
  expected_impact TEXT NOT NULL,
  migration_difficulty TEXT NOT NULL,
  cost_implications TEXT NOT NULL,
  recommendation TEXT NOT NULL
    CHECK (recommendation IN ('recommended', 'optional', 'not-recommended')),
  recommendation_rationale TEXT NOT NULL,
  change_explanation TEXT,
  source_links JSONB NOT NULL DEFAULT '[]'::jsonb,
  adoption_status TEXT NOT NULL DEFAULT 'pending-review'
    CHECK (adoption_status IN ('pending-review', 'approved', 'rejected', 'superseded')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_research_reports_recommendation
  ON mission_control.research_reports(recommendation, adoption_status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_research_reports_technology
  ON mission_control.research_reports(technology, created_at DESC);

ALTER TABLE mission_control.automations
  ADD COLUMN IF NOT EXISTS automation_type TEXT NOT NULL DEFAULT 'task'
    CHECK (automation_type IN ('task', 'research')),
  ADD COLUMN IF NOT EXISTS capability TEXT NOT NULL DEFAULT 'reasoning',
  ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'Australia/Sydney';

ALTER TABLE mission_control.automation_runs
  ADD COLUMN IF NOT EXISTS research_run_id UUID
    REFERENCES mission_control.research_runs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS run_type TEXT NOT NULL DEFAULT 'task'
    CHECK (run_type IN ('task', 'research'));

INSERT INTO mission_control.automations (
  title,
  description,
  cron_schedule,
  model_id,
  automation_type,
  capability,
  timezone,
  status,
  next_run
)
SELECT
  'Mission Control Weekly Technology Research',
  'Evaluate meaningful changes in AI models, development frameworks, automation platforms, memory systems, developer tools, research papers, open-source projects, and infrastructure. Produce recommendation reports only; never adopt technology automatically.',
  '0 8 * * 1',
  'auto',
  'research',
  'research',
  'Australia/Sydney',
  'active',
  NOW() + INTERVAL '7 days'
WHERE NOT EXISTS (
  SELECT 1
  FROM mission_control.automations
  WHERE automation_type = 'research'
    AND title = 'Mission Control Weekly Technology Research'
);

CREATE TABLE IF NOT EXISTS mission_control.constitution_versions (
  version TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  document_path TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'superseded')),
  summary TEXT NOT NULL,
  enacted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

UPDATE mission_control.constitution_versions
SET status = 'superseded'
WHERE status = 'active' AND version <> '1.0.0';

INSERT INTO mission_control.constitution_versions (
  version,
  title,
  document_path,
  status,
  summary
)
VALUES (
  '1.0.0',
  'Mission Control Constitution',
  'docs/MISSION-CONTROL-CONSTITUTION.md',
  'active',
  'Permanent architecture, approval, memory, decision, research, security, cost, journal, model-agnostic, coding, and user-experience principles.'
)
ON CONFLICT (version) DO UPDATE SET
  title = EXCLUDED.title,
  document_path = EXCLUDED.document_path,
  status = 'active',
  summary = EXCLUDED.summary;
