'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { cn, formatCurrency } from '@/lib/utils';
import { Settings, DollarSign, Package, Save, X, Plus } from 'lucide-react';
import { getShippingRates, updateShippingRate } from '@/lib/actions/import-simulator';
import { getCustomExchangeRate, saveCustomExchangeRate } from '@/lib/actions/import-simulator';
import { SHIPPING_TYPES, type ShippingTypeId } from '@/lib/import/shipping-types';
import type { ShippingRate } from '@/lib/supabase-types';
import { useImportSimulatorStore } from '@/stores/import-simulator-store';

type Tab = 'exchange' | 'shipping';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('exchange');
  const [exchangeRate, setExchangeRate] = useState(26);
  const [shippingRates, setShippingRates] = useState<ShippingRate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [editingRateId, setEditingRateId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const { setDefaultExchangeRate } = useImportSimulatorStore();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    const [ratesResult, exchangeResult] = await Promise.all([
      getShippingRates(),
      getCustomExchangeRate(),
    ]);

    if (ratesResult.data) {
      setShippingRates(ratesResult.data);
    }
    if (exchangeResult.rate) {
      setExchangeRate(exchangeResult.rate);
    }
    setIsLoading(false);
  };

  const handleSaveExchangeRate = async () => {
    if (exchangeRate <= 0) {
      toast.error('Exchange rate must be greater than 0');
      return;
    }
    setIsSaving(true);
    const { error } = await saveCustomExchangeRate(exchangeRate);
    setIsSaving(false);

    if (error) {
      toast.error('Failed to save exchange rate');
    } else {
      setDefaultExchangeRate(exchangeRate);
      toast.success('Exchange rate saved');
    }
  };

  const handleStartEdit = (rate: ShippingRate) => {
    setEditingRateId(rate.id);
    setEditValue(rate.rate.toString());
  };

  const handleSaveEdit = async (rate: ShippingRate) => {
    const newRate = parseFloat(editValue);
    if (isNaN(newRate) || newRate < 0) {
      toast.error('Invalid rate value');
      return;
    }

    setIsSaving(true);
    const { error } = await updateShippingRate(rate.id, newRate);
    setIsSaving(false);

    if (error) {
      toast.error('Failed to update rate');
    } else {
      setShippingRates(prev =>
        prev.map(r => r.id === rate.id ? { ...r, rate: newRate } : r)
      );
      toast.success('Rate updated');
    }
    setEditingRateId(null);
  };

  const handleCancelEdit = () => {
    setEditingRateId(null);
    setEditValue('');
  };

  // Group rates by shipping type
  const groupedRates = SHIPPING_TYPES.map(type => ({
    ...type,
    rates: shippingRates.filter(r => r.shipping_type === type.id),
  }));

  return (
    <div className="space-y-6 pb-24">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-tactical-slate flex items-center justify-center">
          <Settings className="w-5 h-5 text-white/60" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Settings</h1>
          <p className="text-xs text-white/60 uppercase tracking-wider">Import Simulator Configuration</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setActiveTab('exchange')}
          className={cn(
            'flex-1 py-3 rounded-xl font-bold text-sm uppercase tracking-wide transition-all',
            activeTab === 'exchange'
              ? 'bg-tactical-blue text-white'
              : 'bg-white/5 text-white/60 hover:bg-white/10'
          )}
        >
          <DollarSign className="w-4 h-4 inline mr-2" />
          Exchange Rate
        </button>
        <button
          onClick={() => setActiveTab('shipping')}
          className={cn(
            'flex-1 py-3 rounded-xl font-bold text-sm uppercase tracking-wide transition-all',
            activeTab === 'shipping'
              ? 'bg-tactical-blue text-white'
              : 'bg-white/5 text-white/60 hover:bg-white/10'
          )}
        >
          <Package className="w-4 h-4 inline mr-2" />
          Shipping Rates
        </button>
      </div>

      {isLoading ? (
        <div className="card-tactical animate-pulse">
          <div className="h-40 bg-white/5 rounded-xl" />
        </div>
      ) : (
        <>
          {/* Exchange Rate Tab */}
          {activeTab === 'exchange' && (
            <div className="card-tactical space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-white/60">
                USD to ZMW Exchange Rate
              </h3>

              <div className="flex gap-3">
                <div className="flex-1 relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 font-bold">K</span>
                  <input
                    type="number"
                    value={exchangeRate}
                    onChange={(e) => setExchangeRate(parseFloat(e.target.value) || 0)}
                    className="w-full h-14 pl-8 pr-4 bg-white/5 border border-white/10 rounded-xl text-white text-lg font-bold focus:outline-none focus:border-tactical-blue"
                    step="0.01"
                  />
                </div>
                <button
                  onClick={handleSaveExchangeRate}
                  disabled={isSaving}
                  className={cn(
                    'h-14 px-6 rounded-xl font-bold transition-all',
                    'bg-tactical-neon text-tactical-black hover:bg-tactical-neon/90',
                    isSaving && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  <Save className="w-4 h-4 inline mr-2" />
                  {isSaving ? 'Saving...' : 'Save'}
                </button>
              </div>

              <p className="text-xs text-white/40">
                This rate is used for all import profit calculations. Update when the Kwacha exchange rate changes.
              </p>
            </div>
          )}

          {/* Shipping Rates Tab */}
          {activeTab === 'shipping' && (
            <div className="space-y-4">
              {groupedRates.map((group) => (
                <div key={group.id} className="card-tactical space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-bold">{group.name}</h3>
                      <p className="text-xs text-white/40">{group.transitDays} days • {group.description}</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {group.rates.map((rate) => (
                      <div key={rate.id} className="flex items-center gap-3 bg-white/5 rounded-xl p-3 min-w-0">
                        <div className="flex-1 min-w-0">
                          <span className="text-sm text-white/60 truncate block">
                            {rate.rate_type === 'per_cbm'
                              ? (rate.volume_max_cbm
                                  ? `${rate.volume_min_cbm}CBM - ${rate.volume_max_cbm}CBM`
                                  : `${rate.volume_min_cbm}CBM+`)
                              : (rate.tier_max_kg
                                  ? `${rate.tier_min_kg}kg - ${rate.tier_max_kg}kg`
                                  : `${rate.tier_min_kg}kg+`)}
                          </span>
                          <span className="text-xs text-white/30 ml-2">
                            ({rate.rate_type === 'per_kg' ? 'per kg' : rate.rate_type === 'per_cbm' ? 'per CBM' : 'per ton'})
                          </span>
                        </div>

                        {editingRateId === rate.id ? (
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-white/40">$</span>
                            <input
                              type="number"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              className="w-20 h-10 px-2 bg-white/10 border border-tactical-blue rounded-lg text-white font-bold focus:outline-none text-sm"
                              step="0.01"
                              autoFocus
                            />
                            <button
                              onClick={() => handleSaveEdit(rate)}
                              className="p-2 rounded-lg bg-tactical-neon/20 text-tactical-neon hover:bg-tactical-neon/30"
                            >
                              <Save className="w-4 h-4" />
                            </button>
                            <button
                              onClick={handleCancelEdit}
                              className="p-2 rounded-lg bg-white/10 text-white/60 hover:bg-white/20"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-tactical-neon">
                              ${rate.rate.toFixed(2)}
                            </span>
                            <button
                              onClick={() => handleStartEdit(rate)}
                              className="p-2 rounded-lg bg-white/10 text-white/60 hover:bg-white/20"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              <p className="text-xs text-white/40 text-center">
                Tap the edit icon to update shipping rates. Changes apply immediately to all calculations.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}