-- Migration: add_review_summary_kind.sql
-- Purpose: Phase 8 / 8.6 from ROADMAP.md — extend the `forecasts`
--          table's `kind` CHECK constraint to include the new
--          'review_summary' kind. We re-use the forecasts cache
--          (1-day TTL, JSONB payload) for review summaries so we
--          don't have to ship a new table + RLS + indexes.
--
-- Why a separate kind (not a new table): summaries, like
-- forecasts, are derived data with a TTL. Putting them in the
-- same table keeps the cache eviction simple (one cron, one
-- "delete expired + regenerate" loop). When the count grows
-- we can split them; for v1 the co-location is cleaner.
--
-- Re-runnable: drops the old constraint before adding the new
-- one (ALTER TABLE ... DROP CONSTRAINT ... IF EXISTS is safe
-- in PG 15+; Supabase runs PG 15+).

ALTER TABLE forecasts DROP CONSTRAINT IF EXISTS forecasts_kind_check;

ALTER TABLE forecasts
  ADD CONSTRAINT forecasts_kind_check
  CHECK (kind IN ('demand', 'cashflow', 'default_risk', 'review_summary'));
