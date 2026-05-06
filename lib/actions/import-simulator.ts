'use server';

import { createServerSupabaseClient, requireAuth } from '@/lib/supabase-server';
import type { ShippingRate, ExchangeRateCustom } from '@/lib/supabase-types';

export async function getShippingRates(): Promise<{ data: ShippingRate[] | null; error: string | null }> {
  const auth = await requireAuth();
  if ('error' in auth) return { data: null, error: auth.error };

  const { data, error } = await auth.supabase
    .from('shipping_rates')
    .select('*')
    .eq('is_active', true)
    .order('shipping_type');

  return { data: data as ShippingRate[] | null, error: error?.message || null };
}

export async function updateShippingRate(
  id: string,
  rate: number
): Promise<{ error: string | null }> {
  const auth = await requireAuth();
  if ('error' in auth) return { error: auth.error };

  const { error } = await auth.supabase
    .from('shipping_rates')
    .update({ rate, updated_at: new Date().toISOString() })
    .eq('id', id);

  return { error: error?.message || null };
}

export async function getCustomExchangeRate(): Promise<{ rate: number; error: string | null }> {
  const auth = await requireAuth();
  if ('error' in auth) return { rate: 26, error: null };

  const { data, error } = await auth.supabase
    .from('exchange_rates_custom')
    .select('rate')
    .eq('currency_pair', 'USD_ZMW')
    .single();

  return { rate: data?.rate || 26, error: error?.message || null };
}

export async function saveCustomExchangeRate(rate: number): Promise<{ error: string | null }> {
  const auth = await requireAuth();
  if ('error' in auth) return { error: auth.error };

  const { error } = await auth.supabase
    .from('exchange_rates_custom')
    .upsert({ currency_pair: 'USD_ZMW', rate, updated_at: new Date().toISOString() });

  return { error: error?.message || null };
}