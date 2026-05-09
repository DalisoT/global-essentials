'use server';

import { createServerSupabaseClient } from '@/lib/supabase-server';
import type { Category } from '@/lib/supabase-types';

export async function getCategories(): Promise<{ data: Category[]; error: string | null }> {
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  return { data: data || [], error: error ? String(error.message) : null };
}

export async function createCategory(
  name: string,
  slug: string,
  description?: string
): Promise<{ data: Category | null; error: string | null }> {
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from('categories')
    .insert([{ name, slug, description }])
    .select()
    .single();

  return { data, error: error ? String(error.message) : null };
}