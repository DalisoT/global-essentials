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
