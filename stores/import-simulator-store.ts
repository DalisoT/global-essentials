import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ShippingTypeId } from '@/lib/import/shipping-types';

interface ImportSimulatorPreferences {
  lastShippingType: ShippingTypeId | null;
  lastExchangeRate: number;
  defaultExchangeRate: number;
  calculationMode: 'selling_price' | 'markup';
  defaultMarkupPercent: number;
  // Manual shipping rate override (null = use database rates)
  manualShippingRate: number | null;
}

interface ImportSimulatorStore extends ImportSimulatorPreferences {
  setLastShippingType: (type: ShippingTypeId) => void;
  setLastExchangeRate: (rate: number) => void;
  setDefaultExchangeRate: (rate: number) => void;
  setCalculationMode: (mode: 'selling_price' | 'markup') => void;
  setDefaultMarkupPercent: (percent: number) => void;
  setManualShippingRate: (rate: number | null) => void;
}

export const useImportSimulatorStore = create<ImportSimulatorStore>()(
  persist(
    (set) => ({
      lastShippingType: null,
      lastExchangeRate: 26,
      defaultExchangeRate: 26,
      calculationMode: 'markup',
      defaultMarkupPercent: 30,
      manualShippingRate: null,

      setLastShippingType: (type) => set({ lastShippingType: type }),
      setLastExchangeRate: (rate) => set({ lastExchangeRate: rate }),
      setDefaultExchangeRate: (rate) => set({ defaultExchangeRate: rate }),
      setCalculationMode: (mode) => set({ calculationMode: mode }),
      setDefaultMarkupPercent: (percent) => set({ defaultMarkupPercent: percent }),
      setManualShippingRate: (rate) => set({ manualShippingRate: rate }),
    }),
    {
      name: 'ge-import-simulator-prefs',
    }
  )
);