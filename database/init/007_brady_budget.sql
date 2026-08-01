-- Brady Budget household storage and restricted member access.
-- Additive and safe to run more than once.

CREATE TABLE IF NOT EXISTS mission_control.budget_households (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  state JSONB,
  revision BIGINT NOT NULL DEFAULT 0 CHECK (revision >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO mission_control.budget_households (slug, name)
VALUES ('brady-household', 'Brady household')
ON CONFLICT (slug) DO NOTHING;

CREATE TABLE IF NOT EXISTS mission_control.budget_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL
    REFERENCES mission_control.budget_households(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_budget_users_email_lower
  ON mission_control.budget_users (LOWER(email));

CREATE INDEX IF NOT EXISTS idx_budget_users_household
  ON mission_control.budget_users (household_id, is_active);

