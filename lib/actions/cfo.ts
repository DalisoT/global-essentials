'use server';

/**
 * AI CFO Copilot — server action (Phase 3 / 3A.5 + 3A.6 + 3C.2).
 *
 * The public surface the chat UI calls (3B). Internals:
 *   - requireAuth (any authenticated user; the engine is read-only)
 *   - rate limit check against ai_usage (3C.2 — 30/user/day default)
 *   - runCfoEngine (3A.3) — the function-calling loop
 *   - best-effort ai_usage row (3A.4) — token cost tracking
 *   - best-effort audit_log row (3A.6) — every question is paper-trailed
 *
 * Best-effort means: if the audit/usage write fails, we still return the
 * AI's answer. The user got value; we'll patch the trail later. Crashing
 * the response because Supabase had a hiccup would be a worse outcome.
 */

import { requireAuth } from '@/lib/supabase-server';
import { CFO_DAILY_LIMIT } from '@/lib/config';
import {
  runCfoEngine,
  type CfoHistoryMessage,
  type CfoRunResult,
} from '@/lib/ai/cfo-engine';
import type { CfoToolCallRecord } from '@/lib/ai/cfo-engine';

export interface AskCFOInput {
  question: string;
  history?: CfoHistoryMessage[];
}

export interface AskCFOData {
  answer: string;
  toolCalls: CfoToolCallRecord[];
  usage: CfoRunResult['usage'];
  iterations: number;
  hitIterationCap: boolean;
  /** Echoed so the UI can show "Asked at HH:MM" without re-parsing. */
  askedAt: string;
}

export async function askCFO(
  input: AskCFOInput
): Promise<{ data?: AskCFOData; error?: string }> {
  // 1) Auth.
  const auth = await requireAuth();
  if ('error' in auth) return { error: auth.error };
  const { supabase, userId } = auth;

  // 2) Validate input. Empty questions waste a Groq call.
  const question = (input.question || '').trim();
  if (!question) {
    return { error: 'Question is required' };
  }
  if (question.length > 2000) {
    return { error: 'Question is too long (max 2000 characters)' };
  }

  // 3) Rate limit (3C.2). Cheap pre-check: one COUNT against ai_usage for
  //    today. We don't lock anything; concurrent calls could slip through,
  //    but a strict exact-count cap is overkill for a single-user scenario.
  //    The COUNT itself is the only network round-trip; if CFO_DAILY_LIMIT
  //    is 0 (disabled) we skip it.
  if (CFO_DAILY_LIMIT > 0) {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const { count, error: countError } = await supabase
      .from('ai_usage')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('route', 'cfo')
      .gte('created_at', startOfDay.toISOString());

    if (!countError && (count ?? 0) >= CFO_DAILY_LIMIT) {
      return {
        error: `Daily CFO limit reached (${CFO_DAILY_LIMIT}/day). Resets at midnight. Adjust CFO_DAILY_LIMIT in lib/config.ts if you need more.`,
      };
    }
  }

  // 4) Run the engine. If it throws (Groq down, network blip, schema
  //    mismatch), the user gets a graceful error instead of a 500.
  let result: CfoRunResult;
  try {
    result = await runCfoEngine(supabase, question, {
      history: input.history ?? [],
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[askCFO] engine error:', msg);
    return {
      error: `I couldn't reach the AI right now (${msg}). Please try again in a moment.`,
    };
  }

  // 5) ai_usage log (3A.4). Best-effort: never block the response on this.
  //    `route = 'cfo'` is the agreed taxonomy; the dashboard for spend
  //    (3C.2 / QW) will filter by it.
  supabase
    .from('ai_usage')
    .insert([{
      user_id: userId,
      route: 'cfo',
      prompt_tokens: result.usage.promptTokens,
      completion_tokens: result.usage.completionTokens,
      total_tokens: result.usage.totalTokens,
      model: 'llama-3.3-70b-versatile',
    }])
    .then(({ error }) => {
      if (error) console.warn('[askCFO] ai_usage insert failed:', error.message);
    });

  // 6) audit_log entry (3A.6). Replicates the journals.ts pattern.
  //    We log the question + which tools the model called + how long it
  //    took — enough to reconstruct what happened without dumping the full
  //    tool results into the audit table.
  supabase
    .from('audit_log')
    .insert([{
      user_id: userId,
      action: 'cfo.ask',
      entity_type: 'cfo_question',
      // Use a stable id per question+timestamp so it's queryable later.
      // (No real "entity" here, but the column is required.)
      entity_id: null,
      metadata: {
        question,
        iterations: result.iterations,
        hitIterationCap: result.hitIterationCap,
        totalTokens: result.usage.totalTokens,
        toolNames: result.toolCalls.map((t) => t.name),
        toolErrors: result.toolCalls
          .filter((t) => !t.result.ok)
          .map((t) => ({ name: t.name, error: t.result.ok ? null : t.result.error })),
        toolDurationsMs: result.toolCalls.map((t) => ({
          name: t.name,
          ms: t.durationMs,
        })),
      },
    }])
    .then(({ error }) => {
      if (error) console.warn('[askCFO] audit_log insert failed:', error.message);
    });

  return {
    data: {
      answer: result.answer,
      toolCalls: result.toolCalls,
      usage: result.usage,
      iterations: result.iterations,
      hitIterationCap: result.hitIterationCap,
      askedAt: new Date().toISOString(),
    },
  };
}
