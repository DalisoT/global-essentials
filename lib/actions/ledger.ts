'use server';

import { createServerSupabaseClient, requireAuth } from '@/lib/supabase-server';
import { postInstallmentPaymentJournal } from '@/lib/actions/journals';

export async function getSalesHistory(
  search?: string,
  options?: { limit?: number; offset?: number }
) {
  const auth = await requireAuth();
  if ('error' in auth) return { data: null, error: auth.error, count: 0 };
  const supabase = auth.supabase;
  const limit = options?.limit ?? 50;
  const offset = options?.offset ?? 0;

  let query = supabase
    .from('sales')
    .select(
      `
      *,
      product:products(*),
      client:clients(*)
    `,
      { count: 'exact' }
    )
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (search) {
    query = query.or(`product.name.ilike.%${search}%,client.full_name.ilike.%${search}%`);
  }

  const { data, error, count } = await query;

  return { data: data || [], error, count };
}

export async function searchDebts(search?: string) {
  const auth = await requireAuth();
  if ('error' in auth) return { data: null, error: auth.error };
  const supabase = auth.supabase;
  let query = supabase
    .from('installments')
    .select(`
      *,
      sale:sales(
        *,
        product:products(*),
        client:clients(*)
      )
    `)
    .eq('is_paid', false)
    .order('due_date', { ascending: true });

  if (search) {
    const sanitized = search.replace(/[^a-zA-Z0-9_\-% ]/g, '').trim();
    if (sanitized) {
      query = query.or(
        `sale.client.full_name.ilike.%${sanitized}%` +
        `,sale.id.ilike.%${sanitized}%` +
        `,sale.product.name.ilike.%${sanitized}%`
      );
    }
  }

  const { data, error } = await query;

  return { data: data || [], error };
}

export async function getClientPaymentHistory(
  clientId: string
): Promise<{ data?: ClientPaymentHistory; error?: string }> {
  const auth = await requireAuth();
  if ('error' in auth) return { error: auth.error };
  const supabase = auth.supabase;

  // Get all sales for this client
  const { data: sales, error: salesError } = await supabase
    .from('sales')
    .select(`
      id, total_amount, payment_status, payment_method, created_at,
      product:products(name),
      installments(*)
    `)
    .eq('client_id', clientId)
    .order('created_at', { ascending: false });

  if (salesError) return { error: salesError.message };
  if (!sales) return { error: undefined };

  // Get client info
  const { data: client, error: clientError } = await supabase
    .from('clients')
    .select('id, full_name, phone_number')
    .eq('id', clientId)
    .single();

  if (clientError) return { error: clientError.message };

  const allInstallments = sales.flatMap((s) => s.installments || []);
  const totalPaid = allInstallments
    .filter((i) => i.is_paid)
    .reduce((sum, i) => sum + (i.amount_paid ?? i.amount_due), 0);
  const totalDue = allInstallments.reduce((sum, i) => sum + i.amount_due, 0);
  const totalOverdue = allInstallments
    .filter((i) => !i.is_paid && new Date(i.due_date) < new Date())
    .reduce((sum, i) => sum + i.amount_due, 0);

  return {
    data: {
      client,
      sales: sales.map((s) => ({
        ...s,
        product: s.product as unknown as { name: string },
      })),
      summary: {
        totalPaid,
        totalDue,
        totalOverdue,
        activeInstallments: allInstallments.filter((i) => !i.is_paid).length,
        paidInstallments: allInstallments.filter((i) => i.is_paid).length,
      },
    },
  };
}

interface ClientPaymentHistory {
  client: { id: string; full_name: string; phone_number: string };
  sales: Array<{
    id: string;
    total_amount: number;
    payment_status: string;
    payment_method: string;
    created_at: string;
    product: { name: string };
    installments: Array<{
      id: string;
      amount_due: number;
      amount_paid: number | null;
      due_date: string;
      is_paid: boolean;
      paid_at: string | null;
      note: string | null;
    }>;
  }>;
  summary: {
    totalPaid: number;
    totalDue: number;
    totalOverdue: number;
    activeInstallments: number;
    paidInstallments: number;
  };
}

export async function markInstallmentPaid(installmentId: string) {
  const auth = await requireAuth();
  if ('error' in auth) return { data: null, error: auth.error };
  const supabase = auth.supabase;

  // Fetch the installment to get its sale_id first
  const { data: installment, error: fetchError } = await supabase
    .from('installments')
    .select('id, sale_id')
    .eq('id', installmentId)
    .single();

  if (fetchError || !installment) return { error: fetchError?.message || 'Installment not found' };

  const { error } = await supabase
    .from('installments')
    .update({ is_paid: true, paid_at: new Date().toISOString() })
    .eq('id', installmentId);

  if (error) return { error: error.message };

  // Check if all installments for this sale are paid
  const { data: installments } = await supabase
    .from('installments')
    .select('sale_id, is_paid')
    .eq('sale_id', installment.sale_id);

  const allPaid = installments?.every((inst) => inst.is_paid);

  if (allPaid) {
    await supabase
      .from('sales')
      .update({ payment_status: 'paid' })
      .eq('id', installment.sale_id);
  }

  return { data: null, error: null };
}

interface RecordPaymentParams {
  installmentId: string;
  /** Amount paid — defaults to full amount_due (full payment). Use smaller value for partial. */
  amount?: number;
  /** Actual date payment was made — defaults to now. Supports backdating. */
  paidAt?: string;
  /** Optional note/memo */
  note?: string;
}

/**
 * Record a payment (full or partial) against a sale, automatically distributed
 * across the sale's unpaid installments in due-date order.
 *
 * Real-world clients don't pay in clean per-installment chunks. A K300 sale
 * with 2 installments of K150 might receive K50 + K100 + K100, where neither
 * individual payment matches an installment boundary. The old code rejected
 * the second K100 because the second installment was "expected" to be K150 —
 * the user had to split the payment manually across two installments, which
 * is fiddly on a phone in the field.
 *
 * This action treats the payment as a contribution to the sale's outstanding
 * balance and walks the installments in order, applying as much as fits each
 * one before moving on. Any amount above the clicked installment's remaining
 * cascades to the next unpaid installment. Any amount above the sale's total
 * remaining is clamped (you can't pay more than what's owed).
 *
 * The CHECK constraint (F8) `installments.amount_paid <= amount_due` is the
 * last line of defense; we Math.min against amount_due at every step so it
 * can never be violated.
 */
export async function recordInstallmentPayment({
  installmentId,
  amount,
  paidAt,
  note,
}: RecordPaymentParams): Promise<{ data?: null; error?: string | null; appliedAmount?: number }> {
  const auth = await requireAuth();
  if ('error' in auth) return { error: auth.error };
  const supabase = auth.supabase;

  // 1) Fetch the clicked installment to get sale_id.
  const { data: installment, error: fetchError } = await supabase
    .from('installments')
    .select('id, sale_id, amount_due, amount_paid')
    .eq('id', installmentId)
    .single();

  if (fetchError || !installment) {
    return { error: fetchError?.message || 'Installment not found' };
  }

  const resolvedPaidAt = paidAt ? new Date(paidAt).toISOString() : new Date().toISOString();

  // 2) Fetch ALL installments for this sale (ordered by due_date so payments
  //    cascade to the earliest-due unpaid installment first).
  const { data: allInstallments, error: allError } = await supabase
    .from('installments')
    .select('id, amount_due, amount_paid, due_date')
    .eq('sale_id', installment.sale_id)
    .order('due_date', { ascending: true });

  if (allError) return { error: allError.message };
  if (!allInstallments || allInstallments.length === 0) {
    return { error: 'No installments found for this sale' };
  }

  // 3) Compute total remaining for the sale.
  const totalRemaining = allInstallments.reduce((sum, i) => {
    return sum + Math.max(0, i.amount_due - (i.amount_paid ?? 0));
  }, 0);

  if (totalRemaining <= 0) {
    return { error: 'Sale is already fully paid' };
  }

  // 4) Clamp requested amount to total remaining. If no amount given, treat as
  //    "pay off the whole sale" (use totalRemaining as the cap).
  const requestedAmount = amount ?? totalRemaining;
  const paymentAmount = Math.min(Math.max(0, requestedAmount), totalRemaining);

  if (paymentAmount <= 0) {
    return { error: 'Enter a valid amount' };
  }

  // 5) Distribute the payment across installments in due-date order.
  let remaining = paymentAmount;
  const updates: Array<{ id: string; amount_paid: number; is_paid: boolean }> = [];

  for (const inst of allInstallments) {
    if (remaining <= 0) break;
    const instRemaining = Math.max(0, inst.amount_due - (inst.amount_paid ?? 0));
    if (instRemaining <= 0) continue;
    const toApply = Math.min(remaining, instRemaining);
    const newAmountPaid = Math.min(inst.amount_due, (inst.amount_paid ?? 0) + toApply);
    const isPaid = newAmountPaid >= inst.amount_due;
    updates.push({ id: inst.id, amount_paid: newAmountPaid, is_paid: isPaid });
    remaining -= toApply;
  }

  // 6) Apply updates. Stamp paid_at + note on every touched installment so the
  //    audit trail shows this payment hit them all.
  for (const update of updates) {
    const { error: updateError } = await supabase
      .from('installments')
      .update({
        is_paid: update.is_paid,
        paid_at: resolvedPaidAt,
        amount_paid: update.amount_paid,
        ...(note ? { note } : {}),
      })
      .eq('id', update.id);

    if (updateError) return { error: updateError.message };
  }

  // 7) If every installment is now paid, flip the sale to 'paid' in one shot.
  const { data: stillUnpaid } = await supabase
    .from('installments')
    .select('id')
    .eq('sale_id', installment.sale_id)
    .eq('is_paid', false)
    .limit(1);

  if (!stillUnpaid || stillUnpaid.length === 0) {
    await supabase
      .from('sales')
      .update({ payment_status: 'paid' })
      .eq('id', installment.sale_id);
  }

  // 8) Post journal entry for the actual amount applied (best-effort).
  const { data: saleWithClient } = await supabase
    .from('sales')
    .select('client:clients(full_name)')
    .eq('id', installment.sale_id)
    .single();
  const clientName =
    (saleWithClient as unknown as { client?: { full_name?: string } })?.client?.full_name
    || 'Unknown client';

  postInstallmentPaymentJournal({
    installmentId,
    amount: paymentAmount,
    clientName,
    paymentMethod: 'cash',
  }).catch(err => console.error('Failed to post installment journal:', err));

  return { data: null, error: null, appliedAmount: paymentAmount };
}