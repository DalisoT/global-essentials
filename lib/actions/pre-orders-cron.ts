'use server';

/**
 * Pre-order update cadence cron (Phase 11 / 11.10).
 *
 * Run once a day. For every active pre-order (status =
 * 'deposit_paid'), it checks whether a scheduled update
 * is due and queues it as a `message_queued` event with
 * the suggested template + body preview.
 *
 * The cadence:
 *   - Day 14 after deposit paid → "in_transit"
 *   - Day 30                       → "customs/clearing"
 *   - Day 45                       → "almost_there"
 *   - 3 days past expected_delivery → "delay apology" (custom)
 *
 * Idempotency: we only queue a message if no event of the
 * same kind exists yet for that pre-order. (For example,
 * we won't queue "in_transit" twice.) The check is per
 * (pre_order_id, event_data->>'cadence_key').
 *
 * The cron does NOT auto-send anything — it just queues.
 * The shop owner opens the pre-order inbox each morning
 * and clicks "send" on the queued ones. We log the result
 * (sent / dismissed) via the `message_sent` event in 11.9.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { createServiceRoleClient, requireAuth } from '@/lib/supabase-server';
import { renderMessage, type MessageTemplateId } from '@/lib/pre-orders/messages';
import type { PreOrder } from '@/lib/supabase-types';

interface CadenceStep {
  /** Days after deposit_paid_at (or after expected_delivery_date for the last step). */
  day: number;
  /** What the day is relative to. 'deposit' = days since deposit_paid_at. 'expected' = days past expected_delivery_date. */
  relative: 'deposit' | 'expected';
  template: MessageTemplateId;
  /** Stable key for the cadence step — used to dedupe. */
  cadence_key: string;
}

const CADENCE: CadenceStep[] = [
  { day: 14, relative: 'deposit', template: 'in_transit', cadence_key: 'd14_in_transit' },
  { day: 30, relative: 'deposit', template: 'customs', cadence_key: 'd30_customs' },
  { day: 45, relative: 'deposit', template: 'almost_there', cadence_key: 'd45_almost' },
  // Day 3 past expected_delivery_date is the "delay apology" —
  // a one-off custom message that the shop owner can edit before sending.
  { day: 3, relative: 'expected', template: 'custom', cadence_key: 'past_3d_apology' },
];

function daysBetween(a: Date, b: Date): number {
  const aMs = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const bMs = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((bMs - aMs) / (1000 * 60 * 60 * 24));
}

function todayLusaka(): Date {
  // We work in calendar days in Africa/Lusaka. For cron purposes
  // we use the UTC date but shift by 2h to align with Lusaka midnight.
  const now = new Date();
  return new Date(now.getTime() + 2 * 60 * 60 * 1000);
}

/** Build the body for a delay-apology cadence step. */
function buildApologyBody(order: PreOrder): string {
  return (
    `Hi ${order.customer_name.split(' ')[0]}! Quick update on pre-order ${order.tracking_code ?? ''}.\n\n` +
    `The boots were expected by ${order.expected_delivery_date} but there's been a small delay. ` +
    `We're chasing the supplier and will text you the moment they land.\n\n` +
    `Thanks for your patience.`
  );
}

export interface RunPreOrderUpdatesResult {
  ok: boolean;
  scanned: number;
  queued: number;
  details: Array<{ pre_order_id: string; cadence_key: string; template: string }>;
  message?: string;
}

export async function runPreOrderUpdatesCron(): Promise<RunPreOrderUpdatesResult> {
  let supabase: SupabaseClient;
  try {
    supabase = await createServiceRoleClient();
  } catch (e) {
    return {
      ok: false,
      scanned: 0,
      queued: 0,
      details: [],
      message: e instanceof Error ? e.message : 'Failed to create client',
    };
  }
  return runPreOrderUpdatesWithClient(supabase);
}

export async function runPreOrderUpdatesWithClient(
  supabase: SupabaseClient
): Promise<RunPreOrderUpdatesResult> {
  // Pull every active pre-order with a paid deposit
  const { data: orders, error } = await supabase
    .from('pre_orders')
    .select('*')
    .eq('status', 'deposit_paid');
  if (error) {
    return { ok: false, scanned: 0, queued: 0, details: [], message: error.message };
  }

  const today = todayLusaka();
  let queued = 0;
  const details: RunPreOrderUpdatesResult['details'] = [];

  for (const raw of (orders ?? []) as PreOrder[]) {
    if (!raw.deposit_paid_at) continue;
    const depositDate = new Date(raw.deposit_paid_at);
    const expectedDate = raw.expected_delivery_date
      ? new Date(raw.expected_delivery_date)
      : null;

    for (const step of CADENCE) {
      // Skip the apology step if there's no expected_delivery_date
      if (step.relative === 'expected' && !expectedDate) continue;

      const reference =
        step.relative === 'deposit' ? depositDate : expectedDate!;
      const elapsed = daysBetween(reference, today);

      if (elapsed < step.day) continue;

      // Idempotency: don't queue the same cadence_key twice.
      // We check pre_order_events for any event with this key
      // in the data column.
      const { data: existing } = await supabase
        .from('pre_order_events')
        .select('id')
        .eq('pre_order_id', raw.id)
        .eq('event_type', 'message_queued')
        .contains('event_data', { cadence_key: step.cadence_key })
        .maybeSingle();
      if (existing) continue;

      // Build the body
      const body =
        step.template === 'custom' && step.cadence_key === 'past_3d_apology'
          ? buildApologyBody(raw)
          : renderMessage(step.template, raw);

      const { error: insertError } = await supabase
        .from('pre_order_events')
        .insert([{
          pre_order_id: raw.id,
          event_type: 'message_queued',
          event_data: {
            cadence_key: step.cadence_key,
            template: step.template,
            body_preview: body.slice(0, 240),
            body_full: body,
            customer_whatsapp: raw.customer_whatsapp,
            days_elapsed: elapsed,
          },
        }]);

      if (!insertError) {
        queued += 1;
        details.push({
          pre_order_id: raw.id,
          cadence_key: step.cadence_key,
          template: step.template,
        });
      }
    }
  }

  return { ok: true, scanned: (orders ?? []).length, queued, details };
}

/**
 * Fetch the latest queued (not yet sent) message for each
 * pre-order. Used by the /pre-orders list page to show a
 * banner like "5 messages to send today".
 */
export async function listQueuedMessages(): Promise<{
  data?: Array<{
    pre_order_id: string;
    cadence_key: string;
    template: string;
    body: string;
    customer_whatsapp: string;
    queued_at: string;
  }>;
  error?: string;
}> {
  const auth = await requireAuth();
  if ('error' in auth) return { error: auth.error };
  return listQueuedMessagesWithClient(auth.supabase);
}

export async function listQueuedMessagesWithClient(
  supabase: SupabaseClient
): Promise<{
  data?: Array<{
    pre_order_id: string;
    cadence_key: string;
    template: string;
    body: string;
    customer_whatsapp: string;
    queued_at: string;
  }>;
  error?: string;
}> {
  // Find all `message_queued` events that don't have a
  // matching `message_sent` event for the same cadence_key
  // on the same pre-order.
  const { data: queued, error } = await supabase
    .from('pre_order_events')
    .select('*')
    .eq('event_type', 'message_queued')
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) return { error: error.message };

  const rows = (queued ?? []) as Array<{
    pre_order_id: string;
    event_data: { cadence_key: string; template: string; body_full?: string; body_preview?: string; customer_whatsapp?: string };
    created_at: string;
  }>;

  // Filter to ones not yet sent: look for a `message_sent`
  // event for the same pre_order + cadence_key.
  const preOrderIds = Array.from(new Set(rows.map((r) => r.pre_order_id)));
  if (preOrderIds.length === 0) return { data: [] };

  const { data: sent } = await supabase
    .from('pre_order_events')
    .select('pre_order_id, event_data')
    .eq('event_type', 'message_sent')
    .in('pre_order_id', preOrderIds);

  const sentKeys = new Set(
    ((sent ?? []) as Array<{ pre_order_id: string; event_data: { cadence_key?: string } }>).map(
      (s) => `${s.pre_order_id}::${s.event_data?.cadence_key ?? ''}`
    )
  );

  const out: Array<{
    pre_order_id: string;
    cadence_key: string;
    template: string;
    body: string;
    customer_whatsapp: string;
    queued_at: string;
  }> = [];
  for (const r of rows) {
    const key = `${r.pre_order_id}::${r.event_data.cadence_key}`;
    if (sentKeys.has(key)) continue;
    // Dedup per pre-order: keep the latest queued for each key
    if (out.find((o) => o.pre_order_id === r.pre_order_id && o.cadence_key === r.event_data.cadence_key)) {
      continue;
    }
    out.push({
      pre_order_id: r.pre_order_id,
      cadence_key: r.event_data.cadence_key,
      template: r.event_data.template,
      body: r.event_data.body_full ?? r.event_data.body_preview ?? '',
      customer_whatsapp: r.event_data.customer_whatsapp ?? '',
      queued_at: r.created_at,
    });
  }
  return { data: out };
}

// Reference createServiceRoleClient so the import is consumed
// (the cron route uses runPreOrderUpdatesCron, which internally
// creates its own client).
void createServiceRoleClient;
