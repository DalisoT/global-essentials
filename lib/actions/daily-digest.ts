'use server';

/**
 * Daily end-of-day digest (Phase 12 / D).
 *
 * Cron runs at 19:00 Africa/Lusaka (after the shop has
 * typically closed). Collects today's snapshot, calls Groq,
 * persists the result as a `kind='custom'` recommendation
 * so the owner sees it first thing in the morning.
 *
 * The recommendation's body is the digest text. The owner
 * can dismiss / accept it (memory layer learns which
 * digests are useful), or use the SendUpdateButton to push
 * it to their own WhatsApp.
 *
 * Idempotency: natural key is (kind='custom', related_id=dateISO).
 * Re-runs on the same day just refresh the body in case
 * the numbers moved.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import groq from '@/lib/groq';
import { dailyDigest } from '@/lib/ai/prompts';
import { createServiceRoleClient } from '@/lib/supabase-server';
import type { AIRecommendation } from '@/lib/supabase-types';

export interface DailyDigestJSON {
  summary: string;
  highlight: string;
  tomorrow: string;
}

function localDateString(d: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Lusaka',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

function addDays(base: string, days: number): string {
  const [y, m, d] = base.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

async function callDigestModel(
  input: Parameters<typeof dailyDigest.buildUserMessage>[0]
): Promise<DailyDigestJSON | null> {
  const userPrompt = dailyDigest.buildUserMessage(input);
  try {
    const response = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: dailyDigest.system },
        { role: 'user', content: userPrompt },
      ],
      model: dailyDigest.meta.model,
      temperature: dailyDigest.meta.temperature,
      max_tokens: dailyDigest.meta.maxTokens,
    });
    const content = response.choices[0]?.message?.content?.trim() || '';
    return parseDigest(content);
  } catch (err) {
    console.warn('[DailyDigest] Groq call failed:', err);
    return null;
  }
}

function parseDigest(content: string): DailyDigestJSON | null {
  const cleaned = content
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/, '')
    .trim();
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    return null;
  }
  if (
    !parsed ||
    typeof parsed !== 'object' ||
    !('summary' in parsed) ||
    !('highlight' in parsed) ||
    !('tomorrow' in parsed)
  ) {
    return null;
  }
  const obj = parsed as { summary: unknown; highlight: unknown; tomorrow: unknown };
  return {
    summary: typeof obj.summary === 'string' ? obj.summary.slice(0, 120).trim() : '',
    highlight: typeof obj.highlight === 'string' ? obj.highlight.slice(0, 200).trim() : '',
    tomorrow: typeof obj.tomorrow === 'string' ? obj.tomorrow.slice(0, 200).trim() : '',
  };
}

export interface GenerateDailyDigestResult {
  ok: boolean;
  recommendation?: AIRecommendation;
  message?: string;
}

export async function generateDailyDigest(
  supabase: SupabaseClient
): Promise<GenerateDailyDigestResult> {
  const today = localDateString();
  const yesterday = addDays(today, -1);

  // Sales today + yesterday
  const { data: todaySales } = await supabase
    .from('sales')
    .select('id, total_amount, product_id, quantity, product:products(name)')
    .eq('payment_status', 'paid')
    .gte('created_at', `${today}T00:00:00`)
    .lte('created_at', `${today}T23:59:59.999`);

  const { data: yesterdaySales } = await supabase
    .from('sales')
    .select('id, total_amount')
    .eq('payment_status', 'paid')
    .gte('created_at', `${yesterday}T00:00:00`)
    .lte('created_at', `${yesterday}T23:59:59.999`);

  // Expenses today
  const { data: todayExpenses } = await supabase
    .from('expenses')
    .select('amount')
    .gte('created_at', `${today}T00:00:00`)
    .lte('created_at', `${today}T23:59:59.999`);

  // Pre-orders active + new today
  const { data: activePreOrders } = await supabase
    .from('pre_orders')
    .select('id')
    .in('status', ['pending', 'deposit_paid', 'arrived']);
  const { data: newPreOrders } = await supabase
    .from('pre_orders')
    .select('id')
    .gte('created_at', `${today}T00:00:00`)
    .lte('created_at', `${today}T23:59:59.999`);

  // Anomalies from today
  const { data: anomalies } = await supabase
    .from('ai_recommendations')
    .select('kind, title')
    .eq('kind', 'anomaly')
    .gte('created_at', `${today}T00:00:00`)
    .lte('created_at', `${today}T23:59:59.999`);

  // High-priority open recs
  const { data: highPriorityRecs } = await supabase
    .from('ai_recommendations')
    .select('id')
    .eq('status', 'pending')
    .eq('priority', 'high');

  // Top product today (by revenue)
  const productAgg = new Map<string, { name: string; revenue: number; unitsSold: number }>();
  for (const s of (todaySales ?? []) as Array<{
    total_amount: number;
    quantity: number | null;
    product: { name: string } | { name: string }[] | null;
  }>) {
    const productRel = Array.isArray(s.product) ? s.product[0] : s.product;
    const name = productRel?.name ?? 'Unknown';
    const entry = productAgg.get(name) ?? { name, revenue: 0, unitsSold: 0 };
    entry.revenue += s.total_amount ?? 0;
    entry.unitsSold += s.quantity ?? 1;
    productAgg.set(name, entry);
  }
  const topProduct =
    Array.from(productAgg.values()).sort((a, b) => b.revenue - a.revenue)[0] ?? null;

  const snapshot = {
    dateISO: today,
    revenueToday: (todaySales ?? []).reduce((s, x) => s + (x.total_amount ?? 0), 0),
    salesCountToday: (todaySales ?? []).length,
    revenueYesterday: (yesterdaySales ?? []).reduce((s, x) => s + (x.total_amount ?? 0), 0),
    expensesToday: (todayExpenses ?? []).reduce((s, x) => s + (x.amount ?? 0), 0),
    topProduct,
    preOrdersActive: (activePreOrders ?? []).length,
    preOrdersNewToday: (newPreOrders ?? []).length,
    anomalies: (anomalies ?? []) as Array<{ kind: string; title: string }>,
    highPriorityRecsCount: (highPriorityRecs ?? []).length,
  };

  const digest = await callDigestModel(snapshot);
  if (!digest) {
    return { ok: false, message: 'Model returned no usable digest' };
  }

  const title = digest.summary || 'Your day-end digest';
  const body = [
    digest.highlight,
    '',
    `For tomorrow: ${digest.tomorrow}`,
  ]
    .filter(Boolean)
    .join('\n')
    .slice(0, 2000);

  // Upsert by (kind='custom', related_id=today) so re-runs refresh
  const { data: existing } = await supabase
    .from('ai_recommendations')
    .select('id, status')
    .eq('kind', 'custom')
    .eq('related_id', today)
    .eq('status', 'pending')
    .maybeSingle();

  if (existing) {
    const { data, error } = await supabase
      .from('ai_recommendations')
      .update({
        title,
        body,
        payload: { digest, snapshot } as Record<string, unknown>,
      })
      .eq('id', (existing as { id: string }).id)
      .select('*')
      .single();
    if (error) return { ok: false, message: error.message };
    return { ok: true, recommendation: data as unknown as AIRecommendation };
  }

  const { data, error } = await supabase
    .from('ai_recommendations')
    .insert([{
      kind: 'custom',
      title,
      body,
      payload: { digest, snapshot } as Record<string, unknown>,
      priority: 'medium',
      status: 'pending',
      source_action: 'generateDailyDigest',
      related_id: today,
    }])
    .select('*')
    .single();

  if (error) return { ok: false, message: error.message };
  return { ok: true, recommendation: data as unknown as AIRecommendation };
}

export async function runDailyDigestCron(): Promise<GenerateDailyDigestResult> {
  let supabase: SupabaseClient;
  try {
    supabase = await createServiceRoleClient();
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : 'Failed to create client',
    };
  }
  return generateDailyDigest(supabase);
}
