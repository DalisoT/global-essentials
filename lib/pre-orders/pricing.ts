/**
 * Pre-orders pricing logic (Phase 11).
 *
 * Pure functions, no DB access. Imported by:
 *   - lib/actions/pre-orders.ts (server-side validation)
 *   - app/(pos)/pre-orders/new/PreOrderForm.tsx (client-side live preview)
 *
 * The deposit math:
 *
 *   unit_cost       = variant.cost_price ?? product.cost_price
 *   weight_kg       = variant.weight_kg   ?? product.weight_kg
 *   rate_per_kg     = product.shipping_per_kg ?? 80 (sea) or 300 (air)
 *   shipping_cost   = weight_kg * rate_per_kg
 *   unit_price      = product.selling_price
 *   deposit_floor   = (unit_cost + shipping_cost) * 1.10    // 10% buffer
 *   deposit_min     = unit_price * 0.5                       // 50% floor
 *   deposit_amount  = max(deposit_floor, deposit_min),       // rounded to 10s
 *                     minimum K10
 *   balance_due     = unit_price - deposit_amount
 *
 * Expected delivery:
 *   sea  → today + 50 days
 *   air  → today + 14 days
 */

import type {
  PreOrderShippingMode,
  Product,
  ProductVariant,
} from '@/lib/supabase-types';

export const SEA_CARGO_DAYS = 50;
export const AIR_CARGO_DAYS = 14;
export const DEFAULT_SEA_RATE_PER_KG = 80;
export const AIR_RATE_PER_KG = 300;
export const DEPOSIT_BUFFER = 0.10;
export const DEPOSIT_FLOOR_FRACTION = 0.5;

export interface PreOrderPricing {
  unit_cost: number;
  shipping_cost: number;
  unit_price: number;
  /** Recommended deposit (covers cost + shipping + 10%, floored at 50% of price). */
  deposit_amount: number;
  balance_due: number;
  /** YYYY-MM-DD. */
  expected_delivery_date: string;
  /** Days from today to expected delivery. */
  delivery_days: number;
}

/** Round to a clean K number (multiple of 10). Cleaner for receipts. */
export function roundToTens(n: number): number {
  return Math.max(10, Math.round(n / 10) * 10);
}

/** YYYY-MM-DD in Africa/Lusaka. */
export function localDateString(d: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Lusaka',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

export function addDays(base: string, days: number): string {
  const [y, m, d] = base.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

/**
 * Compute the deposit + balance for a given product / variant
 * pair under the chosen shipping mode.
 */
export function calculatePreOrderPricing(input: {
  product: Pick<Product, 'cost_price' | 'selling_price' | 'shipping_per_kg' | 'weight_kg'>;
  variant?: Pick<ProductVariant, 'cost_price' | 'weight_kg'> | null;
  shippingMode: PreOrderShippingMode;
}): PreOrderPricing {
  const unit_cost = input.variant?.cost_price ?? input.product.cost_price;
  const weight_kg = input.variant?.weight_kg ?? input.product.weight_kg ?? 1.0;
  const ratePerKg =
    input.shippingMode === 'air'
      ? AIR_RATE_PER_KG
      : input.product.shipping_per_kg ?? DEFAULT_SEA_RATE_PER_KG;
  const shipping_cost = Math.round(weight_kg * ratePerKg * 100) / 100;
  const unit_price = input.product.selling_price;

  const deposit_floor = (unit_cost + shipping_cost) * (1 + DEPOSIT_BUFFER);
  const deposit_min = unit_price * DEPOSIT_FLOOR_FRACTION;
  const depositRaw = Math.max(deposit_floor, deposit_min);
  const deposit_amount = roundToTens(depositRaw);
  const balance_due = Math.max(0, unit_price - deposit_amount);

  const delivery_days =
    input.shippingMode === 'air' ? AIR_CARGO_DAYS : SEA_CARGO_DAYS;
  const expected_delivery_date = addDays(localDateString(), delivery_days);

  return {
    unit_cost,
    shipping_cost,
    unit_price,
    deposit_amount,
    balance_due,
    expected_delivery_date,
    delivery_days,
  };
}

/** Format a money amount as "K1,234" — used in the pre-order UI. */
export function formatK(n: number): string {
  return `K${Math.round(n).toLocaleString('en-US')}`;
}
