'use server';

import { supabase } from '@/lib/supabase';

export async function getProducts() {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .order('name');

  return { data: data || [], error };
}

export async function getClients() {
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .order('full_name');

  return { data: data || [], error };
}

export async function createClient(fullName: string, phoneNumber: string) {
  const { data, error } = await supabase
    .from('clients')
    .insert({ full_name: fullName, phone_number: phoneNumber })
    .select()
    .single();

  return { data, error };
}
