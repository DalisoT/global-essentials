-- Migration: add_journal_entries_date_ref_index.sql
-- Purpose: F12 from ROADMAP.md — compound index for Phase 3 CFO queries
--          that filter journal entries by date range AND reference_type
--          (e.g., "all sale-related journal entries in the last 30 days").
--
-- The existing single-column indexes (idx_journal_entries_date on entry_date,
-- idx_journal_entries_ref on (reference_type, reference_id)) can't be merged
-- efficiently — a query of the shape
--   WHERE entry_date BETWEEN $1 AND $2 AND reference_type = $3
-- needs either a date-range scan + post-filter, or a reference_type scan
-- + post-filter. The compound index lets the planner do both filters via
-- an index range scan.
--
-- Safe to run on a populated DB: CREATE INDEX IF NOT EXISTS is a no-op if
-- the index already exists. Building the index takes a brief AccessExclusive
-- lock; on a small/medium journal_entries table (< 1M rows) this is sub-second.
--
-- Reversible: DROP INDEX idx_journal_entries_date_ref;

CREATE INDEX IF NOT EXISTS idx_journal_entries_date_ref
  ON journal_entries(entry_date DESC, reference_type);