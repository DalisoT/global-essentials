import 'server-only';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import type { Product, ProductVariant } from '@/lib/supabase-types';

/**
 * Server-only helper for the pre-order detail page. Pulls
 * the product (and optional variant) so the client component
 * can show the name, image, and current stock.
 *
 * Kept out of the page file so it can be imported safely
 * from a server context (Next 14 server-component boundary).
 */
export async function getPreOrderDetailProducts(
  productId: string,
  variantId: string | null
): Promise<{
  product: Product | null;
  variant: ProductVariant | null;
}> {
  const supabase = await createServerSupabaseClient();
  const { data: product } = await supabase
    .from('products')
    .select('*')
    .eq('id', productId)
    .maybeSingle();
  let variant: ProductVariant | null = null;
  if (variantId) {
    const { data: v } = await supabase
      .from('product_variants')
      .select('*')
      .eq('id', variantId)
      .maybeSingle();
    variant = v as unknown as ProductVariant | null;
  }
  return {
    product: product as unknown as Product | null,
    variant,
  };
}
