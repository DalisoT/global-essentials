'use server';

import { createServerSupabaseClient } from '@/lib/supabase-server';

export interface ProductReview {
  id: string;
  product_id: string;
  customer_name: string;
  rating: number;
  comment: string | null;
  is_verified_purchase: boolean;
  created_at: string;
}

export async function getProductReviews(productId: string): Promise<{ data: ProductReview[]; error: string | null }> {
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from('product_reviews')
    .select('*')
    .eq('product_id', productId)
    .eq('is_approved', true)
    .order('created_at', { ascending: false });

  return { data: data || [], error: error ? error.message : null };
}

export async function getProductRatingStats(productId: string): Promise<{ average: number; count: number }> {
  const supabase = await createServerSupabaseClient();

  const { data } = await supabase
    .from('product_reviews')
    .select('rating')
    .eq('product_id', productId)
    .eq('is_approved', true);

  if (!data || data.length === 0) return { average: 0, count: 0 };

  const sum = data.reduce((acc, r) => acc + r.rating, 0);
  return { average: sum / data.length, count: data.length };
}

export async function createReview(review: {
  product_id: string;
  customer_name: string;
  rating: number;
  comment?: string;
  is_verified_purchase?: boolean;
}): Promise<{ data: ProductReview | null; error: string | null }> {
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from('product_reviews')
    .insert([
      {
        product_id: review.product_id,
        customer_name: review.customer_name,
        rating: review.rating,
        comment: review.comment || null,
        is_verified_purchase: review.is_verified_purchase || false,
        is_approved: false, // Requires approval before showing
      },
    ])
    .select()
    .single();

  return { data, error: error ? error.message : null };
}