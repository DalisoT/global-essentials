-- Migration: add_learning_academy.sql
-- Purpose: 4A.1-4A.4 from ROADMAP.md — schema for the Learning Academy.
--          Four new tables: pillars, lessons, user_lesson_progress, lesson_resources.
--
-- Design notes:
--   - pillars / lessons are read-mostly content owned by the app. They
--     are seeded in a separate migration (seed_learning_academy.sql) so
--     content edits don't have to re-run the schema.
--   - user_lesson_progress is per-user; UNIQUE(user_id, lesson_id) so
--     the same lesson can't have two progress rows per user.
--   - lesson_resources are links FROM a lesson (e.g. "Open the Debts
--     page" -> /debts, or an external URL). We don't enforce the kind
--     with a CHECK because new resource kinds will come; the column is
--     freeform and validated in the UI.
--   - RLS is restrictive: everyone reads pillars/lessons/resources, but
--     progress rows are scoped to the row owner.
--
-- Safe to re-run: every CREATE uses IF NOT EXISTS and policies use
-- DROP-then-CREATE. The seed migration is intentionally NOT idempotent
-- (it uses fixed UUIDs to keep FK relationships stable).
--
-- Reversible:
--   DROP TABLE IF EXISTS lesson_resources;
--   DROP TABLE IF EXISTS user_lesson_progress;
--   DROP TABLE IF EXISTS lessons;
--   DROP TABLE IF EXISTS pillars;

-- ─────────────────────────────────────────────────────────────────────
-- pillars
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pillars (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  -- URL-friendly identifier. e.g. 'financial-literacy'
  slug VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  -- lucide icon name. e.g. 'BookOpen', 'TrendingUp'. The UI does
  -- a dynamic import to render it.
  icon VARCHAR(50),
  -- Accent color token. e.g. 'tactical-blue', 'tactical-neon'.
  -- The UI maps this to a Tailwind class.
  color VARCHAR(20),
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pillars_order
  ON pillars(is_active, display_order);

-- ─────────────────────────────────────────────────────────────────────
-- lessons
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lessons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pillar_id UUID NOT NULL REFERENCES pillars(id) ON DELETE CASCADE,
  slug VARCHAR(100) UNIQUE NOT NULL,
  title VARCHAR(200) NOT NULL,
  -- Markdown body. The lesson reader renders this with a small
  -- markdown-to-React renderer (we don't pull in a full MDX setup).
  body_md TEXT NOT NULL,
  -- Optional. Either a Groq-TTS-generated audio URL or a hand-uploaded
  -- asset in the `product-images` storage bucket.
  audio_url TEXT,
  -- Rough read time, computed by the content author. The UI displays
  -- "~5 min" etc.
  est_minutes INTEGER DEFAULT 5,
  display_order INTEGER NOT NULL DEFAULT 0,
  -- Flags: which data sources the lesson "needs" to be most useful.
  -- Used by 4B.3 to know which numbers to inject into personalized
  -- examples, and by 4C.5 to decide whether to surface a lesson as
  -- "Today's lesson" given the user's data state.
  -- Allowed values: 'sales', 'inventory', 'debts', 'expenses',
  -- 'profitability', 'journal'.
  requires_data TEXT[] DEFAULT '{}',
  is_published BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lessons_pillar
  ON lessons(pillar_id, display_order);
CREATE INDEX IF NOT EXISTS idx_lessons_published
  ON lessons(is_published, display_order);

-- ─────────────────────────────────────────────────────────────────────
-- user_lesson_progress
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_lesson_progress (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  -- 0-100 score from the optional quiz (4B.1). NULL = not taken yet.
  quiz_score INTEGER,
  -- For 4D.1: how far down the lesson the user scrolled, 0-100.
  scroll_depth_pct INTEGER DEFAULT 0,
  -- For 4D.1: total seconds the lesson was in the foreground.
  read_seconds INTEGER DEFAULT 0,
  -- Bookmarked (4D.2). Independent of completion.
  bookmarked BOOLEAN DEFAULT false,
  -- Last time the user looked at the lesson. Drives the dashboard
  -- "continue where you left off" affordance.
  last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, lesson_id)
);

CREATE INDEX IF NOT EXISTS idx_progress_user_completed
  ON user_lesson_progress(user_id, completed_at DESC);
CREATE INDEX IF NOT EXISTS idx_progress_user_bookmarked
  ON user_lesson_progress(user_id, bookmarked) WHERE bookmarked = true;
CREATE INDEX IF NOT EXISTS idx_progress_lesson
  ON user_lesson_progress(lesson_id);

-- ─────────────────────────────────────────────────────────────────────
-- lesson_resources
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lesson_resources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  -- Short label shown in the lesson reader, e.g. "Open the Debts page".
  label VARCHAR(200) NOT NULL,
  -- href. Can be a Next.js route ('/debts'), an external URL
  -- ('https://...'), or a custom scheme ('app://reset-db') for
  -- app-level actions the UI knows how to dispatch.
  href TEXT NOT NULL,
  -- 'internal' (route), 'external' (new tab), 'action' (app-level).
  -- Freeform for forward-compat; the UI falls back to "open in new tab".
  kind VARCHAR(20) NOT NULL DEFAULT 'internal',
  display_order INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_resources_lesson
  ON lesson_resources(lesson_id, display_order);

-- ─────────────────────────────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE pillars ENABLE ROW LEVEL SECURITY;
ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_lesson_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE lesson_resources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can view pillars" ON pillars;
DROP POLICY IF EXISTS "Authenticated can view lessons" ON lessons;
DROP POLICY IF EXISTS "Authenticated can view resources" ON lesson_resources;
DROP POLICY IF EXISTS "Users view own progress" ON user_lesson_progress;
DROP POLICY IF EXISTS "Users insert own progress" ON user_lesson_progress;
DROP POLICY IF EXISTS "Users update own progress" ON user_lesson_progress;

CREATE POLICY "Authenticated can view pillars" ON pillars
  FOR SELECT TO authenticated USING (is_active = true);

CREATE POLICY "Authenticated can view lessons" ON lessons
  FOR SELECT TO authenticated USING (is_published = true);

CREATE POLICY "Authenticated can view resources" ON lesson_resources
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users view own progress" ON user_lesson_progress
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users insert own progress" ON user_lesson_progress
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own progress" ON user_lesson_progress
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
