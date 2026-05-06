const EXCHANGE_API_URL = 'https://api.exchangerate-api.com/v4/latest/USD';
const CACHE_DURATION_MS = 4 * 60 * 60 * 1000; // 4 hours
const ZMW_CODE = 'ZMW';

interface CachedRate {
  rate: number;
  timestamp: number;
  source: 'api' | 'manual';
}

let inMemoryCache: CachedRate | null = null;

export async function fetchLiveUSDToZMW(): Promise<{ rate: number; source: 'api' | 'cache' | 'fallback'; updatedAt?: string }> {
  // Return in-memory cached if still valid
  if (inMemoryCache && Date.now() - inMemoryCache.timestamp < CACHE_DURATION_MS) {
    return { rate: inMemoryCache.rate, source: inMemoryCache.source as 'api' | 'cache', updatedAt: new Date(inMemoryCache.timestamp).toISOString() };
  }

  try {
    const res = await fetch(EXCHANGE_API_URL, {
      headers: { 'Accept': 'application/json' },
      cache: 'no-store' // Always get fresh data from API
    });

    if (!res.ok) {
      throw new Error(`API responded with status: ${res.status}`);
    }

    const data = await res.json();

    if (!data.rates?.[ZMW_CODE]) {
      throw new Error('ZMW rate not found in API response');
    }

    const rate = data.rates[ZMW_CODE];

    // Update in-memory cache
    inMemoryCache = { rate, timestamp: Date.now(), source: 'api' };

    return { rate, source: 'api', updatedAt: new Date().toISOString() };
  } catch (err) {
    // Return cached value if available, otherwise fallback
    if (inMemoryCache) {
      return { rate: inMemoryCache.rate, source: 'cache' };
    }

    // Default fallback
    return { rate: 26.0, source: 'fallback' };
  }
}

export function getCachedRate(): number | null {
  return inMemoryCache?.rate ?? null;
}

export function clearRateCache(): void {
  inMemoryCache = null;
}