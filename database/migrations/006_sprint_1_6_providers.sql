-- Mission Control V3 - Sprint 1.6: AI Provider Management
-- Additive and backward-compatible. Secrets are never stored by this migration.

CREATE TABLE IF NOT EXISTS mission_control.ai_providers (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  adapter_type TEXT NOT NULL,
  connection_mode TEXT NOT NULL DEFAULT 'api-key'
    CHECK (connection_mode IN ('api-key', 'oauth-proxy', 'hybrid', 'local')),
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  priority_weight SMALLINT NOT NULL DEFAULT 50 CHECK (priority_weight BETWEEN 0 AND 100),
  preferred_usage TEXT NOT NULL DEFAULT '',
  estimated_pricing TEXT NOT NULL DEFAULT 'Pricing not configured',
  strengths TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  weaknesses TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  privacy_notes TEXT NOT NULL DEFAULT '',
  credential_env_var TEXT,
  credential_source TEXT NOT NULL DEFAULT 'none'
    CHECK (credential_source IN ('none', 'environment', 'encrypted-store')),
  health_status TEXT NOT NULL DEFAULT 'unknown'
    CHECK (health_status IN ('unknown', 'healthy', 'degraded', 'unavailable', 'disabled')),
  last_health_check_at TIMESTAMPTZ,
  last_successful_call_at TIMESTAMPTZ,
  last_error TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_providers_enabled_priority
  ON mission_control.ai_providers(enabled, priority_weight DESC);

CREATE TABLE IF NOT EXISTS mission_control.ai_provider_credentials (
  provider_id TEXT PRIMARY KEY
    REFERENCES mission_control.ai_providers(id) ON DELETE CASCADE,
  encrypted_secret TEXT NOT NULL,
  initialization_vector TEXT NOT NULL,
  authentication_tag TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mission_control.ai_provider_connection_tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id TEXT NOT NULL
    REFERENCES mission_control.ai_providers(id) ON DELETE CASCADE,
  success BOOLEAN NOT NULL,
  latency_ms INTEGER,
  error TEXT,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_provider_tests_provider
  ON mission_control.ai_provider_connection_tests(provider_id, checked_at DESC);

INSERT INTO mission_control.ai_providers (
  id,
  display_name,
  adapter_type,
  connection_mode,
  priority_weight,
  preferred_usage,
  estimated_pricing,
  strengths,
  weaknesses,
  privacy_notes,
  credential_env_var,
  credential_source,
  metadata
)
VALUES
  (
    'openai',
    'OpenAI',
    'openai',
    'hybrid',
    85,
    'Complex reasoning, coding, architecture, vision, and long-context planning.',
    'Model pricing varies; Mission Control estimates each routed call.',
    ARRAY['Broad capability coverage', 'Large context options', 'Strong coding and reasoning'],
    ARRAY['Cloud processing', 'Paid usage outside the OAuth bridge', 'Availability can depend on the local bridge'],
    'Cloud provider. Prefer a suitable local route for privacy-sensitive work.',
    'OPENAI_API_KEY',
    'environment',
    '{"typicalUseCases":["reasoning","coding","architecture","vision"],"oauthEnvVar":"OPENAI_OAUTH_ENDPOINT"}'::jsonb
  ),
  (
    'anthropic',
    'Anthropic',
    'anthropic',
    'api-key',
    80,
    'Product critique, planning, security review, and clear documentation.',
    'Model pricing varies; Mission Control estimates each routed call.',
    ARRAY['Careful critique', 'Strong planning', 'Clear long-form explanation'],
    ARRAY['Cloud processing', 'Paid usage', 'No local execution'],
    'Cloud provider. Do not send private material unless the route is approved for that data.',
    'ANTHROPIC_API_KEY',
    'environment',
    '{"typicalUseCases":["planning","product-planning","security","documentation"]}'::jsonb
  ),
  (
    'moonshot',
    'Moonshot',
    'moonshot',
    'api-key',
    70,
    'Cost-aware research, everyday reasoning, and long-context analysis.',
    'Generally lower-cost hosted reasoning; estimates remain model-specific.',
    ARRAY['Strong value', 'Long context', 'Useful general reasoning'],
    ARRAY['Cloud processing', 'Provider-specific availability', 'Quality varies by task'],
    'Cloud provider. Use a local route when privacy outweighs its value advantage.',
    'MOONSHOT_API_KEY',
    'environment',
    '{"typicalUseCases":["research","reasoning","conversation"]}'::jsonb
  ),
  (
    'local',
    'Local Models',
    'local',
    'local',
    90,
    'Private, offline, and low-cost work when a configured local model is capable enough.',
    'No per-token API charge; local compute and electricity still have cost.',
    ARRAY['Best privacy', 'No per-token API cost', 'Can work without an external provider'],
    ARRAY['Depends on local hardware', 'May be slower', 'Capability varies by installed model'],
    'Preferred for privacy-sensitive work when quality and context are sufficient.',
    NULL,
    'none',
    '{"typicalUseCases":["private reasoning","offline work","local automation"]}'::jsonb
  )
ON CONFLICT (id) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  adapter_type = EXCLUDED.adapter_type,
  connection_mode = EXCLUDED.connection_mode,
  estimated_pricing = EXCLUDED.estimated_pricing,
  strengths = EXCLUDED.strengths,
  weaknesses = EXCLUDED.weaknesses,
  privacy_notes = EXCLUDED.privacy_notes,
  credential_env_var = EXCLUDED.credential_env_var,
  metadata = mission_control.ai_providers.metadata || EXCLUDED.metadata,
  updated_at = NOW();

UPDATE mission_control.ai_providers providers
SET last_successful_call_at = recent.last_successful_call_at,
    updated_at = NOW()
FROM (
  SELECT provider, MAX(created_at) AS last_successful_call_at
  FROM mission_control.model_routing_events
  WHERE success = TRUE
  GROUP BY provider
) recent
WHERE providers.id = recent.provider
  AND (
    providers.last_successful_call_at IS NULL
    OR providers.last_successful_call_at < recent.last_successful_call_at
  );
