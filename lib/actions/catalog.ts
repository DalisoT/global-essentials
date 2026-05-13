'use server';

import { createServerSupabaseClient } from '@/lib/supabase-server';

export interface CatalogProductWithImages {
  id: string;
  name: string;
  selling_price: number;
  catalog_price?: number | null;
  image_url: string | null;
  image_urls: string[] | null;
  stock_level: number;
  description?: string;
  images: string[];
}

export async function getCatalogProducts() {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from('products')
    .select('id, name, selling_price, catalog_price, image_url, image_urls, stock_level, description')
    .eq('is_visible_in_catalog', true)
    .gt('stock_level', 0)
    .order('name', { ascending: true });

  // Transform: use catalog_price if set, fall back to selling_price
  const products: CatalogProductWithImages[] = (data || []).map((p) => ({
    ...p,
    selling_price: p.catalog_price ?? p.selling_price,
    images: p.image_urls && p.image_urls.length > 0
      ? p.image_urls
      : p.image_url
        ? [p.image_url]
        : [],
  }));

  return { data: products, error };
}

export async function getProductById(id: string): Promise<{ data: CatalogProductWithImages | null; error: string | null }> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from('products')
    .select('id, name, selling_price, image_url, image_urls, stock_level')
    .eq('id', id)
    .single();

  if (error) return { data: null, error: 'Product not found' };

  // Fallback: if image_urls is empty/null but image_url exists, use image_url as single-item array
  const images = data.image_urls?.length
    ? data.image_urls
    : data.image_url
      ? [data.image_url]
      : [];

  return { data: { ...data, images }, error: null };
}