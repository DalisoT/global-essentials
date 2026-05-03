'use server';

import { createServerSupabaseClient } from '@/lib/supabase-server';

interface ProductVariant {
  id: string;
  product_id: string;
  size?: string;
  color?: string;
  sku: string;
  barcode?: string;
  stock_level: number;
  price_modifier: number;
  created_at: string;
}

export async function getVariants(productId: string): Promise<{ data?: ProductVariant[]; error?: string }> {
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from('product_variants')
    .select('*')
    .eq('product_id', productId)
    .order('created_at', { ascending: true });

  if (error) return { error: error.message };
  return { data: data || [] };
}

export async function createVariant(variant: {
  product_id: string;
  size?: string;
  color?: string;
  sku: string;
  barcode?: string;
  stock_level: number;
  price_modifier?: number;
}): Promise<{ data?: ProductVariant; error?: string }> {
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from('product_variants')
    .insert([{
      product_id: variant.product_id,
      size: variant.size || null,
      color: variant.color || null,
      sku: variant.sku,
      barcode: variant.barcode || null,
      stock_level: variant.stock_level || 0,
      price_modifier: variant.price_modifier || 0,
    }])
    .select()
    .single();

  if (error) return { error: error.message };
  return { data };
}

export async function updateVariant(
  id: string,
  updates: {
    size?: string;
    color?: string;
    sku?: string;
    barcode?: string;
    stock_level?: number;
    price_modifier?: number;
  }
): Promise<{ data?: ProductVariant; error?: string }> {
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from('product_variants')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) return { error: error.message };
  return { data };
}

export async function deleteVariant(id: string): Promise<{ error?: string }> {
  const supabase = await createServerSupabaseClient();

  const { error } = await supabase
    .from('product_variants')
    .delete()
    .eq('id', id);

  if (error) return { error: error.message };
  return {};
}

export async function getVariantByBarcode(barcode: string): Promise<{
  data?: { id: string; product_id: string; sku: string; stock_level: number; price_modifier: number; product: { name: string; selling_price: number } };
  error?: string;
}> {
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from('product_variants')
    .select('id, product_id, sku, stock_level, price_modifier, product:products(name, selling_price)')
    .eq('barcode', barcode)
    .single();

  if (error) return { error: error.message };
  return { data: data as any };
}