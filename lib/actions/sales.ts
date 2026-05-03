'use server';

import { supabase } from '@/lib/supabase';

export async function createSale({
  product_id,
  client_id,
  payment_method,
  installment_duration,
}: {
  product_id: string;
  client_id: string;
  payment_method: 'cash' | 'pay-slow';
  installment_duration?: number;
}) {
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
  if (installment_duration !== undefined && (installment_duration < 2 || installment_duration > 60)) {
    return { error: 'Installment duration must be between 2 and 60 months' };
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
  if (payment_method === 'pay-slow' && installment_duration) {
    const duration = installment_duration;
    const upfront = Math.ceil(totalAmount / duration);
    const monthly = Math.floor(totalAmount / duration);

    const installments = [];

    // First installment (paid upfront)
    installments.push({
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
      installments.push({
        sale_id: sale.id,
        amount_due: monthly,
        due_date: dueDate.toISOString().split('T')[0],
        is_paid: false,
        paid_at: null,
      });
    }

    const { error: installmentsError } = await supabase
      .from('installments')
      .insert(installments);

    if (installmentsError) return { error: installmentsError.message };
  }

  // Decrement stock
  await supabase
    .from('products')
    .update({ stock_level: product.stock_level - 1 })
    .eq('id', product_id);

  return { data: sale, error: null };
}

export async function getProducts() {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .order('name', { ascending: true });

  return { data: data || [], error };
}

export async function getClients() {
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .order('full_name', { ascending: true });

  return { data: data || [], error };
}

export async function createClient(fullName: string, phoneNumber: string) {
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
  const { error } = await supabase
    .from('sales')
    .update(updates)
    .eq('id', saleId);

  if (error) return { error: error.message };
  return {};
}