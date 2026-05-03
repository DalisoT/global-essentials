'use client';

import { Package, TrendingUp, AlertTriangle, Clock } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface ReorderAlert {
  product_id: string;
  product_name: string;
  current_stock: number;
  avg_daily_velocity: number;
  days_until_stockout: number;
  suggested_reorder_qty: number;
  urgency: 'low' | 'medium' | 'high';
}

interface ReorderAlertCardProps {
  alert: ReorderAlert;
}

export function ReorderAlertCard({ alert }: ReorderAlertCardProps) {
  return (
    <div
      className={cn(
        'card-tactical transition-all',
        alert.urgency === 'high' && 'border-tactical-red bg-tactical-red/5',
        alert.urgency === 'medium' && 'border-tactical-orange bg-tactical-orange/5',
        alert.urgency === 'low' && 'border-white/10'
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'w-10 h-10 rounded-xl flex items-center justify-center',
            alert.urgency === 'high' && 'bg-tactical-red/20',
            alert.urgency === 'medium' && 'bg-tactical-orange/20',
            alert.urgency === 'low' && 'bg-white/10'
          )}
        >
          {alert.urgency === 'high' ? (
            <AlertTriangle className="w-5 h-5 text-tactical-red" />
          ) : alert.urgency === 'medium' ? (
            <Clock className="w-5 h-5 text-tactical-orange" />
          ) : (
            <Package className="w-5 h-5 text-white/40" />
          )}
        </div>

        <div className="flex-1">
          <div className="flex items-center justify-between">
            <p className="font-bold text-white">{alert.product_name}</p>
            <span
              className={cn(
                'text-[10px] font-bold uppercase px-2 py-0.5 rounded',
                alert.urgency === 'high' && 'bg-tactical-red/20 text-tactical-red',
                alert.urgency === 'medium' && 'bg-tactical-orange/20 text-tactical-orange',
                alert.urgency === 'low' && 'bg-white/10 text-white/40'
              )}
            >
              {alert.urgency}
            </span>
          </div>

          <p className="text-sm text-white/60 mt-1">
            Stock: <span className="font-semibold text-white">{alert.current_stock}</span>
            {alert.days_until_stockout > 0 && (
              <span className="text-white/40 ml-2">
                • ~{alert.days_until_stockout} days left
              </span>
            )}
          </p>

          <div className="flex items-center gap-4 mt-2">
            <div className="flex items-center gap-1 text-xs text-white/40">
              <TrendingUp className="w-3 h-3" />
              <span>{alert.avg_daily_velocity}/day</span>
            </div>
            {alert.suggested_reorder_qty > 0 && (
              <div className="flex items-center gap-1">
                <span className="text-xs text-white/40">Reorder:</span>
                <span className="text-sm font-bold text-tactical-blue">
                  {alert.suggested_reorder_qty} units
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

interface ReorderAlertsListProps {
  alerts: ReorderAlert[];
  isLoading?: boolean;
}

export function ReorderAlertsList({ alerts, isLoading }: ReorderAlertsListProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="card-tactical animate-pulse">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/10" />
              <div className="flex-1">
                <div className="h-4 bg-white/10 rounded w-1/3 mb-2" />
                <div className="h-3 bg-white/10 rounded w-1/2" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (alerts.length === 0) {
    return (
      <div className="card-tactical py-8 text-center">
        <Package className="w-8 h-8 text-white/20 mx-auto mb-2" />
        <p className="text-white/40 text-sm">No reorder alerts</p>
        <p className="text-white/20 text-xs mt-1">All products are well stocked</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {alerts.map((alert) => (
        <ReorderAlertCard key={alert.product_id} alert={alert} />
      ))}
    </div>
  );
}