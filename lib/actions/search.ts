'use server';

import { createServerSupabaseClient } from '@/lib/supabase-server';

interface SearchResult {
  id: string;
  type: 'product' | 'client' | 'sale';
  name: string;
  subtitle?: string;
  href: string;
}

export async function search(query: string): Promise<SearchResult[]> {
  if (!query || query.length < 2) return [];

  const supabase = await createServerSupabaseClient();
  const results: SearchResult[] = [];

  // Search products
  const { data: products } = await supabase
    .from('products')
    .select('id, name, selling_price')
    .ilike('name', `%${query}%`)
    .eq('deleted_at', null)
    .limit(5);

  if (products) {
    results.push(
      ...products.map((p) => ({
        id: p.id,
        type: 'product' as const,
        name: p.name,
        subtitle: `K${p.selling_price}`,
        href: '/inventory',
      }))
    );
  }

  // Search clients
  const { data: clients } = await supabase
    .from('clients')
    .select('id, full_name, phone_number')
    .ilike('full_name', `%${query}%`)
    .eq('deleted_at', null)
    .limit(5);

  if (clients) {
    results.push(
      ...clients.map((c) => ({
        id: c.id,
        type: 'client' as const,
        name: c.full_name,
        subtitle: c.phone_number,
        href: '/ledger',
      }))
    );
  }

  // Search sales (by product or client name)
  const { data: sales } = await supabase
    .from('sales')
    .select('id, created_at, product:products(name), client:clients(full_name)')
    .or(`product.products.name.ilike.%${query}%,client.clients.full_name.ilike.%${query}%`)
    .eq('deleted_at', null)
    .limit(5);

  if (sales) {
    results.push(
      ...sales.map((s) => ({
        id: s.id,
        type: 'sale' as const,
        name: `Sale - ${(s.product as unknown as { name: string })?.name || 'Unknown'}`,
        subtitle: `Client: ${(s.client as unknown as { full_name: string })?.full_name || 'Unknown'}`,
        href: '/ledger',
      }))
    );
  }

  return results;
}