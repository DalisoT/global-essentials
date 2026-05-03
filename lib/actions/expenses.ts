'use server';

import { supabase } from '@/lib/supabase';

export async function getExpenses(
  search?: string,
  options?: { limit?: number; offset?: number }
) {
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
  const { data, error } = await supabase
    .from('expenses')
    .update({ description, amount, category })
    .eq('id', id)
    .select()
    .single();

  return { data, error };
}

export async function deleteExpense(id: string) {
  const { error } = await supabase.from('expenses').delete().eq('id', id);
  return { error };
}

export async function getExpenseStats() {
  const { data: documents } = await supabase.from('expenses').select('*');

  const total = documents?.reduce((sum: number, e: any) => sum + e.amount, 0) || 0;

  // Group by category
  const byCategory: Record<string, number> = {};
  documents?.forEach((e: any) => {
    byCategory[e.category] = (byCategory[e.category] || 0) + e.amount;
  });

  // Last 7 days
  const lastWeek = new Date();
  lastWeek.setDate(lastWeek.getDate() - 7);

  const last7Days = documents?.filter((e: any) => new Date(e.created_at) >= lastWeek) || [];
  const last7DaysTotal = last7Days.reduce((sum: number, e: any) => sum + e.amount, 0);

  return {
    total,
    byCategory,
    last7DaysTotal,
    count: documents?.length || 0,
  };
}