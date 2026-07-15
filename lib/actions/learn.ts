'use server';

/**
 * Learning Academy — server actions (Phase 4 / 4B.1).
 *
 * The first action here is `generatePersonalizedQuiz(lessonId)`. Given
 * a lesson's body and the user's actual business data, the model
 * generates 4 multiple-choice questions that test understanding of the
 * lesson using the user's real numbers.
 *
 * Data flow:
 *   1. requireAuth (any authenticated user can take a quiz)
 *   2. Rate limit check (LESSON_QUIZ_DAILY_LIMIT — default 10/day/user)
 *   3. Load the lesson by id
 *   4. Gather data context for whatever the lesson's `requires_data` flags
 *      ask for (sales, profitability, debts, inventory, expenses, journal)
 *   5. Call Groq with the lesson-quiz prompt
 *   6. Parse the JSON response defensively (model sometimes adds prose)
 *   7. Return the quiz + usage for the UI
 *   8. Best-effort ai_usage + audit_log writes
 *
 * 4B.2 (audio) and 4B.3 (personalized examples) land as separate
 * functions in this file when their time comes.
 */

import groq from '@/lib/groq';
import { requireAuth } from '@/lib/supabase-server';
import { LESSON_QUIZ_DAILY_LIMIT } from '@/lib/config';
import { lessonQuiz } from '@/lib/ai/prompts';
import type { QuizDataContext } from '@/lib/ai/prompts/lesson-quiz';
import { cfoToolHandlers } from '@/lib/ai/cfo-tools';
import { getDashboardStats } from '@/lib/actions/dashboard';
import type { Pillar, Lesson, LessonResource } from '@/lib/supabase-types';

// ─────────────────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────────────────

export interface QuizQuestion {
  question: string;
  options: string[];
  /** Index into `options` of the correct answer. */
  correctIndex: number;
  explanation: string;
}

export interface Quiz {
  lessonId: string;
  lessonTitle: string;
  questions: QuizQuestion[];
  /** Total tokens used. Surfaced to the UI + logged to ai_usage. */
  usage: { promptTokens: number; completionTokens: number; totalTokens: number };
  generatedAt: string;
}

/** A pillar with its lesson count, ready for the pillar grid UI. */
export interface PillarWithCount extends Pillar {
  lessonCount: number;
}

// ─────────────────────────────────────────────────────────────────────
// Read actions
// ─────────────────────────────────────────────────────────────────────

/**
 * Fetch every active pillar, plus the number of published lessons
 * under each. Used by `/(pos)/learn/` (4C.1) to render the pillar grid.
 *
 * We do the lesson count in a single follow-up query (not as a JOIN)
 * because Supabase PostgREST doesn't yet do relational counts cleanly
 * for our `is_published` filter on the join — a separate COUNT query
 * is simpler and the result set is tiny (4 pillars, 14 lessons total).
 */
export async function getPillars(): Promise<{
  data?: PillarWithCount[];
  error?: string;
}> {
  const auth = await requireAuth();
  if ('error' in auth) return { error: auth.error };
  const supabase = auth.supabase;

  const { data: pillars, error: pillarsError } = await supabase
    .from('pillars')
    .select('*')
    .eq('is_active', true)
    .order('display_order', { ascending: true });

  if (pillarsError) return { error: pillarsError.message };
  if (!pillars || pillars.length === 0) return { data: [] };

  // Count lessons per pillar. We use a single SELECT with grouping
  // (head: false, count: exact) to get all the counts in one round trip.
  const { data: lessonRows, error: lessonsError } = await supabase
    .from('lessons')
    .select('pillar_id')
    .eq('is_published', true);

  if (lessonsError) return { error: lessonsError.message };

  const counts = new Map<string, number>();
  for (const row of (lessonRows ?? []) as Array<{ pillar_id: string }>) {
    counts.set(row.pillar_id, (counts.get(row.pillar_id) ?? 0) + 1);
  }

  const enriched: PillarWithCount[] = (pillars as unknown as Pillar[]).map((p) => ({
    ...p,
    lessonCount: counts.get(p.id) ?? 0,
  }));

  return { data: enriched };
}

/**
 * Fetch a single pillar by slug. Returns the pillar + lesson count.
 * Used by 4C.2 (pillar lesson list page) to render the header.
 */
export async function getPillarBySlug(
  slug: string
): Promise<{ data?: PillarWithCount; error?: string }> {
  const auth = await requireAuth();
  if ('error' in auth) return { error: auth.error };
  const supabase = auth.supabase;

  const { data: pillar, error: pillarError } = await supabase
    .from('pillars')
    .select('*')
    .eq('slug', slug)
    .eq('is_active', true)
    .single();

  if (pillarError || !pillar) return { error: pillarError?.message || 'Pillar not found' };

  const { count, error: countError } = await supabase
    .from('lessons')
    .select('id', { count: 'exact', head: true })
    .eq('pillar_id', (pillar as Pillar).id)
    .eq('is_published', true);

  if (countError) return { error: countError.message };

  return { data: { ...(pillar as Pillar), lessonCount: count ?? 0 } };
}

/**
 * Fetch all published lessons for a pillar, ordered for display. Used
 * by 4C.2 (pillar lesson list page). The lessons arrive WITHOUT their
 * body_md to keep the list payload small; the reader (4C.3) fetches
 * the full body separately.
 *
 * For 4D.2 we also join the user's per-lesson progress so the list
 * can show bookmark + completion + read state without an extra round
 * trip from the client. We project the same columns plus
 * `bookmarked` and `completed_at` (NULL when no row exists).
 */
export async function getLessonsByPillar(
  pillarId: string
): Promise<{
  data?: Array<Omit<Lesson, 'body_md'> & {
    bookmarked: boolean;
    completedAt: string | null;
  }>;
  error?: string;
}> {
  const auth = await requireAuth();
  if ('error' in auth) return { error: auth.error };
  const { supabase, userId } = auth;

  // Pull the lessons and the user's progress for those lessons in two
  // queries, then merge in JS. PostgREST's nested-join syntax works
  // for single-row fetches but is awkward to filter by user_id when
  // progress might be missing — the two-query merge is clearer.
  const [lessonsRes, progressRes] = await Promise.all([
    supabase
      .from('lessons')
      .select(
        'id, pillar_id, slug, title, audio_url, est_minutes, display_order, requires_data, is_published, created_at, updated_at'
      )
      .eq('pillar_id', pillarId)
      .eq('is_published', true)
      .order('display_order', { ascending: true }),
    supabase
      .from('user_lesson_progress')
      .select('lesson_id, bookmarked, completed_at')
      .eq('user_id', userId),
  ]);

  if (lessonsRes.error) return { error: lessonsRes.error.message };
  if (progressRes.error) return { error: progressRes.error.message };

  type ProgressRow = {
    lesson_id: string;
    bookmarked?: boolean;
    completed_at?: string | null;
  };
  const progressByLesson = new Map<string, ProgressRow>();
  for (const row of (progressRes.data ?? []) as ProgressRow[]) {
    progressByLesson.set(row.lesson_id, row);
  }

  const merged = ((lessonsRes.data ?? []) as Omit<Lesson, 'body_md'>[]).map(
    (lesson) => {
      const p = progressByLesson.get(lesson.id);
      return {
        ...lesson,
        bookmarked: p?.bookmarked ?? false,
        completedAt: p?.completed_at ?? null,
      };
    }
  );

  return { data: merged };
}

/**
 * Fetch a single lesson by pillar slug + lesson slug. Used by 4C.3
 * (lesson reader). Returns the full lesson including body_md.
 */
export async function getLessonBySlug(
  pillarSlug: string,
  lessonSlug: string
): Promise<{ data?: Lesson; error?: string }> {
  const auth = await requireAuth();
  if ('error' in auth) return { error: auth.error };
  const supabase = auth.supabase;

  // Join lessons + pillars in one query so we can filter by both slugs.
  // The foreign key from lessons.pillar_id → pillars.id is the join key.
  const { data, error } = await supabase
    .from('lessons')
    .select(
      '*, pillar:pillars!inner(slug, name, color, icon)'
    )
    .eq('slug', lessonSlug)
    .eq('is_published', true)
    .eq('pillars.slug', pillarSlug)
    .maybeSingle();

  if (error) return { error: error.message };
  if (!data) return { error: 'Lesson not found' };

  return { data: data as unknown as Lesson };
}

/**
 * Fetch the "Apply to your business" links for a lesson. Used by 4C.3
 * (lesson reader) to render the resource buttons at the bottom.
 */
export async function getLessonResources(
  lessonId: string
): Promise<{ data?: LessonResource[]; error?: string }> {
  const auth = await requireAuth();
  if ('error' in auth) return { error: auth.error };
  const supabase = auth.supabase;

  const { data, error } = await supabase
    .from('lesson_resources')
    .select('id, lesson_id, label, href, kind, display_order')
    .eq('lesson_id', lessonId)
    .order('display_order', { ascending: true });

  if (error) return { error: error.message };
  return { data: (data ?? []) as LessonResource[] };
}

/**
 * Mark a quiz as completed (or update the existing score). Used by the
 * Take quiz client component after the user finishes answering. The
 * score is 0-100, computed as (correctAnswers / totalQuestions) * 100.
 *
 * Upserts into `user_lesson_progress`: if a row exists for
 * (user_id, lesson_id), update quiz_score + last_seen_at; otherwise
 * insert a new row.
 */
export async function markQuizCompleted(
  lessonId: string,
  score: number
): Promise<{ data?: { score: number }; error?: string }> {
  const auth = await requireAuth();
  if ('error' in auth) return { error: auth.error };
  const { supabase, userId } = auth;

  if (typeof score !== 'number' || score < 0 || score > 100) {
    return { error: 'score must be 0-100' };
  }
  if (!lessonId) return { error: 'lessonId is required' };

  // Upsert. The UNIQUE(user_id, lesson_id) constraint makes this safe.
  const { error } = await supabase
    .from('user_lesson_progress')
    .upsert(
      {
        user_id: userId,
        lesson_id: lessonId,
        quiz_score: Math.round(score),
        last_seen_at: new Date().toISOString(),
        // completed_at gets set when the user finishes the lesson body
        // (4D.1). For now the quiz alone doesn't mark a lesson complete.
      },
      { onConflict: 'user_id,lesson_id' }
    );

  if (error) return { error: error.message };
  return { data: { score: Math.round(score) } };
}

/**
 * Update per-user read progress for a lesson (4D.1).
 *
 * Used by the LessonProgressTracker client component. Called frequently
 * (debounced on the client) to record:
 *   - scrollDepthPct: the deepest position the user has scrolled to (0-100).
 *     We MAX() with the existing value so progress never goes backwards.
 *   - readSeconds: seconds the lesson was in the foreground. We ADD to
 *     the existing value so the same lesson visit adds up over time.
 *   - completed: if true, set completed_at to now() (only if not already
 *     set — we never clear a completion).
 *   - last_seen_at: always updated to now().
 *
 * If a row doesn't exist yet, this creates one. If it does, it merges
 * the deltas (not overwrites). Idempotent under retries.
 */
export async function updateLessonProgress(
  lessonId: string,
  progress: {
    scrollDepthPct?: number;
    readSeconds?: number;
    completed?: boolean;
  }
): Promise<{ data?: { completed: boolean; completedAt: string | null }; error?: string }> {
  const auth = await requireAuth();
  if ('error' in auth) return { error: auth.error };
  const { supabase, userId } = auth;

  if (!lessonId) return { error: 'lessonId is required' };

  // Fetch the existing progress (if any) so we can do the MAX/ADD merge
  // client-side. A single SELECT before the UPSERT is fine — read-time
  // tracking is low-frequency (debounced on the client).
  const { data: existing } = await supabase
    .from('user_lesson_progress')
    .select('scroll_depth_pct, read_seconds, completed_at, bookmarked')
    .eq('user_id', userId)
    .eq('lesson_id', lessonId)
    .maybeSingle();

  const current = (existing as {
    scroll_depth_pct?: number;
    read_seconds?: number;
    completed_at?: string | null;
    bookmarked?: boolean;
  } | null) ?? {};

  const mergedScroll =
    progress.scrollDepthPct != null
      ? Math.max(100, Math.max(current.scroll_depth_pct ?? 0, progress.scrollDepthPct))
      : (current.scroll_depth_pct ?? 0);
  const mergedSeconds =
    progress.readSeconds != null
      ? (current.read_seconds ?? 0) + Math.max(0, Math.floor(progress.readSeconds))
      : (current.read_seconds ?? 0);
  // Cap to sane values.
  const finalScroll = Math.max(0, Math.min(100, mergedScroll));
  const finalSeconds = Math.max(0, mergedSeconds);

  // Completion is sticky: once set, never cleared. We only set it
  // when the caller explicitly asks, AND it's not already set.
  const wantsComplete = progress.completed === true && !current.completed_at;
  const completedAt = wantsComplete
    ? new Date().toISOString()
    : (current.completed_at ?? null);

  const { data: upserted, error } = await supabase
    .from('user_lesson_progress')
    .upsert(
      {
        user_id: userId,
        lesson_id: lessonId,
        scroll_depth_pct: finalScroll,
        read_seconds: finalSeconds,
        completed_at: completedAt,
        bookmarked: current.bookmarked ?? false,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,lesson_id' }
    )
    .select('completed_at')
    .single();

  if (error) return { error: error.message };
  const completedAtOut = (upserted as { completed_at?: string | null } | null)?.completed_at ?? null;
  return { data: { completed: !!completedAtOut, completedAt: completedAtOut } };
}

/**
 * Fetch the user's progress for a single lesson. Used by 4C.5 to
 * decide which lesson to surface as "Today's lesson" and by 4D.2
 * to know if a lesson is bookmarked.
 */
export async function getUserLessonProgress(
  lessonId: string
): Promise<{
  data?: {
    scrollDepthPct: number;
    readSeconds: number;
    completedAt: string | null;
    bookmarked: boolean;
    quizScore: number | null;
  } | null;
  error?: string;
}> {
  const auth = await requireAuth();
  if ('error' in auth) return { error: auth.error };
  const supabase = auth.supabase;

  const { data, error } = await supabase
    .from('user_lesson_progress')
    .select('scroll_depth_pct, read_seconds, completed_at, bookmarked, quiz_score')
    .eq('user_id', auth.userId)
    .eq('lesson_id', lessonId)
    .maybeSingle();

  if (error) return { error: error.message };
  if (!data) return { data: null };

  const row = data as {
    scroll_depth_pct?: number;
    read_seconds?: number;
    completed_at?: string | null;
    bookmarked?: boolean;
    quiz_score?: number | null;
  };
  return {
    data: {
      scrollDepthPct: row.scroll_depth_pct ?? 0,
      readSeconds: row.read_seconds ?? 0,
      completedAt: row.completed_at ?? null,
      bookmarked: row.bookmarked ?? false,
      quizScore: row.quiz_score ?? null,
    },
  };
}

/**
 * Mark a lesson as read unconditionally. Used by the "Mark as read"
 * button on the lesson reader (4D.1 manual fallback when the
 * auto-detection misses). Sets `completed_at` if not already set;
 * otherwise no-ops. Returns the final completed state.
 */
export async function markLessonRead(
  lessonId: string
): Promise<{ data?: { completed: boolean; completedAt: string | null }; error?: string }> {
  // Reuse updateLessonProgress with completed: true. It already
  // enforces the sticky-once-completed rule.
  return updateLessonProgress(lessonId, { completed: true });
}

/**
 * Toggle (or set) the bookmark flag on a lesson (4D.2).
 *
 * If `bookmarked` is omitted, flips the current value. If provided,
 * forces that value. Upserts into `user_lesson_progress` so we don't
 * need to require the user to have read the lesson first.
 *
 * The `bookmarked` column is the only field written here — we never
 * touch scroll/read/quiz state from this action.
 */
export async function toggleBookmark(
  lessonId: string,
  bookmarked?: boolean
): Promise<{ data?: { bookmarked: boolean }; error?: string }> {
  const auth = await requireAuth();
  if ('error' in auth) return { error: auth.error };
  const { supabase, userId } = auth;

  if (!lessonId) return { error: 'lessonId is required' };

  // Look up current state. If a row exists, decide the new value
  // (toggle or set). If no row exists, we treat the current as
  // `false` and apply the new value (which may be `true` or `false`).
  const { data: existing } = await supabase
    .from('user_lesson_progress')
    .select('bookmarked')
    .eq('user_id', userId)
    .eq('lesson_id', lessonId)
    .maybeSingle();

  const currentBookmarked =
    (existing as { bookmarked?: boolean } | null)?.bookmarked ?? false;
  const nextBookmarked =
    typeof bookmarked === 'boolean' ? bookmarked : !currentBookmarked;

  const { error } = await supabase
    .from('user_lesson_progress')
    .upsert(
      {
        user_id: userId,
        lesson_id: lessonId,
        bookmarked: nextBookmarked,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,lesson_id' }
    );

  if (error) return { error: error.message };
  return { data: { bookmarked: nextBookmarked } };
}

/**
 * Compute the user's current completion streak + a few related stats
 * (used by 4C.6 "celebration" UI and 4D.3 "daily reminder" nudge).
 *
 * A "day" is defined by the user's local timezone (we use Africa/Lusaka
 * explicitly because the app is Zambia-only and server time may be UTC).
 * The streak is the count of consecutive days ending today (or yesterday
 * if the user hasn't read anything yet today) on which the user
 * completed at least one lesson. Streak breaks if a day was skipped.
 *
 * Returns:
 *   - streakDays: 0 if no completions ever, otherwise the consecutive-
 *     day count.
 *   - completedToday: true if the user has any completion dated today.
 *   - lastCompletedAt: ISO timestamp of the most recent completion, or
 *     null if none.
 *   - totalCompleted: total number of lessons ever completed.
 */
export async function getStreakSummary(): Promise<{
  data?: {
    streakDays: number;
    completedToday: boolean;
    lastCompletedAt: string | null;
    totalCompleted: number;
  };
  error?: string;
}> {
  const auth = await requireAuth();
  if ('error' in auth) return { error: auth.error };
  const { supabase, userId } = auth;

  // We fetch just the completion timestamps — the only field we need
  // to compute the streak. We sort descending so the most recent is
  // first; that's where the streak walk starts.
  const { data, error } = await supabase
    .from('user_lesson_progress')
    .select('completed_at')
    .eq('user_id', userId)
    .not('completed_at', 'is', null)
    .order('completed_at', { ascending: false });

  if (error) return { error: error.message };

  const rows = (data ?? []) as Array<{ completed_at: string }>;
  const totalCompleted = rows.length;
  if (totalCompleted === 0) {
    return {
      data: {
        streakDays: 0,
        completedToday: false,
        lastCompletedAt: null,
        totalCompleted: 0,
      },
    };
  }

  // Convert each completion to its local-date string in Africa/Lusaka.
  // We use Intl.DateTimeFormat with the timeZone option so DST and
  // offset changes don't matter (Zambia is GMT+2 year-round, so this
  // is mostly belt-and-braces).
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Lusaka',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const localDate = (iso: string) => fmt.format(new Date(iso)); // YYYY-MM-DD

  // Distinct local dates, descending.
  const dateSet = new Set<string>();
  for (const r of rows) dateSet.add(localDate(r.completed_at));
  const datesDesc = Array.from(dateSet).sort((a, b) => (a < b ? 1 : -1));
  const lastCompletedAt = rows[0]?.completed_at ?? null;

  // Today in the user's timezone.
  const todayStr = fmt.format(new Date());
  const completedToday = dateSet.has(todayStr);

  // Walk backwards from today (or yesterday if not done today) day
  // by day, counting consecutive completions.
  const [tY, tM, tD] = todayStr.split('-').map(Number);
  const startDate = new Date(Date.UTC(tY, tM - 1, tD));
  // If the user hasn't completed anything today, the streak still
  // counts as long as the most recent day was yesterday. We start
  // from yesterday in that case to allow "you still have time today".
  if (!completedToday) startDate.setUTCDate(startDate.getUTCDate() - 1);

  let streakDays = 0;
  for (let i = 0; i < dateSet.size + 5; i++) {
    const key = fmt.format(startDate);
    if (dateSet.has(key)) {
      streakDays += 1;
      startDate.setUTCDate(startDate.getUTCDate() - 1);
    } else {
      break;
    }
  }

  return {
    data: {
      streakDays,
      completedToday,
      lastCompletedAt,
      totalCompleted,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────
// Main action: generatePersonalizedQuiz
// ─────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────
// Main action: generatePersonalizedQuiz
// ─────────────────────────────────────────────────────────────────────

export async function generatePersonalizedQuiz(
  lessonId: string
): Promise<{ data?: Quiz; error?: string }> {
  // 1) Auth.
  const auth = await requireAuth();
  if ('error' in auth) return { error: auth.error };
  const { supabase, userId } = auth;

  if (!lessonId) return { error: 'lessonId is required' };

  // 2) Rate limit (default 10 quizzes/user/day).
  if (LESSON_QUIZ_DAILY_LIMIT > 0) {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const { count, error: countError } = await supabase
      .from('ai_usage')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('route', 'lesson_quiz')
      .gte('created_at', startOfDay.toISOString());

    if (!countError && (count ?? 0) >= LESSON_QUIZ_DAILY_LIMIT) {
      return {
        error: `Daily quiz limit reached (${LESSON_QUIZ_DAILY_LIMIT}/day). Resets at midnight. Adjust LESSON_QUIZ_DAILY_LIMIT in lib/config.ts if you need more.`,
      };
    }
  }

  // 3) Load the lesson.
  const { data: lesson, error: lessonError } = await supabase
    .from('lessons')
    .select('id, title, body_md, requires_data, is_published')
    .eq('id', lessonId)
    .single();

  if (lessonError || !lesson) {
    return { error: lessonError?.message || 'Lesson not found' };
  }

  if (!lesson.is_published) {
    return { error: 'Lesson is not published' };
  }

  type LessonRow = {
    id: string;
    title: string;
    body_md: string;
    requires_data: string[];
    is_published: boolean;
  };
  const safeLesson = lesson as unknown as LessonRow;

  // 4) Gather data context based on what the lesson asks for. Each
  //    requires_data flag maps to a single tool call. We do them
  //    sequentially because (a) most lessons ask for 0-2 flags and
  //    (b) tool order doesn't matter for the prompt.
  const dataContext: QuizDataContext = {};
  const flags = safeLesson.requires_data ?? [];

  // Run gatherers in parallel for the common case.
  const gatherers: Array<Promise<void>> = [];

  if (flags.includes('sales')) {
    gatherers.push(
      (async () => {
        const stats = await getDashboardStats();
        if (stats.data) {
          dataContext.sales = {
            groundTruth: stats.data.groundTruth,
            inPipeline: stats.data.inPipeline,
            recentSalesCount: stats.data.recentSales?.length ?? 0,
          };
        }
      })()
    );
  }

  if (flags.includes('profitability')) {
    gatherers.push(
      (async () => {
        // Reuse the engine tool handler. The function is async and takes
        // (supabase, args); we just feed sensible defaults.
        const result = await cfoToolHandlers.get_top_products(supabase, {
          preset: 'month',
          limit: 10,
        });
        if (result.ok) dataContext.profitability = result.data;
      })()
    );
  }

  if (flags.includes('debts')) {
    gatherers.push(
      (async () => {
        const result = await cfoToolHandlers.get_aging_debts(supabase, {});
        if (result.ok) dataContext.debts = result.data;
      })()
    );
  }

  if (flags.includes('inventory')) {
    gatherers.push(
      (async () => {
        const result = await cfoToolHandlers.get_slow_moving_stock(supabase, {
          limit: 20,
        });
        if (result.ok) dataContext.inventory = result.data;
      })()
    );
  }

  if (flags.includes('journal')) {
    gatherers.push(
      (async () => {
        const result = await cfoToolHandlers.get_pnl(supabase, {
          preset: 'month',
        });
        if (result.ok) dataContext.journal = result.data;
      })()
    );
  }

  if (flags.includes('expenses')) {
    gatherers.push(
      (async () => {
        // Reuse get_pnl for now — the PnL already includes the operating
        // expense breakdown. A dedicated get_expense_categories tool
        // is a Phase 4 / Phase 7 add-on.
        const result = await cfoToolHandlers.get_pnl(supabase, {
          preset: 'month',
        });
        if (result.ok) dataContext.expenses = result.data;
      })()
    );
  }

  await Promise.all(gatherers);

  // 5) Call Groq.
  let response;
  try {
    response = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: lessonQuiz.system },
        {
          role: 'user',
          content: lessonQuiz.buildUserMessage({
            lessonTitle: safeLesson.title,
            lessonBody: safeLesson.body_md,
            requiresData: flags,
            data: dataContext,
          }),
        },
      ],
      model: lessonQuiz.meta.model,
      temperature: lessonQuiz.meta.temperature,
      max_tokens: lessonQuiz.meta.maxTokens,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[generatePersonalizedQuiz] Groq error:', msg);
    return { error: `Couldn't reach the AI (${msg}). Please try again.` };
  }

  const usage = {
    promptTokens: response.usage?.prompt_tokens ?? 0,
    completionTokens: response.usage?.completion_tokens ?? 0,
    totalTokens: response.usage?.total_tokens ?? 0,
  };

  // 6) Parse the JSON response. The model sometimes adds prose or
  //    markdown fences; defensive parsing handles all of it.
  const content = response.choices[0]?.message?.content?.trim() || '';
  const questions = parseQuizResponse(content);

  if (questions.length === 0) {
    return {
      error:
        "The AI returned a quiz I couldn't parse. Please try again — the model occasionally adds prose that breaks the JSON.",
    };
  }

  // 7) Best-effort ai_usage write. route = 'lesson_quiz' gives the
  //    future spend dashboard (3C.2 / Phase 7) a clean per-feature
  //    breakdown.
  supabase
    .from('ai_usage')
    .insert([{
      user_id: userId,
      route: 'lesson_quiz',
      prompt_tokens: usage.promptTokens,
      completion_tokens: usage.completionTokens,
      total_tokens: usage.totalTokens,
      model: lessonQuiz.meta.model,
    }])
    .then(({ error }) => {
      if (error) console.warn('[generatePersonalizedQuiz] ai_usage insert failed:', error.message);
    });

  // 8) Best-effort audit_log write.
  supabase
    .from('audit_log')
    .insert([{
      user_id: userId,
      action: 'lesson.quiz_generate',
      entity_type: 'lesson',
      entity_id: safeLesson.id,
      metadata: {
        lessonTitle: safeLesson.title,
        questionCount: questions.length,
        dataFlags: flags,
        totalTokens: usage.totalTokens,
      },
    }])
    .then(({ error }) => {
      if (error) console.warn('[generatePersonalizedQuiz] audit_log insert failed:', error.message);
    });

  return {
    data: {
      lessonId: safeLesson.id,
      lessonTitle: safeLesson.title,
      questions,
      usage,
      generatedAt: new Date().toISOString(),
    },
  };
}

// ─────────────────────────────────────────────────────────────────────
// Defensive JSON parser
// ─────────────────────────────────────────────────────────────────────

/**
 * Pull a JSON array of quiz questions out of the model's free-form text.
 * The model is instructed to return pure JSON but it sometimes wraps
 * the array in markdown fences or adds a sentence of preamble.
 */
function parseQuizResponse(content: string): QuizQuestion[] {
  // Strip code fences if present.
  const cleaned = content
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/, '')
    .trim();

  // Find the first array. Greedy enough to catch the whole array.
  const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
  if (!arrayMatch) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(arrayMatch[0]);
  } catch {
    return [];
  }

  if (!Array.isArray(parsed)) return [];

  const out: QuizQuestion[] = [];
  for (const item of parsed) {
    if (!isQuizQuestion(item)) continue;
    out.push({
      question: String(item.question).slice(0, 500),
      options: item.options.slice(0, 4).map((o) => String(o).slice(0, 300)),
      correctIndex: Math.max(0, Math.min(3, Number(item.correctIndex) || 0)),
      explanation: String(item.explanation || '').slice(0, 500),
    });
  }
  return out;
}

function isQuizQuestion(item: unknown): item is {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
} {
  if (!item || typeof item !== 'object') return false;
  const o = item as Record<string, unknown>;
  if (typeof o.question !== 'string' || !o.question.trim()) return false;
  if (!Array.isArray(o.options) || o.options.length < 2) return false;
  if (typeof o.correctIndex !== 'number') return false;
  if (typeof o.explanation !== 'string') return false;
  return true;
}
