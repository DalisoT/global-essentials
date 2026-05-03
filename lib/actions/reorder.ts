'use server';

import { createServerSupabaseClient } from '@/lib/supabase-server';

interface SalesVelocity {
  product_id: string;
  product_name: string;
  current_stock: number;
  total_units_sold: number;
  days_analyzed: number;
  avg_daily_velocity: number;
  days_until_stockout: number;
  suggested_reorder_qty: number;
  urgency: 'low' | 'medium' | 'high';
}

const LEAD_TIME_DAYS = 14; // Default lead time for reorder
const SAFETY_STOCK = 5;

export async function getSalesVelocity(
  days: number = 90
): Promise<{ data?: SalesVelocity[]; error?: string }> {
  const supabase = await createServerSupabaseClient();

  // Get sales data for the period
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const { data: sales, error } = await supabase
    .from('sales')
    .select(
      `
      product_id,
      created_at,
      product:products(id, name, stock_level)
    `
    )
    .gte('created_at', startDate.toISOString());

  if (error) return { error: error.message };

  // Aggregate by product
  const productSales: Record<string, { name: string; stock_level: number; count: number }> = {};

  for (const sale of sales || []) {
    const productId = sale.product_id;
    const productName = (sale.product as unknown as { name: string })?.name || 'Unknown';
    const stockLevel = (sale.product as unknown as { stock_level: number })?.stock_level || 0;

    if (!productSales[productId]) {
      productSales[productId] = {
        name: productName,
        stock_level: stockLevel,
        count: 0,
      };
    }
    productSales[productId].count++;
  }

  // Calculate velocity for each product
  const velocities: SalesVelocity[] = Object.entries(productSales).map(
    ([productId, data]) => {
      const avgDailyVelocity = data.count / days;
      const daysUntilStockout =
        avgDailyVelocity > 0 ? Math.floor(data.stock_level / avgDailyVelocity) : 999;
      const reorderPoint = avgDailyVelocity * LEAD_TIME_DAYS + SAFETY_STOCK;
      const suggestedReorderQty = Math.max(0, Math.ceil(reorderPoint - data.stock_level));

      let urgency: 'low' | 'medium' | 'high';
      if (daysUntilStockout <= 7 || data.stock_level <= SAFETY_STOCK) {
        urgency = 'high';
      } else if (daysUntilStockout <= 14 || data.stock_level <= reorderPoint) {
        urgency = 'medium';
      } else {
        urgency = 'low';
      }

      return {
        product_id: productId,
        product_name: data.name,
        current_stock: data.stock_level,
        total_units_sold: data.count,
        days_analyzed: days,
        avg_daily_velocity: Math.round(avgDailyVelocity * 100) / 100,
        days_until_stockout: daysUntilStockout === 999 ? -1 : daysUntilStockout,
        suggested_reorder_qty: suggestedReorderQty,
        urgency,
      };
    }
  );

  // Sort by urgency (high first)
  velocities.sort((a, b) => {
    const urgencyOrder = { high: 0, medium: 1, low: 2 };
    return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
  });

  return { data: velocities };
}

export async function getReorderAlerts(): Promise<{
  data?: SalesVelocity[];
  error?: string;
}> {
  return getSalesVelocity(90);
}