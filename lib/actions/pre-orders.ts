'use server';

/**
 * Pre-orders (Phase 11 / 11.2 + 11.3).
 *
 * This module is the read/write surface for the `pre_orders`
 * table. It powers:
 *   - The POS "Take pre-order" flow (walk-in customers)
 *   - The catalog self-serve form (11.7)
 *   - The /pre-orders admin list (11.6)
 *
 * Architecture:
 *
 *   For each public operation, we expose TWO variants:
 *
 *     - `xxx(input)`             — the auth-required wrapper.
 *                                  Uses the user's own supabase
 *                                  client (RLS applies).
 *
 *     - `xxxWithClient(supabase, input)`
 *                                — the core implementation that
 *                                  takes a supabase client. Used
 *                                  by the catalog self-serve page,
 *                                  which calls it with the
 *                                  service-role client (the catalog
 *                                  is public, but we still need to
 *                                  write to pre_orders).
 *
 *   The internal variant is the source of truth — the public
 *   one just plugs in the auth client and delegates.
 *
 * The deposit math lives in `calculatePreOrderPricing` and is
 * pure (no DB). Easy to unit test.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { requireAuth, createServiceRoleClient } from '@/lib/supabase-server';
import {
  calculatePreOrderPricing,
  type PreOrderPricing,
} from '@/lib/pre-orders/pricing';
import type {
  PreOrder,
  PreOrderEvent,
  PreOrderEventType,
  PreOrderShippingMode,
  PreOrderSource,
  PreOrderStatus,
  Product,
  ProductVariant,
} from '@/lib/supabase-types';

// ─────────────────────────────────────────────────────────────────────
// Constants (the "shipping policy")
// ─────────────────────────────────────────────────────────────────────
// The pure pricing math lives in lib/pre-orders/pricing.ts so it
// can be reused by the client form for live preview.

// ─────────────────────────────────────────────────────────────────────
// Pure: pricing
// ─────────────────────────────────────────────────────────────────────

export type { PreOrderPricing } from '@/lib/pre-orders/pricing';

// ─────────────────────────────────────────────────────────────────────
// Pure: tracking code
// ─────────────────────────────────────────────────────────────────────

/**
 * Generate the next tracking code for the current year, in the
 * format `PR-YYYY-NNNN`. Counts existing rows for the year
 * (race-safe because the column is UNIQUE and we retry on
 * conflict in the caller).
 */
async function generateTrackingCode(
  supabase: SupabaseClient
): Promise<string> {
  const year = new Date().getFullYear();
  const startOfYear = `${year}-01-01T00:00:00`;
  const { count } = await supabase
    .from('pre_orders')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', startOfYear);
  const seq = (count ?? 0) + 1;
  return `PR-${year}-${String(seq).padStart(4, '0')}`;
}

// ─────────────────────────────────────────────────────────────────────
// Events helper
// ─────────────────────────────────────────────────────────────────────

async function writeEvent(
  supabase: SupabaseClient,
  preOrderId: string,
  eventType: PreOrderEventType,
  eventData: Record<string, unknown> = {}
): Promise<{ error?: string }> {
  const { error } = await supabase
    .from('pre_order_events')
    .insert([{
      pre_order_id: preOrderId,
      event_type: eventType,
      event_data: eventData,
    }]);
  return { error: error?.message };
}

// ─────────────────────────────────────────────────────────────────────
// Read
// ─────────────────────────────────────────────────────────────────────

export interface ListPreOrdersFilter {
  status?: PreOrderStatus | 'active' | 'all';
  source?: PreOrderSource;
  /** Match customer WhatsApp (catalog self-serve lookup). */
  whatsapp?: string;
  /** Match tracking code (catalog self-serve lookup). */
  trackingCode?: string;
  productId?: string;
  limit?: number;
}

export async function listPreOrders(
  filter: ListPreOrdersFilter = {}
): Promise<{ data?: PreOrder[]; error?: string }> {
  const auth = await requireAuth();
  if ('error' in auth) return { error: auth.error };
  return listPreOrdersWithClient(auth.supabase, filter);
}

export async function listPreOrdersWithClient(
  supabase: SupabaseClient,
  filter: ListPreOrdersFilter = {}
): Promise<{ data?: PreOrder[]; error?: string }> {
  const limit = Math.max(1, Math.min(500, filter.limit ?? 100));
  let q = supabase
    .from('pre_orders')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (filter.status && filter.status !== 'all') {
    if (filter.status === 'active') {
      q = q.in('status', ['pending', 'deposit_paid', 'arrived']);
    } else {
      q = q.eq('status', filter.status);
    }
  }
  if (filter.source) q = q.eq('source', filter.source);
  if (filter.whatsapp) q = q.eq('customer_whatsapp', filter.whatsapp);
  if (filter.trackingCode) q = q.eq('tracking_code', filter.trackingCode);
  if (filter.productId) q = q.eq('product_id', filter.productId);

  const { data, error } = await q;
  if (error) return { error: error.message };
  return { data: (data ?? []) as unknown as PreOrder[] };
}

export async function getPreOrder(
  id: string
): Promise<{ data?: (PreOrder & { events: PreOrderEvent[] }); error?: string }> {
  const auth = await requireAuth();
  if ('error' in auth) return { error: auth.error };
  return getPreOrderWithClient(auth.supabase, id);
}

export async function getPreOrderWithClient(
  supabase: SupabaseClient,
  id: string
): Promise<{ data?: (PreOrder & { events: PreOrderEvent[] }); error?: string }> {
  const { data, error } = await supabase
    .from('pre_orders')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) return { error: error.message };
  if (!data) return { error: 'Pre-order not found' };

  const { data: events } = await supabase
    .from('pre_order_events')
    .select('*')
    .eq('pre_order_id', id)
    .order('created_at', { ascending: true });

  return {
    data: {
      ...(data as unknown as PreOrder),
      events: (events ?? []) as unknown as PreOrderEvent[],
    },
  };
}

export async function getPreOrderByTrackingCode(
  code: string
): Promise<{ data?: (PreOrder & { events: PreOrderEvent[] }); error?: string }> {
  const auth = await requireAuth();
  if ('error' in auth) return { error: auth.error };
  return getPreOrderByTrackingCodeWithClient(auth.supabase, code);
}

/**
 * Public-safe variant — no auth check. Used by the catalog
 * self-serve tracking page (11.8). Rate-limit at the route
 * level (11.7 will add that).
 */
export async function getPreOrderByTrackingCodeWithClient(
  supabase: SupabaseClient,
  code: string
): Promise<{ data?: (PreOrder & { events: PreOrderEvent[] }); error?: string }> {
  const cleanCode = code.trim().toUpperCase();
  if (!/^PR-\d{4}-\d{4}$/.test(cleanCode)) {
    return { error: 'Invalid tracking code format' };
  }
  const { data, error } = await supabase
    .from('pre_orders')
    .select('*')
    .eq('tracking_code', cleanCode)
    .maybeSingle();
  if (error) return { error: error.message };
  if (!data) return { error: 'Pre-order not found' };

  // Only return the events that are customer-relevant. Don't leak
  // internal notes (status_changed with extra metadata).
  const { data: events } = await supabase
    .from('pre_order_events')
    .select('*')
    .eq('pre_order_id', (data as { id: string }).id)
    .in('event_type', [
      'created',
      'deposit_paid',
      'arrived',
      'completed',
      'cancelled',
      'refunded',
    ])
    .order('created_at', { ascending: true });

  return {
    data: {
      ...(data as unknown as PreOrder),
      events: (events ?? []) as unknown as PreOrderEvent[],
    },
  };
}

// ─────────────────────────────────────────────────────────────────────
// Write: create
// ─────────────────────────────────────────────────────────────────────

export interface CreatePreOrderInput {
  customer_name: string;
  customer_whatsapp: string;
  product_id: string;
  variant_id?: string | null;
  shipping_mode: PreOrderShippingMode;
  source: PreOrderSource;
  notes?: string;
  /** Optional explicit customer_id if the customer is in the books. */
  customer_id?: string | null;
}

export async function createPreOrder(
  input: CreatePreOrderInput
): Promise<{ data?: PreOrder; tracking_code?: string; pricing?: PreOrderPricing; error?: string }> {
  const auth = await requireAuth();
  if ('error' in auth) return { error: auth.error };
  return createPreOrderWithClient(auth.supabase, input);
}

export async function createPreOrderWithClient(
  supabase: SupabaseClient,
  input: CreatePreOrderInput
): Promise<{ data?: PreOrder; tracking_code?: string; pricing?: PreOrderPricing; error?: string }> {
  // Validate input
  if (!input.customer_name?.trim()) return { error: 'Customer name is required' };
  if (!input.customer_whatsapp?.trim()) return { error: 'Customer WhatsApp is required' };
  if (!input.product_id) return { error: 'Product is required' };

  // Load the product (and optional variant)
  const { data: product, error: pError } = await supabase
    .from('products')
    .select('*')
    .eq('id', input.product_id)
    .maybeSingle();
  if (pError) return { error: pError.message };
  if (!product) return { error: 'Product not found' };
  if ((product as unknown as Product).pre_order_enabled === false) {
    return { error: 'This product is not available for pre-order' };
  }

  let variant: ProductVariant | null = null;
  if (input.variant_id) {
    const { data: v, error: vError } = await supabase
      .from('product_variants')
      .select('*')
      .eq('id', input.variant_id)
      .maybeSingle();
    if (vError) return { error: vError.message };
    variant = v as unknown as ProductVariant | null;
  }

  // Compute pricing
  const pricing = calculatePreOrderPricing({
    product: product as unknown as Product,
    variant,
    shippingMode: input.shipping_mode,
  });

  // Insert with retry on tracking_code conflict (rare race)
  let tracking_code: string | null = null;
  let lastError: string | undefined;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    tracking_code = await generateTrackingCode(supabase);
    const { data, error } = await supabase
      .from('pre_orders')
      .insert([{
        tracking_code,
        customer_id: input.customer_id ?? null,
        customer_name: input.customer_name.trim().slice(0, 100),
        customer_whatsapp: input.customer_whatsapp.trim().slice(0, 30),
        product_id: input.product_id,
        variant_id: input.variant_id ?? null,
        unit_cost: pricing.unit_cost,
        shipping_cost: pricing.shipping_cost,
        unit_price: pricing.unit_price,
        deposit_amount: pricing.deposit_amount,
        balance_due: pricing.balance_due,
        shipping_mode: input.shipping_mode,
        source: input.source,
        status: 'pending' as const,
        expected_delivery_date: pricing.expected_delivery_date,
        notes: input.notes?.trim().slice(0, 500) ?? null,
      }])
      .select('*')
      .single();
    if (!error && data) {
      const created = data as unknown as PreOrder;
      // Write the 'created' event
      await writeEvent(supabase, created.id, 'created', {
        source: input.source,
        shipping_mode: input.shipping_mode,
        deposit_amount: pricing.deposit_amount,
        unit_price: pricing.unit_price,
      });
      return { data: created, tracking_code, pricing };
    }
    lastError = error?.message;
    if (!String(lastError ?? '').includes('pre_orders_tracking_code')) {
      return { error: lastError };
    }
    // Conflict on tracking code — retry with a fresh code.
  }
  return { error: lastError ?? 'Could not generate a unique tracking code' };
}

// ─────────────────────────────────────────────────────────────────────
// Write: record deposit payment
// ─────────────────────────────────────────────────────────────────────

export interface RecordDepositInput {
  pre_order_id: string;
  amount: number;
  /** 'cash' | 'mobile_money' | 'bank' | 'other' */
  method: 'cash' | 'mobile_money' | 'bank' | 'other';
  /** Optional free-form note (e.g. "Airtel money ref 12345"). */
  note?: string;
}

export async function recordDepositPayment(
  input: RecordDepositInput
): Promise<{ data?: PreOrder; error?: string }> {
  const auth = await requireAuth();
  if ('error' in auth) return { error: auth.error };
  return recordDepositPaymentWithClient(auth.supabase, input);
}

export async function recordDepositPaymentWithClient(
  supabase: SupabaseClient,
  input: RecordDepositInput
): Promise<{ data?: PreOrder; error?: string }> {
  if (input.amount <= 0) return { error: 'Amount must be > 0' };

  // Fetch the current row
  const { data: existing, error: fetchError } = await supabase
    .from('pre_orders')
    .select('*')
    .eq('id', input.pre_order_id)
    .maybeSingle();
  if (fetchError) return { error: fetchError.message };
  if (!existing) return { error: 'Pre-order not found' };

  const row = existing as unknown as PreOrder;
  if (row.status !== 'pending') {
    return { error: `Cannot record deposit for a pre-order in status '${row.status}'` };
  }
  if (input.amount < row.deposit_amount) {
    return {
      error: `Deposit of K${input.amount.toFixed(2)} is less than the required K${row.deposit_amount.toFixed(2)}`,
    };
  }

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('pre_orders')
    .update({
      status: 'deposit_paid',
      deposit_paid_at: now,
    })
    .eq('id', input.pre_order_id)
    .select('*')
    .single();
  if (error) return { error: error.message };

  const updated = data as unknown as PreOrder;
  await writeEvent(supabase, input.pre_order_id, 'deposit_paid', {
    amount: input.amount,
    method: input.method,
    note: input.note ?? null,
  });
  await writeEvent(supabase, input.pre_order_id, 'status_changed', {
    from: 'pending',
    to: 'deposit_paid',
  });

  return { data: updated };
}

// ─────────────────────────────────────────────────────────────────────
// Stats
// ─────────────────────────────────────────────────────────────────────

export async function getPreOrderStats(): Promise<{
  data?: {
    pending: number;
    deposit_paid: number;
    arrived: number;
    completed: number;
    cancelled: number;
    refunded: number;
    total_deposits_held: number;
    total_expected_revenue: number;
  };
  error?: string;
}> {
  const auth = await requireAuth();
  if ('error' in auth) return { error: auth.error };
  return getPreOrderStatsWithClient(auth.supabase);
}

export async function getPreOrderStatsWithClient(
  supabase: SupabaseClient
): Promise<{
  data?: {
    pending: number;
    deposit_paid: number;
    arrived: number;
    completed: number;
    cancelled: number;
    refunded: number;
    total_deposits_held: number;
    total_expected_revenue: number;
  };
  error?: string;
}> {
  const { data, error } = await supabase
    .from('pre_orders')
    .select('status, deposit_amount, balance_due');
  if (error) return { error: error.message };

  const rows = (data ?? []) as Array<{
    status: PreOrderStatus;
    deposit_amount: number;
    balance_due: number;
  }>;
  const stats = {
    pending: 0,
    deposit_paid: 0,
    arrived: 0,
    completed: 0,
    cancelled: 0,
    refunded: 0,
    total_deposits_held: 0,
    total_expected_revenue: 0,
  };
  for (const r of rows) {
    if (r.status === 'pending') stats.pending += 1;
    else if (r.status === 'deposit_paid') {
      stats.deposit_paid += 1;
      stats.total_deposits_held += r.deposit_amount ?? 0;
      stats.total_expected_revenue += r.balance_due ?? 0;
    } else if (r.status === 'arrived') {
      stats.arrived += 1;
      stats.total_deposits_held += r.deposit_amount ?? 0;
      stats.total_expected_revenue += r.balance_due ?? 0;
    } else if (r.status === 'completed') stats.completed += 1;
    else if (r.status === 'cancelled') stats.cancelled += 1;
    else if (r.status === 'refunded') stats.refunded += 1;
  }
  return { data: stats };
}

// Reference createServiceRoleClient so the import is consumed
// (catalog self-serve page will use it in 11.7).
void createServiceRoleClient;

// ─────────────────────────────────────────────────────────────────────
// POS helpers
// ─────────────────────────────────────────────────────────────────────

/** Fetch the list of products that are open for pre-ordering. */
export async function listPreOrderableProducts(): Promise<{
  data?: Product[];
  error?: string;
}> {
  const auth = await requireAuth();
  if ('error' in auth) return { error: auth.error };
  const { data, error } = await auth.supabase
    .from('products')
    .select('*')
    .eq('pre_order_enabled', true)
    .is('deleted_at', null)
    .order('name', { ascending: true });
  if (error) return { error: error.message };
  return { data: (data ?? []) as unknown as Product[] };
}

/** Fetch variants for one product. Used by the pre-order form. */
export async function listProductVariants(
  productId: string
): Promise<{ data?: ProductVariant[]; error?: string }> {
  const auth = await requireAuth();
  if ('error' in auth) return { error: auth.error };
  const { data, error } = await auth.supabase
    .from('product_variants')
    .select('*')
    .eq('product_id', productId)
    .order('size', { ascending: true });
  if (error) return { error: error.message };
  return { data: (data ?? []) as unknown as ProductVariant[] };
}
