-- Migration: add_ai_usage.sql
-- Purpose: 3A.4 from ROADMAP.md — cost + usage tracking for every AI call.
--          Used by the CFO Copilot (3A.5) and any future AI features.
--
-- One row per AI call. `route` distinguishes which feature emitted the call
-- (cfo, analytics, reminder, advisor) so a single dashboard can show the
-- spend per surface. `user_id` is nullable so background/system calls (e.g.
-- a future scheduled digest) can be recorded too.
--
-- Token columns are nullable on purpose — older Groq SDK versions don't
-- always return usage, and we want to record the call even when the
-- token count is missing.
--
-- Idempotent: safe to re-run. CREATE TABLE/INDEX use IF NOT EXISTS, and
-- the RLS policies are dropped-then-created so a partial earlier run
-- (which is exactly how this file got a typo in its first incarnation)
-- can be cleanly recovered.
--
-- Reversible:
--   DROP TABLE IF EXISTS ai_usage;

CREATE TABLE IF NOT EXISTS ai_usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id),
  -- 'cfo' | 'analytics' | 'reminder' | 'advisor' | 'insights' | etc.
  -- Free-form string for now; constrain later if the taxonomy stabilizes.
  route VARCHAR(40) NOT NULL,
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  total_tokens INTEGER,
  model VARCHAR(60),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Primary access pattern: "how much has <user> spent on the CFO this week".
-- Composite index covers user-scoped time-range scans.
CREATE INDEX IF NOT EXISTS idx_ai_usage_user_created
  ON ai_usage(user_id, created_at DESC);

-- Secondary access pattern: "how much did the CFO route cost last month".
-- Lets us report per-feature usage without scanning the whole table.
CREATE INDEX IF NOT EXISTS idx_ai_usage_route_created
  ON ai_usage(route, created_at DESC);

-- RLS: anyone authenticated can insert their own usage row; reads
-- restricted to the row owner (and admins via a separate policy when
-- the audit-log viewer is extended to cover ai_usage in Phase 6).
ALTER TABLE ai_usage ENABLE ROW LEVEL SECURITY;

-- Drop-then-create so this migration is safe to re-run after a partial
-- earlier run. (Previous version had a typo in the policy name, which
-- caused the first run to leave the policies in an inconsistent state.)
DROP POLICY IF EXISTS "Users can insert their own ai_usage" ON ai_usage;
DROP POLICY IF EXISTS "Users can view their own ai_usage" ON ai_usage;

CREATE POLICY "Users can insert their own ai_usage" ON ai_usage
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own ai_usage" ON ai_usage
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
