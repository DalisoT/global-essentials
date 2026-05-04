'use server';

import { createServerSupabaseClient, requireAuth } from '@/lib/supabase-server';

type TableName = 'products' | 'clients' | 'sales' | 'expenses';

export async function softDelete(
  table: TableName,
  id: string
): Promise<{ error?: string }> {
  const auth = await requireAuth();
  if ('error' in auth) return { error: auth.error };
  const supabase = auth.supabase;

  const { error } = await supabase
    .from(table)
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);

  if (error) return { error: error.message };
  return {};
}

export async function restore(
  table: TableName,
  id: string
): Promise<{ error?: string }> {
  const auth = await requireAuth();
  if ('error' in auth) return { error: auth.error };
  const supabase = auth.supabase;

  const { error } = await supabase
    .from(table)
    .update({ deleted_at: null })
    .eq('id', id);

  if (error) return { error: error.message };
  return {};
}

export async function purgeOldDeleted(
  table: TableName,
  daysOld: number = 30
): Promise<{ deleted: number; error?: string }> {
  const auth = await requireAuth();
  if ('error' in auth) return { deleted: 0, error: auth.error };
  const supabase = auth.supabase;

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);

  const { error, count } = await supabase
    .from(table)
    .delete()
    .not('deleted_at', 'is', null)
    .lt('deleted_at', cutoffDate.toISOString());

  if (error) return { deleted: 0, error: error.message };

  return { deleted: count || 0, error: undefined };
}