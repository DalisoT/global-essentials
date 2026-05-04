'use server';

import { createServerSupabaseClient, requireAuth } from '@/lib/supabase-server';

export interface ImportResult {
  success: number;
  failed: number;
  errors: string[];
}

export async function importProducts(
  products: Array<{
    name: string;
    cost_price: number;
    selling_price: number;
    stock_level: number;
    barcode?: string;
  }>
): Promise<ImportResult> {
  const auth = await requireAuth();
  if ('error' in auth) return { success: 0, failed: products.length, errors: [auth.error] };
  const supabase = auth.supabase;

  const { error } = await supabase.from('products').insert(products);

  if (error) {
    return { success: 0, failed: products.length, errors: [error.message] };
  }
  return { success: products.length, failed: 0, errors: [] };
}

export async function importExpenses(
  expenses: Array<{
    description: string;
    amount: number;
    category: string;
    created_at?: string;
  }>
): Promise<ImportResult> {
  const auth = await requireAuth();
  if ('error' in auth) return { success: 0, failed: expenses.length, errors: [auth.error] };
  const supabase = auth.supabase;

  const expensesWithDate = expenses.map((e) => ({
    ...e,
    created_at: e.created_at || new Date().toISOString(),
  }));

  const { error } = await supabase.from('expenses').insert(expensesWithDate);

  if (error) {
    return { success: 0, failed: expenses.length, errors: [error.message] };
  }
  return { success: expenses.length, failed: 0, errors: [] };
}

export async function importClients(
  clients: Array<{
    full_name: string;
    phone_number: string;
  }>
): Promise<ImportResult> {
  const auth = await requireAuth();
  if ('error' in auth) return { success: 0, failed: clients.length, errors: [auth.error] };
  const supabase = auth.supabase;

  const { error } = await supabase.from('clients').insert(clients);

  if (error) {
    return { success: 0, failed: clients.length, errors: [error.message] };
  }
  return { success: clients.length, failed: 0, errors: [] };
}