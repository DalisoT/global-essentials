-- Migration: add_cash_drawer_logs.sql
-- Purpose: Phase 12 / E — Cash drawer reconciliation.
--          End-of-day log: opening cash, closing cash, what
--          the system thinks the drawer should hold, the
--          variance, and a free-form notes field.
--
-- Re-runnable: idempotent.

CREATE TABLE IF NOT EXISTS cash_drawer_logs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  -- YYYY-MM-DD. Unique per business day.
  log_date        DATE NOT NULL UNIQUE,
  -- What was in the drawer when the shop opened.
  opening_cash    NUMERIC(14, 2) NOT NULL CHECK (opening_cash >= 0),
  -- What the system thinks should be in the drawer at close
  -- (computed from the day's cash transactions, plus opening).
  expected_cash   NUMERIC(14, 2) NOT NULL,
  -- What was actually counted.
  closing_cash    NUMERIC(14, 2) NOT NULL CHECK (closing_cash >= 0),
  -- closing - expected. Positive = surplus, negative = shortfall.
  variance        NUMERIC(14, 2) NOT NULL,
  -- Free-form note (e.g. "Banked K500 at lunch", "Gave change for K200 I didn't track").
  notes           TEXT,
  -- Who submitted the log.
  submitted_by    UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Recent-first by default
CREATE INDEX IF NOT EXISTS idx_cash_drawer_logs_date
  ON cash_drawer_logs (log_date DESC);

-- RLS
ALTER TABLE cash_drawer_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can manage cash_drawer_logs"
  ON cash_drawer_logs;
CREATE POLICY "Authenticated users can manage cash_drawer_logs"
  ON cash_drawer_logs
  FOR ALL
  TO authenticated
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

COMMENT ON TABLE cash_drawer_logs IS
  'End-of-day cash drawer reconciliations. One row per business day. Phase 12.';
