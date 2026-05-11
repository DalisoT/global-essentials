'use server';

import { createServerSupabaseClient, requireAuth } from '@/lib/supabase-server';

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
    query = query.or(`sale.client.full_name.ilike.%${search}%`);
  }

  const { data, error } = await query;

  return { data: data || [], error };
}

export async function markInstallmentPaid(installmentId: string) {
  const auth = await requireAuth();
  if ('error' in auth) return { data: null, error: auth.error };
  const supabase = auth.supabase;
  const { error } = await supabase
    .from('installments')
    .update({ is_paid: true, paid_at: new Date().toISOString() })
    .eq('id', installmentId);

  if (error) return { error: error.message };

  // Check if all installments for this sale are paid
  const { data: installments } = await supabase
    .from('installments')
    .select('sale_id, is_paid')
    .eq('sale_id', (await supabase.from('installments').select('sale_id').eq('id', installmentId).single())?.data?.sale_id);

  const allPaid = installments?.every((inst) => inst.is_paid);

  if (allPaid) {
    await supabase
      .from('sales')
      .update({ payment_status: 'paid' })
      .eq('id', installments?.[0]?.sale_id);
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

export async function recordInstallmentPayment({
  installmentId,
  amount,
  paidAt,
  note,
}: RecordPaymentParams): Promise<{ data?: null; error?: string | null }> {
  const auth = await requireAuth();
  if ('error' in auth) return { error: auth.error };
  const supabase = auth.supabase;

  // Fetch the installment to get amount_due and sale_id
  const { data: installment, error: fetchError } = await supabase
    .from('installments')
    .select('id, sale_id, amount_due, amount_paid')
    .eq('id', installmentId)
    .single();

  if (fetchError || !installment) {
    return { error: fetchError?.message || 'Installment not found' };
  }

  const amountPaid = amount ?? installment.amount_due;
  const isFullPayment = amountPaid >= installment.amount_due;

  // Build the update payload
  const updatePayload: Record<string, unknown> = {
    paid_at: paidAt ? new Date(paidAt).toISOString() : new Date().toISOString(),
    ...(note ? { note } : {}),
  };

  if (isFullPayment) {
    // Full payment — mark as fully paid
    updatePayload.is_paid = true;
    updatePayload.amount_paid = installment.amount_due;
  } else {
    // Partial payment — track what was paid, keep as unpaid
    updatePayload.is_paid = false;
    updatePayload.amount_paid = (installment.amount_paid || 0) + amountPaid;
  }

  const { error: updateError } = await supabase
    .from('installments')
    .update(updatePayload)
    .eq('id', installmentId);

  if (updateError) return { error: updateError.message };

  // Check if all installments for this sale are now fully paid
  const { data: allInstallments } = await supabase
    .from('installments')
    .select('id, is_paid')
    .eq('sale_id', installment.sale_id);

  const allPaid = allInstallments?.every((inst) => inst.is_paid);

  if (allPaid) {
    await supabase
      .from('sales')
      .update({ payment_status: 'paid' })
      .eq('id', installment.sale_id);
  }

  return { data: null, error: null };
}