'use server';

import { createServerSupabaseClient, requireAuth } from '@/lib/supabase-server';
import type { Product, Sale, Client, Installment } from '@/lib/supabase-types';
import { LOW_STOCK_THRESHOLD } from '@/lib/config';

type SaleWithRelations = Sale & { product?: Product; client?: Client };
type InstallmentWithRelations = Installment & { sale?: Sale & { client?: Client } };

export async function getDashboardStats(): Promise<{
  data?: {
    groundTruth: number;
    inPipeline: number;
    lowStockProducts: Product[];
    recentSales: SaleWithRelations[];
    upcomingInstallments: InstallmentWithRelations[];
  };
  error?: string;
}> {
  try {
    const auth = await requireAuth();
    if ('error' in auth) return { data: undefined, error: auth.error };
    const supabase = auth.supabase;

    // Fetch paid sales total
    const { data: paidSales } = await supabase
      .from('sales')
      .select('total_amount')
      .eq('payment_status', 'paid');

    const paidSalesTotal = paidSales?.reduce((sum: number, s) => sum + s.total_amount, 0) || 0;

    // Fetch expenses total
    const { data: expenses } = await supabase.from('expenses').select('amount');
    const expensesTotal = expenses?.reduce((sum: number, e) => sum + e.amount, 0) || 0;

    // Ground Truth = Paid Sales - Expenses
    const groundTruth = paidSalesTotal - expensesTotal;

    // In Pipeline = Sum of unpaid installments
    const { data: unpaidInstallments } = await supabase
      .from('installments')
      .select('amount_due')
      .eq('is_paid', false);

    const inPipeline = unpaidInstallments?.reduce((sum: number, i) => sum + i.amount_due, 0) || 0;

    // Low Stock Products (threshold: configurable via LOW_STOCK_THRESHOLD)
    const { data: lowStockProducts } = await supabase
      .from('products')
      .select('*')
      .lte('stock_level', LOW_STOCK_THRESHOLD)
      .order('stock_level', { ascending: true });

    // Recent Sales (last 5) with relations
    const { data: recentSales } = await supabase
      .from('sales')
      .select(`
        *,
        product:products(*),
        client:clients(*)
      `)
      .order('created_at', { ascending: false })
      .limit(5);

    // Upcoming Installments (next 7 days, unpaid)
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);

    const { data: upcomingInstallments } = await supabase
      .from('installments')
      .select(`
        *,
        sale:sales(
          *,
          client:clients(*)
        )
      `)
      .eq('is_paid', false)
      .lte('due_date', nextWeek.toISOString().split('T')[0])
      .order('due_date', { ascending: true })
      .limit(5);

    return {
      data: {
        groundTruth,
        inPipeline,
        lowStockProducts: lowStockProducts || [],
        recentSales: (recentSales || []) as SaleWithRelations[],
        upcomingInstallments: (upcomingInstallments || []) as InstallmentWithRelations[],
      },
    };
  } catch (e: any) {
    return { error: e.message };
  }
}