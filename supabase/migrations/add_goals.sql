-- Migration: add_goals.sql
-- Purpose: Phase 9 / 9.5 — Goal tracking. The user can set
--          revenue / profit / cash_buffer targets on a
--          weekly or monthly cadence, and the system emits
--          `kind='goal_progress'` rows in `ai_recommendations`
--          so the user sees how they're tracking.
--
-- Re-runnable: every statement is idempotent.

CREATE TABLE IF NOT EXISTS goals (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  -- 'revenue' | 'profit' | 'cash_buffer'
  -- revenue = paid sales target
  -- profit  = paid sales − expenses
  -- cash_buffer = ground truth should be ≥ target
  kind            TEXT NOT NULL CHECK (kind IN ('revenue', 'profit', 'cash_buffer')),
  -- Human-readable label, e.g. 'July revenue target'.
  title           TEXT NOT NULL,
  -- The numeric target in ZMW. Always non-negative.
  target_amount   NUMERIC(14, 2) NOT NULL CHECK (target_amount >= 0),
  -- 'weekly' | 'monthly'. Drives how progress is measured.
  period          TEXT NOT NULL CHECK (period IN ('weekly', 'monthly')),
  -- First day of the period this goal covers (YYYY-MM-DD).
  -- For weekly: the Monday. For monthly: the 1st.
  period_start    DATE NOT NULL,
  -- Optional: last day the goal is relevant (YYYY-MM-DD).
  -- NULL = open-ended / current period.
  period_end      DATE,
  -- Whether the goal is currently active. Inactive goals are
  -- kept for history but not surfaced in the inbox.
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Active goals by period — fast lookup for the action layer.
CREATE INDEX IF NOT EXISTS idx_goals_active_period
  ON goals (is_active, period, period_start DESC)
  WHERE is_active = TRUE;

-- A user can have at most one active goal per (kind, period_start).
-- Prevents accidental duplicates when re-saving the same goal.
CREATE UNIQUE INDEX IF NOT EXISTS idx_goals_unique_active
  ON goals (kind, period, period_start)
  WHERE is_active = TRUE;

-- updated_at trigger
CREATE OR REPLACE FUNCTION goals_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_goals_touch_updated_at ON goals;
CREATE TRIGGER trg_goals_touch_updated_at
  BEFORE UPDATE ON goals
  FOR EACH ROW
  EXECUTE FUNCTION goals_touch_updated_at();

-- RLS
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can manage goals"
  ON goals;
CREATE POLICY "Authenticated users can manage goals"
  ON goals
  FOR ALL
  TO authenticated
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

COMMENT ON TABLE goals IS
  'Revenue / profit / cash-buffer targets the owner has set. The system measures progress per period and emits kind=goal_progress recommendations into the inbox.';

COMMENT ON COLUMN goals.kind IS
  'revenue = paid sales target. profit = paid sales - expenses. cash_buffer = ground truth should be at or above target.';

COMMENT ON COLUMN goals.period_start IS
  'First day of the period (Monday for weekly, 1st of the month for monthly). YYYY-MM-DD.';
