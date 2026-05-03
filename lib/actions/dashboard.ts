'use server';

import { createServerSupabaseClient } from '@/lib/supabase-server';

export async function getDashboardStats(): Promise<{
  data?: {
    groundTruth: number;
    inPipeline: number;
    lowStockProducts: any[];
    recentSales: any[];
    upcomingInstallments: any[];
  };
  error?: string;
}> {
  try {
    const supabase = await createServerSupabaseClient();

    // Fetch paid sales total
    const { data: paidSales } = await supabase
      .from('sales')
      .select('total_amount')
      .eq('payment_status', 'paid');

    const paidSalesTotal = paidSales?.reduce((sum: number, s: any) => sum + s.total_amount, 0) || 0;

    // Fetch expenses total
    const { data: expenses } = await supabase.from('expenses').select('amount');
    const expensesTotal = expenses?.reduce((sum: number, e: any) => sum + e.amount, 0) || 0;

    // Ground Truth = Paid Sales - Expenses
    const groundTruth = paidSalesTotal - expensesTotal;

    // In Pipeline = Sum of unpaid installments
    const { data: unpaidInstallments } = await supabase
      .from('installments')
      .select('amount_due')
      .eq('is_paid', false);

    const inPipeline = unpaidInstallments?.reduce((sum: number, i: any) => sum + i.amount_due, 0) || 0;

    // Low Stock Products (threshold: 5)
    const { data: lowStockProducts } = await supabase
      .from('products')
      .select('*')
      .lte('stock_level', 5)
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
        recentSales: recentSales || [],
        upcomingInstallments: upcomingInstallments || [],
      },
    };
  } catch (e: any) {
    return { error: e.message };
  }
}