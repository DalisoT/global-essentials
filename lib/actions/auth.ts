'use server';

import { createServerSupabaseClient } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import type { User } from '@/types/auth';

export async function signIn(email: string, password: string): Promise<{ error?: string }> {
  const supabase = await createServerSupabaseClient();

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) return { error: error.message };

  return {};
}

export async function signUp(
  email: string,
  password: string,
  fullName: string
): Promise<{ error?: string }> {
  const supabase = await createServerSupabaseClient();

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  });

  if (error) return { error: error.message };

  return {};
}

export async function signOut(): Promise<void> {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  redirect('/login');
}

export async function resetPassword(email: string): Promise<{ error?: string }> {
  const supabase = await createServerSupabaseClient();

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl}/reset-password`,
  });

  if (error) return { error: error.message };
  return {};
}

export async function updatePassword(newPassword: string): Promise<{ error?: string }> {
  const supabase = await createServerSupabaseClient();

  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (error) return { error: error.message };
  return {};
}

export async function getSession(): Promise<{ user: User | null }> {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { user: null };

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  return {
    user: profile
      ? {
          id: user.id,
          email: user.email,
          fullName: profile.full_name || '',
          role: (profile.role as 'staff' | 'admin') || 'staff',
          preferences: profile.preferences || {},
        }
      : {
          id: user.id,
          email: user.email,
          fullName: user.email?.split('@')[0] || '',
          role: 'staff',
          preferences: {},
        },
  };
}