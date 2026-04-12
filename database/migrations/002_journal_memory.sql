-- Migration: Add journal_entries and memory_notes tables for Milestone F (Memory and Continuity)
-- Run this migration on the VPS Postgres instance before deploying.

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
