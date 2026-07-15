-- Migration: add_ai_recommendations.sql
-- Purpose: Phase 9 / 9.1 + 9.2 from ROADMAP.md — add the
--          `ai_recommendations` table that backs every AI
--          suggestion the user can accept or reject.
--
-- This table is the "inbox" of AI-generated advice. Every
-- reorder alert, anomaly warning, weekly briefing item, or
-- goal-progress nudge lands here. The user acts on it (or
-- dismisses it) and we record the outcome so 9.6 can build
-- a memory layer that knows what kind of advice the user
-- finds useful.
--
-- Re-runnable: every statement is idempotent.

CREATE TABLE IF NOT EXISTS ai_recommendations (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  -- 'reorder_alert' | 'cashflow_warning' | 'anomaly' |
  -- 'weekly_briefing' | 'goal_progress' | 'forecast_alert'
  -- | 'custom'
  kind            TEXT NOT NULL CHECK (kind IN (
    'reorder_alert', 'cashflow_warning', 'anomaly',
    'weekly_briefing', 'goal_progress', 'forecast_alert', 'custom'
  )),
  -- Short headline (1 line, 5-8 words).
  title           TEXT NOT NULL,
  -- 1-2 sentence explanation. Plain prose, no markdown.
  body            TEXT NOT NULL,
  -- Kind-specific structured data. e.g. for reorder_alert:
  -- { "product_id": "...", "current_stock": 3, "days_left": 5,
  --   "suggested_qty": 20 }
  payload         JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- 'low' | 'medium' | 'high'. Drives sort order in the UI.
  priority        TEXT NOT NULL DEFAULT 'medium'
                    CHECK (priority IN ('low', 'medium', 'high')),
  -- 'pending' | 'delivered' | 'dismissed' | 'accepted' | 'acted_on'
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'delivered', 'dismissed', 'accepted', 'acted_on')),
  -- Which action generated this. Useful for tracking which
  -- surfaces are most valuable. e.g. 'getReorderAlerts',
  -- 'forecastCashFlow', 'anomalyDetection'.
  source_action   TEXT,
  -- Optional pointer to the related entity (product_id,
  -- client_id, etc). Polymorphic, no FK because the table
  -- depends on the kind.
  related_id      UUID,
  -- Optional explicit recipient. The app is single-tenant
  -- today, so this is always NULL. When we add multi-user
  -- it'll be NOT NULL.
  user_id         UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  delivered_at    TIMESTAMPTZ,
  dismissed_at    TIMESTAMPTZ,
  acted_on_at     TIMESTAMPTZ,
  -- When the recommendation goes stale (e.g. a reorder alert
  -- for stock that has since been restocked).
  expires_at      TIMESTAMPTZ
);

-- Indexes
-- 1) The default inbox query: 'show me my pending recommendations
--    ordered by priority then date'.
CREATE INDEX IF NOT EXISTS idx_ai_recommendations_inbox
  ON ai_recommendations (status, priority, created_at DESC)
  WHERE status = 'pending';

-- 2) Lookup by kind, e.g. 'show me all anomalies this week'.
CREATE INDEX IF NOT EXISTS idx_ai_recommendations_kind
  ON ai_recommendations (kind, created_at DESC);

-- 3) Polymorphic related_id lookups.
CREATE INDEX IF NOT EXISTS idx_ai_recommendations_related
  ON ai_recommendations (related_id)
  WHERE related_id IS NOT NULL;

-- updated_at trigger (we touch it on every UPDATE so the UI
-- can show "last seen" reliably).
CREATE OR REPLACE FUNCTION ai_recommendations_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ai_recommendations_touch_updated_at ON ai_recommendations;
CREATE TRIGGER trg_ai_recommendations_touch_updated_at
  BEFORE UPDATE ON ai_recommendations
  FOR EACH ROW
  EXECUTE FUNCTION ai_recommendations_touch_updated_at();

-- RLS
ALTER TABLE ai_recommendations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can manage ai_recommendations"
  ON ai_recommendations;
CREATE POLICY "Authenticated users can manage ai_recommendations"
  ON ai_recommendations
  FOR ALL
  TO authenticated
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Helpful comments
COMMENT ON TABLE ai_recommendations IS
  'Inbox of AI-generated suggestions. The user accepts, dismisses, or acts on them; the outcome feeds the memory layer (9.6) so the system learns what kind of advice the user finds useful.';

COMMENT ON COLUMN ai_recommendations.payload IS
  'Kind-specific structured data. See code comments in lib/actions/recommendations.ts for the per-kind schema.';

COMMENT ON COLUMN ai_recommendations.status IS
  'pending = unread, delivered = shown to user, dismissed = user discarded, accepted = user marked as useful, acted_on = user took the suggested action.';
