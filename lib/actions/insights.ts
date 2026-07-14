'use server';

/**
 * QW.1 — Daily Insights for the Dashboard.
 *
 * Generates 3 short, actionable bullets from the user's actual numbers
 * (ground truth, pipeline, low stock, recent sales, upcoming dues).
 *
 * Design:
 *  - Advisory only — never mutates any data.
 *  - Snapshot is computed server-side from existing dashboard actions so the
 *    AI reasons over the same numbers the user sees on screen.
 *  - Graceful fallback: if Groq is unreachable or returns garbage, we hand
 *    back a static "by-the-numbers" summary so the widget never shows a
 *    blank/error state on the most-visited page.
 *  - Cache for 1 hour via Next.js `revalidate` so we don't ping Groq on
 *    every page load. A manual refresh button bypasses the cache.
 */

import groq from '@/lib/groq';
import { requireAuth } from '@/lib/supabase-server';
import { getDashboardStats } from './dashboard';
import { formatCurrency } from '@/lib/utils';
import { dailyInsights } from '@/lib/ai/prompts';

export interface DailyInsight {
  /** A short, action-oriented bullet (≤ 140 chars). */
  text: string;
  /** Tone hint so the UI can colour-code. */
  tone: 'positive' | 'warning' | 'action' | 'info';
}

export interface DailyInsights {
  bullets: DailyInsight[];
  /** 'ai' when Groq produced the bullets, 'fallback' when we synthesized. */
  source: 'ai' | 'fallback';
  /** ISO timestamp of when these were generated. */
  generatedAt: string;
  /** Echoed for the UI to show alongside. */
  snapshot: {
    groundTruth: number;
    inPipeline: number;
    lowStockCount: number;
    upcomingDuesCount: number;
  };
}

export async function getDailyInsights(): Promise<{ data?: DailyInsights; error?: string }> {
  const auth = await requireAuth();
  if ('error' in auth) return { error: auth.error };

  // Build the snapshot from existing, already-trusted actions.
  const stats = await getDashboardStats();
  if (!stats.data) {
    return { data: buildFallback(null), error: undefined };
  }

  const snapshot = {
    groundTruth: stats.data.groundTruth,
    inPipeline: stats.data.inPipeline,
    lowStockCount: stats.data.lowStockProducts.length,
    upcomingDuesCount: stats.data.upcomingInstallments.length,
  };

  const userPrompt = dailyInsights.buildUserMessage({
    groundTruth: formatCurrency(snapshot.groundTruth),
    inPipeline: formatCurrency(snapshot.inPipeline),
    lowStockCount: snapshot.lowStockCount,
    upcomingDuesCount: snapshot.upcomingDuesCount,
  });

  try {
    const response = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: dailyInsights.system },
        { role: 'user', content: userPrompt },
      ],
      model: dailyInsights.meta.model,
      temperature: dailyInsights.meta.temperature,
      max_tokens: dailyInsights.meta.maxTokens,
    });

    const content = response.choices[0]?.message?.content?.trim() || '';
    const bullets = parseBullets(content);
    if (bullets.length === 3) {
      return {
        data: {
          bullets,
          source: 'ai',
          generatedAt: new Date().toISOString(),
          snapshot,
        },
      };
    }
  } catch (err) {
    // Swallow + fall back. The widget must never error-out the dashboard.
    console.warn('[DailyInsights] Groq call failed, using fallback:', err);
  }

  return { data: buildFallback(snapshot) };
}

function parseBullets(content: string): DailyInsight[] {
  // The model sometimes wraps JSON in markdown fences; strip them.
  const cleaned = content
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/, '')
    .trim();

  const jsonMatch = cleaned.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return [];

  try {
    const parsed = JSON.parse(jsonMatch[0]) as unknown;
    if (!Array.isArray(parsed)) return [];

    const out: DailyInsight[] = [];
    for (const item of parsed) {
      if (
        item &&
        typeof item === 'object' &&
        'text' in item &&
        'tone' in item &&
        typeof (item as { text: unknown }).text === 'string' &&
        typeof (item as { tone: unknown }).tone === 'string'
      ) {
        const tone = (item as { tone: string }).tone as DailyInsight['tone'];
        if (['positive', 'warning', 'action', 'info'].includes(tone)) {
          out.push({
            text: ((item as { text: string }).text || '').slice(0, 200),
            tone,
          });
        }
      }
      if (out.length === 3) break;
    }
    return out;
  } catch {
    return [];
  }
}

function buildFallback(snapshot: DailyInsights['snapshot'] | null): DailyInsights {
  const s = snapshot ?? {
    groundTruth: 0,
    inPipeline: 0,
    lowStockCount: 0,
    upcomingDuesCount: 0,
  };

  const bullets: DailyInsight[] = [];

  if (s.upcomingDuesCount > 0) {
    bullets.push({
      text: `${s.upcomingDuesCount} installment${s.upcomingDuesCount === 1 ? '' : 's'} due in the next 7 days — review the Debts page and send reminders.`,
      tone: 'action',
    });
  } else {
    bullets.push({
      text: 'No installments due in the next 7 days — focus on making new sales.',
      tone: 'positive',
    });
  }

  if (s.lowStockCount > 0) {
    bullets.push({
      text: `${s.lowStockCount} item${s.lowStockCount === 1 ? '' : 's'} low on stock — check the Inventory page and reorder.`,
      tone: 'warning',
    });
  } else {
    bullets.push({
      text: 'Stock levels look healthy across all products.',
      tone: 'positive',
    });
  }

  bullets.push({
    text: `Ground truth is ${formatCurrency(s.groundTruth)}; ${formatCurrency(s.inPipeline)} still in the pipeline.`,
    tone: 'info',
  });

  return {
    bullets,
    source: 'fallback',
    generatedAt: new Date().toISOString(),
    snapshot: s,
  };
}