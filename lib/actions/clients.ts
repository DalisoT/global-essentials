'use server';

import { createServerSupabaseClient, requireAuth } from '@/lib/supabase-server';

interface PaymentEvent {
  id: string;
  type: 'sale' | 'payment';
  date: string;
  productName?: string;
  amount: number;
  isPaid?: boolean;
  dueDate?: string;
}

export interface ClientHistory {
  client: {
    id: string;
    full_name: string;
    phone_number: string;
    created_at: string;
  };
  sales: Array<{
    id: string;
    created_at: string;
    total_amount: number;
    payment_status: 'paid' | 'pending';
    payment_method: 'cash' | 'pay-slow';
    product: Array<{ name: string }>;
  }>;
  installments: Array<{
    id: string;
    amount_due: number;
    due_date: string;
    is_paid: boolean;
    paid_at: string | null;
    sale_id: string;
  }>;
  timeline: PaymentEvent[];
  totalDebt: number;
  totalPaid: number;
  onTimePayments: number;
  latePayments: number;
}

export async function getClientHistory(
  clientId: string
): Promise<{ data?: ClientHistory; error?: string }> {
  const auth = await requireAuth();
  if ('error' in auth) return { data: null, error: auth.error };
  const supabase = auth.supabase;

  // Get client
  const { data: client, error: clientError } = await supabase
    .from('clients')
    .select('id, full_name, phone_number, created_at')
    .eq('id', clientId)
    .single();

  if (clientError || !client) {
    return { error: 'Client not found' };
  }

  // Get sales
  const { data: sales } = await supabase
    .from('sales')
    .select('id, created_at, total_amount, payment_status, payment_method, product:products(name)')
    .eq('client_id', clientId)
    .eq('deleted_at', null)
    .order('created_at', { ascending: false });

  // Get installments for all sales
  const saleIds = (sales || []).map((s) => s.id);
  const { data: installments } = saleIds.length
    ? await supabase
        .from('installments')
        .select('id, amount_due, due_date, is_paid, paid_at, sale_id')
        .in('sale_id', saleIds)
        .order('due_date', { ascending: true })
    : { data: [] };

  // Build timeline
  const timeline: PaymentEvent[] = [];

  for (const sale of sales || []) {
    timeline.push({
      id: sale.id,
      type: 'sale',
      date: sale.created_at,
      productName: (sale.product as unknown as { name: string })?.name,
      amount: sale.total_amount,
      isPaid: sale.payment_status === 'paid',
    });
  }

  for (const inst of installments || []) {
    timeline.push({
      id: inst.id,
      type: 'payment',
      date: inst.is_paid ? (inst.paid_at || inst.due_date) : inst.due_date,
      amount: inst.amount_due,
      isPaid: inst.is_paid,
      dueDate: inst.due_date,
    });
  }

  // Sort timeline by date descending
  timeline.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Calculate stats
  const totalDebt = (installments || [])
    .filter((i) => !i.is_paid)
    .reduce((sum, i) => sum + i.amount_due, 0);

  const totalPaid = (installments || [])
    .filter((i) => i.is_paid)
    .reduce((sum, i) => sum + i.amount_due, 0);

  // Count on-time vs late payments
  let onTimePayments = 0;
  let latePayments = 0;
  for (const inst of installments || []) {
    if (inst.is_paid && inst.paid_at) {
      const paidDate = new Date(inst.paid_at);
      const dueDate = new Date(inst.due_date);
      if (paidDate <= dueDate) {
        onTimePayments++;
      } else {
        latePayments++;
      }
    }
  }

  return {
    data: {
      client,
      sales: sales || [],
      installments: installments || [],
      timeline,
      totalDebt,
      totalPaid,
      onTimePayments,
      latePayments,
    },
  };
}

export async function getClientsList() {
  const auth = await requireAuth();
  if ('error' in auth) return { data: null, error: auth.error };
  const supabase = auth.supabase;
  const { data, error } = await supabase
    .from('clients')
    .select('id, full_name, phone_number, created_at')
    .eq('deleted_at', null)
    .order('full_name', { ascending: true });

  return { data: data || [], error };
}