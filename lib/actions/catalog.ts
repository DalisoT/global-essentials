'use server';

import { supabase } from '@/lib/supabase';

export async function getCatalogProducts() {
  const { data, error } = await supabase
    .from('products')
    .select('id, name, selling_price, image_url, image_urls, stock_level, description')
    .gt('stock_level', 0)
    .order('name', { ascending: true });

  // Transform to use image_urls if available, with fallback to image_url
  const products = (data || []).map((p: any) => ({
    ...p,
    images: p.image_urls && p.image_urls.length > 0
      ? p.image_urls
      : p.image_url
        ? [p.image_url]
        : [],
  }));

  return { data: products, error };
}

export async function getProductById(id: string) {
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