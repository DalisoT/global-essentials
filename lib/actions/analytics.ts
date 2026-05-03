'use server';

import { supabase } from '@/lib/supabase';

export async function getAnalyticsData() {
  // Get all paid sales
  const { data: paidSales } = await supabase
    .from('sales')
    .select('*, product:products(*)')
    .eq('payment_status', 'paid');

  // Get all expenses
  const { data: expenses } = await supabase.from('expenses').select('*');

  // Get all products
  const { data: products } = await supabase.from('products').select('*');

  // Calculate total revenue
  const totalRevenue = paidSales?.reduce((sum: number, s: any) => sum + s.total_amount, 0) || 0;
  const totalExpenses = expenses?.reduce((sum: number, e: any) => sum + e.amount, 0) || 0;
  const netProfit = totalRevenue - totalExpenses;

  // Revenue by day (last 7 days)
  const last7Days: Record<string, number> = {};
  const today = new Date();
  for (let i = 6; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const key = date.toISOString().split('T')[0];
    last7Days[key] = 0;
  }

  paidSales?.forEach((sale: any) => {
    const date = sale.created_at.split('T')[0];
    if (last7Days[date] !== undefined) {
      last7Days[date] += sale.total_amount;
    }
  });

  // Expenses by category
  const expensesByCategory: Record<string, number> = {};
  expenses?.forEach((e: any) => {
    expensesByCategory[e.category] = (expensesByCategory[e.category] || 0) + e.amount;
  });

  // Top selling products (by number of sales)
  const salesByProduct: Record<string, number> = {};
  paidSales?.forEach((sale: any) => {
    salesByProduct[sale.product_id] = (salesByProduct[sale.product_id] || 0) + 1;
  });

  const topProducts = Object.entries(salesByProduct)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([productId, count]) => {
      const product = products?.find((p: any) => p.id === productId);
      return {
        id: productId,
        name: product?.name || 'Unknown',
        count,
        revenue: count * (product?.selling_price || 0),
      };
    });

  // Monthly comparison (last 6 months)
  const monthlyData: Record<string, { revenue: number; expenses: number }> = {};
  for (let i = 0; i < 6; i++) {
    const date = new Date();
    date.setMonth(date.getMonth() - i);
    const key = date.toISOString().substring(0, 7);
    monthlyData[key] = { revenue: 0, expenses: 0 };
  }

  paidSales?.forEach((sale: any) => {
    const month = sale.created_at.substring(0, 7);
    if (monthlyData[month]) {
      monthlyData[month].revenue += sale.total_amount;
    }
  });

  expenses?.forEach((e: any) => {
    const month = e.created_at.substring(0, 7);
    if (monthlyData[month]) {
      monthlyData[month].expenses += e.amount;
    }
  });

  return {
    totalRevenue,
    totalExpenses,
    netProfit,
    revenueByDay: Object.entries(last7Days).map(([date, amount]) => ({ date, amount })),
    expensesByCategory: Object.entries(expensesByCategory).map(([category, amount]) => ({
      category,
      amount,
    })),
    topProducts,
    monthlyData: Object.entries(monthlyData)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({ month, ...data })),
  };
}