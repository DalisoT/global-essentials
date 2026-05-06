'use client';

import { SHIPPING_TYPES, type ShippingTypeId } from '@/lib/import/shipping-types';
import { cn } from '@/lib/utils';

interface ShippingTypeSelectorProps {
  selected: ShippingTypeId;
  onChange: (type: ShippingTypeId) => void;
}

export function ShippingTypeSelector({ selected, onChange }: ShippingTypeSelectorProps) {
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
    </div>
  );
}