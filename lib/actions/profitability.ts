'use server';

/**
 * Phase 2: Profit & Margin Intelligence.
 *
 * Computes per-product profitability metrics using cost_price + selling_price
 * and historical sales data.
 *
 * Metrics returned:
 *   - gross_margin_pct     = (sell - cost) / sell * 100
 *   - margin_per_unit      = sell - cost
 *   - total_units_sold     = sum(quantity) over period
 *   - total_revenue        = units * sell
 *   - total_cogs           = units * cost
 *   - total_profit         = revenue - cogs
 *   - stock_value_at_cost  = stock_level * cost
 *   - potential_profit     = stock_level * (sell - cost)
 *
 * Pure helpers (MarginHealth type + classifyMargin) live in
 * ./profitability-utils so client components can import them without
 * triggering Next.js's "all server-action exports must be async" rule.
 */

import { requireAuth } from '@/lib/supabase-server';
import { getDateRangeFromPreset } from './accounting-utils';
import { classifyMargin } from './profitability-utils';
import type { DateRange, DateRangePreset } from './accounting-utils';
import type { MarginHealth } from './profitability-utils';
import type { Product } from '@/lib/supabase-types';

// Type re-exports only — sync helpers (classifyMargin) live in
// ./profitability-utils and must be imported directly from there.
export type { MarginHealth } from './profitability-utils';

export interface ProductProfitability {
  product_id: string;
  name: string;
  cost_price: number;
  selling_price: number;
  stock_level: number;
  image_url: string | null;
  units_sold: number;
  revenue: number;
  cogs: number;
  profit: number;
  gross_margin_pct: number;       // negative = selling below cost
  margin_per_unit: number;
  stock_value_at_cost: number;    // capital tied up in this SKU
  potential_profit: number;       // profit if all current stock sells at current price
  health: MarginHealth;
}

export interface ProfitabilitySummary {
  products: ProductProfitability[];
  /** Sum of profit per sold unit across all products in the period. */
  total_profit: number;
  /** Sum of revenue in the period. */
  total_revenue: number;
  /** Sum of COGS in the period. */
  total_cogs: number;
  /** Weighted-average gross margin (by revenue). */
  blended_margin_pct: number;
  /** Count of products by health bucket. */
  health_counts: Record<MarginHealth, number>;
  /** Capital currently tied up in inventory (cost basis). */
  inventory_capital: number;
  /** Profit you would make if you sold all current stock at today's prices. */
  potential_profit: number;
  /** Period the metrics were computed for. */
  range: DateRange;
}

export async function getProductProfitability(
  preset: DateRangePreset = 'month'
): Promise<{ data?: ProfitabilitySummary; error?: string }> {
  const auth = await requireAuth();
  if ('error' in auth) return { error: auth.error };
  const supabase = auth.supabase;
  const range = getDateRangeFromPreset(preset);

  // 1) Fetch all products
  const { data: products, error: prodError } = await supabase
    .from('products')
    .select('id, name, cost_price, selling_price, stock_level, image_url, deleted_at')
    .is('deleted_at', null);
  if (prodError) return { error: prodError.message };
  const productList = (products || []) as unknown as Product[];

  // 2) Fetch sales in the period with product info for revenue/cogs aggregation
  const { data: sales, error: salesError } = await supabase
    .from('sales')
    .select('product_id, total_amount, quantity, created_at')
    .gte('created_at', `${range.from}T00:00:00`)
    .lte('created_at', `${range.to}T23:59:59`);
  if (salesError) return { error: salesError.message };

  // Aggregate units + revenue per product. The `quantity` column on `sales`
  // was added by add_sales_quantity.sql; pre-migration rows default to 1, so
  // this remains backward-compatible if a row somehow lacks it.
  const aggByProduct = new Map<string, { units: number; revenue: number }>();
  for (const sale of (sales || []) as Array<{ product_id: string; total_amount: number; quantity?: number }>) {
    const qty = Number(sale.quantity) || 1;
    const cur = aggByProduct.get(sale.product_id) || { units: 0, revenue: 0 };
    cur.units += qty;
    cur.revenue += Number(sale.total_amount) || 0;
    aggByProduct.set(sale.product_id, cur);
  }

  // 3) Build per-product rows
  let totalRevenue = 0;
  let totalCogs = 0;
  let totalProfit = 0;
  let inventoryCapital = 0;
  let potentialProfit = 0;
  const healthCounts: Record<MarginHealth, number> = {
    green: 0, yellow: 0, red: 0, gray: 0,
  };

  const rows: ProductProfitability[] = productList.map((p) => {
    const sell = Number(p.selling_price) || 0;
    const cost = Number(p.cost_price) || 0;
    const agg = aggByProduct.get(p.id) || { units: 0, revenue: 0 };

    // For revenue we use the recorded sale total (which may be > sell*units if
    // multi-quantity sales record combined). For COGS we use cost * units since
    // we cannot perfectly reconstruct quantity from sales alone.
    const units = agg.units;
    const revenue = agg.revenue;
    const cogs = cost * units;
    const profit = revenue - cogs;
    const marginPerUnit = sell - cost;
    const grossMarginPct = sell > 0 ? ((sell - cost) / sell) * 100 : 0;

    const stockValueAtCost = cost * (p.stock_level || 0);
    const potentialProfitForStock = marginPerUnit * (p.stock_level || 0);

    totalRevenue += revenue;
    totalCogs += cogs;
    totalProfit += profit;
    inventoryCapital += stockValueAtCost;
    potentialProfit += potentialProfitForStock;

    const health = classifyMargin(grossMarginPct);
    healthCounts[health] += 1;

    return {
      product_id: p.id,
      name: p.name,
      cost_price: cost,
      selling_price: sell,
      stock_level: p.stock_level || 0,
      image_url: p.image_url || null,
      units_sold: units,
      revenue,
      cogs,
      profit,
      gross_margin_pct: grossMarginPct,
      margin_per_unit: marginPerUnit,
      stock_value_at_cost: stockValueAtCost,
      potential_profit: potentialProfitForStock,
      health,
    };
  });

  // Default sort: highest profit first
  rows.sort((a, b) => b.profit - a.profit);

  const blendedMarginPct = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

  return {
    data: {
      products: rows,
      total_profit: totalProfit,
      total_revenue: totalRevenue,
      total_cogs: totalCogs,
      blended_margin_pct: blendedMarginPct,
      health_counts: healthCounts,
      inventory_capital: inventoryCapital,
      potential_profit: potentialProfit,
      range,
    },
  };
}

/**
 * Top products by profit (replaces the count-based "top sellers" view).
 */
export async function getTopProductsByProfit(
  preset: DateRangePreset = 'month',
  limit = 5
): Promise<{
  data?: Array<{ id: string; name: string; profit: number; revenue: number; units: number; gross_margin_pct: number }>;
  error?: string;
}> {
  const result = await getProductProfitability(preset);
  if (result.error || !result.data) {
    return { data: [], error: result.error };
  }
  return {
    data: result.data.products
      .filter((p) => p.units_sold > 0)
      .sort((a, b) => b.profit - a.profit)
      .slice(0, limit)
      .map((p) => ({
        id: p.product_id,
        name: p.name,
        profit: p.profit,
        revenue: p.revenue,
        units: p.units_sold,
        gross_margin_pct: p.gross_margin_pct,
      })),
  };
}