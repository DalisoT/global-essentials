import Link from 'next/link';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { requireAuth } from '@/lib/supabase-server';
import { ForecastListRow } from '@/components/inventory/ForecastListRow';

/**
 * Per-product demand forecast page (Phase 7 / 7.6).
 *
 * Server component. Lists every product with its current stock,
 * plus a "Forecast" button that lazily fetches the 30-day demand
 * forecast for that product. Each row's stock-vs-forecast ratio
 * is shown as a status badge (Stockout / Reorder / Healthy /
 * Overstocked).
 *
 * Why lazy (per-row button) instead of pre-computing:
 *   - The list can have hundreds of products. Pre-computing 30
 *     forecasts per request would be slow.
 *   - The forecast cache (1-day TTL) means the first click on a
 *     product is the only slow one.
 *   - The user usually only wants to inspect the top movers.
 */

export const dynamic = 'force-dynamic';

export default async function InventoryForecastPage() {
  const auth = await requireAuth();
  if ('error' in auth) {
    return (
      <div className="card-tactical p-6 text-center">
        <p className="text-tactical-red font-bold">Unauthorized</p>
      </div>
    );
  }
  const { supabase } = auth;

  const { data: products, error } = await supabase
    .from('products')
    .select('id, name, stock_level, cost_price, selling_price, deleted_at')
    .is('deleted_at', null)
    .order('name', { ascending: true })
    .limit(500);

  if (error) {
    return (
      <div className="card-tactical border-tactical-red/30 bg-tactical-red/10 p-4">
        <p className="text-sm text-tactical-red font-bold">Couldn&apos;t load products</p>
        <p className="text-xs text-white/60 mt-1">{error?.message ?? 'Unknown error'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Back link */}
      <Link
        href="/inventory"
        className="inline-flex items-center gap-1.5 text-xs text-white/50 hover:text-white transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to Inventory
      </Link>

      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-tactical-blue" />
          <h1 className="text-2xl font-black tracking-tighter">Demand Forecast</h1>
        </div>
        <p className="text-xs text-white/50 uppercase tracking-wider">
          30-day moving average · click each product to predict demand
        </p>
      </div>

      {/* Table */}
      <div className="card-tactical overflow-hidden p-0">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/10 bg-white/[0.03]">
              <th className="text-left text-[10px] font-black uppercase tracking-widest text-white/40 py-3 px-4">
                Product
              </th>
              <th className="text-right text-[10px] font-black uppercase tracking-widest text-white/40 py-3 px-4">
                Stock
              </th>
              <th className="text-right text-[10px] font-black uppercase tracking-widest text-white/40 py-3 px-4">
                30-day forecast
              </th>
              <th className="text-left text-[10px] font-black uppercase tracking-widest text-white/40 py-3 px-4">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {!products || products.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-center text-white/40 py-12 text-sm">
                  No products yet
                </td>
              </tr>
            ) : (
              (products as Array<{
                id: string;
                name: string;
                stock_level: number;
                cost_price: number | null;
                selling_price: number | null;
              }>).map((p) => (
                <ForecastListRow
                  key={p.id}
                  productId={p.id}
                  name={p.name}
                  currentStock={p.stock_level ?? 0}
                  costPrice={p.cost_price}
                  sellingPrice={p.selling_price}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="text-[10px] text-white/30 text-center">
        Forecasts are cached for 24 hours · refresh the page to clear
      </p>
    </div>
  );
}
