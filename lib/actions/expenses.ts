'use server';

import { createServerSupabaseClient, requireAuth } from '@/lib/supabase-server';

export async function getExpenses(
  search?: string,
  options?: { limit?: number; offset?: number }
) {
  const auth = await requireAuth();
  if ('error' in auth) return { data: null, error: auth.error, count: 0 };
  const supabase = auth.supabase;
  const limit = options?.limit ?? 50;
  const offset = options?.offset ?? 0;

  let query = supabase
    .from('expenses')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (search) {
    query = query.ilike('description', `%${search}%`);
  }

  const { data, error, count } = await query;

  return { data: data || [], error, count };
}

export async function createExpense({
  description,
  amount,
  category,
}: {
  description: string;
  amount: number;
  category: string;
}) {
  const auth = await requireAuth();
  if ('error' in auth) return { data: null, error: auth.error };
  const supabase = auth.supabase;
  if (!description || typeof description !== 'string' || description.trim().length === 0) {
    return { data: null, error: 'Description is required' };
  }
  if (typeof amount !== 'number' || amount <= 0) {
    return { data: null, error: 'Amount must be a positive number' };
  }
  if (!category || typeof category !== 'string' || category.trim().length === 0) {
    return { data: null, error: 'Category is required' };
  }

  const { data, error } = await supabase
    .from('expenses')
    .insert([{ description: description.trim(), amount, category: category.trim() }])
    .select()
    .single();

  return { data, error };
}

export async function updateExpense(
  id: string,
  {
    description,
    amount,
    category,
  }: {
    description?: string;
    amount?: number;
    category?: string;
  }
) {
  const auth = await requireAuth();
  if ('error' in auth) return { data: null, error: auth.error };
  const supabase = auth.supabase;
  const { data, error } = await supabase
    .from('expenses')
    .update({ description, amount, category })
    .eq('id', id)
    .select()
    .single();

  return { data, error };
}

export async function deleteExpense(id: string) {
  const auth = await requireAuth();
  if ('error' in auth) return { error: auth.error };
  const supabase = auth.supabase;
  const { error } = await supabase.from('expenses').delete().eq('id', id);
  return { error };
}

export async function getExpenseStats() {
  const auth = await requireAuth();
  if ('error' in auth) return { total: 0, byCategory: {}, last7DaysTotal: 0, count: 0, error: auth.error };
  const supabase = auth.supabase;
  const { data: documents } = await supabase.from('expenses').select('*');

  const total = documents?.reduce((sum: number, e) => sum + e.amount, 0) || 0;

  // Group by category
  const byCategory: Record<string, number> = {};
  documents?.forEach((e) => {
    byCategory[e.category] = (byCategory[e.category] || 0) + e.amount;
  });

  // Last 7 days
  const lastWeek = new Date();
  lastWeek.setDate(lastWeek.getDate() - 7);

  const last7Days = documents?.filter((e) => new Date(e.created_at) >= lastWeek) || [];
  const last7DaysTotal = last7Days.reduce((sum: number, e) => sum + e.amount, 0);

  return {
    total,
    byCategory,
    last7DaysTotal,
    count: documents?.length || 0,
  };
}