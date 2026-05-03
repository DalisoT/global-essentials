'use server';

import { createServerSupabaseClient } from '@/lib/supabase-server';

export async function lookupProductByBarcode(
  barcode: string
): Promise<{ data?: { id: string; name: string; selling_price: number; stock_level: number }; error?: string }> {
  if (!barcode) return { error: 'Barcode is required' };

  const supabase = await createServerSupabaseClient();

  // First check product_variants for barcode
  const { data: variant } = await supabase
    .from('product_variants')
    .select('id, product:products(id, name, selling_price, stock_level)')
    .eq('barcode', barcode)
    .single();

  if (variant) {
    return {
      data: {
        id: (variant.product as unknown as { id: string }).id,
        name: (variant.product as unknown as { name: string }).name,
        selling_price: (variant.product as unknown as { selling_price: number }).selling_price,
        stock_level: (variant.product as unknown as { stock_level: number }).stock_level,
      },
    };
  }

  // Check products table directly
  const { data: product } = await supabase
    .from('products')
    .select('id, name, selling_price, stock_level')
    .eq('barcode', barcode)
    .eq('deleted_at', null)
    .single();

  if (product) {
    return { data: product };
  }

  return { error: 'Product not found' };
}