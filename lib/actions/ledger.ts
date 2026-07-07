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
    // Only include amount_paid if the column exists (migration may not have run)
    if (installment.amount_paid !== undefined) {
      updatePayload.amount_paid = installment.amount_due;
    }
  } else {
    // Partial payment — track what was paid, keep as unpaid
    updatePayload.is_paid = false;
    if (installment.amount_paid !== undefined) {
      updatePayload.amount_paid = (installment.amount_paid || 0) + amountPaid;
    }
  }

  const { error: updateError } = await supabase
    .from('installments')
    .update({
      is_paid: isFullPayment,
      paid_at: paidAt ? new Date(paidAt).toISOString() : new Date().toISOString(),
    })
    .eq('id', installmentId);

  if (updateError) return { error: updateError.message };

  // Try to update amount_paid if column exists (migration may not have run)
  if (installment.amount_paid !== undefined && !isFullPayment) {
    await supabase
      .from('installments')
      .update({ amount_paid: (installment.amount_paid || 0) + amountPaid })
      .eq('id', installmentId)
      .then(({ error }) => {
        if (error) console.warn('amount_paid column not available:', error.message);
      });
  } else if (installment.amount_paid !== undefined && isFullPayment) {
    await supabase
      .from('installments')
      .update({ amount_paid: installment.amount_due })
      .eq('id', installmentId)
      .then(({ error }) => {
        if (error) console.warn('amount_paid column not available:', error.message);
      });
  }

  // Try to update note if provided
  if (note) {
    await supabase
      .from('installments')
      .update({ note })
      .eq('id', installmentId)
      .then(({ error }) => {
        if (error) console.warn('note column not available:', error.message);
      });
  }

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

  // Phase 1: post journal entry (best-effort)
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
    amount: amountPaid,
    clientName,
    paymentMethod: 'cash',
  }).catch(err => console.error('Failed to post installment journal:', err));

  return { data: null, error: null };
}