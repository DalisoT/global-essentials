import 'server-only';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import type { ProductVariant } from '@/lib/supabase-types';

/**
 * Server-only helper for the public catalog pre-order form.
 * Loads the product's variants (if any) so the form can offer
 * a size picker. Uses the anon Supabase client (no auth
 * required) but the table RLS already allows public read.
 */
export async function getProductVariantsForCatalog(
  productId: string
): Promise<{ variants: ProductVariant[] }> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from('product_variants')
    .select('*')
    .eq('product_id', productId)
    .order('size', { ascending: true });
  return { variants: (data ?? []) as unknown as ProductVariant[] };
}
