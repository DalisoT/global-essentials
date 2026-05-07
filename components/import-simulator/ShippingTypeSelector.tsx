'use client';

import { SHIPPING_TYPES, type ShippingTypeId } from '@/lib/import/shipping-types';
import { cn } from '@/lib/utils';
import { AlertTriangle } from 'lucide-react';

interface ShippingTypeSelectorProps {
  selected: ShippingTypeId;
  onChange: (type: ShippingTypeId) => void;
  // Manual rate override
  manualRate: number | null;
  onManualRateChange: (rate: number | null) => void;
  // Whether database rates are available
  hasRates: boolean;
}

export function ShippingTypeSelector({ selected, onChange, manualRate, onManualRateChange, hasRates }: ShippingTypeSelectorProps) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-bold uppercase tracking-wider text-white/60">
        Shipping Method
      </label>
      <div className="grid grid-cols-2 gap-2">
        {SHIPPING_TYPES.map((type) => (
          <button
            key={type.id}
            onClick={() => onChange(type.id)}
            className={cn(
              'p-3 rounded-xl text-left transition-all',
              selected === type.id
                ? 'bg-tactical-blue text-white'
                : 'bg-white/5 text-white/60 hover:bg-white/10'
            )}
          >
            <div className="font-bold text-sm">{type.name}</div>
            <div className="text-xs opacity-70">{type.transitDays} days</div>
          </button>
        ))}
      </div>
      {selected && (
        <p className="text-xs text-white/40 mt-1">
          {SHIPPING_TYPES.find(t => t.id === selected)?.description}
        </p>
      )}

      {/* Manual rate override */}
      {!hasRates && (
        <div className="mt-3 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-xl space-y-2">
          <div className="flex items-center gap-2 text-yellow-500">
            <AlertTriangle className="w-4 h-4" />
            <span className="text-xs font-bold uppercase">No Database Rates — Enter Rate Manually</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-white/60 text-sm">Rate (USD/kg):</span>
            <input
              type="number"
              value={manualRate ?? ''}
              onChange={(e) => onManualRateChange(e.target.value ? parseFloat(e.target.value) : null)}
              placeholder="0.00"
              className="flex-1 h-10 px-3 bg-white/10 border border-white/20 rounded-lg text-white font-bold focus:outline-none focus:border-yellow-500"
              step="0.01"
            />
          </div>
          <p className="text-xs text-white/30">
            Based on TODAY CARGO: Air 7D $13.90 | Air 14D $15.90 | Sea Small $3.90 | Sea CBM $339/CBM | Sea Heavy $449/t
          </p>
        </div>
      )}
    </div>
  );
}