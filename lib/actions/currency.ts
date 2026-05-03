'use server';

import { fetchExchangeRates, convertCurrency, getCurrencyInfo, SUPPORTED_CURRENCIES } from '@/lib/currency/rates';

export async function getExchangeRates() {
  const rates = await fetchExchangeRates();
  return { rates };
}

export async function convert(
  amount: number,
  from: string,
  to: string
): Promise<{ result: number; from: string; to: string }> {
  const rates = await fetchExchangeRates();
  const result = convertCurrency(amount, from, to, rates);
  return { result, from, to };
}

export async function getSupportedCurrencies() {
  return SUPPORTED_CURRENCIES;
}

export async function getCurrencyInfoAction(code: string) {
  return getCurrencyInfo(code);
}