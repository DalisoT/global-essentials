'use server';

import { createServerSupabaseClient, requireAuth } from '@/lib/supabase-server';
import { MIN_INSTALLMENT_MONTHS, MAX_INSTALLMENT_MONTHS } from '@/lib/config';
import { postSaleJournal } from '@/lib/actions/journals';

export async function createSale({
  items,
  client_id,
  payment_method,
  installment_duration,
  installments,
}: {
  items: Array<{ product_id: string; quantity: number }>;
  client_id: string;
  payment_method: 'cash' | 'pay-slow';
  installment_duration?: number;
  installments?: Array<{ amount_due: number; due_date: string }>;
}) {
  const auth = await requireAuth();
  if ('error' in auth) return { data: null, error: auth.error };
  const supabase = auth.supabase;

  // Validate input
  if (!items || items.length === 0) {
    return { error: 'No items provided' };
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

  // Validate all products exist and have sufficient stock FIRST
  const productIds = items.map((i) => i.product_id);
  const { data: products } = await supabase
    .from('products')
    .select('id, name, stock_level, selling_price')
    .in('id', productIds);

  if (!products || products.length !== items.length) {
    return { error: 'Some products not found' };
  }

  for (const item of items) {
    const product = products.find((p) => p.id === item.product_id);
    if (!product) return { error: `Product not found: ${item.product_id}` };
    if (product.stock_level < item.quantity) {
      return { error: `Insufficient stock for ${product.name}. Available: ${product.stock_level}` };
    }
  }

  // Decrement stock FIRST — if this fails, nothing else happens
  for (const item of items) {
    const product = products.find((p) => p.id === item.product_id)!;
    const { error: stockError } = await supabase
      .from('products')
      .update({ stock_level: product.stock_level - item.quantity })
      .eq('id', item.product_id)
      .eq('stock_level', product.stock_level); // optimistic lock — fails if stock changed

    if (stockError) {
      return { error: `Failed to reserve stock for ${product.name}. Please try again.` };
    }
  }

  const paymentStatus = payment_method === 'cash' ? 'paid' : 'pending';
  const createdSales: Array<{ id: string; total_amount: number }> = [];

  interface AtomicSaleResult {
    error?: string;
    sales?: Array<{ id: string; total_amount: number }>;
  }

  // Try Supabase RPC for atomic transaction first
  const { data: rpcResult, error: rpcError } = await supabase.rpc('atomic_create_sale', {
    items_json: JSON.stringify(items),
    client_id,
    payment_method,
    installment_duration: installment_duration ?? null,
    installments_json: installments ? JSON.stringify(installments) : null,
  }).single() as { data: AtomicSaleResult | null; error: unknown };

  if (rpcError) {
    // RPC not available or failed — fall back to optimistic-lock approach
    // Stock was already decremented above — proceed with direct sales creation
  }

  if (rpcResult && rpcResult.error) {
    // RPC returned an error — rollback stock that was decremented above
    for (const item of items) {
      const product = products.find((p) => p.id === item.product_id)!;
      await supabase
        .from('products')
        .update({ stock_level: product.stock_level })
        .eq('id', item.product_id);
    }
    return { error: rpcResult.error };
  }

  if (rpcResult && rpcResult.sales) {
    return { data: rpcResult.sales, error: null };
  }

  // RPC not available — proceed with optimistic-lock approach below
  // (stock already decremented — this is the fallback for when atomic_create_sale RPC doesn't exist)

  // Validate custom installments before creating any sales
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
      if (isNaN(dueDate.getTime())) {
        return { error: 'Invalid installment due date' };
      }
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (dueDate < today) {
        return { error: 'Installment due dates cannot be in the past' };
      }
    }
    const sum = installments.reduce((s, i) => s + i.amount_due, 0);
    const totalAmount = items.reduce((sum, item) => {
      const product = products.find((p) => p.id === item.product_id)!;
      return sum + product.selling_price * item.quantity;
    }, 0);
    if (Math.abs(sum - totalAmount) > 0.01) {
      return { error: `Installments must sum to ${totalAmount.toFixed(2)}, got ${sum.toFixed(2)}` };
    }
  }

  // Create a sale for each line item
  for (const item of items) {
    const product = products.find((p) => p.id === item.product_id)!;
    const totalAmount = product.selling_price * item.quantity;

    const { data: sale, error: saleError } = await supabase
      .from('sales')
      .insert([{
        product_id: item.product_id,
        client_id,
        total_amount: totalAmount,
        payment_status: paymentStatus,
        payment_method,
      }])
      .select()
      .single();

    if (saleError) return { error: saleError.message };
    if (!sale) return { error: 'Failed to create sale' };

    createdSales.push({ id: sale.id, total_amount: totalAmount });

    // If Pay-Slow, create installments for this sale
    if (payment_method === 'pay-slow') {
      if (installments && installments.length > 0) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const processed = installments.map((inst, idx) => {
          const dueDate = new Date(inst.due_date);
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
      } else if (installment_duration) {
        const duration = installment_duration;
        const upfront = Math.ceil(totalAmount / duration);
        const monthly = Math.floor(totalAmount / duration);

        const presetInstallments = [];
        presetInstallments.push({
          sale_id: sale.id,
          amount_due: upfront,
          due_date: new Date().toISOString().split('T')[0],
          is_paid: true,
          paid_at: new Date().toISOString(),
        });
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

    // Stock already decremented upfront with optimistic lock above
  }

  // Phase 1: post the journal entry. Failures here don't roll back the sale —
  // the sale is real, the books will be slightly out until repaired.
  postJournalForSales(createdSales, items, client_id, payment_method).catch(err => {
    console.error('Failed to post sale journal:', err);
  });

  return { data: createdSales, error: null };
}

/**
 * Internal helper called by createSale.
 * Loads the product cost prices + client name and posts the journal entry.
 */
async function postJournalForSales(
  sales: Array<{ id: string; total_amount: number }>,
  items: Array<{ product_id: string; quantity: number }>,
  client_id: string,
  payment_method: 'cash' | 'pay-slow'
) {
  const auth = await requireAuth();
  if ('error' in auth) return;
  const supabase = auth.supabase;

  const productIds = items.map(i => i.product_id);
  const { data: products } = await supabase
    .from('products')
    .select('id, name, cost_price, selling_price')
    .in('id', productIds);
  const { data: client } = await supabase
    .from('clients')
    .select('id, full_name')
    .eq('id', client_id)
    .single();

  // Aggregate items by product for posting
  const aggregated = items.map(item => {
    const product = products?.find(p => p.id === item.product_id);
    return {
      productName: product?.name || 'Unknown',
      quantity: item.quantity,
      sellingPrice: product?.selling_price || 0,
      costPrice: product?.cost_price || 0,
    };
  });

  const totalAmount = sales.reduce((s, x) => s + x.total_amount, 0);
  // For cash sales, full amount is upfront; for pay-slow we post the sale at face
  // and treat the upfront installment (if any) as the cash portion.
  const upfrontPaid = payment_method === 'cash' ? totalAmount : 0;

  await postSaleJournal({
    saleId: sales[0]?.id || '00000000-0000-0000-0000-000000000000',
    items: aggregated,
    upfrontPaid,
    totalAmount,
    paymentMethod,
    clientName: client?.full_name || 'Unknown client',
  });
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

  // If unique constraint violation (409), fetch existing client
  if (error && (error as { code?: string }).code === '23505') {
    const { data: existing } = await supabase
      .from('clients')
      .select('*')
      .eq('phone_number', phoneNumber)
      .single();
    if (existing) return { data: existing, error: null };
  }

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

export async function markSaleFullyPaid(saleId: string): Promise<{ error?: string | null }> {
  const auth = await requireAuth();
  if ('error' in auth) return { error: auth.error };
  const supabase = auth.supabase;

  // Mark all unpaid installments as paid
  const { error: installError } = await supabase
    .from('installments')
    .update({ is_paid: true, paid_at: new Date().toISOString() })
    .eq('sale_id', saleId)
    .eq('is_paid', false);

  if (installError) return { error: installError.message };

  // Update the sale to paid
  const { error: saleError } = await supabase
    .from('sales')
    .update({ payment_status: 'paid' })
    .eq('id', saleId);

  if (saleError) return { error: saleError.message };

  return { error: null };
}