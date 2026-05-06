// Primary API: frankfurter.app (free, open source, reliable)
// Fallback: open.er-api.com
const PRIMARY_API_URL = 'https://api.frankfurter.app/latest?from=USD&to=ZMW';
const FALLBACK_API_URL = 'https://open.er-api.com/v6/latest/USD';
const CACHE_DURATION_MS = 4 * 60 * 60 * 1000; // 4 hours
const ZMW_CODE = 'ZMW';

interface CachedRate {
  rate: number;
  timestamp: number;
  source: 'api' | 'manual';
}

let inMemoryCache: CachedRate | null = null;

async function tryPrimaryAPI(): Promise<number | null> {
  try {
    const res = await fetch(PRIMARY_API_URL, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Primary API status: ${res.status}`);
    const data = await res.json();
    if (data.rates?.[ZMW_CODE]) {
      console.log('[ExchangeRate] Primary API success, ZMW:', data.rates[ZMW_CODE]);
      return data.rates[ZMW_CODE];
    }
    throw new Error('ZMW not in primary response');
  } catch (err) {
    console.log('[ExchangeRate] Primary API failed:', err instanceof Error ? err.message : err);
    return null;
  }
}

async function tryFallbackAPI(): Promise<number | null> {
  try {
    const res = await fetch(FALLBACK_API_URL, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Fallback API status: ${res.status}`);
    const data = await res.json();
    if (data.rates?.[ZMW_CODE]) {
      console.log('[ExchangeRate] Fallback API success, ZMW:', data.rates[ZMW_CODE]);
      return data.rates[ZMW_CODE];
    }
    throw new Error('ZMW not in fallback response');
  } catch (err) {
    console.log('[ExchangeRate] Fallback API failed:', err instanceof Error ? err.message : err);
    return null;
  }
}

export async function fetchLiveUSDToZMW(): Promise<{ rate: number; source: 'api' | 'cache' | 'fallback'; updatedAt?: string }> {
  // Return in-memory cached if still valid
  if (inMemoryCache && Date.now() - inMemoryCache.timestamp < CACHE_DURATION_MS) {
    console.log('[ExchangeRate] Using cached rate:', inMemoryCache.rate);
    return { rate: inMemoryCache.rate, source: 'cache' as const, updatedAt: new Date(inMemoryCache.timestamp).toISOString() };
  }

  console.log('[ExchangeRate] Fetching fresh rate from APIs...');

  // Try primary API first
  let rate = await tryPrimaryAPI();

  // If primary fails, try fallback
  if (rate === null) {
    rate = await tryFallbackAPI();
  }

  // If both fail, use fallback value
  if (rate === null) {
    if (inMemoryCache) {
      console.log('[ExchangeRate] Both APIs failed, using cached rate:', inMemoryCache.rate);
      return { rate: inMemoryCache.rate, source: 'cache' as const };
    }
    console.log('[ExchangeRate] Both APIs failed, using default rate: 26.0');
    return { rate: 26.0, source: 'fallback' as const };
  }

  // Update in-memory cache
  inMemoryCache = { rate, timestamp: Date.now(), source: 'api' };
  console.log('[ExchangeRate] Cached new rate:', rate);

  return { rate, source: 'api' as const, updatedAt: new Date().toISOString() };
}

export function getCachedRate(): number | null {
  return inMemoryCache?.rate ?? null;
}

export function clearRateCache(): void {
  inMemoryCache = null;
}

// Legacy exports for currency.ts compatibility
export const SUPPORTED_CURRENCIES = [
  { code: 'ZMW', symbol: 'K', name: 'Zambian Kwacha', flag: '🇿🇲' },
  { code: 'USD', symbol: '$', name: 'US Dollar', flag: '🇺🇸' },
];

export function getCurrencyInfo(code: string) {
  return SUPPORTED_CURRENCIES.find((c) => c.code === code) || SUPPORTED_CURRENCIES[0];
}

export interface ExchangeRates {
  [currency: string]: number;
}

const LEGACY_CACHE_KEY = 'ge-exchange-rates';
const LEGACY_CACHE_DURATION = 24 * 60 * 60 * 1000;

interface LegacyCachedRates {
  rates: ExchangeRates;
  timestamp: number;
}

export async function fetchExchangeRates(): Promise<ExchangeRates> {
  // Try to get fresh rate first
  const liveResult = await fetchLiveUSDToZMW();
  if (liveResult.source === 'api') {
    return { ZMW: 1, USD: 1 / liveResult.rate };
  }

  // Fallback to cached/localStorage
  if (typeof localStorage !== 'undefined') {
    const cached = localStorage.getItem(LEGACY_CACHE_KEY);
    if (cached) {
      try {
        const parsed: LegacyCachedRates = JSON.parse(cached);
        if (Date.now() - parsed.timestamp < LEGACY_CACHE_DURATION) {
          return parsed.rates;
        }
      } catch {}
    }
  }

  return { ZMW: 1, USD: 1 / 26.0 };
}

export function convertCurrency(
  amount: number,
  from: string,
  to: string,
  rates: ExchangeRates
): number {
  if (from === to) return amount;
  const inZMW = amount / rates[from];
  return inZMW * rates[to];
}