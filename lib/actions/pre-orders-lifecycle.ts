'use server';

/**
 * Pre-orders lifecycle (Phase 11 / 11.3).
 *
 * The state machine lives in `STATUS_TRANSITIONS` below. Every
 * transition validates against the current status, writes the
 * appropriate `pre_order_events` rows, and updates the
 * denormalised status timestamps on the row.
 *
 *   pending  →  deposit_paid  (11.2 — recordDepositPayment)
 *   deposit_paid  →  arrived  (this file — markArrived)
 *   arrived  →  completed  (this file — convertToSale)
 *   pending  →  cancelled  (this file — cancelPreOrder)
 *   deposit_paid  →  cancelled  (this file — deposit forfeited per terms)
 *   deposit_paid  →  refunded  (this file — goodwill refund)
 *   arrived  →  cancelled  (this file — wrong size, etc)
 *
 * Bulk operations (mark all pre-orders for one shipment as
 * arrived) are an admin convenience: same logic, just iterating
 * over an array of IDs.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { requireAuth } from '@/lib/supabase-server';
import type { PreOrder, PreOrderStatus } from '@/lib/supabase-types';

// ─────────────────────────────────────────────────────────────────────
// State machine
// ─────────────────────────────────────────────────────────────────────

const STATUS_TRANSITIONS: Record<PreOrderStatus, PreOrderStatus[]> = {
  pending: ['deposit_paid', 'cancelled', 'refunded'],
  deposit_paid: ['arrived', 'cancelled', 'refunded'],
  arrived: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
  refunded: [],
};

function canTransition(from: PreOrderStatus, to: PreOrderStatus): boolean {
  return STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

// ─────────────────────────────────────────────────────────────────────
// Events helper (inlined to avoid cross-file imports — Next 14
// 'use server' files are strict about exports)
// ─────────────────────────────────────────────────────────────────────

async function writeEvent(
  supabase: SupabaseClient,
  preOrderId: string,
  eventType: string,
  eventData: Record<string, unknown> = {}
): Promise<{ error?: string }> {
  const { error } = await supabase
    .from('pre_order_events')
    .insert([{ pre_order_id: preOrderId, event_type: eventType, event_data: eventData }]);
  return { error: error?.message };
}

// ─────────────────────────────────────────────────────────────────────
// markArrived — stock landed at the shop, awaiting customer pickup
// ─────────────────────────────────────────────────────────────────────

export interface MarkArrivedInput {
  pre_order_id: string;
  /** Optional note (e.g. "Shipment landed 2026-09-15, 4 of 5 pairs in stock"). */
  note?: string;
}

export async function markArrived(
  input: MarkArrivedInput
): Promise<{ data?: PreOrder; error?: string }> {
  const auth = await requireAuth();
  if ('error' in auth) return { error: auth.error };
  return markArrivedWithClient(auth.supabase, input);
}

export async function markArrivedWithClient(
  supabase: SupabaseClient,
  input: MarkArrivedInput
): Promise<{ data?: PreOrder; error?: string }> {
  const { data: existing, error: fetchError } = await supabase
    .from('pre_orders')
    .select('*')
    .eq('id', input.pre_order_id)
    .maybeSingle();
  if (fetchError) return { error: fetchError.message };
  if (!existing) return { error: 'Pre-order not found' };

  const row = existing as unknown as PreOrder;
  if (!canTransition(row.status, 'arrived')) {
    return { error: `Cannot mark arrived from status '${row.status}'` };
  }

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('pre_orders')
    .update({ status: 'arrived', arrived_at: now })
    .eq('id', input.pre_order_id)
    .select('*')
    .single();
  if (error) return { error: error.message };

  const updated = data as unknown as PreOrder;
  await writeEvent(supabase, input.pre_order_id, 'arrived', {
    note: input.note ?? null,
  });
  await writeEvent(supabase, input.pre_order_id, 'status_changed', {
    from: row.status,
    to: 'arrived',
  });
  return { data: updated };
}

/**
 * Bulk mark-arrived. Used when a shipment lands and 10+ pairs
 * arrive at once. Same per-row logic, just iterating.
 */
export async function markArrivedBulk(
  preOrderIds: string[],
  note?: string
): Promise<{ data?: { updated: number; failed: Array<{ id: string; error: string }> }; error?: string }> {
  const auth = await requireAuth();
  if ('error' in auth) return { error: auth.error };

  const failed: Array<{ id: string; error: string }> = [];
  let updated = 0;
  for (const id of preOrderIds) {
    const r = await markArrivedWithClient(auth.supabase, { pre_order_id: id, note });
    if (r.error) failed.push({ id, error: r.error });
    else updated += 1;
  }
  return { data: { updated, failed } };
}

// ─────────────────────────────────────────────────────────────────────
// convertToSale — customer pays balance + collects the boots
// ─────────────────────────────────────────────────────────────────────

export interface ConvertToSaleInput {
  pre_order_id: string;
  /** Balance amount received from the customer. Must equal pre_order.balance_due. */
  balance_amount: number;
  /** 'cash' | 'mobile_money' | 'bank' | 'other'. */
  payment_method: 'cash' | 'mobile_money' | 'bank' | 'other';
  /** Optional note (e.g. "Customer paid extra K50 for a different size"). */
  note?: string;
}

export interface ConvertToSaleResult {
  data?: { pre_order: PreOrder; sale_id: string };
  error?: string;
}

export async function convertToSale(
  input: ConvertToSaleInput
): Promise<ConvertToSaleResult> {
  const auth = await requireAuth();
  if ('error' in auth) return { error: auth.error };
  return convertToSaleWithClient(auth.supabase, input);
}

export async function convertToSaleWithClient(
  supabase: SupabaseClient,
  input: ConvertToSaleInput
): Promise<ConvertToSaleResult> {
  if (input.balance_amount <= 0) return { error: 'Balance amount must be > 0' };

  // 1) Fetch the pre-order
  const { data: existing, error: fetchError } = await supabase
    .from('pre_orders')
    .select('*')
    .eq('id', input.pre_order_id)
    .maybeSingle();
  if (fetchError) return { error: fetchError.message };
  if (!existing) return { error: 'Pre-order not found' };

  const pre = existing as unknown as PreOrder;
  if (!canTransition(pre.status, 'completed')) {
    return { error: `Cannot convert from status '${pre.status}'. Must be 'arrived'.` };
  }
  // Allow a K1 tolerance for rounding.
  if (Math.abs(input.balance_amount - pre.balance_due) > 1) {
    return {
      error: `Balance payment of K${input.balance_amount.toFixed(2)} doesn't match K${pre.balance_due.toFixed(2)} owed.`,
    };
  }

  // 2) Resolve a client_id — auto-create if needed
  let clientId = pre.customer_id;
  if (!clientId) {
    const { data: existingClient } = await supabase
      .from('clients')
      .select('id')
      .eq('phone_number', pre.customer_whatsapp)
      .maybeSingle();
    if (existingClient) {
      clientId = (existingClient as { id: string }).id;
    } else {
      const { data: newClient, error: createError } = await supabase
        .from('clients')
        .insert([{
          full_name: pre.customer_name,
          phone_number: pre.customer_whatsapp,
        }])
        .select('id')
        .single();
      if (createError) return { error: `Failed to create client: ${createError.message}` };
      clientId = (newClient as { id: string }).id;
    }
  }

  // 3) Decrement stock with optimistic lock. Pre-orders are 1 unit each.
  const { data: product, error: productError } = await supabase
    .from('products')
    .select('id, name, stock_level, selling_price')
    .eq('id', pre.product_id)
    .single();
  if (productError) return { error: productError.message };
  const stockLevel = (product as { stock_level: number } | null)?.stock_level ?? 0;
  if (stockLevel < 1) {
    return { error: `Insufficient stock for ${(product as { name: string }).name}. Available: ${stockLevel}` };
  }
  const { error: stockError } = await supabase
    .from('products')
    .update({ stock_level: stockLevel - 1 })
    .eq('id', pre.product_id)
    .eq('stock_level', stockLevel);

  if (stockError) {
    return { error: 'Failed to reserve stock. Please try again.' };
  }

  // 4) Create the sale row. payment_status='paid' because the
  //    full unit_price is now received (deposit was earlier,
  //    balance is now).
  const { data: sale, error: saleError } = await supabase
    .from('sales')
    .insert([{
      product_id: pre.product_id,
      client_id: clientId,
      total_amount: pre.unit_price,
      quantity: 1,
      payment_status: 'paid',
      payment_method: input.payment_method,
      pre_order_id: pre.id,
    }])
    .select('id')
    .single();

  if (saleError || !sale) {
    // Roll back the stock decrement
    const { data: current } = await supabase
      .from('products')
      .select('stock_level')
      .eq('id', pre.product_id)
      .single();
    const restored = (current as { stock_level?: number } | null)?.stock_level ?? 0;
    await supabase
      .from('products')
      .update({ stock_level: restored + 1 })
      .eq('id', pre.product_id);
    return { error: saleError?.message ?? 'Failed to create sale row' };
  }

  // 5) Update the pre-order to 'completed' + link sale_id
  const now = new Date().toISOString();
  const { data: updated, error: updateError } = await supabase
    .from('pre_orders')
    .update({
      status: 'completed',
      completed_at: now,
      sale_id: (sale as { id: string }).id,
    })
    .eq('id', pre.id)
    .select('*')
    .single();
  if (updateError) {
    return { error: `Pre-order updated partially: ${updateError.message}` };
  }

  // 6) Write events
  await writeEvent(supabase, pre.id, 'balance_paid', {
    amount: input.balance_amount,
    method: input.payment_method,
    note: input.note ?? null,
  });
  await writeEvent(supabase, pre.id, 'completed', {
    sale_id: (sale as { id: string }).id,
  });
  await writeEvent(supabase, pre.id, 'status_changed', {
    from: 'arrived',
    to: 'completed',
  });

  return {
    data: { pre_order: updated as unknown as PreOrder, sale_id: (sale as { id: string }).id },
  };
}

// ─────────────────────────────────────────────────────────────────────
// cancelPreOrder — for any reason
// ─────────────────────────────────────────────────────────────────────

export interface CancelPreOrderInput {
  pre_order_id: string;
  reason: string;
  /** Whether the deposit should be refunded. If true, transitions to 'refunded' instead of 'cancelled'. */
  refund_deposit: boolean;
  /** Required when refund_deposit=true. */
  refund_amount?: number;
  /** How the refund was delivered. */
  refund_method?: 'cash' | 'mobile_money' | 'bank' | 'other';
}

export async function cancelPreOrder(
  input: CancelPreOrderInput
): Promise<{ data?: PreOrder; error?: string }> {
  const auth = await requireAuth();
  if ('error' in auth) return { error: auth.error };
  return cancelPreOrderWithClient(auth.supabase, input);
}

export async function cancelPreOrderWithClient(
  supabase: SupabaseClient,
  input: CancelPreOrderInput
): Promise<{ data?: PreOrder; error?: string }> {
  if (!input.reason?.trim()) return { error: 'A reason is required' };
  if (input.refund_deposit) {
    if (!input.refund_amount || input.refund_amount <= 0) {
      return { error: 'Refund amount is required when refund_deposit is true' };
    }
  }

  const { data: existing, error: fetchError } = await supabase
    .from('pre_orders')
    .select('*')
    .eq('id', input.pre_order_id)
    .maybeSingle();
  if (fetchError) return { error: fetchError.message };
  if (!existing) return { error: 'Pre-order not found' };

  const pre = existing as unknown as PreOrder;
  const newStatus: PreOrderStatus = input.refund_deposit ? 'refunded' : 'cancelled';

  if (!canTransition(pre.status, newStatus)) {
    return { error: `Cannot ${newStatus} from status '${pre.status}'` };
  }

  const now = new Date().toISOString();
  const updates: Record<string, unknown> = {
    status: newStatus,
    notes: input.reason.trim().slice(0, 500),
    cancelled_at: now,
  };
  if (input.refund_deposit) {
    updates.refunded_at = now;
  }

  const { data, error } = await supabase
    .from('pre_orders')
    .update(updates)
    .eq('id', input.pre_order_id)
    .select('*')
    .single();
  if (error) return { error: error.message };

  const updated = data as unknown as PreOrder;
  await writeEvent(supabase, pre.id, newStatus, {
    reason: input.reason,
    refund_amount: input.refund_amount ?? null,
    refund_method: input.refund_method ?? null,
  });
  await writeEvent(supabase, pre.id, 'status_changed', {
    from: pre.status,
    to: newStatus,
  });
  return { data: updated };
}

// ─────────────────────────────────────────────────────────────────────
// 11.9 — record a WhatsApp message as sent
// ─────────────────────────────────────────────────────────────────────

export interface RecordMessageSentInput {
  pre_order_id: string;
  template_id: string;
  message_body: string;
}

/**
 * Audit-log a WhatsApp message that the shop owner sent
 * manually. We don't auto-send in v1 (no WhatsApp Business
 * API integration), so the owner clicks "Send", types
 * the message in their own WhatsApp, then comes back to
 * confirm. This writes a `message_sent` event so the
 * timeline shows what was communicated.
 */
export async function recordMessageSent(
  input: RecordMessageSentInput
): Promise<{ error?: string }> {
  const auth = await requireAuth();
  if ('error' in auth) return { error: auth.error };
  return recordMessageSentWithClient(auth.supabase, input);
}

export async function recordMessageSentWithClient(
  supabase: SupabaseClient,
  input: RecordMessageSentInput
): Promise<{ error?: string }> {
  if (!input.message_body?.trim()) {
    return { error: 'Message body is empty' };
  }
  // Confirm the pre-order exists
  const { data: existing } = await supabase
    .from('pre_orders')
    .select('id')
    .eq('id', input.pre_order_id)
    .maybeSingle();
  if (!existing) return { error: 'Pre-order not found' };

  await writeEvent(supabase, input.pre_order_id, 'message_sent', {
    template_id: input.template_id,
    body_preview: input.message_body.slice(0, 240),
  });
  return {};
}
