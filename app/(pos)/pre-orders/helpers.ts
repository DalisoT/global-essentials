import 'server-only';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import type { Product } from '@/lib/supabase-types';

/**
 * Server-only helper for the pre-orders list page. Pulls
 * product names for a batch of pre-orders so the list can
 * show "boots they're waiting for" without N+1 round trips.
 */
export async function getProductMap(
  productIds: string[]
): Promise<Record<string, Pick<Product, 'id' | 'name' | 'image_url'>>> {
  const unique = Array.from(new Set(productIds)).filter(Boolean);
  if (unique.length === 0) return {};
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from('products')
    .select('id, name, image_url')
    .in('id', unique);
  const map: Record<string, Pick<Product, 'id' | 'name' | 'image_url'>> = {};
  for (const p of (data ?? []) as Array<Pick<Product, 'id' | 'name' | 'image_url'>>) {
    map[p.id] = p;
  }
  return map;
}
