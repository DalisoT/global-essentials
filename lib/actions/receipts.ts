'use server';

import { createServerSupabaseClient } from '@/lib/supabase-server';
import { generateReceiptHTML, type ReceiptData } from '@/lib/receipts/template';

export async function getSaleReceipt(saleId: string): Promise<{ data?: string; error?: string }> {
  const supabase = await createServerSupabaseClient();

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
    installments: sale.installments?.map((i: { amount_due: number; due_date: string; is_paid: boolean }) => ({
      amount: i.amount_due,
      dueDate: i.due_date,
      isPaid: i.is_paid,
    })),
  };

  const html = generateReceiptHTML(receiptData);
  return { data: html };
}