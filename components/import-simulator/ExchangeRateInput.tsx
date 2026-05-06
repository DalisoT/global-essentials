'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { RefreshCw } from 'lucide-react';

interface ExchangeRateInputProps {
  rate: number;
  onRateChange: (rate: number) => void;
  onSaveDefault: () => void;
  onRefresh?: () => void;
  isSaving?: boolean;
  isRefreshing?: boolean;
  source?: 'api' | 'cache' | 'fallback' | 'manual';
}

export function ExchangeRateInput({
  rate,
  onRateChange,
  onSaveDefault,
  onRefresh,
  isSaving,
  isRefreshing,
  source = 'manual'
}: ExchangeRateInputProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [tempRate, setTempRate] = useState(rate.toString());

  const handleBlur = () => {
    const parsed = parseFloat(tempRate);
    if (!isNaN(parsed) && parsed > 0) {
      onRateChange(parsed);
    } else {
      setTempRate(rate.toString());
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleBlur();
    } else if (e.key === 'Escape') {
      setTempRate(rate.toString());
      setIsEditing(false);
    }
  };

  const sourceLabel = {
    api: 'Live',
    cache: 'Cached',
    fallback: 'Default',
    manual: 'Manual'
  };

  const sourceColor = {
    api: 'text-tactical-neon',
    cache: 'text-tactical-orange',
    fallback: 'text-tactical-red',
    manual: 'text-white/40'
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-bold uppercase tracking-wider text-white/60">
          Exchange Rate (USD → ZMW)
        </label>
        {source && (
          <span className={cn('text-xs font-medium', sourceColor[source])}>
            {sourceLabel[source]}
          </span>
        )}
      </div>
      <div className="flex gap-2">
        <div className="flex-1 relative">
          {isEditing ? (
            <input
              type="number"
              value={tempRate}
              onChange={(e) => setTempRate(e.target.value)}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              className="w-full h-14 px-4 bg-white/5 border border-tactical-blue rounded-xl text-white text-lg font-bold focus:outline-none"
              autoFocus
            />
          ) : (
            <button
              onClick={() => {
                setTempRate(rate.toString());
                setIsEditing(true);
              }}
              className="w-full h-14 px-4 bg-white/5 border border-white/10 rounded-xl text-white text-lg font-bold text-left hover:bg-white/10 transition-colors"
            >
              K{rate.toFixed(2)}
            </button>
          )}
        </div>
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className={cn(
              'h-14 px-3 rounded-xl font-bold text-sm transition-all',
              'bg-white/5 text-white/60 hover:bg-white/10',
              isRefreshing && 'opacity-50 cursor-not-allowed'
            )}
            title="Refresh from live API"
          >
            <RefreshCw className={cn('w-4 h-4', isRefreshing && 'animate-spin')} />
          </button>
        )}
        <button
          onClick={onSaveDefault}
          disabled={isSaving}
          className={cn(
            'h-14 px-4 rounded-xl font-bold text-sm transition-all',
            'bg-tactical-neon/20 text-tactical-neon hover:bg-tactical-neon/30',
            isSaving && 'opacity-50 cursor-not-allowed'
          )}
        >
          {isSaving ? 'Saving...' : 'Save Default'}
        </button>
      </div>
    </div>
  );
}