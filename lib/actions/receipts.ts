'use server';

import { createServerSupabaseClient, requireAuth } from '@/lib/supabase-server';
import { generateReceiptHTML, type ReceiptData } from '@/lib/receipts/template';

export async function getSaleReceipt(saleId: string): Promise<{ data?: string; error?: string }> {
  const auth = await requireAuth();
  if ('error' in auth) return { error: auth.error };
  const supabase = auth.supabase;

  const { data: sale, error } = await supabase
    .from('sales')
    .select(
      `
      *,
      product:products(name),
      client:clients(full_name, phone_number),
      installments(*)
    `
    )
    .eq('id', saleId)
    .single();

  if (error || !sale) {
    return { error: 'Sale not found' };
  }

  const receiptData: ReceiptData = {
    id: sale.id,
    date: sale.created_at,
    productName: (sale.product as unknown as { name: string }).name,
    clientName: (sale.client as unknown as { full_name: string }).full_name,
    clientPhone: (sale.client as unknown as { phone_number: string }).phone_number,
    paymentMethod: sale.payment_method,
    totalAmount: sale.total_amount,
    items: [{ name: (sale.product as unknown as { name: string }).name, quantity: 1, price: sale.total_amount }],
    installments: sale.installments?.map((i: { amount_due: number; due_date: string; is_paid: boolean }) => ({
      amount: i.amount_due,
      dueDate: i.due_date,
      isPaid: i.is_paid,
    })),
  };

  const html = generateReceiptHTML(receiptData);
  return { data: html };
}

export async function getMultiItemReceipt(saleIds: string[]): Promise<{ data?: string; error?: string }> {
  const auth = await requireAuth();
  if ('error' in auth) return { error: auth.error };
  const supabase = auth.supabase;

  const { data: sales, error } = await supabase
    .from('sales')
    .select(
      `
      *,
      product:products(name),
      client:clients(full_name, phone_number)
    `
    )
    .in('id', saleIds);

  if (error || !sales || sales.length === 0) {
    return { error: 'Sales not found' };
  }

  const client = sales[0].client as unknown as { full_name: string; phone_number: string };
  const firstSale = sales[0];
  const totalAmount = sales.reduce((sum, s) => sum + s.total_amount, 0);

  const receiptData: ReceiptData = {
    id: firstSale.id,
    date: firstSale.created_at,
    productName: sales.length === 1
      ? (firstSale.product as unknown as { name: string }).name
      : `${sales.length} items`,
    clientName: client.full_name,
    clientPhone: client.phone_number,
    paymentMethod: firstSale.payment_method,
    totalAmount,
    items: sales.map((s: typeof sales[number]) => ({
      name: (s.product as unknown as { name: string }).name,
      quantity: 1,
      price: s.total_amount,
    })),
    installments: [],
  };

  const html = generateReceiptHTML(receiptData);
  return { data: html };
}