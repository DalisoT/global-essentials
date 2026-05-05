'use server';

import { createServerSupabaseClient, requireAuth } from '@/lib/supabase-server';
import { MIN_INSTALLMENT_MONTHS, MAX_INSTALLMENT_MONTHS } from '@/lib/config';

export async function createSale({
  product_id,
  client_id,
  payment_method,
  installment_duration,
  installments,
}: {
  product_id: string;
  client_id: string;
  payment_method: 'cash' | 'pay-slow';
  installment_duration?: number;
  installments?: Array<{ amount_due: number; due_date: string }>;
}) {
  const auth = await requireAuth();
  if ('error' in auth) return { data: null, error: auth.error };
  const supabase = auth.supabase;
  // Validate input
  if (!product_id || typeof product_id !== 'string') {
    return { error: 'Invalid product_id' };
  }
  if (!client_id || typeof client_id !== 'string') {
    return { error: 'Invalid client_id' };
  }
  if (!['cash', 'pay-slow'].includes(payment_method)) {
    return { error: 'Invalid payment method' };
  }
  if (installment_duration !== undefined && (installment_duration < MIN_INSTALLMENT_MONTHS || installment_duration > MAX_INSTALLMENT_MONTHS)) {
    return { error: `Installment duration must be between ${MIN_INSTALLMENT_MONTHS} and ${MAX_INSTALLMENT_MONTHS} months` };
  }

  // Get product details
  const { data: product, error: productError } = await supabase
    .from('products')
    .select('*')
    .eq('id', product_id)
    .single();

  if (productError || !product) {
    return { error: 'Product not found' };
  }

  if (product.stock_level <= 0) {
    return { error: 'Product out of stock' };
  }

  const totalAmount = product.selling_price;
  const paymentStatus = payment_method === 'cash' ? 'paid' : 'pending';

  // Validate custom installments
  if (installments && installments.length > 0) {
    if (installments.length < 2) {
      return { error: 'Custom plan must have at least 2 installments' };
    }
    if (installments.length > 10) {
      return { error: 'Custom plan cannot have more than 10 installments' };
    }
    for (const inst of installments) {
      if (inst.amount_due <= 0) {
        return { error: 'All installment amounts must be greater than zero' };
      }
      const dueDate = new Date(inst.due_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (dueDate < today) {
        return { error: 'Installment due dates cannot be in the past' };
      }
    }
    const sum = installments.reduce((s, i) => s + i.amount_due, 0);
    if (sum !== totalAmount) {
      return { error: `Installments must sum to ${totalAmount}, got ${sum}` };
    }
  }

  // Create sale
  const { data: sale, error: saleError } = await supabase
    .from('sales')
    .insert([{
      product_id,
      client_id,
      total_amount: totalAmount,
      payment_status: paymentStatus,
      payment_method,
    }])
    .select()
    .single();

  if (saleError) return { error: saleError.message };

  // If Pay-Slow, create installments
  if (payment_method === 'pay-slow') {
    // Custom installments provided (custom plan)
    if (installments && installments.length > 0) {
      const processed = installments.map((inst, idx) => {
        const dueDate = new Date(inst.due_date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const isToday = dueDate.toISOString().split('T')[0] === today.toISOString().split('T')[0];
        return {
          sale_id: sale.id,
          amount_due: inst.amount_due,
          due_date: inst.due_date,
          is_paid: idx === 0 && isToday,
          paid_at: (idx === 0 && isToday) ? new Date().toISOString() : null,
        };
      });
      const { error } = await supabase.from('installments').insert(processed);
      if (error) return { error: error.message };
    }
    // Preset duration (existing equal-split logic)
    else if (installment_duration) {
      const duration = installment_duration;
      const upfront = Math.ceil(totalAmount / duration);
      const monthly = Math.floor(totalAmount / duration);

      const presetInstallments = [];

      // First installment (paid upfront)
      presetInstallments.push({
        sale_id: sale.id,
        amount_due: upfront,
        due_date: new Date().toISOString().split('T')[0],
        is_paid: true,
        paid_at: new Date().toISOString(),
      });

      // Remaining installments
      for (let i = 1; i < duration; i++) {
        const dueDate = new Date();
        dueDate.setMonth(dueDate.getMonth() + i);
        presetInstallments.push({
          sale_id: sale.id,
          amount_due: monthly,
          due_date: dueDate.toISOString().split('T')[0],
          is_paid: false,
          paid_at: null,
        });
      }

      const { error } = await supabase.from('installments').insert(presetInstallments);
      if (error) return { error: error.message };
    }
  }

  // Decrement stock
  await supabase
    .from('products')
    .update({ stock_level: product.stock_level - 1 })
    .eq('id', product_id);

  return { data: sale, error: null };
}

export async function getProducts() {
  const auth = await requireAuth();
  if ('error' in auth) return { data: null, error: auth.error };
  const supabase = auth.supabase;
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .order('name', { ascending: true });

  return { data: data || [], error };
}

export async function getClients() {
  const auth = await requireAuth();
  if ('error' in auth) return { data: null, error: auth.error };
  const supabase = auth.supabase;
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .order('full_name', { ascending: true });

  return { data: data || [], error };
}

export async function createClient(fullName: string, phoneNumber: string) {
  const auth = await requireAuth();
  if ('error' in auth) return { data: null, error: auth.error };
  const supabase = auth.supabase;
  // Check if client exists
  const { data: existing } = await supabase
    .from('clients')
    .select('*')
    .eq('phone_number', phoneNumber)
    .single();

  if (existing) {
    return { data: existing, error: null };
  }

  const { data, error } = await supabase
    .from('clients')
    .insert([{
      full_name: fullName,
      phone_number: phoneNumber,
    }])
    .select()
    .single();

  return { data, error };
}

export async function deleteSale(saleId: string): Promise<{ error?: string }> {
  const auth = await requireAuth();
  if ('error' in auth) return { error: auth.error };
  const supabase = auth.supabase;
  // Get the sale first
  const { data: sale, error: saleError } = await supabase
    .from('sales')
    .select('*, product:products(*)')
    .eq('id', saleId)
    .single();

  if (saleError || !sale) {
    return { error: 'Sale not found' };
  }

  // Delete associated installments
  await supabase.from('installments').delete().eq('sale_id', saleId);

  // Restore product stock
  if (sale.product) {
    await supabase
      .from('products')
      .update({ stock_level: sale.product.stock_level + 1 })
      .eq('id', sale.product_id);
  }

  // Delete the sale
  const { error: deleteError } = await supabase
    .from('sales')
    .delete()
    .eq('id', saleId);

  if (deleteError) return { error: deleteError.message };
  return {};
}

export async function editSale(
  saleId: string,
  updates: {
    payment_status?: 'paid' | 'pending';
    payment_method?: 'cash' | 'pay-slow';
  }
): Promise<{ error?: string }> {
  const auth = await requireAuth();
  if ('error' in auth) return { error: auth.error };
  const supabase = auth.supabase;
  const { error } = await supabase
    .from('sales')
    .update(updates)
    .eq('id', saleId);

  if (error) return { error: error.message };
  return {};
}