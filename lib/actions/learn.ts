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
