import { AlertTriangle, Package, Sparkles } from 'lucide-react';
import { getReorderAlerts } from '@/lib/actions/forecast';

/**
 * ReorderAlertsPanel (Phase 7 / 7.7).
 *
 * Server component. Surfaces on the /inventory/forecast page as a
 * sticky panel at the top. Lists every product that will stock out
 * BEFORE the supplier can deliver (forecast demand > current stock
 * within lead_time + safety_buffer days).
 *
 * If there are no alerts, renders a "you're stocked" happy state.
 * If the call fails, renders a graceful error state — never throws.
 */

export async function ReorderAlertsPanel() {
  const res = await getReorderAlerts();

  if (res.error) {
    return (
      <div className="card-tactical border-tactical-red/30 bg-tactical-red/10 p-4">
        <p className="text-sm text-tactical-red font-bold">Couldn&apos;t load reorder alerts</p>
        <p className="text-xs text-white/60 mt-1">{res.error}</p>
      </div>
    );
  }

  const alerts = res.data ?? [];

  if (alerts.length === 0) {
    return (
      <div className="card-tactical border-tactical-neon/30 bg-tactical-neon/5 p-4 flex items-center gap-3">
        <Sparkles className="w-5 h-5 text-tactical-neon" />
        <div>
          <p className="text-sm font-black text-tactical-neon">All stocked</p>
          <p className="text-xs text-white/60">
            No products are forecast to stock out before their supplier lead time.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="card-tactical border-tactical-orange/30 p-4">
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle className="w-4 h-4 text-tactical-orange" />
        <h2 className="text-sm font-black uppercase tracking-widest text-tactical-orange">
          Reorder alerts
        </h2>
        <span className="text-[10px] text-white/40 font-bold">
          ({alerts.length} product{alerts.length === 1 ? '' : 's'})
        </span>
      </div>
      <div className="space-y-2">
        {alerts.map((a) => {
          const urgent = a.daysUntilStockout < a.leadTimeDays;
          return (
            <div
              key={a.productId}
              className={`flex items-center gap-3 px-3 py-2 rounded-xl border ${
                urgent
                  ? 'bg-tactical-red/10 border-tactical-red/30'
                  : 'bg-tactical-orange/10 border-tactical-orange/30'
              }`}
            >
              <Package
                className={`w-4 h-4 shrink-0 ${
                  urgent ? 'text-tactical-red' : 'text-tactical-orange'
                }`}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold truncate">{a.productName}</p>
                <p className="text-[10px] uppercase tracking-widest font-bold text-white/40">
                  Stock: {a.currentStock} · Lead time: {a.leadTimeDays}d · Demand:{' '}
                  {a.avgDailyDemand}/day
                </p>
              </div>
              <div className="text-right shrink-0">
                <p
                  className={`text-base font-black ${
                    urgent ? 'text-tactical-red' : 'text-tactical-orange'
                  }`}
                >
                  {a.daysUntilStockout.toFixed(0)}d
                </p>
                <p className="text-[10px] text-white/40">
                  Order {a.suggestedOrderQty}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
