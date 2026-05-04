import { FALLBACK_EXCHANGE_RATES } from '../config';

const EXCHANGE_RATE_API = 'https://api.exchangerate-api.com/v4/latest/ZMW';

export interface ExchangeRates {
  [currency: string]: number;
}

const CACHE_KEY = 'ge-exchange-rates';
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

interface CachedRates {
  rates: ExchangeRates;
  timestamp: number;
}

export const SUPPORTED_CURRENCIES = [
  { code: 'ZMW', symbol: 'K', name: 'Zambian Kwacha', flag: '🇿🇲' },
  { code: 'USD', symbol: '$', name: 'US Dollar', flag: '🇺🇸' },
  { code: 'EUR', symbol: '€', name: 'Euro', flag: '🇪🇺' },
  { code: 'GBP', symbol: '£', name: 'British Pound', flag: '🇬🇧' },
  { code: 'BWP', symbol: 'P', name: 'Botswana Pula', flag: '🇧🇼' },
  { code: 'ZAR', symbol: 'R', name: 'South African Rand', flag: '🇿🇦' },
  { code: 'UGX', symbol: 'USh', name: 'Ugandan Shilling', flag: '🇺🇬' },
];

export async function fetchExchangeRates(): Promise<ExchangeRates> {
  // Check cache first
  if (typeof localStorage !== 'undefined') {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      const parsed: CachedRates = JSON.parse(cached);
      if (Date.now() - parsed.timestamp < CACHE_DURATION) {
        return parsed.rates;
      }
    }
  }

  try {
    const response = await fetch(EXCHANGE_RATE_API);
    if (!response.ok) throw new Error('Failed to fetch rates');

    const data = await response.json();
    const rates: ExchangeRates = {
      ZMW: 1,
      USD: data.rates.USD,
      EUR: data.rates.EUR,
      GBP: data.rates.GBP,
      BWP: data.rates.BWP,
      ZAR: data.rates.ZAR,
      UGX: data.rates.UGX,
    };

    // Cache the rates
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(
        CACHE_KEY,
        JSON.stringify({ rates, timestamp: Date.now() })
      );
    }

    return rates;
  } catch (error) {
    // Return cached rates if fetch fails (even if expired)
    if (typeof localStorage !== 'undefined') {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const parsed: CachedRates = JSON.parse(cached);
        return parsed.rates;
      }
    }

    // Fallback to configured rates
    return { ...FALLBACK_EXCHANGE_RATES };
  }
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

export function getCurrencyInfo(code: string) {
  return SUPPORTED_CURRENCIES.find((c) => c.code === code) || SUPPORTED_CURRENCIES[0];
}

export function isRatesStale(): boolean {
  if (typeof localStorage === 'undefined') return true;

  const cached = localStorage.getItem(CACHE_KEY);
  if (!cached) return true;

  const parsed: CachedRates = JSON.parse(cached);
  return Date.now() - parsed.timestamp > CACHE_DURATION;
}